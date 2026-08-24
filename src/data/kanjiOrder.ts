/**
 * The order kanji are taught in, grouped so related characters arrive
 * together. Numbers first because they unlock dates, prices, and counters;
 * then the calendar kanji those dates are written with; then people,
 * position, and the everyday verbs.
 *
 * Frequency order (what the source data ships in) puts 国 third and scatters
 * 一二三 across the list, which is a fine ranking and a poor lesson plan.
 *
 * Every N5 character appears exactly once. kanjiOrder.test.ts enforces that
 * against the dataset, so a missing or duplicated character fails the build.
 */
export interface KanjiGroup {
  name: string
  chars: string[]
}

export const KANJI_GROUPS: KanjiGroup[] = [
  {
    name: 'Numbers',
    chars: [...'一二三四五六七八九十'],
  },
  {
    name: 'Bigger numbers and money',
    chars: [...'百千万円'],
  },
  {
    name: 'Days of the week',
    chars: [...'日月火水木金土'],
  },
  {
    name: 'Telling the time',
    chars: [...'年今時間半午毎'],
  },
  {
    name: 'People',
    chars: [...'人男女子父母友先生'],
  },
  {
    name: 'Where things are',
    chars: [...'上下中外前後右左'],
  },
  {
    name: 'Directions',
    chars: [...'東西南北'],
  },
  {
    name: 'Size and shape',
    chars: [...'大小長高白'],
  },
  {
    name: 'Everyday verbs',
    chars: [...'行来出入見聞話食休'],
  },
  {
    name: 'School and reading',
    chars: [...'学校本読書語名何'],
  },
  {
    // 火 is taught with the weekdays, so it is not repeated here.
    name: 'Nature and weather',
    chars: [...'山川天雨気'],
  },
  {
    name: 'Out in the world',
    chars: [...'国車電'],
  },
]

/** char to position, 0-based, following the group order above. */
export const KANJI_ORDER: Map<string, number> = new Map(
  KANJI_GROUPS.flatMap((g) => g.chars).map((c, i) => [c, i]),
)

/** The group a character belongs to, for labelling preset sets. */
export const KANJI_GROUP_OF: Map<string, string> = new Map(
  KANJI_GROUPS.flatMap((g) => g.chars.map((c) => [c, g.name] as const)),
)
