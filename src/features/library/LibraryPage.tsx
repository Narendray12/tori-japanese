import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import type {
  GrammarItem,
  Item,
  ItemType,
  KanaItem,
  KanjiItem,
  VocabItem,
} from '../../db/types'
import { filterItems, type LearnedFilter } from './search'
import { AddToSetSheet } from './AddToSetSheet'

const tabs: { type: ItemType; label: string }[] = [
  { type: 'kana', label: 'Kana' },
  { type: 'kanji', label: 'Kanji' },
  { type: 'vocab', label: 'Vocab' },
  { type: 'grammar', label: 'Grammar' },
]

const filters: { key: LearnedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'learned', label: 'Learning' },
  { key: 'new', label: 'Not started' },
]

export function LibraryPage() {
  const [tab, setTab] = useState<ItemType>('kana')
  const [query, setQuery] = useState('')
  const [learned, setLearned] = useState<LearnedFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)

  const items = useLiveQuery(
    () => db.items.where('type').equals(tab).sortBy('orderIndex'),
    [tab],
  )

  const learnedIds = useLiveQuery(async () => {
    const cards = await db.cards.where('introduced').equals(1).toArray()
    return new Set(cards.map((c) => c.itemId))
  }, [])

  const visible = useMemo(() => {
    if (!items || items[0]?.type !== tab) return null
    return filterItems(items, query, learned, learnedIds ?? new Set())
  }, [items, tab, query, learned, learnedIds])

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectAllVisible = () =>
    setSelected((s) => new Set([...s, ...(visible ?? []).map((i) => i.id)]))

  const selecting = selected.size > 0

  return (
    <div className="pt-2">
      <div role="tablist" className="flex gap-1 rounded-lg border border-mist bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.type}
            role="tab"
            aria-selected={tab === t.type}
            onClick={() => setTab(t.type)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === t.type ? 'bg-ai-wash text-ai-deep' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in English, kana, or romaji"
          className="min-w-0 flex-1 rounded-lg border border-mist bg-card px-3 py-2 text-sm placeholder:text-ink-faint"
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setLearned(f.key)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                learned === f.key
                  ? 'border-ai bg-ai-wash text-ai-deep'
                  : 'border-mist bg-card text-ink-soft hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {visible && visible.length > 0 && (
          <button
            onClick={selectAllVisible}
            className="shrink-0 text-xs font-medium text-ai hover:text-ai-deep"
          >
            Select all {visible.length}
          </button>
        )}
      </div>

      {!visible ? null : visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink-soft">
          Nothing here matches "{query}". Try another spelling.
        </p>
      ) : tab === 'kana' ? (
        <KanaGrid items={visible as KanaItem[]} selected={selected} onToggle={toggle} />
      ) : tab === 'kanji' ? (
        <KanjiGrid items={visible as KanjiItem[]} selected={selected} onToggle={toggle} />
      ) : tab === 'vocab' ? (
        <VocabList items={visible as VocabItem[]} selected={selected} onToggle={toggle} />
      ) : (
        <GrammarList items={visible as GrammarItem[]} selected={selected} onToggle={toggle} />
      )}

      {selecting && (
        <div
          className="fixed inset-x-0 bottom-[57px] z-10 border-t border-mist bg-card/95 backdrop-blur"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-3">
            <span className="text-sm font-medium tabular-nums">
              {selected.size} selected
            </span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-ink-faint hover:text-ink"
            >
              Clear
            </button>
            <button
              onClick={() => setSheetOpen(true)}
              className="ml-auto rounded-lg bg-ai px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
            >
              Add to set
            </button>
          </div>
        </div>
      )}

      {sheetOpen && (
        <AddToSetSheet
          itemIds={[...selected]}
          onClose={() => setSheetOpen(false)}
          onDone={() => {
            setSheetOpen(false)
            setSelected(new Set())
          }}
        />
      )}
    </div>
  )
}

interface RowProps<T extends Item> {
  items: T[]
  selected: Set<string>
  onToggle: (id: string) => void
}

/** Tap toggles selection; the arrow link opens the detail page. */
function SelectMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] leading-none ${
        on ? 'border-ai bg-ai text-white' : 'border-mist text-transparent'
      }`}
    >
      ✓
    </span>
  )
}

function KanaGrid({ items, selected, onToggle }: RowProps<KanaItem>) {
  return (
    <ul className="mt-4 grid grid-cols-5 gap-2 pb-16 sm:grid-cols-6">
      {items.map((k) => {
        const on = selected.has(k.id)
        return (
          <li key={k.id} className="relative">
            <button
              onClick={() => onToggle(k.id)}
              aria-pressed={on}
              className={`flex w-full flex-col items-center rounded-lg border py-2.5 transition-colors ${
                on ? 'border-ai bg-ai-wash' : 'border-mist bg-card'
              }`}
            >
              <span className="glyph text-3xl" lang="ja">
                {k.primary}
              </span>
              <span className="mt-1 font-mono text-[10px] text-ink-soft">
                {k.romaji}
              </span>
            </button>
            <Link
              to={`/item/${encodeURIComponent(k.id)}`}
              aria-label={`Details for ${k.romaji}`}
              className="absolute top-0.5 right-1 text-[9px] text-ink-faint hover:text-ai"
            >
              ⓘ
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function KanjiGrid({ items, selected, onToggle }: RowProps<KanjiItem>) {
  return (
    <ul className="mt-4 grid grid-cols-4 gap-2 pb-16 sm:grid-cols-5">
      {items.map((k) => {
        const on = selected.has(k.id)
        return (
          <li key={k.id} className="relative">
            <button
              onClick={() => onToggle(k.id)}
              aria-pressed={on}
              className={`flex w-full flex-col items-center rounded-lg border py-3 transition-colors ${
                on ? 'border-ai bg-ai-wash' : 'border-mist bg-card'
              }`}
            >
              <span className="glyph text-4xl" lang="ja">
                {k.primary}
              </span>
              <span className="mt-1.5 max-w-full truncate px-1 text-[10px] text-ink-soft">
                {k.meanings[0]}
              </span>
            </button>
            <Link
              to={`/item/${encodeURIComponent(k.id)}`}
              aria-label={`Details for ${k.primary}`}
              className="absolute top-1 right-1 rounded px-1 text-[10px] text-ink-faint hover:text-ai"
            >
              ⓘ
            </Link>
            {on && (
              <span className="absolute top-1 left-1">
                <SelectMark on />
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function VocabList({ items, selected, onToggle }: RowProps<VocabItem>) {
  return (
    <ul className="mt-4 divide-y divide-mist overflow-hidden rounded-lg border border-mist bg-card pb-0">
      {items.map((v) => {
        const on = selected.has(v.id)
        return (
          <li key={v.id} className={on ? 'bg-ai-wash' : ''}>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <button
                onClick={() => onToggle(v.id)}
                aria-pressed={on}
                className="flex min-w-0 flex-1 items-baseline gap-3 text-left"
              >
                <SelectMark on={on} />
                <span className="glyph shrink-0 text-xl" lang="ja">
                  {v.primary}
                </span>
                {v.reading !== v.primary && (
                  <span className="shrink-0 font-mono text-xs text-ink-faint" lang="ja">
                    {v.reading}
                  </span>
                )}
                <span className="min-w-0 truncate text-sm text-ink-soft">
                  {v.meanings.join(', ')}
                </span>
              </button>
              <Link
                to={`/item/${encodeURIComponent(v.id)}`}
                aria-label={`Details for ${v.primary}`}
                className="shrink-0 text-xs text-ink-faint hover:text-ai"
              >
                ›
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function GrammarList({ items, selected, onToggle }: RowProps<GrammarItem>) {
  return (
    <ul className="mt-4 space-y-3 pb-16">
      {items.map((g) => {
        const on = selected.has(g.id)
        return (
          <li
            key={g.id}
            className={`rounded-lg border p-4 ${on ? 'border-ai bg-ai-wash' : 'border-mist bg-card'}`}
          >
            <button
              onClick={() => onToggle(g.id)}
              aria-pressed={on}
              className="w-full text-left"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2">
                  <SelectMark on={on} />
                  <span className="glyph text-lg" lang="ja">
                    {g.primary}
                  </span>
                </span>
                <span className="text-sm text-ink-soft">{g.meanings[0]}</span>
              </span>
              <span className="mt-1 block font-mono text-xs text-ink-faint">
                {g.structure}
              </span>
            </button>
            <Link
              to={`/item/${encodeURIComponent(g.id)}`}
              className="mt-2 inline-block text-xs font-medium text-ai hover:text-ai-deep"
            >
              Details →
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
