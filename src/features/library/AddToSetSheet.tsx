import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { addItemsToSet, createSet, setActive, sortSets } from '../sets/setsApi'

interface Props {
  itemIds: string[]
  onClose: () => void
  onDone: () => void
}

/** Bottom sheet: put the current selection into a new or existing set. */
export function AddToSetSheet({ itemIds, onClose, onDone }: Props) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const sets = useLiveQuery(
    async () => sortSets(await db.studySets.toArray()),
    [],
  )

  const create = async () => {
    if (busy) return
    setBusy(true)
    // A set you just made is a set you want to study, so turn it on right away.
    const set = await createSet(name, itemIds)
    await setActive(set.id, true)
    onDone()
  }

  const addTo = async (setId: string) => {
    if (busy) return
    setBusy(true)
    await addItemsToSet(setId, itemIds)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]"
      />
      <div
        className="relative mx-auto max-h-[75dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border-t border-mist bg-card p-5"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <h2 className="text-base font-medium">
          Add {itemIds.length} {itemIds.length === 1 ? 'item' : 'items'} to a set
        </h2>

        <div className="mt-4">
          <label
            htmlFor="new-set-name"
            className="text-xs font-medium tracking-widest text-ink-faint uppercase"
          >
            New set
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="new-set-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void create()}
              placeholder="Week 1 kanji"
              className="min-w-0 flex-1 rounded-lg border border-mist px-3 py-2 text-sm placeholder:text-ink-faint"
            />
            <button
              onClick={() => void create()}
              disabled={busy}
              className="shrink-0 rounded-lg bg-ai px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ai-deep disabled:opacity-50"
            >
              Create
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            New sets become active right away, so reviews come only from them.
          </p>
        </div>

        {sets && sets.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-medium tracking-widest text-ink-faint uppercase">
              Existing set
            </p>
            <ul className="mt-1.5 divide-y divide-mist rounded-lg border border-mist">
              {sets.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => void addTo(s.id)}
                    disabled={busy}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-paper disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {s.name}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {s.itemIds.length} items
                        {s.active === 1 ? ' · active' : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-ai">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-mist py-2.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
