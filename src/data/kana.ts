/**
 * The kana syllabaries, generated from the gojūon table rather than typed out
 * as a list, so a missing or duplicated character is impossible.
 *
 * Order is the order you learn them in: all of hiragana first (the plain rows,
 * then the voiced ones, then the small-ya combinations), and katakana after.
 * Nobody needs katakana ヂ before they can read あいうえお.
 */

export type Script = 'hiragana' | 'katakana'
export type KanaGroup = 'gojuon' | 'dakuten' | 'yoon'

export interface KanaEntry {
  hiragana: string
  katakana: string
  romaji: string
  /** The consonant row: 'a' for あいうえお, 'k' for かきくけこ. */
  row: string
  group: KanaGroup
}

/** Plain syllables. A gap means the slot does not exist (yi, ye, wu). */
const GOJUON: [row: string, hira: string, kata: string, romaji: string][] = [
  ['a', 'あいうえお', 'アイウエオ', 'a i u e o'],
  ['k', 'かきくけこ', 'カキクケコ', 'ka ki ku ke ko'],
  ['s', 'さしすせそ', 'サシスセソ', 'sa shi su se so'],
  ['t', 'たちつてと', 'タチツテト', 'ta chi tsu te to'],
  ['n', 'なにぬねの', 'ナニヌネノ', 'na ni nu ne no'],
  ['h', 'はひふへほ', 'ハヒフヘホ', 'ha hi fu he ho'],
  ['m', 'まみむめも', 'マミムメモ', 'ma mi mu me mo'],
  ['y', 'やゆよ', 'ヤユヨ', 'ya yu yo'],
  ['r', 'らりるれろ', 'ラリルレロ', 'ra ri ru re ro'],
  ['w', 'わを', 'ワヲ', 'wa wo'],
  ['n2', 'ん', 'ン', 'n'],
]

/** Voiced and half-voiced syllables: the ones with " or ° on top. */
const DAKUTEN: [row: string, hira: string, kata: string, romaji: string][] = [
  ['g', 'がぎぐげご', 'ガギグゲゴ', 'ga gi gu ge go'],
  ['z', 'ざじずぜぞ', 'ザジズゼゾ', 'za ji zu ze zo'],
  ['d', 'だぢづでど', 'ダヂヅデド', 'da ji zu de do'],
  ['b', 'ばびぶべぼ', 'バビブベボ', 'ba bi bu be bo'],
  ['p', 'ぱぴぷぺぽ', 'パピプペポ', 'pa pi pu pe po'],
]

/** Combinations written with a small ya, yu or yo. */
const YOON_BASES: [hira: string, kata: string, prefix: string][] = [
  ['き', 'キ', 'ky'],
  ['し', 'シ', 'sh'],
  ['ち', 'チ', 'ch'],
  ['に', 'ニ', 'ny'],
  ['ひ', 'ヒ', 'hy'],
  ['み', 'ミ', 'my'],
  ['り', 'リ', 'ry'],
  ['ぎ', 'ギ', 'gy'],
  ['じ', 'ジ', 'j'],
  ['び', 'ビ', 'by'],
  ['ぴ', 'ピ', 'py'],
]

const YOON_SUFFIX: [hira: string, kata: string, vowel: string][] = [
  ['ゃ', 'ャ', 'a'],
  ['ゅ', 'ュ', 'u'],
  ['ょ', 'ョ', 'o'],
]

function expand(
  table: [string, string, string, string][],
  group: KanaGroup,
): KanaEntry[] {
  return table.flatMap(([row, hira, kata, romajiList]) => {
    const romaji = romajiList.split(' ')
    return [...hira].map((h, i) => ({
      hiragana: h,
      katakana: [...kata][i],
      romaji: romaji[i],
      row,
      group,
    }))
  })
}

function buildYoon(): KanaEntry[] {
  return YOON_BASES.flatMap(([bh, bk, prefix]) =>
    YOON_SUFFIX.map(([sh, sk, vowel]) => ({
      hiragana: bh + sh,
      katakana: bk + sk,
      // し+ゃ is "sha", not "shya"; the same for ch and j.
      romaji: ['sh', 'ch', 'j'].includes(prefix)
        ? prefix + vowel
        : prefix + vowel,
      row: prefix,
      group: 'yoon' as const,
    })),
  )
}

/** Every syllable, in teaching order. */
export const KANA: KanaEntry[] = [
  ...expand(GOJUON, 'gojuon'),
  ...expand(DAKUTEN, 'dakuten'),
  ...buildYoon(),
]

export const GROUP_LABEL: Record<KanaGroup, string> = {
  gojuon: 'Basic',
  dakuten: 'With " and °',
  yoon: 'Small ya, yu, yo',
}

/** The row heading shown in the library, e.g. 'k' becomes か行. */
export function rowLabel(script: Script, entry: KanaEntry): string {
  if (entry.row === 'n2') return script === 'hiragana' ? 'ん' : 'ン'
  const first = KANA.find((k) => k.row === entry.row)
  if (!first) return entry.row
  return (script === 'hiragana' ? first.hiragana : first.katakana) + '行'
}

export interface KanaSeedRow {
  id: string
  char: string
  romaji: string
  script: Script
  row: string
  group: KanaGroup
  orderIndex: number
}

/**
 * Flattened to one row per character: hiragana first, then katakana, each in
 * table order. Order index is global so the library reads top to bottom.
 */
export function buildKanaRows(): KanaSeedRow[] {
  const rows: KanaSeedRow[] = []
  for (const script of ['hiragana', 'katakana'] as Script[]) {
    for (const entry of KANA) {
      const char = script === 'hiragana' ? entry.hiragana : entry.katakana
      rows.push({
        id: `kana:${char}`,
        char,
        romaji: entry.romaji,
        script,
        row: entry.row,
        group: entry.group,
        orderIndex: rows.length,
      })
    }
  }
  return rows
}
