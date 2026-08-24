import { describe, expect, it } from 'vitest'
import { createEmptyCard, Rating, State } from 'ts-fsrs'
import {
  currentStreak,
  dayKey,
  forecast,
  leeches,
  longestStreak,
  maturity,
  medianAnswerSeconds,
  retention,
  reviewsByDay,
} from './stats'
import type { ReviewLogRow, StudyCard } from '../../db/types'

const TODAY = new Date('2026-08-24T12:00:00')

function log(daysAgo: number, rating = Rating.Good, elapsedMs = 3000): ReviewLogRow {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - daysAgo)
  return {
    cardId: 'c',
    itemId: 'i',
    rating,
    reviewedAt: d,
    elapsedMs,
    stateBefore: 1,
    stateAfter: 2,
    stability: 3,
    difficulty: 5,
  }
}

function card(over: Partial<StudyCard> & { due?: Date } = {}): StudyCard {
  const { due, ...rest } = over
  const fsrs = createEmptyCard(TODAY)
  if (due) fsrs.due = due
  return {
    id: 'c',
    itemId: 'i',
    itemType: 'kanji',
    facet: 'meaning',
    fsrs,
    suspended: false,
    introduced: 1,
    introducedAt: TODAY,
    ...rest,
  } as StudyCard
}

describe('review history', () => {
  it('counts reviews per day and fills empty days with zero', () => {
    const days = reviewsByDay([log(0), log(0), log(2)], TODAY, 4)
    expect(days).toHaveLength(4)
    expect(days.at(-1)!.count).toBe(2) // today
    expect(days.at(-2)!.count).toBe(0) // yesterday, nothing
    expect(days.at(-3)!.count).toBe(1)
  })

  it('counts a streak ending today', () => {
    expect(currentStreak([log(0), log(1), log(2)], TODAY)).toBe(3)
  })

  it('keeps the streak alive when today has not been studied yet', () => {
    expect(currentStreak([log(1), log(2)], TODAY)).toBe(2)
  })

  it('breaks the streak after a missed day', () => {
    expect(currentStreak([log(2), log(3)], TODAY)).toBe(0)
    expect(currentStreak([], TODAY)).toBe(0)
  })

  it('finds the longest run in history', () => {
    // days 10,9,8 is a run of 3; days 5,4 is a run of 2
    expect(longestStreak([log(10), log(9), log(8), log(5), log(4)])).toBe(3)
  })
})

describe('forecast', () => {
  const at = (days: number) => {
    const d = new Date(TODAY)
    d.setDate(d.getDate() + days)
    return d
  }

  it('buckets upcoming cards by day', () => {
    const f = forecast(
      [card({ id: 'a', due: at(1) }), card({ id: 'b', due: at(1) }), card({ id: 'c', due: at(3) })],
      TODAY,
      5,
    )
    expect(f[1].count).toBe(2)
    expect(f[3].count).toBe(1)
    expect(f[2].count).toBe(0)
  })

  it('rolls overdue cards into today', () => {
    const f = forecast([card({ due: at(-9) })], TODAY, 3)
    expect(f[0].count).toBe(1)
    expect(f[0].key).toBe(dayKey(TODAY))
  })

  it('ignores cards that are not in rotation', () => {
    const f = forecast(
      [card({ introduced: 0, due: at(1) }), card({ suspended: true, due: at(1) })],
      TODAY,
      3,
    )
    expect(f.every((d) => d.count === 0)).toBe(true)
  })
})

describe('retention and maturity', () => {
  it('treats anything but Again as recalled', () => {
    const r = retention([log(0, Rating.Good), log(0, Rating.Hard), log(0, Rating.Again)])
    expect(r.reviews).toBe(3)
    expect(r.correct).toBe(2)
    expect(r.rate).toBeCloseTo(2 / 3)
  })

  it('reports no rate before any reviews', () => {
    expect(retention([]).rate).toBeNull()
  })

  it('splits cards by how well they are known', () => {
    const mature = card({ id: 'm' })
    mature.fsrs.state = State.Review
    mature.fsrs.stability = 40
    const young = card({ id: 'y' })
    young.fsrs.state = State.Review
    young.fsrs.stability = 3
    const learning = card({ id: 'l' })
    learning.fsrs.state = State.Learning
    const m = maturity([mature, young, learning, card({ id: 'n', introduced: 0 })])
    expect(m).toEqual({ fresh: 1, learning: 1, young: 1, mature: 1 })
  })
})

describe('leeches', () => {
  it('flags repeatedly forgotten cards, worst first', () => {
    const bad = card({ id: 'bad' })
    bad.fsrs.lapses = 7
    const meh = card({ id: 'meh' })
    meh.fsrs.lapses = 4
    const fine = card({ id: 'fine' })
    fine.fsrs.lapses = 1
    const found = leeches([fine, meh, bad])
    expect(found.map((c) => c.id)).toEqual(['bad', 'meh'])
  })
})

describe('answer timing', () => {
  it('takes the median and ignores absurd gaps', () => {
    expect(
      medianAnswerSeconds([log(0, Rating.Good, 2000), log(0, Rating.Good, 4000), log(0, Rating.Good, 999_999)]),
    ).toBe(3)
    expect(medianAnswerSeconds([])).toBeNull()
  })
})
