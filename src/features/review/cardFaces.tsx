import type { GrammarItem, Item, KanjiItem, StudyCard, VocabItem } from '../../db/types'
import { ClozeSentence } from './QuizPrompt'
import { buildCloze } from './cloze'

/** What the task is, shown as an eyebrow so facets are never ambiguous. */
export function facetLabel(card: StudyCard): string {
  switch (card.facet) {
    case 'meaning':
      return card.itemType === 'kanji' ? 'Kanji · Meaning' : 'Grammar · Meaning'
    case 'reading':
      return card.itemType === 'kana' ? 'Kana · Sound' : 'Kanji · Reading'
    case 'recognition':
      return 'Vocab · Meaning'
    case 'recall':
      return card.itemType === 'kana' ? 'Kana · Write it' : 'Vocab · Recall'
    case 'listening':
      return card.itemType === 'kana' ? 'Kana · Listening' : 'Vocab · Listening'
    case 'cloze':
      return 'Grammar · Fill in'
  }
}

export function facetPrompt(card: StudyCard): string {
  switch (card.facet) {
    case 'meaning':
      return 'What does it mean?'
    case 'reading':
      return card.itemType === 'kana' ? 'Which sound is this?' : 'How is it read?'
    case 'recognition':
      return 'What does it mean?'
    case 'recall':
      return card.itemType === 'kana' ? 'Which kana is this?' : 'Say it in Japanese'
    case 'cloze':
      return 'What fills the blank?'
    case 'listening':
      return ''
    default:
      return ''
  }
}

export function CardFront({ card, item }: { card: StudyCard; item: Item }) {
  if (item.type === 'kana') {
    if (card.facet === 'listening') {
      return (
        <div className="text-center">
          <p className="glyph text-6xl text-ink-faint" lang="ja" aria-hidden>
            ♪
          </p>
          <p className="mt-2 text-sm text-ink-faint">Listen and choose</p>
        </div>
      )
    }
    return (
      <div className="text-center">
        <p className={card.facet === 'recall' ? 'font-mono text-5xl' : 'glyph text-8xl'} lang={card.facet === 'recall' ? 'en' : 'ja'}>
          {card.facet === 'recall' ? item.romaji : item.primary}
        </p>
      </div>
    )
  }
  if (card.facet === 'cloze' && item.type === 'grammar') {
    return <ClozeSentence item={item} />
  }
  if (card.facet === 'listening') {
    // The prompt is the audio, so the face stays blank until the answer.
    return (
      <div className="text-center">
        <p className="glyph text-6xl text-ink-faint" lang="ja" aria-hidden>
          ♪
        </p>
        <p className="mt-2 text-sm text-ink-faint">Listen and choose</p>
      </div>
    )
  }
  if (card.facet === 'recall') {
    // English → Japanese: the prompt is the meaning
    return (
      <div className="text-center">
        <p className="text-2xl font-medium text-balance">
          {item.meanings.join(', ')}
        </p>
      </div>
    )
  }
  const isKanji = item.type === 'kanji'
  return (
    <div className="text-center">
      <p
        className={`glyph text-balance ${isKanji ? 'text-8xl' : item.type === 'grammar' ? 'text-4xl' : 'text-6xl'}`}
        lang="ja"
      >
        {item.primary}
      </p>
    </div>
  )
}

export function CardBack({ card, item }: { card: StudyCard; item: Item }) {
  if (item.type === 'kana') {
    return (
      <div className="space-y-2 text-center">
        <p className="glyph text-6xl" lang="ja">
          {item.primary}
        </p>
        <p className="font-mono text-2xl text-ink-soft">{item.romaji}</p>
        <p className="text-xs text-ink-faint capitalize">{item.script}</p>
      </div>
    )
  }
  switch (item.type) {
    case 'kanji':
      return <KanjiBack card={card} item={item} />
    case 'vocab':
      return <VocabBack card={card} item={item} />
    case 'grammar':
      return <GrammarBack card={card} item={item} />
  }
}

function Readings({ label, readings }: { label: string; readings: string[] }) {
  if (!readings.length) return null
  return (
    <p className="flex items-baseline justify-center gap-2">
      <span className="glyph text-xs text-ink-faint" lang="ja">
        {label}
      </span>
      <span className="font-mono text-base" lang="ja">
        {readings.join('　')}
      </span>
    </p>
  )
}

function KanjiBack({ card, item }: { card: StudyCard; item: KanjiItem }) {
  const meaningIsAnswer = card.facet === 'meaning'
  return (
    <div className="space-y-3 text-center">
      <p
        className={
          meaningIsAnswer ? 'text-2xl font-medium text-balance' : 'text-base text-ink-soft'
        }
      >
        {item.meanings.join(', ')}
      </p>
      <div className={meaningIsAnswer ? 'space-y-1 opacity-70' : 'space-y-1'}>
        <Readings label="音" readings={item.readingsOn} />
        <Readings label="訓" readings={item.readingsKun} />
      </div>
    </div>
  )
}

function VocabBack({ card, item }: { card: StudyCard; item: VocabItem }) {
  // Recall and listening both start without the written word, so show it big.
  if (card.facet === 'recall' || card.facet === 'listening') {
    return (
      <div className="space-y-2 text-center">
        <p className="glyph text-5xl" lang="ja">
          {item.primary}
        </p>
        {item.reading !== item.primary && (
          <p className="font-mono text-lg text-ink-soft" lang="ja">
            {item.reading}
          </p>
        )}
        {card.facet === 'listening' && (
          <p className="text-base font-medium">{item.meanings.join(', ')}</p>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-2 text-center">
      {item.reading !== item.primary && (
        <p className="font-mono text-lg text-ink-soft" lang="ja">
          {item.reading}
        </p>
      )}
      <p className="text-2xl font-medium text-balance">
        {item.meanings.join(', ')}
      </p>
    </div>
  )
}

function GrammarBack({ card, item }: { card: StudyCard; item: GrammarItem }) {
  const ex = item.examples[0]
  if (card.facet === 'cloze') {
    const cloze = buildCloze(item)
    return (
      <div className="space-y-3 text-center">
        <p className="glyph text-3xl text-ai" lang="ja">
          {cloze?.answer}
        </p>
        <p className="text-sm" lang="ja">
          {cloze ? cloze.before + cloze.answer + cloze.after : ''}
        </p>
        <p className="text-xs text-ink-soft">{item.meanings[0]}</p>
      </div>
    )
  }
  return (
    <div className="space-y-4 text-center">
      <p className="text-2xl font-medium text-balance">{item.meanings[0]}</p>
      <p className="font-mono text-sm text-ink-soft">{item.structure}</p>
      {ex && (
        <p className="text-sm">
          <span lang="ja">{ex.jp}</span>
          <span className="mt-0.5 block text-xs text-ink-soft">{ex.en}</span>
        </p>
      )}
    </div>
  )
}
