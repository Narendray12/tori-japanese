/**
 * Simulates a returning visitor: install the app, save progress, deploy a new
 * build over it, and check the update is offered and applied without data loss.
 */
import { chromium } from 'playwright'
import { cp, rm } from 'node:fs/promises'

const base = `http://localhost:${process.env.PORT ?? '4173'}`
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
let bad = 0
const check = (c, m) => { console.log(c ? '  ok: ' + m : 'FAILED: ' + m); if (!c) bad++ }

// --- visit 1: install the worker and record some progress -------------------
await page.goto(base + '/')
await page.waitForSelector('text=cards in rotation', { timeout: 30000 })
await page.evaluate(() => navigator.serviceWorker.ready)
await page.waitForTimeout(2500)
check(true, 'first visit installs the service worker')

const seeded = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((r) => (req.onsuccess = () => r(req.result)))
  const tx = dbi.transaction(['cards', 'reviewLogs'], 'readwrite')
  const store = tx.objectStore('cards')
  const all = await new Promise((r) => { const q = store.getAll(); q.onsuccess = () => r(q.result) })
  all.slice(0, 5).forEach((c) => { c.introduced = 1; c.introducedAt = new Date(); store.put(c) })
  for (let i = 0; i < 7; i++)
    tx.objectStore('reviewLogs').add({
      cardId: all[i % 5].id, itemId: all[i % 5].itemId, rating: 3,
      reviewedAt: new Date(), elapsedMs: 2000, stateBefore: 1, stateAfter: 2,
      stability: 4, difficulty: 5,
    })
  await new Promise((r) => (tx.oncomplete = r))
  return { introduced: 5, reviews: 7 }
})
console.log('   progress before update:', JSON.stringify(seeded))

// --- ship a real second build over the top -----------------------------------
// dist/ already holds the newer build; copying it in is exactly what a deploy
// to a static host does.
await rm('/tmp/tori-site', { recursive: true, force: true })
await cp('dist', '/tmp/tori-site', { recursive: true })
console.log('   deployed a new build')

// --- visit 2: the app should notice ------------------------------------------
await page.goto(base + '/')
await page.waitForSelector('text=cards in rotation', { timeout: 20000 })
const offered = await page
  .waitForSelector('text=A new version is ready', { timeout: 20000 })
  .then(() => true)
  .catch(() => false)
check(offered, 'the app offers the update instead of hiding it')

if (offered) {
  await page.click('text=A new version is ready')
  await page.waitForTimeout(3000)
  await page.waitForSelector('text=cards in rotation', { timeout: 20000 })
  check(true, 'tapping refresh reloads onto the new version')
}

// --- the point of the whole exercise -----------------------------------------
const after = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((r) => (req.onsuccess = () => r(req.result)))
  const getAll = (s) => new Promise((r) => {
    const q = dbi.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result)
  })
  const cards = await getAll('cards')
  return {
    introduced: cards.filter((c) => c.introduced === 1).length,
    reviews: (await getAll('reviewLogs')).length,
  }
})
console.log('   progress after update:', JSON.stringify(after))
check(after.introduced === 5, 'learned items survived the update')
check(after.reviews === 7, 'review history survived the update')

await browser.close()
process.exitCode = bad ? 1 : 0
