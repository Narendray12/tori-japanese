/** M4: stats page against seeded history, including a leech and a streak. */
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
const check = (c, m) => {
  console.log(c ? '  ok: ' + m : 'FAILED: ' + m)
  if (!c) failures++
}

// Empty state first, on a database with no history.
await page.goto(`http://localhost:${PORT}/stats`)
await page.waitForTimeout(2500)
const emptyShown = await page.isVisible('text=once you have answered')
console.log('empty state visible on fresh DB:', emptyShown)
if (emptyShown) await page.screenshot({ path: `${OUT}/m4-empty.png` })

// Seed a history: reviews across past days, plus one heavily lapsed card.
const seeded = await page.evaluate(async () => {
  const req = indexedDB.open('tori')
  const dbi = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const getAll = (s) =>
    new Promise((r) => {
      const q = dbi.transaction(s).objectStore(s).getAll()
      q.onsuccess = () => r(q.result)
    })
  const cards = await getAll('cards')
  const chosen = cards.slice(0, 30)

  const tx = dbi.transaction(['reviewLogs', 'cards'], 'readwrite')
  const logs = tx.objectStore('reviewLogs')
  const cardStore = tx.objectStore('cards')

  let written = 0
  // A 5-day streak ending today, with varying volume for the heatmap ramp.
  for (let daysAgo = 0; daysAgo < 5; daysAgo++) {
    const perDay = [22, 8, 3, 45, 12][daysAgo]
    for (let i = 0; i < perDay; i++) {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      logs.add({
        cardId: chosen[i % chosen.length].id,
        itemId: chosen[i % chosen.length].itemId,
        rating: i % 7 === 0 ? 1 : 3,
        reviewedAt: d,
        elapsedMs: 2000 + (i % 5) * 900,
        stateBefore: 1,
        stateAfter: 2,
        stability: 5,
        difficulty: 5,
      })
      written++
    }
  }

  // Spread cards into the future so the forecast has shape, and make leeches.
  // Uneven spread so the forecast has a real shape to draw.
  chosen.forEach((c, i) => {
    const due = new Date()
    due.setDate(due.getDate() + (i < 12 ? 1 : i < 18 ? 3 : i % 10))
    c.introduced = 1
    c.introducedAt = new Date()
    c.fsrs.due = due
    c.fsrs.state = 2
    c.fsrs.stability = i % 3 === 0 ? 40 : 4
    c.fsrs.lapses = i < 3 ? 6 - i : 0
    cardStore.put(c)
  })

  await new Promise((r) => (tx.oncomplete = r))
  return { logs: written, cards: chosen.length }
})
console.log('seeded history:', JSON.stringify(seeded))

await page.reload()
await page.waitForSelector('text=Day streak', { timeout: 20000 })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/m4-stats.png`, fullPage: true })

const text = await page.textContent('main')
const streak = await page.locator('main .glyph').first().textContent()
console.log('streak tile reads:', streak.trim())
check(Number(streak.trim()) === 5, 'a 5-day streak is counted')
check(/Recall/.test(text) && /%/.test(text), 'recall percentage is shown')
check(/How well you know it/.test(text), 'maturity breakdown renders')
check(/Mature/.test(text), 'mature bucket is labelled')
check(/Reviews coming up/.test(text), 'forecast section renders')
check(/Giving you trouble/.test(text), 'leeches surface')

// Chart geometry: heatmap cells and forecast bars must actually be drawn.
const geometry = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('div[title*="review"]')]
  const bars = [...document.querySelectorAll('div[title*="due"]')]
  const painted = cells.filter(
    (c) => getComputedStyle(c).backgroundColor !== 'rgba(0, 0, 0, 0)',
  )
  return {
    heatCells: cells.length,
    paintedCells: painted.length,
    forecastBars: bars.length,
    allBarHeights: bars.map((b) => Math.round(b.getBoundingClientRect().height)),
    bodyScrollsX: document.body.scrollWidth > window.innerWidth + 1,
  }
})
console.log('geometry:', JSON.stringify(geometry))
check(geometry.heatCells > 100, 'heatmap draws a full calendar grid')
check(geometry.paintedCells === geometry.heatCells, 'every heatmap cell is painted')
check(geometry.forecastBars > 0, 'forecast bars are drawn')
// A bar chart whose bars are all minimum-height slivers is a broken chart,
// even though every bar technically "has height".
check(
  Math.max(...geometry.allBarHeights) >= 30,
  `the tallest forecast bar uses the plot area (max ${Math.max(...geometry.allBarHeights)}px)`,
)
check(
  new Set(geometry.allBarHeights).size > 1,
  'forecast bars vary with their counts',
)
check(!geometry.bodyScrollsX, 'the page does not scroll sideways')

// A leech should link through to the item page.
await page.click('text=Giving you trouble')
const leechLink = page.locator('a[href^="/item/"]').first()
check((await leechLink.count()) > 0, 'leech rows link to the item')
await leechLink.click()
await page.waitForTimeout(600)
check(await page.isVisible('text=Progress'), 'the leech link opens the item page')

console.log('Console errors:', errors.length ? errors : 'none')
if (errors.length) failures++
await browser.close()
process.exitCode = failures ? 1 : 0
