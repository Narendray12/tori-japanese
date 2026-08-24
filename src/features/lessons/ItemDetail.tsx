import type { GrammarItem, Item, KanjiItem, VocabItem } from '../../db/types'

/** Full teaching view of an item, used in lessons (and later, the library). */
export function ItemDetail({ item }: { item: Item }) {
  switch (item.type) {
    case 'kanji':
      return <KanjiDetail item={item} />
    case 'vocab':
      return <VocabDetail item={item} />
    case 'grammar':
      return <GrammarDetail item={item} />
  }
}

function strokeOrderUrl(char: string): string {
  const hex = char.codePointAt(0)!.toString(16).padStart(5, '0')
  // BASE_URL so the diagrams resolve when the app is served from a subpath.
  return `${import.meta.env.BASE_URL}kanjivg/${hex}.svg`
}

function KanjiDetail({ item }: { item: KanjiItem }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="glyph text-8xl" lang="ja">
        {item.primary}
      </p>
      <p className="text-xl font-medium text-balance">
        {item.meanings.join(', ')}
      </p>
      <div className="space-y-1.5">
        {item.readingsOn.length > 0 && (
          <p className="text-sm">
            <span className="glyph mr-2 text-xs text-ink-faint" lang="ja">
              音
            </span>
            <span className="font-mono" lang="ja">
              {item.readingsOn.join('　')}
            </span>
          </p>
        )}
        {item.readingsKun.length > 0 && (
          <p className="text-sm">
            <span className="glyph mr-2 text-xs text-ink-faint" lang="ja">
              訓
            </span>
            <span className="font-mono" lang="ja">
              {item.readingsKun.join('　')}
            </span>
          </p>
        )}
      </div>
      <figure className="mt-2">
        <img
          src={strokeOrderUrl(item.primary)}
          alt={`Stroke order for ${item.primary}`}
          className="size-24 rounded-lg border border-mist bg-white p-2"
        />
        <figcaption className="mt-1 text-[10px] text-ink-faint">
          {item.strokes} strokes
        </figcaption>
      </figure>
    </div>
  )
}

function VocabDetail({ item }: { item: VocabItem }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="glyph text-6xl text-balance" lang="ja">
        {item.primary}
      </p>
      {item.reading !== item.primary && (
        <p className="font-mono text-xl text-ink-soft" lang="ja">
          {item.reading}
        </p>
      )}
      <p className="text-xl font-medium text-balance">
        {item.meanings.join(', ')}
      </p>
      {item.kanjiUsed.length > 0 && (
        <p className="text-sm text-ink-soft">
          <span className="mr-2 text-[10px] font-medium tracking-widest text-ink-faint uppercase">
            Uses
          </span>
          <span className="glyph text-lg" lang="ja">
            {item.kanjiUsed.join('・')}
          </span>
        </p>
      )}
    </div>
  )
}

function GrammarDetail({ item }: { item: GrammarItem }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="glyph text-4xl text-balance" lang="ja">
          {item.primary}
        </p>
        <p className="mt-2 text-lg font-medium">{item.meanings[0]}</p>
        <p className="mt-1 font-mono text-sm text-ink-faint">{item.structure}</p>
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">{item.explanation}</p>
      <ul className="space-y-3 border-t border-mist pt-4">
        {item.examples.map((ex) => (
          <li key={ex.jp} className="text-sm">
            <span lang="ja">{ex.jp}</span>
            <span className="mt-0.5 block text-xs text-ink-soft">{ex.en}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
