import { Rating, State } from 'ts-fsrs'
import type { ReviewLogRow, StudyCard } from '../../db/types'
import { startOfLocalDay } from '../../srs/queue'

/** A card is a leech once it has been forgotten this many times. */
export const LEECH_THRESHOLD = 4

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export interface DayCount {
  key: string
  date: Date
  count: number
}

/** Reviews per day for the last `days` days, oldest first, gaps filled with 0. */
export function reviewsByDay(
  logs: ReviewLogRow[],
  today: Date,
  days: number,
): DayCount[] {
  const counts = new Map<string, number>()
  for (const log of logs) {
    const k = dayKey(new Date(log.reviewedAt))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const start = startOfLocalDay(today)
  const out: DayCount[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(start)
    date.setDate(date.getDate() - i)
    const key = dayKey(date)
    out.push({ key, date, count: counts.get(key) ?? 0 })
  }
  return out
}

/**
 * Consecutive days ending today (or yesterday, so an unfinished day does not
 * look like a broken streak).
 */
export function currentStreak(logs: ReviewLogRow[], today: Date): number {
  const active = new Set(logs.map((l) => dayKey(new Date(l.reviewedAt))))
  const cursor = startOfLocalDay(today)
  if (!active.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!active.has(dayKey(cursor))) return 0
  }
  let streak = 0
  while (active.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function longestStreak(logs: ReviewLogRow[]): number {
  const days = [...new Set(logs.map((l) => dayKey(new Date(l.reviewedAt))))]
    .map((k) => new Date(k))
    .sort((a, b) => a.getTime() - b.getTime())
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const d of days) {
    if (prev && (d.getTime() - prev.getTime()) / 864e5 === 1) run++
    else run = 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Upcoming due counts per day, so a backlog is visible before it lands. */
export function forecast(
  cards: StudyCard[],
  today: Date,
  days: number,
): DayCount[] {
  const start = startOfLocalDay(today)
  const buckets = new Map<string, number>()
  for (const c of cards) {
    if (c.introduced !== 1 || c.suspended) continue
    const due = startOfLocalDay(new Date(c.fsrs.due))
    // Anything already overdue belongs to today.
    const key = dayKey(due.getTime() < start.getTime() ? start : due)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const out: DayCount[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    const key = dayKey(date)
    out.push({ key, date, count: buckets.get(key) ?? 0 })
  }
  return out
}

export interface Retention {
  reviews: number
  correct: number
  /** Share of reviews not rated Again, 0..1. Null when nothing was reviewed. */
  rate: number | null
}

export function retention(logs: ReviewLogRow[]): Retention {
  const reviews = logs.length
  const correct = logs.filter((l) => l.rating !== Rating.Again).length
  return { reviews, correct, rate: reviews ? correct / reviews : null }
}

export interface Maturity {
  fresh: number // never studied
  learning: number
  young: number // scheduled under 21 days out
  mature: number // 21 days or more, the usual "known" line
}

export function maturity(cards: StudyCard[]): Maturity {
  const m: Maturity = { fresh: 0, learning: 0, young: 0, mature: 0 }
  for (const c of cards) {
    if (c.introduced !== 1 || c.fsrs.state === State.New) {
      m.fresh++
    } else if (
      c.fsrs.state === State.Learning ||
      c.fsrs.state === State.Relearning
    ) {
      m.learning++
    } else if (c.fsrs.stability >= 21) {
      m.mature++
    } else {
      m.young++
    }
  }
  return m
}

export function leeches(cards: StudyCard[], threshold = LEECH_THRESHOLD) {
  return cards
    .filter((c) => c.introduced === 1 && c.fsrs.lapses >= threshold)
    .sort((a, b) => b.fsrs.lapses - a.fsrs.lapses)
}

/** Median seconds spent per answer, which is steadier than the mean. */
export function medianAnswerSeconds(logs: ReviewLogRow[]): number | null {
  const times = logs
    .map((l) => l.elapsedMs)
    .filter((ms) => ms > 0 && ms < 120_000)
    .sort((a, b) => a - b)
  if (!times.length) return null
  const mid = Math.floor(times.length / 2)
  const ms =
    times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2
  return Math.round(ms / 100) / 10
}
