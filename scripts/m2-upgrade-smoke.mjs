/**
 * Reproduces the "no sets visible" state: a database seeded by a build that
 * had SEED_VERSION 3 but no `group` field on study sets. Then reloads and
 * checks the app recovers.
 */
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
const fail = (m) => {
  console.error('FAILED:', m)
  process.exitCode = 1
}

await page.goto(`http://localhost:${PORT}/sets`)
await page.waitForSelector('text=Studying everything', { timeout: 20000 })
await page.waitForTimeout(800)

// Corrupt the DB the same way the real upgrade did.
const broken = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const tx = dbi.transaction(['studySets', 'meta'], 'readwrite')
  const sets = tx.objectStore('studySets')
  const all = await new Promise((r) => {
    const q = sets.getAll()
    q.onsuccess = () => r(q.result)
  })
  for (const s of all) {
    delete s.group
    sets.put(s)
  }
  tx.objectStore('meta').put({ key: 'seedVersion', value: 3 })
  await new Promise((r) => (tx.oncomplete = r))
  return all.length
})
console.log(`Simulated old DB: ${broken} sets with no group, seedVersion=3`)

await page.reload()
await page.waitForSelector('text=Studying everything', { timeout: 20000 })
await page.waitForTimeout(1200)

const visible = await page.$$eval('h3', (hs) => hs.length)
const headings = await page.$$eval('h2', (hs) => hs.map((h) => h.textContent.trim()))
console.log(`After reload: ${visible} sets visible under ${JSON.stringify(headings)}`)
await page.screenshot({ path: `${OUT}/m2-upgrade-recovered.png` })

if (visible < 20) fail(`expected the presets back, saw ${visible}`)
if (!headings.includes('Kanji')) fail(`expected grouped headings, saw ${headings}`)

const after = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((res) => (req.onsuccess = () => res(req.result)))
  const q = dbi.transaction('studySets').objectStore('studySets').getAll()
  const sets = await new Promise((r) => (q.onsuccess = () => r(q.result)))
  return {
    total: sets.length,
    missingGroup: sets.filter((s) => !s.group).length,
  }
})
console.log('DB after re-seed:', JSON.stringify(after))
if (after.missingGroup) fail(`${after.missingGroup} sets still have no group`)

console.log('Console errors:', errors.length ? errors : 'none')
await browser.close()
