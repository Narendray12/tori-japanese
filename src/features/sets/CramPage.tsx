import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../../db/db'
import type { Item, StudyCard } from '../../db/types'
import { currentFacets } from '../../srs/queue'
import { CardBack, CardFront, facetLabel, facetPrompt } from '../review/cardFaces'
import { japaneseVoice } from '../review/tts'

/** Fisher-Yates. Cram order is deliberately random, unlike the SRS queue. */
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Cram: drill a set without touching its FSRS schedule. Nothing here writes
 * to the cards table, which is the whole point of a practice run.
 */
export function CramPage() {
  const { setId = '' } = useParams()
  const [state, setState] = useState<{
    name: string
    cards: StudyCard[]
    items: Map<string, Item>
  } | null>(null)
  const [queue, setQueue] = useState<StudyCard[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [missed, setMissed] = useState(0)
  const [answered, setAnswered] = useState(0)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    void (async () => {
      const set = await db.studySets.get(decodeURIComponent(setId))
      if (!set) {
        setState({ name: '', cards: [], items: new Map() })
        return
      }
      const facets = await currentFacets(japaneseVoice() !== null)
      const cards = (
        await db.cards.where('itemId').anyOf(set.itemIds).toArray()
      ).filter((c) => facets.has(c.facet))
      const items = new Map(
        (await db.items.bulkGet(set.itemIds))
          .filter((i): i is Item => !!i)
          .map((i) => [i.id, i]),
      )
      const shuffled = shuffle(cards)
      setState({ name: set.name, cards: shuffled, items })
      setQueue(shuffled)
    })()
  }, [setId])

  const answer = useCallback(
    (gotIt: boolean) => {
      const card = queue[idx]
      if (!card) return
      if (!gotIt) {
        setMissed((m) => m + 1)
        setQueue((q) => [...q, card]) // come back around this session
      }
      setAnswered((a) => a + 1)
      setRevealed(false)
      setIdx((i) => i + 1)
    },
    [queue, idx],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && (e.key === '1' || e.key === '2')) {
        answer(e.key === '2')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, answer])

  if (!state) return null
  if (state.cards.length === 0) {
    return (
      <div className="pt-16 text-center">
        <p className="text-sm text-ink-soft">
          This set has no quizzable items yet.
        </p>
        <Link to="/sets" className="mt-3 inline-block text-sm font-medium text-ai">
          ← Back to sets
        </Link>
      </div>
    )
  }

  const card = queue[idx]
  const item = card ? state.items.get(card.itemId) : undefined

  if (!card || !item) {
    const accuracy = answered
      ? Math.round(((answered - missed) / answered) * 100)
      : 100
    return (
      <div className="flex flex-col items-center gap-6 pt-10 text-center">
        <div
          className="glyph flex size-32 items-center justify-center rounded-full border-4 border-shu text-5xl text-shu"
          style={{ transform: 'rotate(-6deg)' }}
          lang="ja"
        >
          完
        </div>
        <div>
          <p className="text-lg font-medium">Practice done</p>
          <p className="mt-1 text-sm text-ink-soft">
            {answered} answers · {accuracy}% first try
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Practice runs leave your review schedule alone.
          </p>
        </div>
        <Link
          to="/sets"
          className="rounded-lg bg-ai px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
        >
          Back to sets
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70dvh] flex-col pt-2">
      <div className="flex items-center justify-between">
        <p className="truncate text-xs font-medium tracking-widest text-ink-faint uppercase">
          Practice · {state.name}
        </p>
        <p className="font-mono text-xs text-ink-faint tabular-nums">
          {idx + 1} / {queue.length}
        </p>
      </div>

      <div className="mt-1.5 h-0.5 w-full rounded bg-mist">
        <div
          className="h-full rounded bg-moss transition-all"
          style={{ width: `${(idx / queue.length) * 100}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        disabled={revealed}
        className="mt-4 flex flex-1 cursor-pointer flex-col rounded-xl border border-mist bg-card px-6 py-8 disabled:cursor-default"
      >
        <span className="text-center text-[11px] font-medium tracking-widest text-ink-faint uppercase">
          {facetLabel(card)}
        </span>
        <span className="flex flex-1 flex-col items-center justify-center gap-6">
          <CardFront card={card} item={item} />
          {revealed ? (
            <span className="w-full border-t border-mist pt-6">
              <CardBack card={card} item={item} />
            </span>
          ) : (
            <span className="text-sm text-ink-faint">{facetPrompt(card)}</span>
          )}
        </span>
      </button>

      <div className="mt-4 pb-2">
        {revealed ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => answer(false)}
              className="rounded-lg border border-shu/40 py-3 text-sm font-medium text-shu transition-colors hover:bg-shu/5"
            >
              Missed it
            </button>
            <button
              onClick={() => answer(true)}
              className="rounded-lg border border-mist bg-card py-3 text-sm font-medium transition-colors hover:border-ai hover:text-ai"
            >
              Got it
            </button>
          </div>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-lg bg-ai py-3 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
          >
            Show answer
          </button>
        )}
        <div className="mt-2 text-right">
          <Link to="/sets" className="text-xs text-ink-faint hover:text-ink">
            End practice
          </Link>
        </div>
      </div>
    </div>
  )
}
