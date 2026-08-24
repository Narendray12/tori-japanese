# 鳥 Tori

A free, offline flashcard app for JLPT N5 Japanese. Install it to your phone's
home screen from the browser: no App Store, no account, no subscription.

Built because AnkiMobile costs money on iOS and its interface fights you.

## What it does

- **The whole N5 syllabus, already loaded.** 79 kanji with stroke-order
  diagrams, 718 vocabulary words, and 61 grammar points with worked examples.
- **Modern scheduling.** Reviews are timed by [FSRS](https://github.com/open-spaced-repetition),
  the algorithm Anki adopted in 2023, which needs fewer reviews than the old
  SM-2 formula for the same recall. One slider sets how well you want to
  remember; the app works out the rest.
- **Study only what you choose.** Pick ten kanji in the library, save them as a
  set, and lessons and reviews come from those ten alone until you widen it.
  Two dozen ready-made sets ship with the app, including one per kanji theme
  and the first six Genki chapters.
- **Asked in the way that suits the card.** Type readings with romaji turning
  into kana as you go, pick meanings from four options, hear a word and say
  what it means, or fill the blank in a sentence.
- **Kanji in a sensible order.** Numbers first, then the weekday kanji, then
  time, people, and position, rather than raw frequency.
- **Progress you can see.** Streaks, recall rate, a review heatmap, a two-week
  forecast, and a list of the cards that keep catching you out.
- **Yours, on your device.** Everything lives in the browser's local database.
  Nothing is uploaded. Save a backup file whenever you like.

## Running it

```bash
npm install
npm run dev
```

Rebuild the bundled datasets (only needed if you change the pipeline):

```bash
npm run data
```

## Testing

```bash
npm test          # unit tests
```

The browser suites in `scripts/` drive the real interface and then read the
database to check what actually happened. Start a server first, then point a
suite at it:

```bash
npm run dev                                   # for m1 to m4
PORT=5176 node scripts/m3-smoke.mjs

npm run build && npx vite preview --port 4173 # for m5, which needs the service worker
PORT=4173 node scripts/m5-smoke.mjs
```

## Deploying

Pushing to `main` builds the app and publishes it to GitHub Pages. A service
worker only runs over HTTPS or on localhost, so serving the folder over a plain
local network address gives you the app but not the offline part.

## Credits

Kanji data from [KANJIDIC](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project)
via [kanji-data](https://github.com/davidluzgouveia/kanji-data), vocabulary from
[open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) after
Jonathan Waller's JLPT lists, and stroke diagrams from
[KanjiVG](https://kanjivg.tagaini.net/). Grammar explanations are written for
this project. Full terms in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

[PLAN.md](PLAN.md) has the design notes and what is left to build.
