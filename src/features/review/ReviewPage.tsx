import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FSRS } from 'ts-fsrs'
import { db } from '../../db/db'
import { getSettings } from '../../db/settings'
import type { Item, StudyCard } from '../../db/types'
import { getDueCards } from '../../srs/queue'
import { makeScheduler } from '../../srs/scheduler'
import { ReviewSession } from './ReviewSession'
import type { QuizSettings } from './quizMode'
import { japaneseVoice, watchVoices } from './tts'

interface SessionData {
  cards: StudyCard[]
  items: Map<string, Item>
  pool: Item[]
  scheduler: FSRS
  quiz: QuizSettings
  ttsAvailable: boolean
}

export function ReviewPage() {
  const [data, setData] = useState<SessionData | null>(null)
  const [empty, setEmpty] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    // Voices can arrive late; make sure they are loaded before building the queue.
    const stop = watchVoices(() => {})
    return stop
  }, [])

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    void (async () => {
      const ttsAvailable = japaneseVoice() !== null
      const [cards, settings, pool] = await Promise.all([
        getDueCards(new Date(), ttsAvailable),
        getSettings(),
        db.items.toArray(),
      ])
      if (cards.length === 0) {
        setEmpty(true)
        return
      }
      const byId = new Map(pool.map((i) => [i.id, i]))
      setData({
        cards,
        items: byId,
        pool,
        scheduler: makeScheduler(settings.desiredRetention),
        quiz: {
          typing: settings.typing,
          multipleChoice: settings.multipleChoice,
          listening: settings.listening,
        },
        ttsAvailable,
      })
    })()
  }, [])

  if (empty) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="glyph text-5xl text-ink-faint" lang="ja">
          静
        </p>
        <p className="text-sm text-ink-soft">
          Nothing is due right now. Want to learn something new?
        </p>
        <Link to="/lessons" className="text-sm font-medium text-ai">
          Go to lessons →
        </Link>
      </div>
    )
  }
  if (!data) return null

  return (
    <ReviewSession
      initialCards={data.cards}
      items={data.items}
      pool={data.pool}
      scheduler={data.scheduler}
      quiz={data.quiz}
      ttsAvailable={data.ttsAvailable}
      heading="Review"
      exitTo="/"
    />
  )
}
