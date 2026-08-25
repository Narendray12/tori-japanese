import type { Item, KanaItem, SetGroup, StudySet, VocabItem } from '../../db/types'
import { KANJI_GROUPS } from '../../data/kanjiOrder'
import { GROUP_LABEL, type KanaGroup } from '../../data/kana'

const KANJI_BATCH = 10

/** Grammar groups, by the ids used in n5.grammar.json. */
const GRAMMAR_THEMES: { id: string; name: string; ids: string[]; blurb: string }[] =
  [
    {
      id: 'particles',
      name: 'Core particles',
      ids: [
        'grammar:wa',
        'grammar:ga',
        'grammar:o',
        'grammar:ni-time',
        'grammar:ni-destination',
        'grammar:de-location',
        'grammar:de-means',
        'grammar:e',
        'grammar:to-and',
        'grammar:mo',
        'grammar:no-possessive',
      ],
      blurb: 'The small words that decide what a sentence actually means.',
    },
    {
      id: 'polite-basics',
      name: 'Polite sentence basics',
      ids: [
        'grammar:desu',
        'grammar:masu',
        'grammar:ka-question',
        'grammar:ne',
        'grammar:yo',
        'grammar:mashou',
        'grammar:masen-ka',
      ],
      blurb: 'です, ます, and the endings that make a sentence sound polite.',
    },
    {
      id: 'te-form',
      name: 'The て-form family',
      ids: [
        'grammar:te-form',
        'grammar:te-kudasai',
        'grammar:naide-kudasai',
        'grammar:te-imasu',
        'grammar:temo-ii',
        'grammar:tewa-ikemasen',
        'grammar:te-kara',
      ],
      blurb: 'Requests, permission, and "I am doing" all run through て.',
    },
    {
      id: 'past',
      name: 'Talking about the past',
      ids: [
        'grammar:ta-form',
        'grammar:ta-koto-ga-aru',
        'grammar:tari-tari',
        'grammar:ato-de',
        'grammar:mae-ni',
        'grammar:mou-mada',
      ],
      blurb: 'The た-form, past experience, and putting events in order.',
    },
  ]

function set(
  id: string,
  name: string,
  description: string,
  group: SetGroup,
  itemIds: string[],
  createdAt: Date,
): StudySet {
  return {
    id,
    name,
    description,
    group,
    itemIds,
    active: 0,
    preset: 1,
    createdAt,
  }
}

/**
 * The sets that ship with the app, built from the seeded content so they can
 * never drift from the data. All start inactive: with nothing active the queue
 * covers everything, which is the right default before you have picked.
 */
export function buildPresets(items: Item[], createdAt: Date): StudySet[] {
  const kanji = items
    .filter((i) => i.type === 'kanji')
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const vocab = items.filter((i): i is VocabItem => i.type === 'vocab')
  const grammarIds = new Set(items.filter((i) => i.type === 'grammar').map((i) => i.id))

  const presets: StudySet[] = []

  // Kana: whole syllabaries first, then the harder subsets on their own.
  const kana = items.filter((i): i is KanaItem => i.type === 'kana')
  for (const script of ['hiragana', 'katakana'] as const) {
    const basic = kana.filter(
      (k) => k.script === script && k.kanaGroup === 'gojuon',
    )
    if (basic.length)
      presets.push(
        set(
          `preset:${script}`,
          script === 'hiragana' ? 'Hiragana' : 'Katakana',
          `The ${basic.length} basic ${script} syllables. Start here.`,
          'Kana',
          basic.map((k) => k.id),
          createdAt,
        ),
      )
  }
  for (const group of ['dakuten', 'yoon'] as KanaGroup[]) {
    const picked = kana.filter((k) => k.kanaGroup === group)
    if (picked.length)
      presets.push(
        set(
          `preset:kana-${group}`,
          GROUP_LABEL[group],
          group === 'dakuten'
            ? `Voiced syllables in both scripts: が, ざ, ぱ and the rest. ${picked.length} of them.`
            : `Combinations like きゃ and しゅ, in both scripts. ${picked.length} of them.`,
          'Kana',
          picked.map((k) => k.id),
          createdAt,
        ),
      )
  }

  // One set per teaching group, in the order they are meant to be learned.
  KANJI_GROUPS.forEach((group, i) => {
    const chars = new Set(group.chars)
    const picked = kanji.filter((k) => chars.has(k.primary))
    if (!picked.length) return
    presets.push(
      set(
        `preset:kanji-group-${i + 1}`,
        `${i + 1}. ${group.name}`,
        `${picked.map((k) => k.primary).join('')} (${picked.length} kanji)`,
        'Kanji',
        picked.map((k) => k.id),
        createdAt,
      ),
    )
  })

  // Ten at a time, for working straight through in curriculum order.
  for (let b = 0; b * KANJI_BATCH < kanji.length; b++) {
    const batch = kanji.slice(b * KANJI_BATCH, (b + 1) * KANJI_BATCH)
    const from = b * KANJI_BATCH + 1
    presets.push(
      set(
        `preset:kanji-batch-${b + 1}`,
        `Kanji ${from}-${from + batch.length - 1}`,
        `${batch.map((k) => k.primary).join('')} in teaching order.`,
        'Kanji',
        batch.map((k) => k.id),
        createdAt,
      ),
    )
  }

  // Genki chapters, taken from the tags on the source vocabulary deck.
  const genkiLessons = [...new Set(vocab.flatMap((v) => v.tags))]
    .filter((t) => /^Genki_Ln\.\d+$/.test(t))
    .map((t) => ({ tag: t, n: Number(t.split('.')[1]) }))
    .sort((a, b) => a.n - b.n)
    .slice(0, 6)

  for (const { tag, n } of genkiLessons) {
    const words = vocab.filter((v) => v.tags.includes(tag))
    if (words.length < 5) continue
    presets.push(
      set(
        `preset:genki-${n}`,
        `Genki chapter ${n}`,
        `The ${words.length} words this chapter introduces, if you are following the textbook.`,
        'Vocabulary',
        words.map((v) => v.id),
        createdAt,
      ),
    )
  }

  const verbs = vocab.filter((v) =>
    v.meanings.some((m) => m.toLowerCase().startsWith('to ')),
  )
  if (verbs.length)
    presets.push(
      set(
        'preset:verbs',
        'Verbs',
        `Every N5 word that translates as "to something". ${verbs.length} in total.`,
        'Vocabulary',
        verbs.map((v) => v.id),
        createdAt,
      ),
    )

  // Words written only in kana are the ones learners skip, so they get a set.
  const kanaOnly = vocab.filter(
    (v) => v.kanjiUsed.length === 0 && v.primary === v.reading,
  )
  if (kanaOnly.length >= 20)
    presets.push(
      set(
        'preset:kana-only',
        'Kana-only words',
        `Words with no kanji to lean on, so you have to know the sound. ${kanaOnly.length} of them.`,
        'Vocabulary',
        kanaOnly.map((v) => v.id),
        createdAt,
      ),
    )

  for (const theme of GRAMMAR_THEMES) {
    const ids = theme.ids.filter((id) => grammarIds.has(id))
    if (ids.length)
      presets.push(
        set(
          `preset:${theme.id}`,
          theme.name,
          theme.blurb,
          'Grammar',
          ids,
          createdAt,
        ),
      )
  }

  return presets
}
