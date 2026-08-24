import { db } from './db'

export interface AppSettings {
  /** FSRS target recall probability at review time. */
  desiredRetention: number
  /** Max new items (not cards) introduced via lessons per day. */
  newItemsPerDay: number
  /** Items taught per lesson batch before the mini-quiz. */
  lessonBatchSize: number
  /** Type the answer instead of grading yourself. */
  typing: boolean
  /** Offer four options instead of grading yourself. */
  multipleChoice: boolean
  /** Schedule cards that play the word and ask what it means. */
  listening: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  desiredRetention: 0.9,
  newItemsPerDay: 10,
  lessonBatchSize: 5,
  typing: true,
  multipleChoice: true,
  listening: true,
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray()
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await db.settings.put({ key, value })
}
