import { describe, expect, it } from 'vitest'
import { filterItems, idsBetween, matchesQuery } from './search'
import { buildPresets } from '../sets/presets'
import type { Item, KanjiItem, VocabItem } from '../../db/types'

const neko: VocabItem = {
  id: 'vocab:猫:ねこ',
  type: 'vocab',
  primary: '猫',
  meanings: ['cat'],
  tags: [],
  orderIndex: 0,
  reading: 'ねこ',
  kanjiUsed: [],
}

const hi: KanjiItem = {
  id: 'kanji:日',
  type: 'kanji',
  primary: '日',
  meanings: ['Day', 'Sun'],
  tags: [],
  orderIndex: 0,
  readingsOn: ['にち', 'じつ'],
  readingsKun: ['ひ'],
  strokes: 4,
  freq: 1,
}

describe('search', () => {
  it('matches English meanings case-insensitively', () => {
    expect(matchesQuery(neko, 'cat')).toBe(true)
    expect(matchesQuery(hi, 'sun')).toBe(true)
    expect(matchesQuery(neko, 'dog')).toBe(false)
  })

  it('matches kana typed as romaji', () => {
    expect(matchesQuery(neko, 'neko')).toBe(true)
    expect(matchesQuery(hi, 'nichi')).toBe(true)
  })

  it('matches kana and kanji directly', () => {
    expect(matchesQuery(neko, 'ねこ')).toBe(true)
    expect(matchesQuery(neko, '猫')).toBe(true)
  })

  it('an empty query matches everything', () => {
    expect(matchesQuery(neko, '   ')).toBe(true)
  })

  it('filters by learned state', () => {
    const items: Item[] = [neko, hi]
    const learned = new Set([neko.id])
    expect(filterItems(items, '', 'learned', learned)).toEqual([neko])
    expect(filterItems(items, '', 'new', learned)).toEqual([hi])
    expect(filterItems(items, '', 'all', learned)).toHaveLength(2)
  })

  it('selects an inclusive range in either direction', () => {
    const items = [neko, hi, { ...hi, id: 'kanji:一' }] as Item[]
    expect(idsBetween(items, 0, 1)).toEqual([neko.id, hi.id])
    expect(idsBetween(items, 2, 1)).toEqual([hi.id, 'kanji:一'])
  })
})

describe('presets', () => {
  const items: Item[] = [
    ...Array.from({ length: 25 }, (_, i) => ({
      ...hi,
      id: `kanji:${i}`,
      primary: i < 14 ? '一二三四五六七八九十百千万円'[i] : '猫',
      orderIndex: i,
    })),
    { ...neko, id: 'vocab:食べる', meanings: ['to eat'] },
    { ...neko, id: 'vocab:猫2', meanings: ['cat'] },
    {
      id: 'grammar:wa',
      type: 'grammar',
      primary: '〜は',
      meanings: ['topic marker'],
      tags: [],
      orderIndex: 0,
      structure: 'Noun + は',
      explanation: 'x',
      examples: [],
    },
  ]
  const presets = buildPresets(items, new Date('2026-08-24'))

  it('creates themed kanji groups, batches, verb and particle sets', () => {
    const ids = presets.map((p) => p.id)
    expect(ids).toContain('preset:kanji-group-1')
    expect(ids).toContain('preset:kanji-batch-1')
    expect(ids).toContain('preset:verbs')
    expect(ids).toContain('preset:particles')
  })

  it('names the first kanji group after the numbers it teaches', () => {
    const first = presets.find((p) => p.id === 'preset:kanji-group-1')!
    expect(first.name).toBe('1. Numbers')
  })

  it('batches ten kanji each, in teaching order', () => {
    const batch1 = presets.find((p) => p.id === 'preset:kanji-batch-1')!
    expect(batch1.itemIds).toHaveLength(10)
    expect(batch1.name).toBe('Kanji 1-10')
  })

  it('only picks verbs whose meaning starts with "to "', () => {
    const verbs = presets.find((p) => p.id === 'preset:verbs')!
    expect(verbs.itemIds).toEqual(['vocab:食べる'])
  })

  it('ships every preset inactive so the default scope is everything', () => {
    expect(presets.every((p) => p.active === 0)).toBe(true)
    expect(presets.every((p) => p.preset === 1)).toBe(true)
  })
})
