import { describe, expect, it } from 'vitest'
import { KANJI_GROUPS, KANJI_ORDER } from './kanjiOrder'
import kanji from './n5.kanji.json'

const dataset = kanji.map((k) => k.char)

describe('kanji teaching order', () => {
  it('covers every N5 kanji in the dataset', () => {
    const missing = dataset.filter((c) => !KANJI_ORDER.has(c))
    expect(missing, `not in the teaching order: ${missing.join('')}`).toEqual([])
  })

  it('does not invent characters the dataset lacks', () => {
    const inOrder = KANJI_GROUPS.flatMap((g) => g.chars)
    const extra = inOrder.filter((c) => !dataset.includes(c))
    expect(extra, `ordered but not in the data: ${extra.join('')}`).toEqual([])
  })

  it('lists each character exactly once', () => {
    const all = KANJI_GROUPS.flatMap((g) => g.chars)
    const dupes = all.filter((c, i) => all.indexOf(c) !== i)
    expect(dupes, `listed twice: ${dupes.join('')}`).toEqual([])
    expect(all).toHaveLength(dataset.length)
  })

  it('starts with the numbers one through ten', () => {
    const first10 = KANJI_GROUPS[0].chars.slice(0, 10).join('')
    expect(first10).toBe('一二三四五六七八九十')
    expect(KANJI_ORDER.get('一')).toBe(0)
  })

  it('teaches the weekday kanji as one block', () => {
    const week = [...'日月火水木金土'].map((c) => KANJI_ORDER.get(c)!)
    const contiguous = week.every((n, i) => i === 0 || n === week[i - 1] + 1)
    expect(contiguous).toBe(true)
  })
})
