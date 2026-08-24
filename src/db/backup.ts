import { db } from './db'
import type {
  MetaRow,
  ReviewLogRow,
  SettingRow,
  StudyCard,
  StudySet,
} from './types'

export const BACKUP_FORMAT = 1

export interface Backup {
  format: number
  app: 'tori'
  exportedAt: string
  cards: StudyCard[]
  reviewLogs: ReviewLogRow[]
  studySets: StudySet[]
  settings: SettingRow[]
  meta: MetaRow[]
}

/**
 * Everything the user created: schedules, history, sets, and settings.
 * Items are not included because they are shipped with the app and would
 * quadruple the file for no gain.
 */
export async function exportBackup(): Promise<Backup> {
  const [cards, reviewLogs, studySets, settings, meta] = await Promise.all([
    db.cards.toArray(),
    db.reviewLogs.toArray(),
    db.studySets.toArray(),
    db.settings.toArray(),
    db.meta.toArray(),
  ])
  return {
    format: BACKUP_FORMAT,
    app: 'tori',
    exportedAt: new Date().toISOString(),
    cards,
    reviewLogs,
    studySets,
    settings,
    meta,
  }
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `tori-backup-${stamp}.json`
}

/** Dates survive JSON as strings, so they have to be rebuilt on the way in. */
function reviveCard(c: StudyCard): StudyCard {
  return {
    ...c,
    introducedAt: c.introducedAt ? new Date(c.introducedAt) : null,
    fsrs: {
      ...c.fsrs,
      due: new Date(c.fsrs.due),
      last_review: c.fsrs.last_review ? new Date(c.fsrs.last_review) : undefined,
    },
  }
}

export class BackupError extends Error {}

export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('That file is not valid JSON.')
  }
  const b = data as Partial<Backup>
  if (b.app !== 'tori')
    throw new BackupError('That backup was not made by Tori.')
  if (typeof b.format !== 'number' || b.format > BACKUP_FORMAT)
    throw new BackupError(
      'That backup came from a newer version of Tori. Update the app first.',
    )
  if (!Array.isArray(b.cards) || !Array.isArray(b.studySets))
    throw new BackupError('That backup is missing its cards.')
  return {
    format: b.format,
    app: 'tori',
    exportedAt: b.exportedAt ?? '',
    cards: b.cards,
    reviewLogs: b.reviewLogs ?? [],
    studySets: b.studySets ?? [],
    settings: b.settings ?? [],
    meta: b.meta ?? [],
  }
}

export interface ImportSummary {
  cards: number
  reviews: number
  sets: number
}

/**
 * Replaces local progress with the backup's. Items are left alone: the backup
 * restores what you did, not what the app ships with.
 */
export async function importBackup(backup: Backup): Promise<ImportSummary> {
  await db.transaction(
    'rw',
    db.cards,
    db.reviewLogs,
    db.studySets,
    db.settings,
    db.meta,
    async () => {
      await Promise.all([
        db.cards.clear(),
        db.reviewLogs.clear(),
        db.studySets.clear(),
        db.settings.clear(),
      ])
      await db.cards.bulkPut(backup.cards.map(reviveCard))
      await db.reviewLogs.bulkPut(
        backup.reviewLogs.map((l) => ({
          ...l,
          reviewedAt: new Date(l.reviewedAt),
        })),
      )
      await db.studySets.bulkPut(
        backup.studySets.map((s) => ({ ...s, createdAt: new Date(s.createdAt) })),
      )
      await db.settings.bulkPut(backup.settings)
      if (backup.meta.length) await db.meta.bulkPut(backup.meta)
    },
  )
  return {
    cards: backup.cards.length,
    reviews: backup.reviewLogs.length,
    sets: backup.studySets.length,
  }
}
