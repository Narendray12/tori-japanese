import { describe, expect, it } from 'vitest'
import kanji from './n5.kanji.json'
import vocab from './n5.vocab.json'
import grammar from './n5.grammar.json'

describe('N5 seed data', () => {
  it('has the full kanji set with required fields', () => {
    expect(kanji.length).toBeGreaterThanOrEqual(79)
    for (const k of kanji) {
      expect(k.id).toMatch(/^kanji:.$/)
      expect(k.meanings.length).toBeGreaterThan(0)
      expect(k.readingsOn.length + k.readingsKun.length).toBeGreaterThan(0)
      expect(k.strokes).toBeGreaterThan(0)
    }
  })

  it('has the vocab set with readings and meanings', () => {
    expect(vocab.length).toBeGreaterThanOrEqual(600)
    const ids = new Set<string>()
    for (const v of vocab) {
      expect(ids.has(v.id), `duplicate id ${v.id}`).toBe(false)
      ids.add(v.id)
      expect(v.expression).toBeTruthy()
      expect(v.reading).toBeTruthy()
      expect(v.meanings.length).toBeGreaterThan(0)
    }
  })

  it('has grammar points with structures and bilingual examples', () => {
    expect(grammar.length).toBeGreaterThanOrEqual(50)
    for (const g of grammar) {
      expect(g.id).toMatch(/^grammar:[a-z0-9-]+$/)
      expect(g.structure).toBeTruthy()
      expect(g.explanation.length).toBeGreaterThan(20)
      expect(g.examples.length).toBeGreaterThanOrEqual(2)
      for (const ex of g.examples) {
        expect(ex.jp).toMatch(/[ぁ-んァ-ン一-龯]/)
        expect(ex.en).toBeTruthy()
      }
    }
  })

  it('vocab kanjiUsed only references N5 kanji', () => {
    const chars = new Set(kanji.map((k) => k.char))
    for (const v of vocab) {
      for (const c of v.kanjiUsed) expect(chars.has(c)).toBe(true)
    }
  })
})
