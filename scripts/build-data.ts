/**
 * Data pipeline: downloads open JLPT N5 datasets, normalizes them into the
 * seed JSON files the app ships with, and fetches KanjiVG stroke-order SVGs.
 *
 * Run with: npm run data
 *
 * Sources (see ATTRIBUTIONS.md):
 * - Kanji:  davidluzgouveia/kanji-data (KANJIDIC-derived, CC-BY-SA)
 * - Vocab:  jamsinclair/open-anki-jlpt-decks (CC0 deck data, Tanos-derived lists)
 * - Stroke order: KanjiVG (CC-BY-SA 3.0)
 *
 * Grammar (src/data/n5.grammar.json) is authored by hand in this repo, not generated.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'src', 'data')
const kanjivgDir = join(root, 'public', 'kanjivg')

const KANJI_URL =
  'https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json'
const VOCAB_URL =
  'https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/main/src/n5.csv'
const KANJIVG_BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji'

export interface KanjiSeed {
  id: string // "kanji:日"
  char: string
  meanings: string[]
  readingsOn: string[]
  readingsKun: string[]
  strokes: number
  freq: number | null
  grade: number | null
}

export interface VocabSeed {
  id: string // "vocab:会う:あう"
  expression: string
  reading: string
  meanings: string[]
  kanjiUsed: string[] // N5 kanji chars appearing in the expression
  tags: string[] // e.g. Genki lesson tags from the source deck
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return res.text()
}

/** Minimal CSV parser handling quoted fields (the only quoting the source uses). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length > 0) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
      if (c === '\r' && text[i + 1] === '\n') i++
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

async function buildKanji(): Promise<KanjiSeed[]> {
  console.log('Fetching kanji dataset…')
  const all = JSON.parse(await fetchText(KANJI_URL)) as Record<
    string,
    {
      strokes: number
      grade: number | null
      freq: number | null
      jlpt_new: number | null
      meanings: string[]
      readings_on: string[]
      readings_kun: string[]
    }
  >
  const seeds: KanjiSeed[] = Object.entries(all)
    .filter(([, v]) => v.jlpt_new === 5)
    .map(([char, v]) => ({
      id: `kanji:${char}`,
      char,
      meanings: v.meanings,
      readingsOn: v.readings_on,
      readingsKun: v.readings_kun,
      strokes: v.strokes,
      freq: v.freq ?? null,
      grade: v.grade ?? null,
    }))
    // Frequency order = sensible default learning order
    .sort((a, b) => (a.freq ?? 9999) - (b.freq ?? 9999))
  console.log(`  ${seeds.length} N5 kanji`)
  return seeds
}

async function buildVocab(n5KanjiChars: Set<string>): Promise<VocabSeed[]> {
  console.log('Fetching vocab dataset…')
  const csv = await fetchText(VOCAB_URL)
  const [header, ...rows] = parseCsv(csv)
  const col = (name: string) => header.indexOf(name)
  const iExpr = col('expression')
  const iRead = col('reading')
  const iMean = col('meaning')
  const iTags = col('tags')
  if (iExpr < 0 || iRead < 0 || iMean < 0)
    throw new Error(`Unexpected CSV header: ${header.join(',')}`)

  const seen = new Set<string>()
  const seeds: VocabSeed[] = []
  for (const r of rows) {
    const expression = r[iExpr]?.trim()
    const reading = r[iRead]?.trim() || expression
    if (!expression) continue
    const id = `vocab:${expression}:${reading}`
    if (seen.has(id)) continue
    seen.add(id)
    const meanings = (r[iMean] ?? '')
      .split(/[,;]/)
      .map((m) => m.trim())
      .filter(Boolean)
    const tags = (r[iTags] ?? '')
      .split(/\s+/)
      .filter((t) => t && !t.startsWith('JLPT'))
    const kanjiUsed = [...expression].filter((ch) => n5KanjiChars.has(ch))
    seeds.push({ id, expression, reading, meanings, kanjiUsed, tags })
  }
  console.log(`  ${seeds.length} N5 vocab entries`)
  return seeds
}

async function fetchKanjiVg(kanji: KanjiSeed[]) {
  console.log('Fetching KanjiVG stroke-order SVGs…')
  await mkdir(kanjivgDir, { recursive: true })
  let fetched = 0
  let skipped = 0
  for (const k of kanji) {
    const hex = k.char.codePointAt(0)!.toString(16).padStart(5, '0')
    const dest = join(kanjivgDir, `${hex}.svg`)
    try {
      await access(dest)
      skipped++
      continue
    } catch {
      /* not cached yet */
    }
    const svg = await fetchText(`${KANJIVG_BASE}/${hex}.svg`)
    await writeFile(dest, svg)
    fetched++
  }
  console.log(`  ${fetched} fetched, ${skipped} already present`)
}

async function main() {
  await mkdir(dataDir, { recursive: true })

  const kanji = await buildKanji()
  await writeFile(
    join(dataDir, 'n5.kanji.json'),
    JSON.stringify(kanji, null, 1),
  )

  const vocab = await buildVocab(new Set(kanji.map((k) => k.char)))
  await writeFile(
    join(dataDir, 'n5.vocab.json'),
    JSON.stringify(vocab, null, 1),
  )

  await fetchKanjiVg(kanji)

  // Grammar is hand-authored; just validate it parses and report the count.
  try {
    const grammar = JSON.parse(
      await readFile(join(dataDir, 'n5.grammar.json'), 'utf8'),
    ) as unknown[]
    console.log(`Grammar (hand-authored): ${grammar.length} points`)
  } catch {
    console.warn('Grammar seed missing or invalid: src/data/n5.grammar.json')
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
