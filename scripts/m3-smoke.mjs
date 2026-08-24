/** M3: typed answers, multiple choice, cloze, and grading behaviour. */
import { chromium } from 'playwright'

const OUT = process.env.SHOT_DIR ?? 'scripts/shots'
const PORT = process.env.PORT ?? '5176'
const browser = await chromium.launch()
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
).newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
let failures = 0
const check = (cond, msg) => {
  if (!cond) {
    console.error('FAILED:', msg)
    failures++
  } else console.log('  ok:', msg)
}

const url = (p = '') => `http://localhost:${PORT}${p}`

// Learn a batch so there is something to review.
await page.goto(url('/lessons'))
await page.waitForSelector('button:has-text("Next"), button:has-text("Start quiz")', { timeout: 20000 })
while (await page.isVisible('button:has-text("Next")')) {
  await page.click('button:has-text("Next")')
  await page.waitForTimeout(120)
}
await page.click('button:has-text("Start quiz")')
await page.waitForTimeout(600)

console.log('\n--- quiz modes seen during the lesson quiz ---')
const modesSeen = new Set()
const facetsSeen = new Set()
let typedCorrect = 0
let typedWrong = 0

for (let i = 0; i < 200; i++) {
  if (await page.isVisible('text=Session complete')) break

  const facet = await page
    .locator('main .uppercase')
    .nth(1)
    .textContent()
    .catch(() => null)
  if (facet) facetsSeen.add(facet.trim())

  const hasInput = await page.isVisible('input[aria-label="Your answer"]')
  const hasChoices = await page.isVisible('main button:has-text("Play again")')
    ? true
    : (await page.locator('main >> button').count()) > 0 &&
      (await page.isVisible('button:has-text("I don\'t know")'))

  if (hasInput) {
    modesSeen.add('typed')
    // Answer deliberately wrong first to prove wrong answers force Again.
    if (typedWrong === 0) {
      await page.fill('input[aria-label="Your answer"]', 'zzzz')
      await page.click('button:has-text("Check")')
      await page.waitForTimeout(250)
      const forcedAgain = await page.isVisible('button:has-text("Got it wrong")')
      const echoed = await page.isVisible('text=You answered')
      check(forcedAgain, 'a wrong typed answer offers only Again')
      check(echoed, 'the wrong answer is echoed back to the user')
      await page.screenshot({ path: `${OUT}/m3-typed-wrong.png` })
      typedWrong++
      await page.click('button:has-text("Got it wrong")')
      await page.waitForTimeout(200)
      continue
    }
    // Otherwise reveal the answer via "I don't know" to keep moving.
    await page.click("button:has-text(\"I don't know\")")
    await page.waitForTimeout(150)
    if (await page.isVisible('button:has-text("Got it wrong")'))
      await page.click('button:has-text("Got it wrong")')
    await page.waitForTimeout(150)
    continue
  }

  if (await page.isVisible('button:has-text("Show answer")')) {
    modesSeen.add('flip')
    await page.click('button:has-text("Show answer")')
    await page.waitForTimeout(120)
    if (await page.isVisible('button:has-text("Good")')) await page.click('button:has-text("Good")')
    await page.waitForTimeout(120)
    continue
  }

  if (await page.isVisible("button:has-text(\"I don't know\")")) {
    modesSeen.add('choice')
    if (typedCorrect === 0) {
      await page.screenshot({ path: `${OUT}/m3-choice.png` })
      typedCorrect++
    }
    // Click the first option button inside the card.
    const opts = page.locator('main div.rounded-xl button')
    const n = await opts.count()
    if (n > 0) await opts.nth(0).click()
    else await page.click("button:has-text(\"I don't know\")")
    await page.waitForTimeout(200)
    for (const label of ['Good', 'Got it wrong', 'Again']) {
      if (await page.isVisible(`button:has-text("${label}")`)) {
        await page.click(`button:has-text("${label}")`)
        break
      }
    }
    await page.waitForTimeout(150)
    continue
  }
  break
}

console.log('modes exercised:', [...modesSeen].join(', '))
console.log('facets seen:', [...facetsSeen].join(' | '))
check(modesSeen.has('typed'), 'typed-answer cards appeared')
check(modesSeen.has('choice'), 'multiple-choice cards appeared')
check(
  [...facetsSeen].some((f) => /FILL IN/i.test(f)),
  'grammar fill-in-the-blank cards appeared',
)

await page.screenshot({ path: `${OUT}/m3-end.png` })

// Cloze rendering: a blank must actually be shown.
const state = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((res) => (req.onsuccess = () => res(req.result)))
  const all = (s) =>
    new Promise((r) => {
      const q = dbi.transaction(s).objectStore(s).getAll()
      q.onsuccess = () => r(q.result)
    })
  const cards = await all('cards')
  const introduced = cards.filter((c) => c.introduced === 1)
  const byFacet = {}
  for (const c of introduced) byFacet[c.facet] = (byFacet[c.facet] ?? 0) + 1
  const logs = await all('reviewLogs')
  return { introduced: introduced.length, byFacet, reviews: logs.length }
})
console.log('DB:', JSON.stringify(state))
check(state.byFacet.cloze > 0, 'cloze cards are scheduled in the database')
check(state.reviews > 0, 'reviews were recorded')

console.log('\nConsole errors:', errors.length ? errors : 'none')
if (errors.length) failures++
await browser.close()
process.exitCode = failures ? 1 : 0
