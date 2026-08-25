import type { Facet, ItemType } from '../../db/types'

export type QuizMode =
  | 'flip' // read it, judge yourself
  | 'type-kana' // type the Japanese
  | 'type-meaning' // type the English
  | 'choice' // pick from four
  | 'listen' // hear it, then pick the meaning

export interface QuizSettings {
  typing: boolean
  multipleChoice: boolean
  listening: boolean
}

/** The interaction each facet wants when every mode is switched on. */
const PREFERRED: Record<Facet, QuizMode> = {
  meaning: 'choice',
  reading: 'type-kana',
  recognition: 'choice',
  recall: 'type-kana',
  listening: 'listen',
  cloze: 'type-kana',
}

/**
 * Kana invert two of those. Reading か means saying "ka", which is typed in
 * the Latin alphabet, and recalling "ka" means producing か, which is typed
 * with the kana IME.
 */
const KANA_PREFERRED: Partial<Record<Facet, QuizMode>> = {
  reading: 'type-meaning',
  recall: 'type-kana',
}

/**
 * Picks how to ask a card, falling back to a plain flip whenever the preferred
 * mode is switched off or unsupported. Every facet stays reviewable no matter
 * which modes the user disables.
 */
export function resolveMode(
  facet: Facet,
  settings: QuizSettings,
  ttsAvailable: boolean,
  itemType: ItemType = 'kanji',
): QuizMode {
  const preferred =
    (itemType === 'kana' ? KANA_PREFERRED[facet] : undefined) ?? PREFERRED[facet]
  if (preferred === 'choice' && !settings.multipleChoice) return 'flip'
  if (
    (preferred === 'type-kana' || preferred === 'type-meaning') &&
    !settings.typing
  )
    return 'flip'
  if (preferred === 'listen') {
    if (!settings.listening || !ttsAvailable) return 'flip'
    // Hearing a word and picking its meaning needs the choice UI.
    return settings.multipleChoice ? 'listen' : 'flip'
  }
  return preferred
}

/**
 * Facets worth scheduling. Listening only counts when the device can actually
 * speak Japanese, otherwise those cards would be unanswerable.
 */
export function enabledFacets(
  settings: QuizSettings,
  ttsAvailable: boolean,
): Set<Facet> {
  const facets: Facet[] = ['meaning', 'reading', 'recognition', 'recall', 'cloze']
  if (settings.listening && ttsAvailable) facets.push('listening')
  return new Set(facets)
}
