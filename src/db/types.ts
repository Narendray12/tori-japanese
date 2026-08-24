import type { Card as FsrsCard } from 'ts-fsrs'

export type ItemType = 'kanji' | 'vocab' | 'grammar'

/** One testable facet of an item. Each facet gets its own scheduled card. */
export type Facet =
  | 'meaning' // kanji → meanings, grammar → meaning
  | 'reading' // kanji → readings
  | 'recognition' // vocab JP → EN
  | 'recall' // vocab EN → JP
  | 'listening' // vocab audio → meaning
  | 'cloze' // grammar fill-in-the-blank

interface BaseItem {
  id: string
  type: ItemType
  /** The headline content: 日 / 会う / 〜てください */
  primary: string
  meanings: string[]
  tags: string[]
  /** Default learning order within its type (0-based). */
  orderIndex: number
}

export interface KanjiItem extends BaseItem {
  type: 'kanji'
  readingsOn: string[]
  readingsKun: string[]
  strokes: number
  freq: number | null
}

export interface VocabItem extends BaseItem {
  type: 'vocab'
  reading: string
  /** N5 kanji characters used in the expression (for cross-linking). */
  kanjiUsed: string[]
}

export interface GrammarItem extends BaseItem {
  type: 'grammar'
  structure: string
  explanation: string
  examples: { jp: string; en: string }[]
  /**
   * The exact string a fill-in-the-blank card should hide. Set only where the
   * point's title names a category (い形容詞) rather than a form we can find
   * in the sentence on our own.
   */
  clozeToken?: string
}

export type Item = KanjiItem | VocabItem | GrammarItem

/** A scheduled card: FSRS state for one facet of one item. */
export interface StudyCard {
  id: string // `${itemId}#${facet}`
  itemId: string
  itemType: ItemType
  facet: Facet
  fsrs: FsrsCard
  suspended: boolean
  /** 1 once the item has been taught in a lesson; only introduced cards enter the queue. */
  introduced: 0 | 1
  introducedAt: Date | null
}

export interface ReviewLogRow {
  id?: number
  cardId: string
  itemId: string
  rating: number // ts-fsrs Rating (1=Again 2=Hard 3=Good 4=Easy)
  reviewedAt: Date
  /** ms the user spent before answering */
  elapsedMs: number
  stateBefore: number
  stateAfter: number
  stability: number
  difficulty: number
}

export type SetGroup = 'Your sets' | 'Kanji' | 'Vocabulary' | 'Grammar'

/** Order the Sets screen lists the groups in. */
export const SET_GROUPS: SetGroup[] = [
  'Your sets',
  'Kanji',
  'Vocabulary',
  'Grammar',
]

export interface StudySet {
  id: string
  name: string
  /** One line on the card explaining what this set covers. */
  description: string
  /** Heading this set files under on the Sets screen. */
  group: SetGroup
  itemIds: string[]
  /** 0/1 because IndexedDB cannot index booleans. Active sets scope the queue. */
  active: 0 | 1
  /** 1 for sets shipped with the app; they can be deactivated but not deleted. */
  preset: 0 | 1
  createdAt: Date
}

export interface SettingRow {
  key: string
  value: unknown
}

export interface MetaRow {
  key: string
  value: string | number
}

/** Which facets each item type generates cards for. */
export const FACETS_BY_TYPE: Record<ItemType, Facet[]> = {
  kanji: ['meaning', 'reading'],
  vocab: ['recognition', 'recall', 'listening'],
  grammar: ['meaning', 'cloze'],
}
