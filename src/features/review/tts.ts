/**
 * Japanese text to speech through the browser's built-in voices. Free, offline
 * on iOS and macOS, and nothing to download.
 *
 * Picking a voice matters more than it looks. Apple ships proper Japanese
 * voices (Kyoko, Otoya) alongside a set of novelty character voices (Eddy,
 * Flo, Rocko and friends) that are fine for a joke and poor for study.
 * getVoices() returns them in an arbitrary order, so taking the first match
 * lands on whichever the platform happens to list first.
 */

/** Apple's real Japanese voices, best first. */
const PREFERRED_NAMES = ['kyoko', 'otoya', 'hattori', 'o-ren']

/** Apple's character voices: never auto-selected for study. */
const NOVELTY_NAMES = [
  'eddy',
  'flo',
  'grandma',
  'grandpa',
  'reed',
  'rocko',
  'sandy',
  'shelley',
  'bubbles',
  'jester',
  'organ',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'bells',
  'boing',
  'bad news',
  'good news',
]

export function isJapanese(v: SpeechSynthesisVoice): boolean {
  return v.lang.replace('_', '-').toLowerCase().startsWith('ja')
}

/** Higher scores win. Quality first, then a real voice over a novelty one. */
export function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase()
  let score = 0
  const preferred = PREFERRED_NAMES.findIndex((n) => name.includes(n))
  if (preferred >= 0) score += 100 - preferred * 10
  if (NOVELTY_NAMES.some((n) => name.includes(n))) score -= 100
  // Apple labels its better downloads this way; they are a real step up.
  if (name.includes('premium')) score += 40
  else if (name.includes('enhanced')) score += 30
  else if (name.includes('siri')) score += 25
  if (name.includes('compact')) score -= 15
  // A local voice keeps working on a plane.
  if (v.localService) score += 10
  return score
}

export function rankJapaneseVoices(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice[] {
  return voices
    .filter(isJapanese)
    .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name))
}

export function japaneseVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return []
  return rankJapaneseVoices(speechSynthesis.getVoices())
}

let preferredUri: string | null = null

/** Remembers the voice chosen in settings, or null to use the best available. */
export function setPreferredVoice(uri: string | null): void {
  preferredUri = uri
}

export function japaneseVoice(): SpeechSynthesisVoice | null {
  const voices = japaneseVoices()
  if (!voices.length) return null
  if (preferredUri) {
    const chosen = voices.find((v) => v.voiceURI === preferredUri)
    if (chosen) return chosen
  }
  return voices[0]
}

/** Voices load asynchronously in some browsers, so re-check once they arrive. */
export function watchVoices(onReady: (available: boolean) => void): () => void {
  if (typeof speechSynthesis === 'undefined') {
    onReady(false)
    return () => {}
  }
  const update = () => onReady(japaneseVoices().length > 0)
  update()
  speechSynthesis.addEventListener('voiceschanged', update)
  return () => speechSynthesis.removeEventListener('voiceschanged', update)
}

let speechRate = 0.8

export function setSpeechRate(rate: number): void {
  speechRate = rate
}

export function getSpeechRate(): number {
  return speechRate
}

export function speakJapanese(text: string, rate = speechRate): void {
  const voice = japaneseVoice()
  if (!voice) return
  // Cancelling in the same tick as speak() makes WebKit drop the utterance
  // settings, so only clear a queue that is actually busy.
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = rate
  utterance.pitch = 1
  speechSynthesis.speak(utterance)
}
