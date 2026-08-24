import { describe, expect, it } from 'vitest'
import { createEmptyCard, Rating, State } from 'ts-fsrs'
import {
  humanizeInterval,
  makeScheduler,
  previewIntervals,
  rate,
} from './scheduler'
import {
  inScope,
  interleaveByType,
  isQueueable,
  orderQueue,
  scopeFromSets,
  startOfLocalDay,
} from './queue'
import type { Facet, Item, StudyCard, StudySet } from '../db/types'
import { enabledFacets, resolveMode } from '../features/review/quizMode'

const NOW = new Date('2026-08-24T12:00:00')

function card(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: 'kanji:日#meaning',
    itemId: 'kanji:日',
    itemType: 'kanji',
    facet: 'meaning',
    fsrs: createEmptyCard(NOW),
    suspended: false,
    introduced: 1,
    introducedAt: NOW,
    ...overrides,
  }
}

describe('scheduler', () => {
  it('schedules a new card into the future on Good', () => {
    const s = makeScheduler(0.9)
    const { card: next, log } = rate(s, createEmptyCard(NOW), Rating.Good, NOW)
    expect(next.due.getTime()).toBeGreaterThan(NOW.getTime())
    expect(next.state).not.toBe(State.New)
    expect(log.rating).toBe(Rating.Good)
  })

  it('Again on a mature card brings it back sooner than Good', () => {
    const s = makeScheduler(0.9)
    let c = createEmptyCard(NOW)
    // Mature the card: three Good reviews at its due dates
    for (let i = 0; i < 3; i++) c = rate(s, c, Rating.Good, c.due).card
    const again = rate(s, c, Rating.Again, c.due).card
    const good = rate(s, c, Rating.Good, c.due).card
    expect(again.due.getTime()).toBeLessThan(good.due.getTime())
    expect(again.state).toBe(State.Relearning)
  })

  it('handles a card reviewed long overdue', () => {
    const s = makeScheduler(0.9)
    const first = rate(s, createEmptyCard(NOW), Rating.Good, NOW).card
    const yearLater = new Date(NOW.getTime() + 365 * 864e5)
    const { card: next } = rate(s, first, Rating.Good, yearLater)
    expect(next.due.getTime()).toBeGreaterThan(yearLater.getTime())
    expect(Number.isFinite(next.stability)).toBe(true)
  })

  it('previews four increasing intervals', () => {
    const s = makeScheduler(0.9)
    const p = previewIntervals(s, createEmptyCard(NOW), NOW)
    expect(Object.keys(p)).toHaveLength(4)
    for (const v of Object.values(p)) expect(v).toBeTruthy()
  })

  it('humanizes intervals across scales', () => {
    const t = (ms: number) => new Date(NOW.getTime() + ms)
    expect(humanizeInterval(NOW, t(30_000))).toBe('<1m')
    expect(humanizeInterval(NOW, t(5 * 60_000))).toBe('5m')
    expect(humanizeInterval(NOW, t(3 * 3_600_000))).toBe('3h')
    expect(humanizeInterval(NOW, t(12 * 864e5))).toBe('12d')
    expect(humanizeInterval(NOW, t(65 * 864e5))).toBe('2.1mo')
    expect(humanizeInterval(NOW, t(500 * 864e5))).toBe('1.4y')
  })
})

describe('queue', () => {
  it('only queues introduced, unsuspended, due, active-facet cards', () => {
    const due = new Date(NOW.getTime() - 1000)
    expect(isQueueable(card({ fsrs: Object.assign(createEmptyCard(NOW), { due }) }), NOW)).toBe(true)
    expect(isQueueable(card({ introduced: 0 }), NOW)).toBe(false)
    expect(isQueueable(card({ suspended: true }), NOW)).toBe(false)
    // A facet the current settings exclude (no Japanese voice, say) stays out.
    const withoutMeaning = new Set<Facet>(['reading'])
    expect(isQueueable(card({}), NOW, null, withoutMeaning)).toBe(false)
    expect(
      isQueueable(card({ facet: 'reading' }), NOW, null, withoutMeaning),
    ).toBe(true)
    const future = new Date(NOW.getTime() + 864e5)
    expect(
      isQueueable(card({ fsrs: Object.assign(createEmptyCard(NOW), { due: future }) }), NOW),
    ).toBe(false)
  })

  it('orders the queue most-overdue first', () => {
    const early = card({ id: 'a', fsrs: Object.assign(createEmptyCard(NOW), { due: new Date('2026-08-20') }) })
    const late = card({ id: 'b', fsrs: Object.assign(createEmptyCard(NOW), { due: new Date('2026-08-23') }) })
    expect(orderQueue([late, early]).map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('day boundary is local midnight', () => {
    const d = startOfLocalDay(new Date('2026-08-24T23:59:00'))
    expect(d.getHours()).toBe(0)
    expect(d.getDate()).toBe(24)
    // just after midnight is a new day
    const next = startOfLocalDay(new Date('2026-08-25T00:01:00'))
    expect(next.getDate()).toBe(25)
  })

  it('scopes to the union of active sets, or everything when none are active', () => {
    const set = (id: string, active: 0 | 1, itemIds: string[]): StudySet => ({
      id,
      name: id,
      description: '',
      group: 'Your sets',
      itemIds,
      active,
      preset: 0,
      createdAt: NOW,
    })
    // No active sets → null scope → everything is in scope.
    expect(scopeFromSets([set('a', 0, ['kanji:日'])])).toBeNull()
    expect(inScope('anything', null)).toBe(true)

    const scope = scopeFromSets([
      set('a', 1, ['kanji:日', 'kanji:一']),
      set('b', 1, ['vocab:猫']),
      set('c', 0, ['kanji:excluded']),
    ])
    expect(scope).toEqual(new Set(['kanji:日', 'kanji:一', 'vocab:猫']))
    expect(inScope('kanji:excluded', scope)).toBe(false)
  })

  it('keeps out-of-scope cards out of the queue even when due', () => {
    const due = new Date(NOW.getTime() - 1000)
    const c = card({ fsrs: Object.assign(createEmptyCard(NOW), { due }) })
    expect(isQueueable(c, NOW, new Set(['kanji:日']))).toBe(true)
    expect(isQueueable(c, NOW, new Set(['vocab:猫']))).toBe(false)
    expect(isQueueable(c, NOW, null)).toBe(true)
  })

  it('picks a quiz mode per facet and falls back to flip when one is off', () => {
    const all = { typing: true, multipleChoice: true, listening: true }
    expect(resolveMode('reading', all, true)).toBe('type-kana')
    expect(resolveMode('meaning', all, true)).toBe('choice')
    expect(resolveMode('cloze', all, true)).toBe('type-kana')
    expect(resolveMode('listening', all, true)).toBe('listen')

    // Every facet stays answerable with modes switched off.
    const none = { typing: false, multipleChoice: false, listening: false }
    for (const f of [
      'meaning',
      'reading',
      'recognition',
      'recall',
      'cloze',
      'listening',
    ] as Facet[]) {
      expect(resolveMode(f, none, true)).toBe('flip')
    }
    // No Japanese voice means no listening mode, whatever the setting says.
    expect(resolveMode('listening', all, false)).toBe('flip')
  })

  it('only schedules listening cards when a voice exists', () => {
    const all = { typing: true, multipleChoice: true, listening: true }
    expect(enabledFacets(all, true).has('listening')).toBe(true)
    expect(enabledFacets(all, false).has('listening')).toBe(false)
    expect(enabledFacets({ ...all, listening: false }, true).has('listening')).toBe(
      false,
    )
    // Cloze needs no device support, so it is always scheduled.
    expect(enabledFacets(all, false).has('cloze')).toBe(true)
  })

  it('interleaves lesson items across types in curriculum order', () => {
    const item = (type: Item['type'], orderIndex: number): Item =>
      ({ id: `${type}:${orderIndex}`, type, orderIndex } as Item)
    const picked = interleaveByType(
      [item('vocab', 1), item('vocab', 0), item('kanji', 0), item('grammar', 0), item('kanji', 1)],
      4,
    )
    expect(picked.map((i) => i.id)).toEqual([
      'kanji:0',
      'vocab:0',
      'grammar:0',
      'kanji:1',
    ])
  })
})
