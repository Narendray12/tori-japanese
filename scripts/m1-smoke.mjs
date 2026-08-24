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

await page.goto(`http://localhost:${PORT}/`)
await page.waitForSelector('text=cards in rotation', { timeout: 20000 })
await page.screenshot({ path: `${OUT}/m1-today-before.png` })

// Start a lesson
await page.click('text=Learn')
await page.waitForSelector('text=Lesson')
await page.screenshot({ path: `${OUT}/m1-lesson-teach.png` })

// Page through the teach carousel to the quiz
while (await page.isVisible('button:has-text("Next")')) {
  await page.click('button:has-text("Next")')
  await page.waitForTimeout(150)
}
await page.click('button:has-text("Start quiz")')
await page.waitForSelector('text=Lesson quiz')

// Answer everything Good until the summary stamp appears
let shotTaken = false
for (let i = 0; i < 120; i++) {
  if (await page.isVisible('text=Session complete')) break
  if (await page.isVisible('button:has-text("Show answer")')) {
    await page.click('button:has-text("Show answer")')
    if (!shotTaken) {
      await page.waitForTimeout(200)
      await page.screenshot({ path: `${OUT}/m1-quiz-revealed.png` })
      shotTaken = true
    }
  } else if (await page.isVisible('button:has-text("Good")')) {
    await page.click('button:has-text("Good")')
  }
  await page.waitForTimeout(120)
}
await page.waitForSelector('text=Session complete', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/m1-summary.png` })

await page.click('text=Back to Today')
await page.waitForSelector('text=cards in rotation')
await page.screenshot({ path: `${OUT}/m1-today-after.png` })

// Inspect resulting DB state
const state = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const all = (store) =>
    new Promise((res) => {
      const r = dbi.transaction(store).objectStore(store).getAll()
      r.onsuccess = () => res(r.result)
    })
  const cards = await all('cards')
  const logs = await all('reviewLogs')
  const introduced = cards.filter((c) => c.introduced === 1)
  return {
    introducedCards: introduced.length,
    introducedItems: new Set(introduced.map((c) => c.itemId)).size,
    reviews: logs.length,
    futureDue: introduced.filter((c) => new Date(c.fsrs.due) > new Date()).length,
    sampleDue: introduced.slice(0, 3).map((c) => ({ id: c.id, due: c.fsrs.due, state: c.fsrs.state })),
  }
})
console.log('DB state:', JSON.stringify(state, null, 1))
console.log('Console errors:', errors.length ? errors : 'none')
await browser.close()
