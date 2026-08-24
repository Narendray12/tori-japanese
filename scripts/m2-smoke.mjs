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
const fail = (msg) => {
  console.error('ASSERTION FAILED:', msg)
  process.exitCode = 1
}

// --- Sets page ships with presets -------------------------------------------
await page.goto(`http://localhost:${PORT}/sets`)
await page.waitForSelector('text=Studying everything', { timeout: 20000 })
const presetNames = await page.$$eval('h3', (hs) => hs.map((h) => h.textContent))
console.log('Presets:', presetNames.join(' | '))
await page.screenshot({ path: `${OUT}/m2-sets.png` })

// --- Select three specific kanji in the library ------------------------------
await page.goto(`http://localhost:${PORT}/library`)
await page.waitForSelector('.glyph', { timeout: 10000 })
await page.fill('input[type="search"]', 'moon')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/m2-search.png` })
await page.fill('input[type="search"]', '')
await page.waitForTimeout(300)

const tiles = page.locator('ul.grid > li button[aria-pressed]')
const chosen = []
for (let i = 0; i < 3; i++) {
  const t = tiles.nth(i)
  chosen.push((await t.locator('.glyph').textContent()).trim())
  await t.click()
}
console.log('Selected kanji:', chosen.join(''))
await page.waitForSelector('text=3 selected')
await page.screenshot({ path: `${OUT}/m2-selection.png` })

// --- Put them in a new (auto-activated) set ----------------------------------
await page.click('button:has-text("Add to set")')
await page.waitForSelector('text=Add 3 items to a set')
await page.fill('#new-set-name', 'Week 1 kanji')
await page.screenshot({ path: `${OUT}/m2-sheet.png` })
await page.click('button:has-text("Create")')
await page.waitForTimeout(600)

// --- Today reflects the active scope -----------------------------------------
await page.goto(`http://localhost:${PORT}/`)
await page.waitForSelector('text=cards in rotation')
const scopeLine = await page.textContent('a[href="/sets"]').catch(() => null)
if (!scopeLine?.includes('Week 1 kanji')) fail(`Today should name the active set, got: ${scopeLine}`)
const learnBtn = await page.textContent('a[href="/lessons"]')
if (!learnBtn.includes('3')) fail(`Lesson budget should be capped at 3 by scope, got: ${learnBtn}`)
console.log('Today scope line:', scopeLine?.trim(), '| lesson button:', learnBtn.trim())
await page.screenshot({ path: `${OUT}/m2-today-scoped.png` })

// --- The lesson must contain ONLY the selected kanji --------------------------
await page.click('a[href="/lessons"]')
await page.waitForSelector('button:has-text("Next"), button:has-text("Start quiz")')
const taught = []
for (let i = 0; i < 10; i++) {
  taught.push((await page.locator('main .glyph').first().textContent()).trim())
  if (await page.isVisible('button:has-text("Next")')) {
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(200)
  } else break
}
console.log('Taught in lesson:', taught.join(''))
const extra = taught.filter((t) => !chosen.includes(t))
if (extra.length) fail(`Lesson leaked out-of-scope items: ${extra.join('')}`)
if (new Set(taught).size !== 3) fail(`Expected exactly 3 items, saw ${new Set(taught).size}`)

// --- Quiz them, then confirm the queue stays inside the set -------------------
await page.click('button:has-text("Start quiz")')
for (let i = 0; i < 60; i++) {
  if (await page.isVisible('text=Session complete')) break
  if (await page.isVisible('button:has-text("Show answer")')) await page.click('button:has-text("Show answer")')
  else if (await page.isVisible('button:has-text("Again")')) await page.click('button:has-text("Again")')
  await page.waitForTimeout(100)
}
await page.goto(`http://localhost:${PORT}/`)
await page.waitForSelector('text=cards in rotation')
await page.screenshot({ path: `${OUT}/m2-today-after-quiz.png` })

const state = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const all = (s) =>
    new Promise((r) => {
      const q = dbi.transaction(s).objectStore(s).getAll()
      q.onsuccess = () => r(q.result)
    })
  const [cards, sets] = [await all('cards'), await all('studySets')]
  const active = sets.filter((s) => s.active === 1)
  const scope = new Set(active.flatMap((s) => s.itemIds))
  const introduced = cards.filter((c) => c.introduced === 1)
  return {
    sets: sets.length,
    activeSet: active.map((s) => `${s.name} (${s.itemIds.length})`),
    introducedItems: [...new Set(introduced.map((c) => c.itemId))],
    introducedOutsideScope: [
      ...new Set(introduced.map((c) => c.itemId).filter((id) => !scope.has(id))),
    ],
  }
})
console.log('DB:', JSON.stringify(state, null, 1))
if (state.introducedOutsideScope.length)
  fail(`Items introduced outside the active set: ${state.introducedOutsideScope}`)

// --- Cram must not disturb the schedule --------------------------------------
const dueBefore = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((res) => (req.onsuccess = () => res(req.result)))
  const q = dbi.transaction('cards').objectStore('cards').getAll()
  const cards = await new Promise((r) => (q.onsuccess = () => r(q.result)))
  return cards.filter((c) => c.introduced === 1).map((c) => `${c.id}@${c.fsrs.due}`).sort()
})
await page.goto(`http://localhost:${PORT}/sets`)
await page.click('a:has-text("Quiz this set") >> nth=0')
await page.waitForSelector('text=Practice')
await page.screenshot({ path: `${OUT}/m2-cram.png` })
for (let i = 0; i < 12; i++) {
  if (await page.isVisible('button:has-text("Show answer")')) await page.click('button:has-text("Show answer")')
  else if (await page.isVisible('button:has-text("Got it")')) await page.click('button:has-text("Got it")')
  await page.waitForTimeout(80)
}
const dueAfter = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((res) => (req.onsuccess = () => res(req.result)))
  const q = dbi.transaction('cards').objectStore('cards').getAll()
  const cards = await new Promise((r) => (q.onsuccess = () => r(q.result)))
  return cards.filter((c) => c.introduced === 1).map((c) => `${c.id}@${c.fsrs.due}`).sort()
})
if (JSON.stringify(dueBefore) !== JSON.stringify(dueAfter))
  fail('Cram changed the FSRS schedule — it must not')
else console.log('Cram left all', dueAfter.length, 'schedules untouched ✓')

console.log('Console errors:', errors.length ? errors : 'none')
if (errors.length) process.exitCode = 1
await browser.close()
