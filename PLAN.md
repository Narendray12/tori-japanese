# 鳥 Tori — A Free, Smarter Anki for Japanese (JLPT N5 → beyond)

A local-first, installable web app (PWA) that replaces paid AnkiMobile for learning Japanese.
Ships preloaded with both kana syllabaries and the full JLPT N5 syllabus (kanji, vocabulary, grammar), uses the modern
**FSRS** scheduling algorithm (the one Anki itself adopted in 2023), and is built around
**scoped study** — you pick exactly which items you're working on (e.g. 10 kanji) and the app
quizzes you from only those until you expand the set.

---

## 1. Why these choices

### Platform: PWA (React + TypeScript + Vite), not a native iOS app
- **Free on iPhone.** Installable from Safari → "Add to Home Screen". Full-screen, offline,
  no App Store, no $25 AnkiMobile fee, no Apple developer account.
- **Local-first.** All data lives in IndexedDB on the device. No server, no account, no cost.
  Export/import gives backup and manual cross-device transfer; real sync is a stretch goal.
- One codebase works on iPhone, desktop, and Android.

### Algorithm: FSRS (via `ts-fsrs`), not SM-2
- FSRS models actual memory decay (Difficulty–Stability–Retrievability) instead of SM-2's
  fixed 1987 formula. Benchmarks on 500M+ real Anki reviews show ~20–30% fewer reviews for
  the same retention, and better recall prediction in ~99.6% of collections.
- `ts-fsrs` is the official TypeScript implementation from the open-spaced-repetition org —
  maintained, small, and gives us `Again / Hard / Good / Easy` scheduling out of the box.
- User-facing knob: a single **desired retention** slider (default 0.90) instead of Anki's
  maze of ease/interval settings. This alone is a big "better than Anki" UX win.

### Data: bundled at build time from open sources
| Content | Source | Size (N5) |
|---|---|---|
| Kanji (meanings, on/kun readings, JLPT level, examples) | [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data) (KANJIDIC-derived) + [kanjiapi.dev](https://kanjiapi.dev) | ~80–103 kanji |
| Vocabulary (word, reading, meaning, POS) | [jamsinclair/open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) (CSV, actively maintained) + [Bluskyo/JLPT_Vocabulary](https://github.com/Bluskyo/JLPT_Vocabulary) (Tanos lists) | ~700–800 words |
| Grammar points (structure, meaning, examples) | Tanos N5 grammar list as skeleton; examples hand-curated + Tatoeba; we author our own explanation JSON (Bunpro content is proprietary — don't copy) | ~120 points |
| Example sentences | [Tatoeba / Tanaka Corpus](https://tatoeba.org) (CC-BY) | as needed |
| Stroke order animations | [KanjiVG](https://kanjivg.tagaini.net/) SVGs (CC-BY-SA) | per kanji |
| Audio | Web Speech API (`ja-JP` TTS) — free, offline on iOS/macOS | n/a |

A build-time script (`scripts/build-data.ts`) downloads/normalizes these into versioned JSON
seed files committed to the repo, so the app never depends on third-party APIs at runtime.

---

## 2. Core concepts & data model

```
Item      — one thing to learn: kanji | vocab | grammar
            { id, type, primary (字/語/文型), readings, meanings, examples[],
              strokeSvg?, links[] (kanji↔vocab↔grammar cross-refs), tags[] }

Card      — one testable facet of an Item (this is what FSRS schedules):
            kanji  → meaning, reading
            vocab  → JP→EN (recognition), EN→JP (recall), listening
            grammar→ cloze fill-in, meaning
            { id, itemId, facet, fsrs: {due, stability, difficulty, state, reps, lapses}, suspended }

ReviewLog — { cardId, rating, reviewedAt, elapsed, stateBefore/After }  → powers stats + future FSRS optimization

StudySet  — user-defined scope: { id, name, itemIds[], newPerDay, activeFacets[] }
            THE key feature: reviews & lessons draw ONLY from the active set(s).

Settings  — desired retention, daily new limit, theme, quiz modes on/off, etc.
```

Storage: **Dexie.js** over IndexedDB. Everything serializable to a single JSON export file.

### Scoped study — "ask me only from my 10 kanji"
- Library screen shows all N5 content grouped (kanji grid, vocab list, grammar list) with
  search + filters (POS, tag, kanji-used, learned/unlearned).
- Select any items → "Add to Study Set" (or create a new set: *"Week 1 Kanji"*).
- Sets can be activated/deactivated. The review queue = due cards whose item ∈ active sets.
- Preset sets ship with the app: *N5 Kanji by frequency (batches of 10)*, *Genki I ch. order*,
  *Verbs only*, *Days & numbers*, etc.
- One-tap **"Quiz this set now"** = cram mode: shuffled quiz over the set that does **not**
  touch FSRS state (Anki's custom study, but discoverable).

---

## 3. Better-than-Anki feature set

Curated from what makes WaniKani, Bunpro, Renshuu, and modern Anki good:

**Review experience**
- Clean full-screen card UI, big Japanese type, swipe/keyboard/tap for the 4 ratings.
- FSRS shows the *next interval* under each rating button (like Anki) — but in human words ("3 days").
- **Undo** last answer (Anki buries this; we make it a visible button).
- **Typed answers** with [WanaKana](https://github.com/WanaKana/WanaKana) — type romaji, get kana
  live; fuzzy-match meanings (WaniKani-style) so "to eat" ≈ "eat".
- Multiple modes per session, auto-mixed: flip-card, type-the-reading, multiple choice,
  listening (TTS says the word → you answer), grammar cloze (Bunpro-style 文 with blank).
- Session summary screen: accuracy, time, items that struggled.
- **Lesson flow** for new items (WaniKani-style): teach first (meaning, readings, examples,
  stroke animation) → immediate mini-quiz → only then enters the SRS queue.

**Intelligence**
- **Leech detection**: card with ≥N lapses gets flagged, auto-suggests moving it to a
  "problem items" set with extra context (mnemonics field, more example sentences).
- **Load balancing / review forecast**: chart of upcoming due counts; new-card throttle
  suggests reducing lessons when a backlog is building.
- Cross-links: a vocab card shows the kanji it uses (tap → kanji detail); a kanji shows N5
  vocab containing it; grammar examples highlight known vs unknown vocab.
- Desired-retention slider with plain-language explanation of the tradeoff.
- (Stretch) FSRS parameter optimization from your own ReviewLog once ≥1000 reviews exist.

**Motivation & stats**
- GitHub-style review heatmap, streak counter, per-type progress rings
  ("Kanji 42/103 · Vocab 210/720 · Grammar 18/120"), JLPT-readiness % per category.
- Milestone toasts ("All Week-1 kanji at Stability > 30 days 🎉").

**App quality**
- Installable PWA, 100% offline after first load, instant start.
- Dark/light theme, mobile-first layout, keyboard shortcuts on desktop (1-4 to rate, space to flip).
- Full JSON export/import (backup, move devices), plus Anki .apkg **import** as a stretch goal.

---

## 4. Milestones

### M0 — Foundation & data pipeline ✅ (done 2026-08-24)
- Scaffold: Vite + React + TS, Tailwind, Dexie, ts-fsrs, wanakana, vite-plugin-pwa. Vitest for tests.
- `scripts/build-data.ts`: pull + normalize kanji/vocab/grammar/sentences/KanjiVG into
  `src/data/n5.{kanji,vocab,grammar}.json` with stable IDs. License attributions file.
- DB schema + seed-on-first-run + migration versioning.
- **Done when:** app boots, DB is seeded with full N5 content, data visible in a debug list.

### M1 — Core SRS loop ✅ (done 2026-08-24 — usable daily from this point)
- Review queue (due cards → session), flip-card UI, 4 rating buttons with interval preview,
  ts-fsrs state updates, ReviewLog writes, undo, session summary.
- Lesson flow for new items with daily new-limit.
- **Done when:** you can learn and review the whole N5 deck end-to-end with correct scheduling
  (unit tests around scheduling edge cases: overdue, same-day relearn, timezone/day rollover).

### M2 — Library & study sets ✅ (done 2026-08-24 — the customization centerpiece)
- Browse screens: kanji grid, vocab list, grammar list; search (romaji/kana/kanji/English), filters.
- Item detail pages (readings, examples, stroke order SVG animation, cross-links).
- StudySet CRUD, activate/deactivate, preset sets, queue scoping, cram mode.
- **Done when:** "select 10 kanji → only those appear in lessons/reviews" works, plus cram quiz.

### M3 — Rich quiz modes ✅ (done 2026-08-25)
- Typed answers (wanakana kana input + fuzzy meaning matching), multiple choice,
  listening mode (Web Speech TTS), grammar cloze cards.
- Per-set facet toggles (e.g. reading-only for kanji).
- **Done when:** a session mixes modes and each facet schedules independently.

### M4 — Stats & intelligence ✅ (done 2026-08-25)
- Heatmap, streaks, forecast chart, retention stats, progress rings, leech detection + problem set.
- **Done when:** dashboard reflects real ReviewLog data and leeches auto-surface.

### M5 — PWA polish & durability ✅ (done 2026-08-25)
- Offline service worker, iOS install flow (splash/icons/safe-areas), dark mode,
  keyboard shortcuts, JSON export/import, onboarding tour.
- **Done when:** installed on your iPhone, works in airplane mode, survives export→wipe→import.

### M6 — Stretch
- FSRS optimizer from personal logs · Anki .apkg import · optional cloud sync ·
  mnemonic fields with community/AI suggestions · N4 content pack · handwriting-input kanji quiz.

Ordering rationale: after **M1 you can already study daily** while later milestones land —
the app becomes its own dogfooding loop.

---

## 5. Project structure

```
japaneselearning/
├── PLAN.md
├── scripts/build-data.ts        # dataset download + normalization (run at dev time)
├── src/
│   ├── data/                    # generated JSON seeds (committed)
│   ├── db/                      # Dexie schema, seed, migrations, export/import
│   ├── srs/                     # ts-fsrs wrapper, queue builder, leech logic (pure, tested)
│   ├── features/
│   │   ├── review/              # session engine + card renderers per mode
│   │   ├── lessons/
│   │   ├── library/             # browse, search, item detail
│   │   ├── sets/                # study set management
│   │   └── stats/
│   ├── components/              # shared UI
│   └── app/                     # routes, shell, theme, settings
└── public/                      # PWA manifest, icons, KanjiVG svgs
```

## 6. Licensing notes (all bundled data must ship attributions)
- KANJIDIC/JMdict/Tatoeba: CC-BY-SA / CC-BY — attribution page in app settings.
- KanjiVG: CC-BY-SA 3.0.
- Grammar explanations: **write our own** (skeleton list of point names from public Tanos
  lists is fine; Bunpro/WaniKani prose is copyrighted).

## 7. Sources
- FSRS vs SM-2: [Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm), [Neurako comparison](https://www.neurako.com/blog/fsrs-vs-sm2-spaced-repetition-algorithms-compared), [Kachika explainer](https://kachika.app/en/blog/spaced-repetition-algorithms/)
- [ts-fsrs (npm)](https://www.npmjs.com/package/ts-fsrs) · [docs](https://open-spaced-repetition.github.io/ts-fsrs/)
- Datasets: [kanji-data](https://github.com/davidluzgouveia/kanji-data), [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks), [JLPT_Vocabulary (Tanos)](https://github.com/Bluskyo/JLPT_Vocabulary), [kanjiapi.dev](https://kanjiapi.dev), [KanjiVG](https://kanjivg.tagaini.net/), [Tatoeba](https://tatoeba.org), [Jisho about (resource lineage)](https://jisho.org/about)
- App landscape: [WaniKani/Bunpro/Renshuu comparison](https://languavibe.com/bunpro-vs-renshuu/), [2026 app comparison](https://immit.co/blog/best-app-for-learning-japanese-in-2026-an-honest-comparison)

---

## Status — all core milestones shipped (2026-08-25)

M0 through M5 are built and verified. The app is a complete, installable,
offline JLPT N5 trainer.

**Verification.** 67 unit tests plus five browser suites that drive the real UI
and read the resulting database:

| Suite | What it proves |
|---|---|
| `m1-smoke.mjs` | a lesson teaches, quizzes, and schedules with FSRS |
| `m2-smoke.mjs` | picking N items restricts lessons and reviews to exactly those; practice never alters the schedule |
| `m2-upgrade-smoke.mjs` | a database written by an older build recovers instead of hiding sets |
| `m3-smoke.mjs` / `m3-correct-answer.mjs` | typed, multiple-choice and fill-in-the-blank cards grade correctly both ways |
| `m4-smoke.mjs` | streak, recall, forecast and heatmap render real geometry from real history |
| `m5-smoke.mjs` | settings persist, dark mode repaints, backup survives a wipe, and the app runs with the network off |

Run them with the dev server on (`npm run dev`) for m1–m4 and `npx vite preview`
for m5, passing `PORT=`.

### Known limits
- **Webfonts offline.** App code, data, and stroke diagrams are precached, so
  everything works offline. The Japanese webfonts are not: Google splits them
  into ~100 subsets per weight and precaching them would cost several MB.
  Offline, text falls back to Hiragino Mincho and Hiragino Sans on Apple
  devices. It self-heals once online.
- **Listening cards** need a system Japanese voice. Without one they are left
  out of the queue rather than shown unanswerable.
- **One device.** Backup and restore move progress between devices by hand;
  there is no sync.

### M6 — writing practice and richer cards
Planned in detail in [PLAN-M6-writing.md](PLAN-M6-writing.md): draw kanji and get
graded stroke by stroke, audio on everything, component breakdowns, and pitch
accent.

### Later
FSRS parameter optimization from personal history · Anki .apkg import · optional
cloud sync · an N4 content pack · kana writing practice.
