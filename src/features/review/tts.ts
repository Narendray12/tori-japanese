/**
 * Japanese text to speech through the browser's built-in voices. Free, offline
 * on iOS and macOS, and nothing to download. If the device has no Japanese
 * voice, listening cards are left out of the queue rather than played in an
 * accent that would teach the wrong pronunciation.
 */

let cached: SpeechSynthesisVoice | null | undefined

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  return voices.find((v) => v.lang.replace('_', '-').startsWith('ja')) ?? null
}

export function japaneseVoice(): SpeechSynthesisVoice | null {
  if (cached === undefined) cached = pickVoice()
  return cached
}

/** Voices load asynchronously in some browsers, so re-check once they arrive. */
export function watchVoices(onReady: (available: boolean) => void): () => void {
  if (typeof speechSynthesis === 'undefined') {
    onReady(false)
    return () => {}
  }
  const update = () => {
    cached = pickVoice()
    onReady(cached !== null)
  }
  update()
  speechSynthesis.addEventListener('voiceschanged', update)
  return () => speechSynthesis.removeEventListener('voiceschanged', update)
}

export function speakJapanese(text: string, rate = 0.85): void {
  const voice = japaneseVoice()
  if (!voice) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = rate
  speechSynthesis.speak(utterance)
}
