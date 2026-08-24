import {
  fsrs,
  generatorParameters,
  Rating,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs'

export const GRADES: Grade[] = [
  Rating.Again,
  Rating.Hard,
  Rating.Good,
  Rating.Easy,
]

export const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Again]: 'Again',
  [Rating.Hard]: 'Hard',
  [Rating.Good]: 'Good',
  [Rating.Easy]: 'Easy',
}

export function makeScheduler(desiredRetention: number): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: desiredRetention,
      maximum_interval: 365,
      enable_fuzz: true,
    }),
  )
}

/** Apply a grade to a card, returning the updated card and its review log. */
export function rate(
  scheduler: FSRS,
  card: FsrsCard,
  grade: Grade,
  now: Date,
): RecordLogItem {
  return scheduler.next(card, now, grade)
}

/** Next due date for each of the four grades — shown under the rating buttons. */
export function previewIntervals(
  scheduler: FSRS,
  card: FsrsCard,
  now: Date,
): Record<Grade, string> {
  const entries = GRADES.map((g) => {
    const { card: next } = scheduler.next(card, now, g)
    return [g, humanizeInterval(now, next.due)] as const
  })
  return Object.fromEntries(entries) as Record<Grade, string>
}

/** "The card comes back in …" — compact human form of a future interval. */
export function humanizeInterval(from: Date, to: Date): string {
  const mins = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000))
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 31) return `${days}d`
  const months = days / 30.4
  if (months < 12) return `${Math.round(months * 10) / 10}mo`
  return `${Math.round((days / 365.25) * 10) / 10}y`
}
