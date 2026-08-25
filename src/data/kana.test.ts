import { describe, expect, it } from 'vitest'
import { toHiragana, toKatakana } from 'wanakana'
import { buildKanaRows, KANA } from './kana'

const rows = buildKanaRows()

describe('kana table', () => {
  it('has the expected number of syllables', () => {
    // 46 plain + 25 voiced + 33 small-ya combinations
    expect(KANA.filter((k) => k.group === 'gojuon')).toHaveLength(46)
    expect(KANA.filter((k) => k.group === 'dakuten')).toHaveLength(25)
    expect(KANA.filter((k) => k.group === 'yoon')).toHaveLength(33)
    expect(rows).toHaveLength(KANA.length * 2)
  })

  it('starts with あいうえお and ends with the katakana combinations', () => {
    expect(rows.slice(0, 5).map((r) => r.char).join('')).toBe('あいうえお')
    expect(rows[0].romaji).toBe('a')
    expect(rows.at(-1)!.script).toBe('katakana')
  })

  it('teaches all of hiragana before any katakana', () => {
    const firstKatakana = rows.findIndex((r) => r.script === 'katakana')
    expect(rows.slice(0, firstKatakana).every((r) => r.script === 'hiragana')).toBe(true)
    expect(firstKatakana).toBe(KANA.length)
  })

  it('never repeats a character', () => {
    const chars = rows.map((r) => r.char)
    const dupes = chars.filter((c, i) => chars.indexOf(c) !== i)
    expect(dupes, `repeated: ${dupes.join(' ')}`).toEqual([])
  })

  it('pairs each hiragana with the katakana of the same sound', () => {
    for (const entry of KANA) {
      expect(toKatakana(entry.hiragana), entry.romaji).toBe(entry.katakana)
      expect(toHiragana(entry.katakana), entry.romaji).toBe(entry.hiragana)
    }
  })

  it('romaji round-trips back to the same kana', () => {
    // Skips the pairs Japanese spells two ways: ぢ/じ and づ/ず.
    const ambiguous = new Set(['ぢ', 'づ', 'ヂ', 'ヅ'])
    for (const row of rows) {
      if (ambiguous.has(row.char)) continue
      const expected = row.script === 'hiragana' ? row.char : toHiragana(row.char)
      expect(toHiragana(row.romaji), `${row.char} = ${row.romaji}`).toBe(expected)
    }
  })

  it('spells the irregular syllables the way people write them', () => {
    const find = (r: string) => KANA.find((k) => k.romaji === r)
    expect(find('shi')?.hiragana).toBe('し')
    expect(find('chi')?.hiragana).toBe('ち')
    expect(find('tsu')?.hiragana).toBe('つ')
    expect(find('fu')?.hiragana).toBe('ふ')
    expect(find('sha')?.hiragana).toBe('しゃ')
    expect(find('ja')?.hiragana).toBe('じゃ')
    expect(find('kya')?.hiragana).toBe('きゃ')
  })

  it('gives every row a stable id', () => {
    expect(rows.find((r) => r.char === 'ア')?.id).toBe('kana:ア')
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
  })
})
