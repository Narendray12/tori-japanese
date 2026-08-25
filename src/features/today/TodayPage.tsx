import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import { getDueCount, getLessonBudget } from '../../srs/queue'
import { japaneseVoice, watchVoices } from '../review/tts'

/** Red hanko-seal badge: the app's signature mark, reserved for due counts. */
function HankoSeal({ count }: { count: number }) {
  return (
    <div
      className="glyph flex size-28 items-center justify-center rounded-full border-4 border-shu text-shu"
      style={{ transform: 'rotate(-4deg)' }}
      aria-label={`${count} cards due`}
    >
      <div className="text-center leading-none">
        <div className="text-4xl tabular-nums">{count}</div>
        <div className="mt-1 font-sans text-[10px] font-medium tracking-widest uppercase">
          due
        </div>
      </div>
    </div>
  )
}

export function TodayPage() {
  // Re-evaluate "due" once a minute. Cards come due as time passes,
  // not only when the DB changes.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Listening cards only count once a Japanese voice is actually available.
  const [tts, setTts] = useState(() => japaneseVoice() !== null)
  useEffect(() => watchVoices(setTts), [])

  const data = useLiveQuery(async () => {
    const now = new Date()
    const [due, lessonBudget, learned, kana, kanji, vocab, grammar, activeSets] =
      await Promise.all([
        getDueCount(now, tts),
        getLessonBudget(now),
        db.cards.where('introduced').equals(1).count(),
        db.items.where('type').equals('kana').count(),
        db.items.where('type').equals('kanji').count(),
        db.items.where('type').equals('vocab').count(),
        db.items.where('type').equals('grammar').count(),
        db.studySets.where('active').equals(1).toArray(),
      ])
    return { due, lessonBudget, learned, kana, kanji, vocab, grammar, activeSets }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, tts])

  if (!data) return null

  return (
    <div className="flex flex-col items-center gap-8 pt-8">
      <HankoSeal count={data.due} />

      {data.activeSets.length > 0 && (
        <Link
          to="/sets"
          className="-mt-4 max-w-xs text-center text-xs text-ink-soft hover:text-ink"
        >
          Studying{' '}
          <span className="font-medium text-ai">
            {data.activeSets.map((s) => s.name).join(', ')}
          </span>
        </Link>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Link
          to="/review"
          aria-disabled={data.due === 0}
          className={`rounded-lg py-3 text-center text-sm font-medium transition-colors ${
            data.due > 0
              ? 'bg-ai text-white hover:bg-ai-deep'
              : 'pointer-events-none bg-mist text-ink-faint'
          }`}
        >
          {data.due > 0 ? `Review ${data.due} due` : 'Nothing due'}
        </Link>
        <Link
          to="/lessons"
          aria-disabled={data.lessonBudget === 0}
          className={`rounded-lg border py-3 text-center text-sm font-medium transition-colors ${
            data.lessonBudget > 0
              ? 'border-ai text-ai hover:bg-ai-wash'
              : 'pointer-events-none border-mist text-ink-faint'
          }`}
        >
          {data.lessonBudget > 0
            ? `Learn ${data.lessonBudget} new`
            : 'New items done for today'}
        </Link>
      </div>

      <dl className="grid w-full grid-cols-4 gap-2">
        {(
          [
            ['Kana', 'あ', data.kana],
            ['Kanji', '字', data.kanji],
            ['Vocab', '語', data.vocab],
            ['Grammar', '文', data.grammar],
          ] as const
        ).map(([label, kanji, n]) => (
          <div
            key={label}
            className="rounded-lg border border-mist bg-card px-2 py-3 text-center"
          >
            <dt className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-ink-soft">
              <span className="glyph text-base text-ai" lang="ja" aria-hidden>
                {kanji}
              </span>
              {label}
            </dt>
            <dd className="glyph mt-1 text-xl tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>

      <p className="font-mono text-xs text-ink-faint">
        {data.learned} cards in rotation
      </p>
    </div>
  )
}
