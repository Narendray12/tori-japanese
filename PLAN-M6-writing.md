# M6 — Writing practice and richer cards

## What I think

Right now Tori tests whether you *recognise* 日. It never asks whether you can
*produce* it. That is the biggest hole in the app, and it is the one thing a
paper flashcard cannot do but a phone can: watch you draw and tell you where
you went wrong, stroke by stroke, while you are still holding your finger down.

Two things make this worth building now rather than later:

**The data is already on disk.** Every KanjiVG file we ship carries each stroke
as an ordered centreline path, tagged with its stroke class (㇑ vertical, ㇐
horizontal, ㇕ hook), inside a fixed 109×109 box. It also carries the component
tree: 時 is 日 plus 寺, and 寺 is 土 plus 寸, with 日 marked as the radical. We
are shipping all of that today and showing none of it.

**We are not doing handwriting recognition.** Recognising an unknown scrawl is
hard. Checking a drawing against a character we already chose is not: we know
which stroke should come next and where it should go, so it reduces to
comparing two short polylines. That is a tractable, offline, dependency-free
problem.

The honest risk is not the algorithm, it is the tuning. Stroke checking that
rejects a stroke a human would accept is worse than no stroke checking at all,
because the app becomes a liar you have to argue with. Most of the effort below
is spent on leniency, on good failure messages, and on always leaving you a way
to overrule the grader.

One scope correction: **drawing applies to kanji, not grammar.** A grammar
point has nothing to draw. Grammar and vocabulary get the other half of this
work: audio everywhere, pitch accent, and more worked examples.

---

## 1. What goes into each card

### Kanji
| Addition | Source | Notes |
|---|---|---|
| Component breakdown (時 → 日 + 寺 → 土 + 寸) | KanjiVG `kvg:element`, already shipped | The single best mnemonic aid there is; free |
| Which component is the radical | KanjiVG `kvg:radical` | Shown as a labelled chip |
| Animated stroke order | KanjiVG paths + `stroke-dasharray` | Replaces today's static diagram; play/replay/step |
| Audio on every reading | Web Speech, already shipped | Tap 音 or 訓 to hear it |
| Example words per reading | our vocab, filtered by `kanjiUsed` | Shows *which* reading a word uses |
| Your own mnemonic | new, user-editable | Stored per item, included in backups |

### Vocabulary
| Addition | Source | Notes |
|---|---|---|
| Pitch accent | [kanjium accents.txt](https://github.com/mifunetoshiro/kanjium) | 124k entries; we need ~718, so ~20 KB after filtering. **License is listed as "Other" and must be read before bundling.** |
| Audio | already shipped | Also on the front of the card, not only the back |
| Kanji breakdown | already have `kanjiUsed` | Tap through to each kanji |
| Example sentence | Tatoeba, or authored | Currently only grammar has sentences |

### Grammar
| Addition | Source | Notes |
|---|---|---|
| Audio on every example | Web Speech | The examples exist and are silent today |
| All examples, not just the first | already in the data | The card shows `examples[0]` and hides the rest |
| Related and contrasted points | authored | に vs で, は vs が: the confusions that actually cost marks |
| Conjugation table | authored, where it applies | For て-form, past, negative |

---

## 2. How drawing gets evaluated

### The input
A `<canvas>` (or pointer-events on an SVG) sized to a square, captured as a
list of strokes, each stroke a list of `[x, y]` points. Scale the canvas to
KanjiVG's 109×109 space on capture, so everything downstream is in one
coordinate system.

### The reference
At build time, extend `scripts/build-data.ts` to emit `n5.strokes.json`:

```
"kanji:時": {
  "strokes": ["M31.5,24.5c1.12...", ...],   // ordered centrelines
  "medians": [[[31,24],[32,29],...], ...],  // ~32 sampled points per stroke
  "types":   ["㇑", "㇕a", "㇐a", ...]        // stroke class per stroke
}
```

Medians come from sampling each path with `getPointAtLength` in a headless
browser during the build, the same trick already used to render the icons. No
new runtime dependency.

### The comparison
For the expected stroke *n* and the user's stroke:

1. **Resample** both to 32 evenly spaced points.
2. **Shape and position**: mean Euclidean distance between paired points,
   normalised by the character box. Under ~12 units (of 109) passes.
3. **Direction**: angle between the start→end vectors. Over ~55° fails, and
   this is the check that catches a horizontal drawn right-to-left, which is
   the single most common beginner error.
4. **Extent**: ratio of path lengths, to reject a dash where a full stroke
   belongs.
5. **Order**: if the stroke fails against *n* but passes against a later
   stroke, report an order mistake rather than a shape mistake.

### What it says when you get it wrong
Generic "wrong" is useless. The checks above each map to a specific sentence:

| Detected | Message |
|---|---|
| Direction reversed | "Draw this one left to right." / "top to bottom" |
| Matches a later stroke | "That is stroke 4. Stroke 2 comes first." |
| Too short | "Take it all the way across." |
| Shape off, right area | "Close. Watch the curve." |
| Nothing matches | "Not quite" plus a hint animation of just that stroke |

Two failed attempts on the same stroke animates the correct stroke, then asks
you to trace it. That mirrors how HanziWriter's quiz behaves, which is the
best-tested version of this interaction on the web.

### Leniency, and the escape hatch
A **Strictness** setting with three positions: Relaxed (shape only), Normal
(shape and direction, the default), Strict (adds order). Whatever the grader
says, the review screen always keeps a "**I wrote it correctly**" button.
The grader is an assistant, not a referee.

---

## 3. Where drawing shows up

- **In a lesson.** A new step after the meaning and readings: the character is
  shown faintly and you trace it once. Not graded, just muscle memory.
- **As a review card.** A new `writing` facet on kanji items, scheduled by FSRS
  like any other. Empty box, faint centre guides, character drawn from memory.
  79 new cards at N5.
- **In practice mode.** "Quiz this set" gains a writing-only option, so you can
  drill one theme's kanji by hand without touching the schedule.
- **On the item page.** A permanent scratch canvas for practising a character
  as many times as you like, with the animation beside it.

### Grading into FSRS
| What happened | Rating |
|---|---|
| Every stroke first try | Easy |
| One or two retries, no hint | Good |
| Several retries, or an order mistake | Hard |
| Hint animation shown, or gave up | Again |

---

## 4. Milestones

**W1 — Stroke data and the matcher.** Extend the build script to emit strokes,
medians, and types. Write the comparison as a pure, tested module: resampling,
distance, direction, order detection, and the message each failure maps to.
*Done when:* a test replays a set of known-good and known-bad strokes for 日,
語, and 休 and the matcher classifies every one correctly.

**W2 — The canvas.** Drawing surface with pointer capture, undo the last
stroke, clear, and per-stroke feedback as you lift your finger. Animated
stroke order with play, replay and step.
*Done when:* you can draw 日 on a phone, get told which stroke was wrong and
why, and watch the correct one animate.

**W3 — Wire it into study.** The `writing` facet, the lesson tracing step, the
practice option, and the item-page scratch canvas. Strictness setting.
*Done when:* writing cards appear in reviews, schedule correctly, and a browser
test drives a full writing review end to end.

**W4 — Richer cards.** Component breakdown with radical, audio on every reading
and example, all grammar examples, pitch accent if the license allows, and the
mnemonic field.
*Done when:* a kanji card shows its parts, every Japanese string on screen can
be heard, and mnemonics survive a backup and restore.

---

## 5. Risks, and what I would cut

- **Tuning is the whole game.** Thresholds above are a starting point, not a
  result. W1 ends with a test corpus precisely so tuning is measurable instead
  of a matter of opinion.
- **Finger drawing is coarse.** Small strokes inside dense characters (語 has
  14) will be the worst case. The canvas needs to be large, and Relaxed mode
  needs to be genuinely relaxed.
- **Pitch accent may not be bundleable.** If kanjium's license does not permit
  it, drop pitch accent rather than fudge it. Everything else here stands
  alone.
- **Kana are not in the app at all.** KanjiVG covers hiragana and katakana, so
  the same canvas would teach あ and ア for nearly free. Tempting, but it is a
  new content type and belongs in its own milestone, not smuggled into this one.
- **What I would cut first** if this gets long: the conjugation tables and the
  authored "related points" prose. They are real work for modest gain next to
  the drawing surface.

## 6. What this does not do

No cloud recognition, no accounts, no per-card audio downloads. Everything
above runs on the device, offline, from data the app already carries or a
~20 KB addition. That constraint is what makes Tori worth having, and this
feature does not get to break it.
