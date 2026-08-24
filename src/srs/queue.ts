import { db } from '../db/db'
import { getSettings } from '../db/settings'
import { enabledFacets } from '../features/review/quizMode'
import type { Facet, Item, ItemType, StudyCard, StudySet } from '../db/types'

/**
 * Every facet the review UI can render. Which of these actually get scheduled
 * depends on the user's quiz-mode settings and whether the device can speak
 * Japanese, resolved per call by enabledFacets().
 */
export const ACTIVE_FACETS: ReadonlySet<Facet> = new Set([
  'meaning',
  'reading',
  'recognition',
  'recall',
  'cloze',
  'listening',
])

/** The facets to schedule right now, given settings and device support. */
export async function currentFacets(ttsAvailable: boolean): Promise<Set<Facet>> {
  return enabledFacets(await getSettings(), ttsAvailable)
}

/** Local-midnight day boundary. (A configurable 4am cutoff can come later.) */
export function startOfLocalDay(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * The set of item ids the user is currently studying, or null for "everything".
 * Null (no active sets) is the default so the app works before any set exists.
 */
export type Scope = ReadonlySet<string> | null

export function inScope(itemId: string, scope: Scope): boolean {
  return scope === null || scope.has(itemId)
}

/** Union of the item ids of all active sets. */
export function scopeFromSets(sets: StudySet[]): Scope {
  const active = sets.filter((s) => s.active === 1)
  if (active.length === 0) return null
  return new Set(active.flatMap((s) => s.itemIds))
}

export async function getActiveScope(): Promise<Scope> {
  return scopeFromSets(await db.studySets.where('active').equals(1).toArray())
}

export function isQueueable(
  card: StudyCard,
  now: Date,
  scope: Scope = null,
  facets: ReadonlySet<Facet> = ACTIVE_FACETS,
): boolean {
  return (
    card.introduced === 1 &&
    !card.suspended &&
    facets.has(card.facet) &&
    inScope(card.itemId, scope) &&
    new Date(card.fsrs.due).getTime() <= now.getTime()
  )
}

/** Most-overdue first, so a backlog drains oldest-first. */
export function orderQueue(cards: StudyCard[]): StudyCard[] {
  return [...cards].sort(
    (a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime(),
  )
}

/**
 * Round-robin across types so a lesson batch isn't ten kanji in a row.
 * Within each type, items come in orderIndex (frequency/curriculum) order.
 */
export function interleaveByType(items: Item[], budget: number): Item[] {
  const byType = new Map<ItemType, Item[]>()
  for (const it of items) {
    if (!byType.has(it.type)) byType.set(it.type, [])
    byType.get(it.type)!.push(it)
  }
  for (const list of byType.values())
    list.sort((a, b) => a.orderIndex - b.orderIndex)

  const order: ItemType[] = ['kanji', 'vocab', 'grammar']
  const picked: Item[] = []
  let exhausted = false
  while (picked.length < budget && !exhausted) {
    exhausted = true
    for (const t of order) {
      const list = byType.get(t)
      if (list?.length && picked.length < budget) {
        picked.push(list.shift()!)
        exhausted = false
      }
    }
  }
  return picked
}

export async function getDueCards(
  now: Date,
  ttsAvailable = false,
): Promise<StudyCard[]> {
  const [scope, facets] = await Promise.all([
    getActiveScope(),
    currentFacets(ttsAvailable),
  ])
  const cards = await db.cards
    .where('introduced')
    .equals(1)
    .filter((c) => isQueueable(c, now, scope, facets))
    .toArray()
  return orderQueue(cards)
}

export async function getDueCount(
  now: Date,
  ttsAvailable = false,
): Promise<number> {
  const [scope, facets] = await Promise.all([
    getActiveScope(),
    currentFacets(ttsAvailable),
  ])
  return db.cards
    .where('introduced')
    .equals(1)
    .filter((c) => isQueueable(c, now, scope, facets))
    .count()
}

/** How many new items may still be introduced today. */
export async function getLessonBudget(now: Date): Promise<number> {
  const { newItemsPerDay } = await getSettings()
  const since = startOfLocalDay(now)
  const introducedCards = await db.cards
    .where('introducedAt')
    .aboveOrEqual(since)
    .toArray()
  const itemsToday = new Set(introducedCards.map((c) => c.itemId)).size
  const remaining = Math.max(0, newItemsPerDay - itemsToday)
  if (remaining === 0) return 0
  // Don't promise lessons the active scope can't supply.
  return Math.min(remaining, (await getNextLessonItems(remaining)).length)
}

/** Next unintroduced items within the active scope, mixed across types. */
export async function getNextLessonItems(budget: number): Promise<Item[]> {
  if (budget <= 0) return []
  const scope = await getActiveScope()
  const unintroducedCards = await db.cards
    .where('introduced')
    .equals(0)
    .toArray()
  const itemIds = [
    ...new Set(
      unintroducedCards
        .map((c) => c.itemId)
        .filter((id) => inScope(id, scope)),
    ),
  ]
  const items = (await db.items.bulkGet(itemIds)).filter(
    (i): i is Item => !!i,
  )
  return interleaveByType(items, budget)
}

/** Mark all cards of these items introduced and due now — they enter the queue immediately. */
export async function introduceItems(
  itemIds: string[],
  now: Date,
): Promise<void> {
  await db.cards
    .where('itemId')
    .anyOf(itemIds)
    .modify((c) => {
      c.introduced = 1
      c.introducedAt = now
      c.fsrs.due = now
    })
}
