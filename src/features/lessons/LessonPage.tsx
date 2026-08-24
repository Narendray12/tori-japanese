import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FSRS } from 'ts-fsrs'
import { db } from '../../db/db'
import { getSettings } from '../../db/settings'
import type { Item, StudyCard } from '../../db/types'
import {
  currentFacets,
  getLessonBudget,
  getNextLessonItems,
  introduceItems,
} from '../../srs/queue'
import { makeScheduler } from '../../srs/scheduler'
import { ReviewSession } from '../review/ReviewSession'
import type { QuizSettings } from '../review/quizMode'
import { japaneseVoice, watchVoices } from '../review/tts'
import { ItemDetail } from './ItemDetail'

interface QuizContext {
  scheduler: FSRS
  quiz: QuizSettings
  ttsAvailable: boolean
  pool: Item[]
}

type Stage =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'teach'; items: Item[]; at: number; ctx: QuizContext }
  | {
      kind: 'quiz'
      cards: StudyCard[]
      items: Map<string, Item>
      ctx: QuizContext
    }

export function LessonPage() {
  const [stage, setStage] = useState<Stage>({ kind: 'loading' })
  const loaded = useRef(false)

  useEffect(() => watchVoices(() => {}), [])

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    void (async () => {
      const ttsAvailable = japaneseVoice() !== null
      const settings = await getSettings()
      const budget = await getLessonBudget(new Date())
      const items = await getNextLessonItems(
        Math.min(budget, settings.lessonBatchSize),
      )
      if (items.length === 0) {
        setStage({ kind: 'empty' })
        return
      }
      setStage({
        kind: 'teach',
        items,
        at: 0,
        ctx: {
          scheduler: makeScheduler(settings.desiredRetention),
          quiz: {
            typing: settings.typing,
            multipleChoice: settings.multipleChoice,
            listening: settings.listening,
          },
          ttsAvailable,
          pool: await db.items.toArray(),
        },
      })
    })()
  }, [])

  const startQuiz = async (items: Item[], ctx: QuizContext) => {
    const now = new Date()
    await introduceItems(
      items.map((i) => i.id),
      now,
    )
    const facets = await currentFacets(ctx.ttsAvailable)
    const cards = (
      await db.cards
        .where('itemId')
        .anyOf(items.map((i) => i.id))
        .toArray()
    ).filter((c) => facets.has(c.facet))
    setStage({
      kind: 'quiz',
      cards,
      items: new Map(items.map((i) => [i.id, i])),
      ctx,
    })
  }

  switch (stage.kind) {
    case 'loading':
      return null

    case 'empty':
      return (
        <div className="flex flex-col items-center gap-4 pt-16 text-center">
          <p className="glyph text-5xl text-ink-faint" lang="ja">
            満
          </p>
          <p className="max-w-xs text-sm text-ink-soft">
            You have learned today's new items. More open up tomorrow.
          </p>
          <Link to="/" className="text-sm font-medium text-ai">
            Back to Today →
          </Link>
        </div>
      )

    case 'teach': {
      const { items, at, ctx } = stage
      const item = items[at]
      const last = at === items.length - 1
      return (
        <div className="flex min-h-[70dvh] flex-col pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-widest text-ink-faint uppercase">
              Lesson
            </p>
            <p className="font-mono text-xs text-ink-faint tabular-nums">
              {at + 1} / {items.length}
            </p>
          </div>

          <div className="mt-4 flex-1 rounded-xl border border-mist bg-card px-6 py-8">
            <ItemDetail item={item} />
          </div>

          <div className="mt-4 flex gap-2 pb-2">
            <button
              type="button"
              onClick={() => setStage({ ...stage, at: at - 1 })}
              disabled={at === 0}
              className="rounded-lg border border-mist bg-card px-5 py-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            >
              Back
            </button>
            {last ? (
              <button
                type="button"
                onClick={() => void startQuiz(items, ctx)}
                className="flex-1 rounded-lg bg-ai py-3 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
              >
                Start quiz
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStage({ ...stage, at: at + 1 })}
                className="flex-1 rounded-lg bg-ai py-3 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )
    }

    case 'quiz':
      return (
        <ReviewSession
          initialCards={stage.cards}
          items={stage.items}
          pool={stage.ctx.pool}
          scheduler={stage.ctx.scheduler}
          quiz={stage.ctx.quiz}
          ttsAvailable={stage.ctx.ttsAvailable}
          heading="Lesson quiz"
          exitTo="/"
        />
      )
  }
}
