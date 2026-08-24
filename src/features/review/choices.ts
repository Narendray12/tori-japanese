/**
 * Multiple-choice option building. Distractors come from the same item type
 * and never repeat the right answer, so a question is always answerable and
 * never has two correct options.
 */
export interface ChoiceSource {
  id: string
  label: string
}

export function buildChoices(
  correct: ChoiceSource,
  pool: ChoiceSource[],
  count: number,
  /** 0..1, injected so tests are deterministic. */
  random: () => number = Math.random,
): ChoiceSource[] {
  const seen = new Set([correct.label.toLowerCase()])
  const candidates: ChoiceSource[] = []
  for (const c of pool) {
    if (c.id === correct.id) continue
    const key = c.label.toLowerCase()
    if (!c.label.trim() || seen.has(key)) continue
    seen.add(key)
    candidates.push(c)
  }

  // Fisher-Yates over a copy, using the injected source of randomness.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const options = [correct, ...candidates.slice(0, Math.max(0, count - 1))]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return options
}
