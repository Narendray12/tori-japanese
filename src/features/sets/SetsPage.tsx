import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import { SET_GROUPS, type SetGroup, type StudySet } from '../../db/types'
import {
  deactivateAll,
  deleteSet,
  renameSet,
  setActive,
  sortSets,
} from './setsApi'

/**
 * A set written by an older version of the app may have no group, or one this
 * build doesn't know. Never let that hide it: file the stragglers under
 * "Your sets" so every set is always reachable.
 */
function groupOf(s: StudySet): SetGroup {
  return SET_GROUPS.includes(s.group) ? s.group : 'Your sets'
}

export function SetsPage() {
  const data = useLiveQuery(async () => {
    const sets = sortSets(await db.studySets.toArray())
    const introduced = new Set(
      (await db.cards.where('introduced').equals(1).toArray()).map(
        (c) => c.itemId,
      ),
    )
    return { sets, introduced }
  }, [])

  if (!data) return null
  const { sets, introduced } = data
  const activeCount = sets.filter((s) => s.active === 1).length

  return (
    <div className="pt-2 pb-6">
      <div className="rounded-lg border border-mist bg-card px-4 py-3">
        <p className="text-sm">
          {activeCount === 0 ? (
            <>
              Studying <strong className="font-medium">everything</strong> in N5.
            </>
          ) : (
            <>
              Studying{' '}
              <strong className="font-medium">
                {activeCount} active {activeCount === 1 ? 'set' : 'sets'}
              </strong>{' '}
              only.
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Turn a set on and your lessons and reviews come from it alone.
          {activeCount > 0 && (
            <button
              onClick={() => void deactivateAll()}
              className="ml-1.5 font-medium text-ai hover:text-ai-deep"
            >
              Study everything again
            </button>
          )}
        </p>
      </div>

      {SET_GROUPS.map((group) => {
        const inGroup = sets.filter((s) => groupOf(s) === group)
        if (inGroup.length === 0) return null
        return (
          <section key={group} className="mt-5">
            <h2 className="text-xs font-medium tracking-widest text-ink-faint uppercase">
              {group}
            </h2>
            <ul className="mt-2 space-y-3">
              {inGroup.map((s) => (
                <SetCard key={s.id} set={s} introduced={introduced} />
              ))}
            </ul>
          </section>
        )
      })}

      <p className="mt-6 text-center text-xs text-ink-faint">
        To build your own, pick the items you want in the{' '}
        <Link to="/library" className="font-medium text-ai">
          library
        </Link>{' '}
        and tap Add to set.
      </p>
    </div>
  )
}

function SetCard({
  set: s,
  introduced,
}: {
  set: StudySet
  introduced: Set<string>
}) {
  const learned = s.itemIds.filter((id) => introduced.has(id)).length
  const pct = s.itemIds.length
    ? Math.round((learned / s.itemIds.length) * 100)
    : 0

  return (
    <li
      className={`rounded-lg border bg-card p-4 ${
        s.active === 1 ? 'border-ai' : 'border-mist'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{s.name}</h3>
          {s.description && (
            <p className="mt-0.5 text-xs text-ink-soft">{s.description}</p>
          )}
        </div>
        <button
          role="switch"
          aria-checked={s.active === 1}
          aria-label={`${s.active === 1 ? 'Turn off' : 'Turn on'} ${s.name}`}
          onClick={() => void setActive(s.id, s.active !== 1)}
          className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            s.active === 1 ? 'bg-ai' : 'bg-mist'
          }`}
        >
          <span
            className={`size-5 rounded-full bg-white transition-transform ${
              s.active === 1 ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs text-ink-faint">
          <span className="font-mono">
            {learned} / {s.itemIds.length} started
          </span>
          <span className="font-mono tabular-nums">{pct}%</span>
        </div>
        <div className="mt-1 h-1 w-full rounded bg-mist">
          <div
            className="h-full rounded bg-moss transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Link
          to={`/cram/${encodeURIComponent(s.id)}`}
          className="rounded-lg border border-mist px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ai hover:text-ai"
        >
          Quiz this set
        </Link>
        <button
          onClick={() => {
            const name = prompt('Rename set', s.name)
            if (name) void renameSet(s.id, name)
          }}
          className="text-xs text-ink-faint hover:text-ink"
        >
          Rename
        </button>
        {s.preset === 0 && (
          <button
            onClick={() => {
              if (confirm(`Delete "${s.name}"? The items stay in your library.`))
                void deleteSet(s.id)
            }}
            className="ml-auto text-xs text-ink-faint hover:text-shu"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  )
}
