import type { GrammarItem } from '../../db/types'

export interface Cloze {
  before: string
  answer: string
  after: string
  translation: string
}

export const BLANK = '＿＿＿'

/**
 * Turns a grammar point plus one of its examples into a fill-in-the-blank.
 * The token to remove comes from the point's title: 〜てください gives てください,
 * which is then located in the sentence.
 *
 * Titles that name a category rather than a form (い形容詞, 助数詞) have no token
 * to blank, so they return null and the app skips cloze for that point.
 */
export function clozeTokens(title: string): string[] {
  const stripped = title
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[〜～]/g, '')
    .trim()
  if (!stripped) return []
  // Titles listing alternatives (〜たり〜たりする) yield several candidates.
  const parts = stripped
    .split(/[・、／\/]/)
    .map((p) => p.trim())
    .filter(Boolean)
  // Only kana/kanji tokens can be searched for in a sentence.
  return parts.filter((p) => /^[ぁ-んァ-ヶ一-龯]+$/.test(p))
}

export function buildCloze(item: GrammarItem): Cloze | null {
  const tokens = item.clozeToken
    ? [item.clozeToken]
    : clozeTokens(item.primary).sort((a, b) => b.length - a.length)
  if (!tokens.length) return null

  for (const example of item.examples) {
    for (const token of tokens) {
      // Blank the last occurrence: for particles the sentence-final use is
      // the one the grammar point is actually about.
      const at = example.jp.lastIndexOf(token)
      if (at === -1) continue
      // A one-character particle blanked at position 0 makes a guessing game.
      if (token.length === 1 && at === 0) continue
      return {
        before: example.jp.slice(0, at),
        answer: token,
        after: example.jp.slice(at + token.length),
        translation: example.en,
      }
    }
  }
  return null
}
