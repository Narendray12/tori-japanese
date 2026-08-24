/**
 * Proves the happy path of typed grading: look up the real reading for the
 * kanji on screen, type it, and expect it to be accepted.
 */
import { chromium } from 'playwright'

const OUT = process.env.SHOT_DIR ?? 'scripts/shots'
const PORT = process.env.PORT ?? '5176'
const browser = await chromium.launch()
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
let failures = 0
const check = (c, m) => {
  console.log(c ? '  ok: ' + m : 'FAILED: ' + m)
  if (!c) failures++
}

await page.goto(`http://localhost:${PORT}/lessons`)
await page.waitForSelector('button:has-text("Next"), button:has-text("Start quiz")', { timeout: 20000 })
while (await page.isVisible('button:has-text("Next")')) {
  await page.click('button:has-text("Next")')
  await page.waitForTimeout(100)
}
await page.click('button:has-text("Start quiz")')
await page.waitForTimeout(500)

let tested = false
for (let i = 0; i < 60 && !tested; i++) {
  const facet = (await page.locator('main .uppercase').nth(1).textContent()) ?? ''

  if (/Reading/i.test(facet) && (await page.isVisible('input[aria-label="Your answer"]'))) {
    const glyph = (await page.locator('main .glyph').first().textContent()).trim()
    const readings = await page.evaluate(async (ch) => {
      const req = indexedDB.open('tori')
      const dbi = await new Promise((r) => (req.onsuccess = () => r(req.result)))
      const q = dbi.transaction('items').objectStore('items').get('kanji:' + ch)
      const item = await new Promise((r) => (q.onsuccess = () => r(q.result)))
      return item ? [...item.readingsOn, ...item.readingsKun] : []
    }, glyph)
    const answer = readings.find((r) => !/[.\-]/.test(r)) ?? readings[0]
    console.log(`typing "${answer}" for ${glyph} (accepted: ${readings.join(', ')})`)

    // Type kana directly to bypass the romaji IME for a deterministic test.
    await page.fill('input[aria-label="Your answer"]', answer)
    await page.click('button:has-text("Check")')
    await page.waitForTimeout(300)

    check(await page.isVisible('text=Correct'), 'a correct reading is accepted')
    check(
      await page.isVisible('button:has-text("Good")'),
      'a correct answer offers Hard / Good / Easy',
    )
    check(
      !(await page.isVisible('button:has-text("Got it wrong")')),
      'a correct answer does not force Again',
    )
    await page.screenshot({ path: `${OUT}/m3-typed-correct.png` })
    tested = true
    break
  }

  // Advance past whatever card this is.
  for (const sel of [
    'button:has-text("Show answer")',
    "button:has-text(\"I don't know\")",
  ]) {
    if (await page.isVisible(sel)) {
      await page.click(sel)
      break
    }
  }
  await page.waitForTimeout(150)
  for (const label of ['Good', 'Got it wrong', 'Again']) {
    if (await page.isVisible(`button:has-text("${label}")`)) {
      await page.click(`button:has-text("${label}")`)
      break
    }
  }
  await page.waitForTimeout(150)
}

check(tested, 'found a typed reading card to test')
console.log('Page errors:', errors.length ? errors : 'none')
await browser.close()
process.exitCode = failures ? 1 : 0
