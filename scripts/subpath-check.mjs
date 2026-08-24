import { chromium } from 'playwright'
const base = 'http://localhost:4180/tori'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const failed = []
page.on('requestfailed', (r) => failed.push(r.url()))
page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`))
let bad = 0
const check = (c, m) => { console.log(c ? '  ok: ' + m : 'FAILED: ' + m); if (!c) bad++ }

await page.goto(base + '/')
await page.waitForSelector('text=cards in rotation', { timeout: 20000 })
check(true, 'home renders under /tori/')

// Deep link (SPA fallback) and in-app navigation
await page.goto(base + '/library')
await page.waitForSelector('main .glyph', { timeout: 15000 })
check(true, 'deep link /tori/library renders')
await page.click('text=Sets')
await page.waitForSelector('text=Studying everything', { timeout: 10000 })
check(page.url().includes('/tori/sets'), `nav keeps the subpath (${page.url()})`)

// Stroke diagram must resolve under the subpath
await page.goto(base + '/lessons')
await page.waitForSelector('img[alt*="Stroke order"]', { timeout: 20000 })
const imgOk = await page.evaluate(() => {
  const img = document.querySelector('img[alt*="Stroke order"]')
  return { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 }
})
check(imgOk.loaded, `stroke diagram loads (${imgOk.src})`)

const swOk = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  return regs.length > 0
})
check(swOk, 'service worker registers under the subpath')

const notFound = failed.filter((u) => !u.includes('fonts.g'))
check(notFound.length === 0, `no broken asset paths (${notFound.slice(0,2).join(', ') || 'none'})`)
await page.screenshot({ path: 'scripts/shots/subpath.png' })
await browser.close()
process.exitCode = bad ? 1 : 0
