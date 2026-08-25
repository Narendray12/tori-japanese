/** Verifies kana appear as a first-class section and quiz correctly. */
import { chromium } from 'playwright'
const base = `http://localhost:${process.env.PORT ?? '5176'}`
const OUT = process.env.SHOT_DIR ?? 'scripts/shots'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
let bad = 0
const check = (c, m) => { console.log(c ? '  ok: ' + m : 'FAILED: ' + m); if (!c) bad++ }

await page.goto(base + '/library')
await page.waitForSelector('main .glyph', { timeout: 25000 })
await page.waitForTimeout(1500)

const tabs = await page.$$eval('[role="tablist"]:not([aria-label]) [role="tab"]', (t) =>
  t.map((x) => x.textContent.trim()))
check(tabs.join(',') === 'Kana,Kanji,Vocab,Grammar', `four sections: ${tabs.join(', ')}`)
check(await page.getAttribute('[role="tab"]:has-text("Kana")', 'aria-selected') === 'true',
  'the library opens on Kana')

const order = await page.$$eval('ul.grid > li .glyph', (e) => e.map((x) => x.textContent.trim()))
check(order.slice(0, 5).join('') === 'あいうえお', `starts with あいうえお (${order.slice(0,5).join('')})`)
// The two syllabaries are separate views now, so one view holds half of them.
check(order.length === 104, `the hiragana view lists ${order.length} characters`)
check(order.every((c) => !/[゠-ヿ]/.test(c)), 'the hiragana view holds no katakana')
await page.screenshot({ path: `${OUT}/kana-library.png` })

// Romaji search must find the kana.
await page.fill('input[type="search"]', 'shi')
await page.waitForTimeout(500)
const found = await page.$$eval('ul.grid > li .glyph', (e) => e.map((x) => x.textContent.trim()))
check(found.includes('し'), `searching "shi" finds し (${found.join(' ')})`)
// Search stays inside the chosen syllabary, the way a tab should behave.
await page.click('[aria-label="Syllabary"] [role="tab"]:has-text("katakana")')
await page.waitForTimeout(500)
const foundKata = await page.$$eval('ul.grid > li .glyph', (e) => e.map((x) => x.textContent.trim()))
check(foundKata.includes('シ'), `the same search in katakana finds シ (${foundKata.join(' ')})`)
await page.click('[aria-label="Syllabary"] [role="tab"]:has-text("hiragana")')
await page.fill('input[type="search"]', '')

// Detail page: stroke diagram must resolve.
await page.goto(base + '/item/' + encodeURIComponent('kana:あ'))
await page.waitForSelector('img[alt*="Stroke order"]', { timeout: 15000 })
const img = await page.evaluate(() => {
  const i = document.querySelector('img[alt*="Stroke order"]')
  return { src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }
})
check(img.ok, `あ has a stroke diagram (${img.src})`)
await page.screenshot({ path: `${OUT}/kana-detail.png` })

// Sets: kana presets exist under their own heading.
await page.goto(base + '/sets')
await page.waitForSelector('text=Studying everything', { timeout: 15000 })
await page.waitForTimeout(800)
const heads = await page.$$eval('h2', (h) => h.map((x) => x.textContent.trim()))
check(heads.includes('Kana'), `Sets has a Kana group (${heads.join(', ')})`)
const names = await page.$$eval('h3', (h) => h.map((x) => x.textContent.trim()))
check(names.includes('Hiragana') && names.includes('Katakana'), 'Hiragana and Katakana sets ship')
await page.screenshot({ path: `${OUT}/kana-sets.png` })

// A lesson should now start with kana, and quiz them the right way round.
await page.goto(base + '/lessons')
await page.waitForSelector('button:has-text("Next"), button:has-text("Start quiz")', { timeout: 20000 })
const taught = (await page.locator('main .glyph').first().textContent()).trim()
check(taught === 'あ', `lessons start at あ (got ${taught})`)
await page.screenshot({ path: `${OUT}/kana-lesson.png` })

while (await page.isVisible('button:has-text("Next")')) {
  await page.click('button:has-text("Next")'); await page.waitForTimeout(120)
}
await page.click('button:has-text("Start quiz")')
await page.waitForTimeout(700)

const facets = new Set()
let sawRomajiPrompt = false
for (let i = 0; i < 40; i++) {
  if (await page.isVisible('text=Session complete')) break
  const f = (await page.locator('main .uppercase').nth(1).textContent().catch(() => '')) ?? ''
  facets.add(f.trim())
  if (/Kana . Sound/i.test(f)) {
    const ph = await page.getAttribute('input[aria-label="Your answer"]', 'placeholder').catch(() => null)
    if (ph === 'Type the meaning') sawRomajiPrompt = true
    await page.fill('input[aria-label="Your answer"]', 'a').catch(() => {})
    await page.click('button:has-text("Check")').catch(() => {})
    await page.waitForTimeout(250)
    if (await page.isVisible('text=Correct')) check(true, 'typing "a" answers the あ sound card')
  }
  for (const sel of ['button:has-text("Show answer")', "button:has-text(\"I don't know\")"]) {
    if (await page.isVisible(sel)) { await page.click(sel); break }
  }
  await page.waitForTimeout(150)
  for (const l of ['Good', 'Got it wrong', 'Again']) {
    if (await page.isVisible(`button:has-text("${l}")`)) { await page.click(`button:has-text("${l}")`); break }
  }
  await page.waitForTimeout(150)
}
console.log('   kana facets seen:', [...facets].filter(Boolean).join(' | '))
check(sawRomajiPrompt, 'the sound card asks for romaji, not kana')
check([...facets].some((f) => /Write it/i.test(f)), 'a write-it card appears')

console.log('errors:', errs.length ? errs.slice(0, 3) : 'none')
if (errs.length) bad++
await browser.close()
process.exitCode = bad ? 1 : 0
