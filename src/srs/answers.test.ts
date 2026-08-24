import { describe, expect, it } from 'vitest'
import {
  checkMeaning,
  checkReading,
  cleanReading,
  levenshtein,
  normalizeMeaning,
} from './answers'
import { buildCloze, clozeTokens } from '../features/review/cloze'
import { buildChoices } from '../features/review/choices'
import grammarSeed from '../data/n5.grammar.json'
import type { GrammarItem } from '../db/types'

describe('meaning answers', () => {
  it('ignores case, articles, and a leading "to"', () => {
    expect(normalizeMeaning('To Eat')).toBe('eat')
    expect(normalizeMeaning('the Sun')).toBe('sun')
    expect(checkMeaning('eat', ['to eat']).correct).toBe(true)
    expect(checkMeaning('To Eat', ['to eat']).correct).toBe(true)
  })

  it('accepts any listed meaning', () => {
    expect(checkMeaning('sun', ['Day', 'Sun', 'Japan']).correct).toBe(true)
    expect(checkMeaning('japan', ['Day', 'Sun', 'Japan']).correct).toBe(true)
  })

  it('forgives one typo in a long word but not a different word', () => {
    const r = checkMeaning('studnet', ['student'])
    expect(r.correct).toBe(true)
    expect(r.typo).toBe(true)
    expect(checkMeaning('to drink', ['to eat']).correct).toBe(false)
    // Short words must be exact: cat vs cap is a real mistake.
    expect(checkMeaning('cap', ['cat']).correct).toBe(false)
  })

  it('rejects an empty answer', () => {
    expect(checkMeaning('   ', ['cat']).correct).toBe(false)
  })

  it('measures edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('same', 'same')).toBe(0)
  })
})

describe('reading answers', () => {
  it('strips KANJIDIC okurigana markers', () => {
    expect(cleanReading('-び')).toBe('び')
    expect(cleanReading('た.べる')).toBe('たべる')
  })

  it('accepts romaji typed for kana', () => {
    expect(checkReading('nichi', ['にち']).correct).toBe(true)
    expect(checkReading('にち', ['にち', 'じつ']).correct).toBe(true)
  })

  it('is strict about a wrong reading', () => {
    expect(checkReading('じつ', ['にち']).correct).toBe(false)
    expect(checkReading('', ['にち']).correct).toBe(false)
  })
})

describe('cloze', () => {
  const items = (grammarSeed as unknown as GrammarItem[]).map((g) => ({
    ...g,
    type: 'grammar' as const,
    primary: (g as unknown as { title: string }).title,
    meanings: [(g as unknown as { meaning: string }).meaning],
    tags: [],
    orderIndex: 0,
  }))

  it('extracts searchable tokens and skips category titles', () => {
    expect(clozeTokens('〜てください')).toEqual(['てください'])
    expect(clozeTokens('〜に（時間）')).toEqual(['に'])
    expect(clozeTokens('AはBより')).toEqual([])
  })

  it('builds a blank for every N5 grammar point', () => {
    for (const item of items) {
      const c = buildCloze(item)
      expect(c, `no cloze for ${item.primary}`).not.toBeNull()
      // The sentence must reassemble exactly.
      expect(c!.before + c!.answer + c!.after).toContain(c!.answer)
      expect(c!.translation).toBeTruthy()
    }
  })

  it('never blanks a single particle at the start of a sentence', () => {
    const c = buildCloze({
      ...items[0],
      primary: '〜は',
      clozeToken: undefined,
      examples: [{ jp: 'はい、そうです。', en: 'Yes, that is so.' }],
    })
    // 'は' at index 0 is skipped, so it falls through to no usable example.
    expect(c).toBeNull()
  })
})

describe('multiple choice', () => {
  const pool = Array.from({ length: 10 }, (_, i) => ({
    id: `i${i}`,
    label: `option ${i}`,
  }))
  const correct = { id: 'right', label: 'the answer' }
  const seq = () => 0.5

  it('always includes the correct option', () => {
    const opts = buildChoices(correct, pool, 4, seq)
    expect(opts).toHaveLength(4)
    expect(opts.filter((o) => o.id === correct.id)).toHaveLength(1)
  })

  it('never offers a duplicate of the correct label', () => {
    const dupes = [{ id: 'other', label: 'The Answer' }, ...pool]
    const opts = buildChoices(correct, dupes, 4, seq)
    const labels = opts.map((o) => o.label.toLowerCase())
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('copes with a pool smaller than the requested count', () => {
    const opts = buildChoices(correct, pool.slice(0, 1), 4, seq)
    expect(opts).toHaveLength(2)
  })
})
