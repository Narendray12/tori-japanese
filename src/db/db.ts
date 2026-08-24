import Dexie, { type Table } from 'dexie'
import type {
  Item,
  StudyCard,
  ReviewLogRow,
  StudySet,
  SettingRow,
  MetaRow,
} from './types'

export class ToriDB extends Dexie {
  items!: Table<Item, string>
  cards!: Table<StudyCard, string>
  reviewLogs!: Table<ReviewLogRow, number>
  studySets!: Table<StudySet, string>
  settings!: Table<SettingRow, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('tori')
    this.version(1).stores({
      items: 'id, type, orderIndex, *tags',
      cards: 'id, itemId, itemType, facet, fsrs.due, fsrs.state, suspended',
      reviewLogs: '++id, cardId, itemId, reviewedAt',
      studySets: 'id, name, active',
      settings: 'key',
      meta: 'key',
    })
    // v2: lesson flow. Cards stay out of the queue until their item
    // has been introduced (taught). 0/1 instead of boolean: IndexedDB
    // cannot index booleans.
    this.version(2)
      .stores({
        items: 'id, type, orderIndex, *tags',
        cards:
          'id, itemId, itemType, facet, fsrs.due, fsrs.state, suspended, introduced, introducedAt',
        reviewLogs: '++id, cardId, itemId, reviewedAt',
        studySets: 'id, name, active',
        settings: 'key',
        meta: 'key',
      })
      .upgrade((tx) =>
        tx
          .table('cards')
          .toCollection()
          .modify((c) => {
            c.introduced = 0
            c.introducedAt = null
          }),
      )
    // v3: study sets gain a preset flag and a 0/1 active flag so both can be indexed.
    this.version(3).stores({
      items: 'id, type, orderIndex, *tags',
      cards:
        'id, itemId, itemType, facet, fsrs.due, fsrs.state, suspended, introduced, introducedAt',
      reviewLogs: '++id, cardId, itemId, reviewedAt',
      studySets: 'id, name, active, preset',
      settings: 'key',
      meta: 'key',
    })
  }
}

export const db = new ToriDB()
