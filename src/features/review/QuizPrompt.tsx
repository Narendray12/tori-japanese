import { useEffect, useMemo, useRef, useState } from 'react'
import { bind, unbind } from 'wanakana'
import type { GrammarItem, Item, StudyCard, VocabItem } from '../../db/types'
import { checkMeaning, checkReading } from '../../srs/answers'
import { buildChoices, type ChoiceSource } from './choices'
import { BLANK, buildCloze } from './cloze'
import type { QuizMode } from './quizMode'
import { speakJapanese } from './tts'

export interface Graded {
  correct: boolean
  /** What the user gave, for the review screen to echo back. */
  given: string
}

interface Props {
  mode: QuizMode
  card: StudyCard
  item: Item
  pool: Item[]
  onGraded: (result: Graded) => void
}

/** The answers a typed card accepts. */
function acceptedAnswers(card: StudyCard, item: Item): string[] {
  switch (card.facet) {
    case 'reading':
      return item.type === 'kanji'
        ? [...item.readingsOn, ...item.readingsKun]
        : []
    case 'recall':
      return item.type === 'vocab' ? [item.reading, item.primary] : []
    case 'cloze': {
      const cloze = item.type === 'grammar' ? buildCloze(item) : null
      return cloze ? [cloze.answer] : []
    }
    default:
      return item.meanings
  }
}

export function QuizPrompt({ mode, card, item, pool, onGraded }: Props) {
  switch (mode) {
    case 'type-kana':
    case 'type-meaning':
      return (
        <TypedAnswer
          card={card}
          item={item}
          kana={mode === 'type-kana'}
          onGraded={onGraded}
        />
      )
    case 'choice':
    case 'listen':
      return (
        <ChoiceAnswer
          card={card}
          item={item}
          pool={pool}
          listen={mode === 'listen'}
          onGraded={onGraded}
        />
      )
    default:
      return null
  }
}

function TypedAnswer({
  card,
  item,
  kana,
  onGraded,
}: {
  card: StudyCard
  item: Item
  kana: boolean
  onGraded: (r: Graded) => void
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  // wanakana turns romaji into kana as you type, so no keyboard switching.
  useEffect(() => {
    const el = ref.current
    if (!el || !kana) return
    bind(el, { IMEMode: 'toHiragana' })
    return () => unbind(el)
  }, [kana])

  useEffect(() => {
    ref.current?.focus()
  }, [card.id])

  const submit = () => {
    if (!value.trim()) return
    const accepted = acceptedAnswers(card, item)
    const result =
      card.facet === 'reading' || card.facet === 'recall' || card.facet === 'cloze'
        ? checkReading(value, accepted)
        : checkMeaning(value, accepted)
    onGraded({ correct: result.correct, given: value.trim() })
  }

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={kana ? 'Type in romaji or kana' : 'Type the meaning'}
          aria-label="Your answer"
          className="min-w-0 flex-1 rounded-lg border border-mist bg-card px-3 py-3 text-center text-lg placeholder:text-sm placeholder:text-ink-faint"
          lang={kana ? 'ja' : 'en'}
        />
        <button
          type="button"
          onClick={submit}
          className="shrink-0 rounded-lg bg-ai px-5 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
        >
          Check
        </button>
      </div>
    </div>
  )
}

function ChoiceAnswer({
  card,
  item,
  pool,
  listen,
  onGraded,
}: {
  card: StudyCard
  item: Item
  pool: Item[]
  listen: boolean
  onGraded: (r: Graded) => void
}) {
  const label = (i: Item) => i.meanings[0] ?? i.primary

  const options = useMemo(
    () =>
      buildChoices(
        { id: item.id, label: label(item) },
        pool
          .filter((p) => p.type === item.type)
          .map<ChoiceSource>((p) => ({ id: p.id, label: label(p) })),
        4,
      ),
    // A fresh set of options per card, not per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.id],
  )

  // Play the word as soon as a listening card appears.
  useEffect(() => {
    if (listen && item.type === 'vocab') speakJapanese(item.reading)
  }, [listen, item, card.id])

  return (
    <div className="w-full space-y-2">
      {listen && (
        <button
          type="button"
          onClick={() =>
            item.type === 'vocab' && speakJapanese((item as VocabItem).reading)
          }
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-mist bg-card py-3 text-sm font-medium text-ai"
        >
          <span aria-hidden>♪</span> Play again
        </button>
      )}
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onGraded({ correct: o.id === item.id, given: o.label })}
          className="w-full rounded-lg border border-mist bg-card px-4 py-3 text-left text-sm transition-colors hover:border-ai hover:text-ai"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The sentence with its blank, shown as the question for a cloze card. */
export function ClozeSentence({ item }: { item: GrammarItem }) {
  const cloze = buildCloze(item)
  if (!cloze) return null
  return (
    <div className="text-center">
      <p className="text-2xl" lang="ja">
        {cloze.before}
        <span className="mx-0.5 border-b-2 border-ai px-2 text-ai">{BLANK}</span>
        {cloze.after}
      </p>
      <p className="mt-3 text-sm text-ink-soft">{cloze.translation}</p>
    </div>
  )
}
