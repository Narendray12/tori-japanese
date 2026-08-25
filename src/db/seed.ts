import { createEmptyCard } from 'ts-fsrs'
import { db } from './db'
import {
  FACETS_BY_TYPE,
  type KanaItem,
  type GrammarItem,
  type Item,
  type KanjiItem,
  type StudyCard,
  type VocabItem,
} from './types'
import { buildPresets } from '../features/sets/presets'
import { KANJI_GROUP_OF, KANJI_ORDER } from '../data/kanjiOrder'
import { buildKanaRows, GROUP_LABEL } from '../data/kana'
import kanjiSeed from '../data/n5.kanji.json'
import vocabSeed from '../data/n5.vocab.json'
import grammarSeed from '../data/n5.grammar.json'

/** Bump when seed JSON shape or content changes in a way that requires re-seeding. */
export const SEED_VERSION = 6

function buildItems(): Item[] {
  const kana: KanaItem[] = buildKanaRows().map((k) => ({
    id: k.id,
    type: 'kana',
    primary: k.char,
    // The romaji is the answer, so it lives where every other item keeps it.
    meanings: [k.romaji],
    tags: [k.script, GROUP_LABEL[k.group]],
    orderIndex: k.orderIndex,
    romaji: k.romaji,
    script: k.script,
    row: k.row,
    kanaGroup: k.group,
  }))

  // Kanji are taught in curriculum order (numbers, then the calendar, and so
  // on), not the frequency order the source data ships in.
  const kanji: KanjiItem[] = (kanjiSeed as KanjiSeedRow[]).map((k) => ({
    id: k.id,
    type: 'kanji',
    primary: k.char,
    meanings: k.meanings,
    tags: [KANJI_GROUP_OF.get(k.char) ?? 'Other'],
    orderIndex: KANJI_ORDER.get(k.char) ?? 999,
    readingsOn: k.readingsOn,
    readingsKun: k.readingsKun,
    strokes: k.strokes,
    freq: k.freq,
  }))

  const vocab: VocabItem[] = (vocabSeed as VocabSeedRow[]).map((v, i) => ({
    id: v.id,
    type: 'vocab',
    primary: v.expression,
    meanings: v.meanings,
    tags: v.tags,
    orderIndex: i,
    reading: v.reading,
    kanjiUsed: v.kanjiUsed,
  }))

  const grammar: GrammarItem[] = (grammarSeed as GrammarSeedRow[]).map(
    (g, i) => ({
      id: g.id,
      type: 'grammar',
      primary: g.title,
      meanings: [g.meaning],
      tags: [],
      orderIndex: i,
      structure: g.structure,
      explanation: g.explanation,
      examples: g.examples,
      clozeToken: g.clozeToken,
    }),
  )

  return [...kana, ...kanji, ...vocab, ...grammar]
}

function buildCards(items: Item[]): StudyCard[] {
  return items.flatMap((item) =>
    FACETS_BY_TYPE[item.type].map((facet) => ({
      id: `${item.id}#${facet}`,
      itemId: item.id,
      itemType: item.type,
      facet,
      fsrs: createEmptyCard(new Date()),
      suspended: false,
      introduced: 0 as const,
      introducedAt: null,
    })),
  )
}

/**
 * Seeds the database on first run (or after a seed-version bump).
 * New items/cards are added; existing cards keep their review state.
 */
export async function seedIfNeeded(): Promise<void> {
  const seeded = await db.meta.get('seedVersion')
  if (seeded && Number(seeded.value) >= SEED_VERSION) return

  const items = buildItems()
  const cards = buildCards(items)
  const presets = buildPresets(items, new Date())

  await db.transaction(
    'rw',
    db.items,
    db.cards,
    db.studySets,
    db.meta,
    async () => {
      await db.items.bulkPut(items)
      // bulkAdd (not bulkPut) so existing FSRS state and set activation survive a re-seed.
      const existingCards = new Set(await db.cards.toCollection().primaryKeys())
      await db.cards.bulkAdd(cards.filter((c) => !existingCards.has(c.id)))
      // Preset contents are app-owned and get refreshed, but whether the user
      // turned a set on is theirs to keep.
      const existingSets = new Map(
        (await db.studySets.toArray()).map((s) => [s.id, s]),
      )
      await db.studySets.bulkPut(
        presets.map((s) => ({
          ...s,
          active: existingSets.get(s.id)?.active ?? 0,
        })),
      )
      await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
    },
  )
}

// Seed JSON row shapes (as produced by scripts/build-data.ts)
interface KanjiSeedRow {
  id: string
  char: string
  meanings: string[]
  readingsOn: string[]
  readingsKun: string[]
  strokes: number
  freq: number | null
  grade: number | null
}
interface VocabSeedRow {
  id: string
  expression: string
  reading: string
  meanings: string[]
  kanjiUsed: string[]
  tags: string[]
}
interface GrammarSeedRow {
  id: string
  title: string
  structure: string
  meaning: string
  explanation: string
  examples: { jp: string; en: string }[]
  clozeToken?: string
}
