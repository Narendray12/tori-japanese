import { db } from './db'
import { setPreferredVoice, setSpeechRate } from '../features/review/tts'

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
  /** Playback speed for spoken Japanese. 1 is the voice's normal pace. */
  speechRate: number
  /** voiceURI of the chosen voice, or null to use the best one available. */
  voiceURI: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  desiredRetention: 0.9,
  newItemsPerDay: 10,
  lessonBatchSize: 5,
  typing: true,
  multipleChoice: true,
  listening: true,
  // Slower than conversational: you are trying to hear each mora.
  speechRate: 0.8,
  voiceURI: null,
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray()
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...stored }
}

/** Pushes the speech preferences into the TTS module, which speaks synchronously. */
export async function applySpeechSettings(): Promise<void> {
  const { speechRate, voiceURI } = await getSettings()
  setSpeechRate(speechRate)
  setPreferredVoice(voiceURI)
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await db.settings.put({ key, value })
}
