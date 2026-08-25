/** Confirms the settings UI exposes speed + voice, and that rate reaches the utterance. */
import { chromium } from 'playwright'
const base = `http://localhost:${process.env.PORT ?? '5176'}`
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
let bad = 0
const check = (c, m) => { console.log(c ? '  ok: ' + m : 'FAILED: ' + m); if (!c) bad++ }

// Headless Chromium has no system voices, so install a fake set that mirrors macOS.
await page.addInitScript(() => {
  const names = ['Eddy (Japanese (Japan))', 'Flo (Japanese (Japan))', 'Kyoko', 'Rocko (Japanese (Japan))']
  const voices = names.map((name) => ({ name, lang: 'ja-JP', localService: true, default: false, voiceURI: name }))
  window.__spoken = []
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      speak: (u) => window.__spoken.push({ text: u.text, rate: u.rate, voice: u.voice?.name }),
      cancel() {}, speaking: false, pending: false,
      addEventListener() {}, removeEventListener() {},
    },
  })
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1 } }
})

await page.goto(base + '/settings')
await page.waitForSelector('text=Speaking speed', { timeout: 20000 })
check(true, 'the Voice section appears when voices exist')

const auto = await page.textContent('option[value=""]')
check(auto.includes('Kyoko'), `auto-selection names Kyoko, not Eddy (${auto.trim()})`)

const options = await page.$$eval('#voice option', (os) => os.map((o) => o.textContent.trim()))
check(options.length === 5, `all voices are offered (${options.length - 1} + auto)`)

await page.click('button:has-text("Hear")')
await page.waitForTimeout(300)
let spoken = await page.evaluate(() => window.__spoken.at(-1))
console.log('   spoke:', JSON.stringify(spoken))
check(spoken?.voice === 'Kyoko', 'the sample is spoken by Kyoko')
check(spoken?.rate === 0.8, `default rate is 0.8, not 1.0 (${spoken?.rate})`)

// Drag the slider to its slowest and confirm the new rate is used and saved.
await page.locator('input[aria-label="Speaking speed"]').fill('0.5')
await page.locator('input[aria-label="Speaking speed"]').dispatchEvent('mouseup')
await page.waitForTimeout(400)
spoken = await page.evaluate(() => window.__spoken.at(-1))
check(spoken?.rate === 0.5, `slider changes the rate (${spoken?.rate})`)

await page.reload()
await page.waitForSelector('text=Speaking speed')
await page.waitForTimeout(600)
await page.click('button:has-text("Hear")')
await page.waitForTimeout(300)
spoken = await page.evaluate(() => window.__spoken.at(-1))
check(spoken?.rate === 0.5, `the speed survives a reload (${spoken?.rate})`)
await page.screenshot({ path: 'scripts/shots/voice-settings.png', fullPage: true })

// Choosing a specific voice must stick.
await page.selectOption('#voice', 'Rocko (Japanese (Japan))')
await page.waitForTimeout(400)
spoken = await page.evaluate(() => window.__spoken.at(-1))
check(spoken?.voice === 'Rocko (Japanese (Japan))', 'a chosen voice is used')

await browser.close()
process.exitCode = bad ? 1 : 0
