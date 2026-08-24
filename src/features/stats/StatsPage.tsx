import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import type { Item, StudyCard } from '../../db/types'
import { facetLabel } from '../review/cardFaces'
import { ForecastChart, Heatmap, MaturityBar } from './Charts'
import {
  currentStreak,
  forecast,
  leeches,
  longestStreak,
  maturity,
  medianAnswerSeconds,
  retention,
  reviewsByDay,
  LEECH_THRESHOLD,
} from './stats'

const HEATMAP_DAYS = 119 // 17 weeks, a clean grid on a phone
const FORECAST_DAYS = 14

export function StatsPage() {
  const data = useLiveQuery(async () => {
    const now = new Date()
    const [logs, cards] = await Promise.all([
      db.reviewLogs.toArray(),
      db.cards.toArray(),
    ])
    const leechCards = leeches(cards)
    const leechItems = await db.items.bulkGet(
      [...new Set(leechCards.map((c) => c.itemId))].slice(0, 10),
    )
    return {
      now,
      logs,
      cards,
      leechCards,
      leechItems: new Map(
        leechItems.filter((i): i is Item => !!i).map((i) => [i.id, i]),
      ),
    }
  }, [])

  if (!data) return null
  const { now, logs, cards, leechCards, leechItems } = data

  const ret = retention(logs)
  const mat = maturity(cards)
  const streak = currentStreak(logs, now)
  const best = longestStreak(logs)
  const median = medianAnswerSeconds(logs)
  const todayCount = reviewsByDay(logs, now, 1)[0].count

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="glyph text-5xl text-ink-faint" lang="ja">
          未
        </p>
        <p className="max-w-xs text-sm text-ink-soft">
          Your history shows up here once you have answered a few cards.
        </p>
        <Link to="/lessons" className="text-sm font-medium text-ai">
          Start a lesson →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-2 pb-6">
      <section className="grid grid-cols-3 gap-2">
        <Stat label="Day streak" value={streak} note={best > streak ? `best ${best}` : 'keep going'} />
        <Stat
          label="Recall"
          value={ret.rate === null ? '—' : `${Math.round(ret.rate * 100)}%`}
          note={`${ret.reviews} reviews`}
        />
        <Stat
          label="Per answer"
          value={median === null ? '—' : `${median}s`}
          note={`${todayCount} today`}
        />
      </section>

      <section>
        <h2 className="text-xs font-medium tracking-widest text-ink-faint uppercase">
          How well you know it
        </h2>
        <div className="mt-2 rounded-lg border border-mist bg-card p-4">
          {/*
            Only cards in rotation are charted. Including the thousands you have
            not met yet would flatten the bar into one colour and hide the
            progress it exists to show; that total is stated below instead.
          */}
          <MaturityBar
            parts={[
              { label: 'Learning', count: mat.learning, color: 'var(--color-ramp-1)' },
              { label: 'Young', count: mat.young, color: 'var(--color-ramp-2)' },
              { label: 'Mature', count: mat.mature, color: 'var(--color-ramp-4)' },
            ]}
          />
          <p className="mt-3 text-xs text-ink-soft">
            Mature means the card is scheduled at least three weeks out, which is
            the usual line for something you actually know.{' '}
            <span className="text-ink-faint">
              {mat.fresh.toLocaleString()} cards are still waiting to be started.
            </span>
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-medium tracking-widest text-ink-faint uppercase">
          Reviews coming up
        </h2>
        <div className="mt-2 rounded-lg border border-mist bg-card p-4">
          <ForecastChart days={forecast(cards, now, FORECAST_DAYS)} />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-medium tracking-widest text-ink-faint uppercase">
          Reviews you have done
        </h2>
        <div className="mt-2 rounded-lg border border-mist bg-card p-4">
          <Heatmap days={reviewsByDay(logs, now, HEATMAP_DAYS)} />
        </div>
      </section>

      {leechCards.length > 0 && (
        <section>
          <h2 className="text-xs font-medium tracking-widest text-ink-faint uppercase">
            Giving you trouble
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            Forgotten {LEECH_THRESHOLD} times or more. Open one and read the
            examples again, or park it in a set of its own.
          </p>
          <ul className="mt-2 divide-y divide-mist rounded-lg border border-mist bg-card">
            {leechCards.slice(0, 10).map((c) => (
              <LeechRow key={c.id} card={c} item={leechItems.get(c.itemId)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  note,
}: {
  label: string
  value: number | string
  note: string
}) {
  return (
    <div className="rounded-lg border border-mist bg-card px-3 py-3 text-center">
      <p className="text-[10px] font-medium tracking-widest text-ink-faint uppercase">
        {label}
      </p>
      <p className="glyph mt-1 text-2xl tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] text-ink-faint">{note}</p>
    </div>
  )
}

function LeechRow({ card, item }: { card: StudyCard; item?: Item }) {
  if (!item) return null
  return (
    <li>
      <Link
        to={`/item/${encodeURIComponent(item.id)}`}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper"
      >
        <span className="glyph shrink-0 text-xl" lang="ja">
          {item.primary}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{item.meanings[0]}</span>
          <span className="block text-[11px] text-ink-faint">
            {facetLabel(card)}
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs text-shu">
          {card.fsrs.lapses}×
        </span>
      </Link>
    </li>
  )
}
