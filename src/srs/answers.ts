import { toHiragana } from 'wanakana'

/**
 * Answer checking for typed responses. Grading has to be forgiving about
 * spelling and strict about meaning: "to eat" and "eat" are the same answer,
 * "to eat" and "to drink" are not.
 */

/** KANJIDIC readings carry okurigana markers (-び, 食.べる) that users never type. */
export function cleanReading(reading: string): string {
  return toHiragana(
    reading
      .replace(/[.\-‐−ー－]/g, (m) => (m === 'ー' ? 'ー' : ''))
      .trim()
      .toLowerCase(),
  )
}

export function normalizeMeaning(meaning: string): string {
  return meaning
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/^(to|a|an|the)\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Damerau-Levenshtein (optimal string alignment): counts a swap of two
 * neighbouring letters as one edit, because "studnet" for "student" is the
 * typo people actually make.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/** One typo is forgiven on longer words, none on short ones. */
function closeEnough(input: string, target: string): boolean {
  if (input === target) return true
  if (target.length < 5) return false
  return levenshtein(input, target) <= 1
}

export interface AnswerCheck {
  correct: boolean
  /** Set when the answer was accepted despite a small spelling slip. */
  typo?: boolean
}

export function checkMeaning(input: string, accepted: string[]): AnswerCheck {
  const given = normalizeMeaning(input)
  if (!given) return { correct: false }
  const targets = accepted.map(normalizeMeaning).filter(Boolean)
  if (targets.some((t) => t === given)) return { correct: true }
  // Multi-word meanings: accept any comma-free alternative the entry lists.
  if (targets.some((t) => closeEnough(given, t)))
    return { correct: true, typo: true }
  return { correct: false }
}

/** Readings must be exact once normalized: a wrong kana is a wrong reading. */
export function checkReading(input: string, accepted: string[]): AnswerCheck {
  const given = cleanReading(input)
  if (!given) return { correct: false }
  return {
    correct: accepted.map(cleanReading).filter(Boolean).includes(given),
  }
}
