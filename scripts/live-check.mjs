/** Verifies the deployed site: HTTPS, installable, and genuinely offline. */
import { chromium } from 'playwright'
const base = 'https://narendray12.github.io/tori-japanese'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
let bad = 0
const check = (c, m) => { console.log(c ? '  ok: ' + m : 'FAILED: ' + m); if (!c) bad++ }

await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=cards in rotation', { timeout: 45000 })
check(true, 'the live site loads')

const env = await page.evaluate(() => ({
  https: location.protocol === 'https:',
  secure: window.isSecureContext,
}))
check(env.https && env.secure, 'served over HTTPS in a secure context')

const mf = await page.evaluate(async () => {
  const href = document.querySelector('link[rel="manifest"]')?.href
  const r = await fetch(href)
  return { href, ...(await r.json()) }
})
check(mf.start_url?.includes('tori-japanese'), `manifest start_url is ${mf.start_url}`)
check(mf.display === 'standalone', 'installs as a standalone app')

await page.evaluate(() => navigator.serviceWorker.ready)
const regs = await page.evaluate(async () =>
  (await navigator.serviceWorker.getRegistrations()).length)
check(regs > 0, 'service worker registered')
await page.waitForTimeout(4000) // let precaching finish

// Seed a little progress, then cut the network entirely.
await page.goto(base + '/library')
await page.waitForSelector('main .glyph', { timeout: 30000 })
const online = await page.locator('main .glyph').count()

await ctx.setOffline(true)
await page.goto(base + '/library')
const offlineOk = await page.waitForSelector('main .glyph', { timeout: 20000 }).then(() => true).catch(() => false)
check(offlineOk, 'the library loads with the network off')
const offline = await page.locator('main .glyph').count()
check(offline >= online - 1, `same content offline (${offline} vs ${online} glyphs)`)

// The library opens on Kana now, so あ is the first character.
const first = await page.locator('main .glyph').first().textContent()
check(first.trim() === 'あ', `kana section loads offline (starts with ${first.trim()})`)
await page.click('[role="tab"]:has-text("Kanji")')
await page.waitForTimeout(700)
const firstKanji = await page.locator('main .glyph').first().textContent()
check(
  firstKanji.trim() === '一',
  `kanji still in teaching order offline (starts with ${firstKanji.trim()})`,
)

const svg = await page.evaluate(async () => (await fetch('/tori-japanese/kanjivg/04e00.svg')).ok)
check(svg, 'stroke diagrams cached offline')

await page.goto(base + '/stats')
// Either the empty state or the tiles proves the route rendered offline.
const statsOk = await page
  .locator('text=once you have answered')
  .or(page.locator('text=Day streak'))
  .first()
  .waitFor({ timeout: 15000 })
  .then(() => true)
  .catch(() => false)
check(statsOk, 'other routes work offline too')
await page.screenshot({ path: 'scripts/shots/live-offline.png' })

await ctx.setOffline(false)
await browser.close()
console.log(bad ? `\n${bad} check(s) failed` : '\nlive site verified')
process.exitCode = bad ? 1 : 0
