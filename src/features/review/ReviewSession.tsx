import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FSRS, Grade } from 'ts-fsrs'
import { Rating } from 'ts-fsrs'
import { db } from '../../db/db'
import type { Item, StudyCard } from '../../db/types'
import { GRADES, GRADE_LABELS, previewIntervals, rate } from '../../srs/scheduler'
import { CardBack, CardFront, facetLabel, facetPrompt } from './cardFaces'
import { QuizPrompt, type Graded } from './QuizPrompt'
import { resolveMode, type QuizSettings } from './quizMode'
import { speakJapanese } from './tts'

/** A lapsed card comes back within the same session if due again this soon. */
const REQUEUE_WINDOW_MS = 10 * 60_000

interface UndoEntry {
  snapshot: StudyCard
  logId: number
  requeued: boolean
  idxBefore: number
}

interface Props {
  initialCards: StudyCard[]
  items: Map<string, Item>
  /** Distractor source for multiple choice. */
  pool: Item[]
  scheduler: FSRS
  quiz: QuizSettings
  ttsAvailable: boolean
  heading: string
  exitTo: string
}

export function ReviewSession({
  initialCards,
  items,
  pool,
  scheduler,
  quiz,
  ttsAvailable,
  heading,
  exitTo,
}: Props) {
  const [queue, setQueue] = useState<StudyCard[]>(initialCards)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [graded, setGraded] = useState<Graded | null>(null)
  const [grades, setGrades] = useState<Grade[]>([])
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const shownAt = useRef(Date.now())
  const startedAt = useRef(Date.now())
  const busy = useRef(false)

  const card = queue[idx]
  const item = card ? items.get(card.itemId) : undefined
  const done = idx >= queue.length
  const mode = card ? resolveMode(card.facet, quiz, ttsAvailable, card.itemType) : 'flip'

  useEffect(() => {
    shownAt.current = Date.now()
  }, [idx])

  const previews = useMemo(
    () => (card ? previewIntervals(scheduler, card.fsrs, new Date()) : null),
    [card, scheduler],
  )

  const onRate = useCallback(
    async (grade: Grade) => {
      if (!card || !revealed || busy.current) return
      busy.current = true
      try {
        const now = new Date()
        const snapshot = structuredClone(card)
        const { card: nextFsrs, log } = rate(scheduler, card.fsrs, grade, now)
        await db.cards.update(card.id, { fsrs: nextFsrs })
        const logId = await db.reviewLogs.add({
          cardId: card.id,
          itemId: card.itemId,
          rating: grade,
          reviewedAt: now,
          elapsedMs: Date.now() - shownAt.current,
          stateBefore: log.state,
          stateAfter: nextFsrs.state,
          stability: nextFsrs.stability,
          difficulty: nextFsrs.difficulty,
        })
        const requeued =
          nextFsrs.due.getTime() <= now.getTime() + REQUEUE_WINDOW_MS
        if (requeued) setQueue((q) => [...q, { ...card, fsrs: nextFsrs }])
        setUndoStack((s) => [
          ...s,
          { snapshot, logId: logId as number, requeued, idxBefore: idx },
        ])
        setGrades((g) => [...g, grade])
        setRevealed(false)
        setGraded(null)
        setIdx((i) => i + 1)
      } finally {
        busy.current = false
      }
    },
    [card, revealed, idx, scheduler],
  )

  const onUndo = useCallback(async () => {
    const entry = undoStack.at(-1)
    if (!entry || busy.current) return
    busy.current = true
    try {
      await db.cards.update(entry.snapshot.id, { fsrs: entry.snapshot.fsrs })
      await db.reviewLogs.delete(entry.logId)
      if (entry.requeued) {
        // Drop the copy that was appended to the end of the queue.
        setQueue((q) => {
          const last = q.map((c) => c.id).lastIndexOf(entry.snapshot.id)
          return q.filter((_, i) => i !== last)
        })
      }
      setUndoStack((s) => s.slice(0, -1))
      setGrades((g) => g.slice(0, -1))
      setRevealed(true)
      setGraded(null)
      setIdx(entry.idxBefore)
    } finally {
      busy.current = false
    }
  }, [undoStack])

  /** Answering a quiz reveals the card; a wrong answer is always Again. */
  const onGraded = useCallback((result: Graded) => {
    setGraded(result)
    setRevealed(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return
      const typing =
        e.target instanceof HTMLElement && e.target.tagName === 'INPUT'
      if (!revealed && !typing && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        if (mode === 'flip') setRevealed(true)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        const grade = GRADES[Number(e.key) - 1]
        // After a wrong answer only Again applies.
        if (!graded || graded.correct || grade === Rating.Again) void onRate(grade)
      } else if (!typing && e.key.toLowerCase() === 'u') {
        void onUndo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, revealed, mode, graded, onRate, onUndo])

  if (done) {
    return (
      <Summary
        grades={grades}
        durationMs={Date.now() - startedAt.current}
        exitTo={exitTo}
      />
    )
  }
  if (!card || !item) return null

  const gradeButtons: Grade[] = graded
    ? graded.correct
      ? [Rating.Hard, Rating.Good, Rating.Easy]
      : [Rating.Again]
    : GRADES

  return (
    <div className="flex min-h-[70dvh] flex-col pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-widest text-ink-faint uppercase">
          {heading}
        </p>
        <p className="font-mono text-xs text-ink-faint tabular-nums">
          {idx + 1} / {queue.length}
        </p>
      </div>

      <div className="mt-1.5 h-0.5 w-full rounded bg-mist">
        <div
          className="h-full rounded bg-ai transition-all"
          style={{ width: `${(idx / queue.length) * 100}%` }}
        />
      </div>

      <div
        role={mode === 'flip' && !revealed ? 'button' : undefined}
        tabIndex={mode === 'flip' && !revealed ? 0 : undefined}
        onClick={() => mode === 'flip' && !revealed && setRevealed(true)}
        className="mt-4 flex flex-1 flex-col rounded-xl border border-mist bg-card px-6 py-8"
      >
        <span className="text-center text-[11px] font-medium tracking-widest text-ink-faint uppercase">
          {facetLabel(card)}
        </span>

        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <CardFront card={card} item={item} />

          {revealed ? (
            <div className="w-full space-y-4 border-t border-mist pt-6">
              {graded && (
                <p
                  className={`text-center text-sm font-medium ${
                    graded.correct ? 'text-moss' : 'text-shu'
                  }`}
                >
                  {graded.correct
                    ? 'Correct'
                    : `You answered "${graded.given}"`}
                </p>
              )}
              <CardBack card={card} item={item} />
              {(item.type === 'vocab' || item.type === 'kana') && ttsAvailable && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() =>
                      speakJapanese(
                        item.type === 'vocab' ? item.reading : item.primary,
                      )
                    }
                    className="text-xs font-medium text-ai"
                  >
                    ♪ Hear it
                  </button>
                </div>
              )}
            </div>
          ) : mode === 'flip' ? (
            <span className="text-sm text-ink-faint">{facetPrompt(card)}</span>
          ) : (
            <QuizPrompt
              mode={mode}
              card={card}
              item={item}
              pool={pool}
              onGraded={onGraded}
            />
          )}
        </div>
      </div>

      <div className="mt-4 pb-2">
        {revealed && previews ? (
          <div
            className={`grid gap-2 ${
              gradeButtons.length === 1
                ? 'grid-cols-1'
                : gradeButtons.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-4'
            }`}
          >
            {gradeButtons.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => void onRate(g)}
                className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                  g === Rating.Again
                    ? 'border-shu/40 text-shu hover:bg-shu/5'
                    : 'border-mist bg-card text-ink hover:border-ai hover:text-ai'
                }`}
              >
                {g === Rating.Again && graded && !graded.correct
                  ? 'Got it wrong, continue'
                  : GRADE_LABELS[g]}
                <span className="block font-mono text-[11px] font-normal text-ink-faint">
                  {previews[g]}
                </span>
              </button>
            ))}
          </div>
        ) : mode === 'flip' ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full rounded-lg bg-ai py-3 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
          >
            Show answer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setGraded({ correct: false, given: 'skipped' })
              setRevealed(true)
            }}
            className="w-full rounded-lg border border-mist py-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            I don't know
          </button>
        )}

        <div className="mt-2 flex justify-between">
          <button
            type="button"
            onClick={() => void onUndo()}
            disabled={undoStack.length === 0}
            className="text-xs text-ink-faint hover:text-ink disabled:invisible"
          >
            ↩ Undo
          </button>
          <Link to={exitTo} className="text-xs text-ink-faint hover:text-ink">
            End session
          </Link>
        </div>
      </div>
    </div>
  )
}

function Summary({
  grades,
  durationMs,
  exitTo,
}: {
  grades: Grade[]
  durationMs: number
  exitTo: string
}) {
  const total = grades.length
  const misses = grades.filter((g) => g === Rating.Again).length
  const accuracy = total ? Math.round(((total - misses) / total) * 100) : 100
  const mins = Math.max(1, Math.round(durationMs / 60000))

  return (
    <div className="flex flex-col items-center gap-6 pt-10 text-center">
      {/* The completion stamp, the one place 朱 gets to celebrate */}
      <div
        className="glyph flex size-32 items-center justify-center rounded-full border-4 border-shu text-6xl text-shu"
        style={{ transform: 'rotate(-6deg)' }}
        lang="ja"
      >
        完
      </div>

      <div>
        <p className="text-lg font-medium">Session complete</p>
        <p className="mt-1 text-sm text-ink-soft">
          {total} {total === 1 ? 'answer' : 'answers'} · {accuracy}% correct ·{' '}
          {mins} min
        </p>
      </div>

      <dl className="grid w-full max-w-xs grid-cols-4 gap-2">
        {GRADES.map((g) => (
          <div key={g} className="rounded-lg border border-mist bg-card py-2">
            <dt className="text-[10px] font-medium text-ink-faint uppercase">
              {GRADE_LABELS[g]}
            </dt>
            <dd className="glyph text-lg tabular-nums">
              {grades.filter((x) => x === g).length}
            </dd>
          </div>
        ))}
      </dl>

      <Link
        to={exitTo}
        className="rounded-lg bg-ai px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
      >
        Back to Today
      </Link>
    </div>
  )
}
