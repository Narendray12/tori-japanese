/**
 * M5: settings, theme, backup round trip, and offline. Runs against the
 * production build (vite preview) so the real service worker is exercised.
 */
import { chromium } from 'playwright'
import { readFile, rm } from 'node:fs/promises'

const OUT = process.env.SHOT_DIR ?? 'scripts/shots'
const PORT = process.env.PORT ?? '4173'
const base = `http://localhost:${PORT}`
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
})
const page = await context.newPage()
const errors = []
const failedUrls = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
page.on('requestfailed', (r) => failedUrls.push(r.url()))
let failures = 0
const check = (c, m) => {
  console.log(c ? '  ok: ' + m : 'FAILED: ' + m)
  if (!c) failures++
}

// ---- manifest and icons ----------------------------------------------------
const manifestRes = await page.request.get(`${base}/manifest.webmanifest`)
check(manifestRes.ok(), 'the web manifest is served')
const manifest = await manifestRes.json()
check(manifest.name?.includes('Tori'), 'manifest names the app')
check(manifest.display === 'standalone', 'manifest asks for a standalone window')
check(
  manifest.icons?.some((i) => i.purpose === 'maskable'),
  'a maskable icon is declared',
)
const iconRes = await page.request.get(`${base}/icons/apple-touch-icon.png`)
check(iconRes.ok(), 'the iOS home-screen icon is served')

// ---- settings persist ------------------------------------------------------
await page.goto(`${base}/settings`)
await page.waitForSelector('text=Daily new items', { timeout: 20000 })
await page.screenshot({ path: `${OUT}/m5-settings.png`, fullPage: true })

const readNew = () =>
  page.locator('span.font-mono').first().textContent().then((t) => Number(t.trim()))
const before = await readNew()
await page.click('button[aria-label="Increase"] >> nth=0')
await page.waitForTimeout(300)
const afterClick = await readNew()
check(afterClick === before + 5, `daily new items steps ${before} to ${afterClick}`)

await page.reload()
await page.waitForSelector('text=Daily new items')
check((await readNew()) === afterClick, 'the setting survives a reload')

// Turning a quiz mode off must persist too.
await page.click('button[aria-label="Multiple choice"]')
await page.waitForTimeout(300)
await page.reload()
await page.waitForSelector('text=Multiple choice')
const mcOff =
  (await page.getAttribute('button[aria-label="Multiple choice"]', 'aria-checked')) ===
  'false'
check(mcOff, 'switching multiple choice off persists')
await page.click('button[aria-label="Multiple choice"]') // restore
await page.waitForTimeout(200)

// ---- dark mode -------------------------------------------------------------
await page.click('button:has-text("dark")')
await page.waitForTimeout(400)
const darkBg = await page.evaluate(
  () => getComputedStyle(document.documentElement).backgroundColor,
)
check(darkBg === 'rgb(22, 25, 28)', `dark theme repaints the surface (${darkBg})`)
await page.screenshot({ path: `${OUT}/m5-dark-settings.png`, fullPage: true })
await page.goto(`${base}/stats`)
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/m5-dark-stats.png`, fullPage: true })

await page.goto(`${base}/settings`)
await page.waitForSelector('text=Appearance')
await page.click('button:has-text("light")')
await page.waitForTimeout(300)
const lightBg = await page.evaluate(
  () => getComputedStyle(document.documentElement).backgroundColor,
)
check(lightBg === 'rgb(246, 245, 241)', 'switching back to light restores paper')

// ---- backup round trip -----------------------------------------------------
// Give the database something worth losing.
const seeded = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((r) => (req.onsuccess = () => r(req.result)))
  const tx = dbi.transaction(['cards', 'reviewLogs'], 'readwrite')
  const cards = tx.objectStore('cards')
  const all = await new Promise((r) => {
    const q = cards.getAll()
    q.onsuccess = () => r(q.result)
  })
  const marked = all.slice(0, 8)
  marked.forEach((c) => {
    c.introduced = 1
    c.introducedAt = new Date()
    c.fsrs.lapses = 3
    cards.put(c)
  })
  for (let i = 0; i < 20; i++)
    tx.objectStore('reviewLogs').add({
      cardId: marked[i % marked.length].id,
      itemId: marked[i % marked.length].itemId,
      rating: 3,
      reviewedAt: new Date(),
      elapsedMs: 2500,
      stateBefore: 1,
      stateAfter: 2,
      stability: 4,
      difficulty: 5,
    })
  await new Promise((r) => (tx.oncomplete = r))
  return { introduced: marked.length }
})
console.log('seeded before backup:', JSON.stringify(seeded))

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('button:has-text("Save a backup")'),
])
const path = `/tmp/${download.suggestedFilename()}`
await download.saveAs(path)
const backup = JSON.parse(await readFile(path, 'utf8'))
check(backup.app === 'tori', 'the backup identifies itself')
check(backup.cards.length > 0, `the backup holds ${backup.cards.length} cards`)
check(backup.reviewLogs.length === 20, 'the backup holds the review history')
console.log('  backup file:', download.suggestedFilename())

// Wipe, confirm loss, then restore.
await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((r) => (req.onsuccess = () => r(req.result)))
  const tx = dbi.transaction(['cards', 'reviewLogs'], 'readwrite')
  tx.objectStore('reviewLogs').clear()
  const cards = tx.objectStore('cards')
  const all = await new Promise((r) => {
    const q = cards.getAll()
    q.onsuccess = () => r(q.result)
  })
  all.forEach((c) => {
    c.introduced = 0
    c.fsrs.lapses = 0
    cards.put(c)
  })
  await new Promise((r) => (tx.oncomplete = r))
})
const wiped = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((r) => (req.onsuccess = () => r(req.result)))
  const q = dbi.transaction('reviewLogs').objectStore('reviewLogs').count()
  return new Promise((r) => (q.onsuccess = () => r(q.result)))
})
check(wiped === 0, 'history really was erased before restoring')

await page.setInputFiles('input[type="file"]', path)
await page.waitForTimeout(1200)
check(
  await page.isVisible('text=Restored'),
  'the app reports what it restored',
)
const restored = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((r) => (req.onsuccess = () => r(req.result)))
  const getAll = (s) =>
    new Promise((r) => {
      const q = dbi.transaction(s).objectStore(s).getAll()
      q.onsuccess = () => r(q.result)
    })
  const cards = await getAll('cards')
  const logs = await getAll('reviewLogs')
  return {
    logs: logs.length,
    introduced: cards.filter((c) => c.introduced === 1).length,
    lapses: cards.filter((c) => c.fsrs.lapses === 3).length,
    dueIsDate: logs.length > 0 && cards[0].fsrs.due instanceof Date,
  }
})
console.log('after restore:', JSON.stringify(restored))
check(restored.logs === 20, 'review history came back')
check(restored.introduced === 8, 'introduced cards came back')
check(restored.lapses === 8, 'lapse counts came back')
check(restored.dueIsDate, 'due dates were revived as Date objects, not strings')

// ---- offline ---------------------------------------------------------------
await page.goto(base)
await page.waitForSelector('text=cards in rotation', { timeout: 20000 })
await page.evaluate(() => navigator.serviceWorker.ready)
await page.waitForTimeout(1500)

await context.setOffline(true)
await page.goto(`${base}/library`)
const offlineLoaded = await page
  .waitForSelector('text=Kanji', { timeout: 15000 })
  .then(() => true)
  .catch(() => false)
check(offlineLoaded, 'the library loads with the network off')
const offlineGlyphs = await page.locator('main .glyph').count()
check(offlineGlyphs > 10, `content renders offline (${offlineGlyphs} glyphs)`)
const svgOk = await page.evaluate(async () => {
  const r = await fetch('/kanjivg/065e5.svg')
  return r.ok
})
check(svgOk, 'stroke-order diagrams are cached for offline lessons')
await page.screenshot({ path: `${OUT}/m5-offline.png` })
await context.setOffline(false)

// Only optional webfont files may fail offline; anything the app serves must not.
const appFailures = failedUrls.filter((u) => !u.includes('fonts.gstatic.com'))
check(
  appFailures.length === 0,
  `no app resource fails offline (${appFailures.length} failures${appFailures.length ? ': ' + appFailures[0] : ''})`,
)
console.log(
  `  note: ${failedUrls.length - appFailures.length} optional webfont subsets unavailable offline; text falls back to system Japanese fonts`,
)

await rm(path, { force: true })
await browser.close()
process.exitCode = failures ? 1 : 0
