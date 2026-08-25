import { chromium } from 'playwright'
const base = `http://localhost:${process.env.PORT ?? '5176'}`
const OUT = process.env.SHOT_DIR ?? 'scripts/shots'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
let bad = 0
const check = (c, m) => { console.log(c ? '  ok: ' + m : 'FAILED: ' + m); if (!c) bad++ }

await page.goto(base + '/library')
await page.waitForSelector('main .glyph', { timeout: 25000 })
await page.waitForTimeout(1200)

const scriptTabs = await page.$$eval('[aria-label="Syllabary"] [role="tab"]', (t) => t.map((x) => x.textContent.trim()))
check(scriptTabs.length === 2, `syllabary switch present: ${scriptTabs.join(' / ')}`)

const heads = await page.$$eval('main section h2', (h) => h.map((x) => x.textContent.trim()))
check(heads.length === 3, `three sections: ${heads.join(' | ')}`)

const shown = await page.$$eval('ul.grid > li .glyph', (e) => e.map((x) => x.textContent.trim()))
check(shown.length === 104, `hiragana only: ${shown.length} characters (not 208)`)
check(shown.every((c) => !/[゠-ヿ]/.test(c)), 'no katakana leaking into the hiragana view')
check(shown.slice(0, 5).join('') === 'あいうえお', 'still starts at あいうえお')
await page.screenshot({ path: `${OUT}/kana-hiragana.png` })

await page.click('[aria-label="Syllabary"] [role="tab"]:has-text("katakana")')
await page.waitForTimeout(600)
const kata = await page.$$eval('ul.grid > li .glyph', (e) => e.map((x) => x.textContent.trim()))
check(kata.length === 104, `katakana view has ${kata.length} characters`)
check(kata.slice(0, 5).join('') === 'アイウエオ', `starts at アイウエオ (${kata.slice(0,5).join('')})`)
check(kata.every((c) => /[゠-ヿ]/.test(c)), 'only katakana in the katakana view')
await page.screenshot({ path: `${OUT}/kana-katakana.png` })

// Select all must respect the current view, not grab all 208.
await page.click('text=Select all')
await page.waitForTimeout(400)
const sel = await page.textContent('text=selected')
check(/104 selected/.test(sel), `select all takes the visible view only (${sel.trim()})`)

await browser.close()
process.exitCode = bad ? 1 : 0
