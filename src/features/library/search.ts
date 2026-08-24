import { toHiragana } from 'wanakana'
import type { Item } from '../../db/types'

export type LearnedFilter = 'all' | 'learned' | 'new'

/** Everything about an item that a query can match. */
function haystack(item: Item): string[] {
  const fields = [item.primary, ...item.meanings]
  if (item.type === 'vocab') fields.push(item.reading)
  if (item.type === 'kanji') fields.push(...item.readingsOn, ...item.readingsKun)
  if (item.type === 'grammar') fields.push(item.structure)
  return fields
}

/**
 * Matches a query against an item. Typing romaji ("neko", "taberu") also
 * matches kana, so the user never has to switch keyboards to search.
 */
export function matchesQuery(item: Item, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const kana = toHiragana(q, { passRomaji: false })
  const fields = haystack(item)
  return fields.some((f) => {
    const lower = f.toLowerCase()
    return lower.includes(q) || (kana !== q && lower.includes(kana))
  })
}

export function filterItems(
  items: Item[],
  query: string,
  learned: LearnedFilter,
  learnedIds: ReadonlySet<string>,
): Item[] {
  return items.filter((item) => {
    if (learned === 'learned' && !learnedIds.has(item.id)) return false
    if (learned === 'new' && learnedIds.has(item.id)) return false
    return matchesQuery(item, query)
  })
}

/** Range-select support: the ids between two indices, inclusive. */
export function idsBetween(items: Item[], a: number, b: number): string[] {
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  return items.slice(lo, hi + 1).map((i) => i.id)
}
