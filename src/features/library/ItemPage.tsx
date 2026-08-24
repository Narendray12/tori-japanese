import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { State } from 'ts-fsrs'
import { db } from '../../db/db'
import type { Item, StudyCard, VocabItem } from '../../db/types'
import { ItemDetail } from '../lessons/ItemDetail'
import { humanizeInterval } from '../../srs/scheduler'
import { ACTIVE_FACETS } from '../../srs/queue'
import { facetLabel } from '../review/cardFaces'

export function ItemPage() {
  const { id = '' } = useParams()
  const itemId = decodeURIComponent(id)

  const data = useLiveQuery(async () => {
    const item = await db.items.get(itemId)
    if (!item) return { item: null, cards: [], related: [] as Item[] }
    const cards = await db.cards.where('itemId').equals(itemId).toArray()

    // Cross-links: kanji → vocab containing it; vocab → the kanji it uses.
    let related: Item[] = []
    if (item.type === 'kanji') {
      const vocab = (await db.items
        .where('type')
        .equals('vocab')
        .toArray()) as VocabItem[]
      related = vocab
        .filter((v) => v.kanjiUsed.includes(item.primary))
        .slice(0, 12)
    } else if (item.type === 'vocab') {
      related = (
        await db.items.bulkGet(item.kanjiUsed.map((c) => `kanji:${c}`))
      ).filter((i): i is Item => !!i)
    }
    return { item, cards, related }
  }, [itemId])

  if (!data) return null
  if (!data.item) {
    return (
      <div className="pt-16 text-center">
        <p className="text-sm text-ink-soft">That item is not in the library.</p>
        <Link to="/library" className="mt-3 inline-block text-sm font-medium text-ai">
          ← Back to library
        </Link>
      </div>
    )
  }

  const { item, cards, related } = data

  return (
    <div className="pt-2 pb-6">
      <Link to="/library" className="text-xs text-ink-faint hover:text-ink">
        ← Library
      </Link>

      <div className="mt-3 rounded-xl border border-mist bg-card px-6 py-8">
        <ItemDetail item={item} />
      </div>

      <Progress cards={cards} />

      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium tracking-widest text-ink-faint uppercase">
            {item.type === 'kanji' ? 'Appears in' : 'Built from'}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/item/${encodeURIComponent(r.id)}`}
                  className="flex items-baseline gap-2 rounded-lg border border-mist bg-card px-3 py-2 hover:border-ai"
                >
                  <span className="glyph text-lg" lang="ja">
                    {r.primary}
                  </span>
                  <span className="text-xs text-ink-soft">{r.meanings[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Progress({ cards }: { cards: StudyCard[] }) {
  const active = cards.filter((c) => ACTIVE_FACETS.has(c.facet))
  if (active.length === 0) return null
  const now = new Date()

  return (
    <section className="mt-6">
      <h2 className="text-xs font-medium tracking-widest text-ink-faint uppercase">
        Progress
      </h2>
      <ul className="mt-2 divide-y divide-mist rounded-lg border border-mist bg-card">
        {active.map((c) => {
          const due = new Date(c.fsrs.due)
          const isNew = c.introduced === 0 || c.fsrs.state === State.New
          return (
            <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm">{facetLabel(c)}</span>
              <span className="font-mono text-xs text-ink-faint">
                {isNew
                  ? 'not started'
                  : due <= now
                    ? 'due now'
                    : `in ${humanizeInterval(now, due)}`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
