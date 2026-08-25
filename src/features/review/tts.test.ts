import { describe, expect, it } from 'vitest'
import { isJapanese, rankJapaneseVoices, scoreVoice } from './tts'

function voice(
  name: string,
  lang = 'ja-JP',
  localService = true,
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    localService,
    default: false,
    voiceURI: name,
  } as SpeechSynthesisVoice
}

// The list macOS actually reports, in the order `say -v '?'` prints it.
const macVoices = [
  voice('Eddy (Japanese (Japan))'),
  voice('Flo (Japanese (Japan))'),
  voice('Grandma (Japanese (Japan))'),
  voice('Grandpa (Japanese (Japan))'),
  voice('Kyoko'),
  voice('Reed (Japanese (Japan))'),
  voice('Rocko (Japanese (Japan))'),
  voice('Sandy (Japanese (Japan))'),
  voice('Shelley (Japanese (Japan))'),
]

describe('voice selection', () => {
  it('picks Kyoko over the novelty voices listed before her', () => {
    // Taking the first Japanese voice would land on Eddy. That was the bug.
    expect(rankJapaneseVoices(macVoices)[0].name).toBe('Kyoko')
  })

  it('ranks every novelty voice below the real one', () => {
    const ranked = rankJapaneseVoices(macVoices)
    expect(ranked.at(-1)!.name).not.toBe('Kyoko')
    expect(scoreVoice(voice('Kyoko'))).toBeGreaterThan(
      scoreVoice(voice('Rocko (Japanese (Japan))')),
    )
  })

  it('prefers a downloaded high quality voice over the compact default', () => {
    const ranked = rankJapaneseVoices([
      voice('Kyoko'),
      voice('Kyoko (Premium)'),
      voice('Kyoko (Enhanced)'),
    ])
    expect(ranked.map((v) => v.name)).toEqual([
      'Kyoko (Premium)',
      'Kyoko (Enhanced)',
      'Kyoko',
    ])
  })

  it('prefers an offline voice over one that needs the network', () => {
    expect(scoreVoice(voice('Otoya', 'ja-JP', true))).toBeGreaterThan(
      scoreVoice(voice('Otoya', 'ja-JP', false)),
    )
  })

  it('keeps only Japanese voices, however the locale is written', () => {
    expect(isJapanese(voice('Kyoko', 'ja_JP'))).toBe(true)
    expect(isJapanese(voice('Kyoko', 'ja-JP'))).toBe(true)
    expect(isJapanese(voice('Samantha', 'en-US'))).toBe(false)
    expect(rankJapaneseVoices([voice('Samantha', 'en-US')])).toEqual([])
  })
})
