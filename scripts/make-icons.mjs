/**
 * Renders the app icons with headless Chromium, so there is no image
 * dependency in the toolchain. Run after changing the mark: npm run icons
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = 'public/icons'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()

/** maskable icons need the mark inside the safe zone, so it sits smaller. */
const sizes = [
  { file: 'icon-192.png', size: 192, scale: 0.62, bg: '#F6F5F1', fg: '#22303B' },
  { file: 'icon-512.png', size: 512, scale: 0.62, bg: '#F6F5F1', fg: '#22303B' },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.45, bg: '#F6F5F1', fg: '#22303B' },
  // iOS home screen: no transparency, no rounding of its own.
  { file: 'apple-touch-icon.png', size: 180, scale: 0.6, bg: '#F6F5F1', fg: '#22303B' },
]

for (const { file, size, scale, bg, fg } of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<!doctype html>
    <html><head><link
      href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@800&display=swap"
      rel="stylesheet"></head>
    <body style="margin:0">
      <div style="width:${size}px;height:${size}px;background:${bg};
                  display:flex;align-items:center;justify-content:center">
        <span style="font-family:'Shippori Mincho B1',serif;font-weight:800;
                     font-size:${Math.round(size * scale)}px;color:${fg};
                     line-height:1">鳥</span>
      </div>
    </body></html>`)
  await page.waitForTimeout(1200) // let the webfont land
  await page.screenshot({ path: `${OUT}/${file}` })
  await page.close()
  console.log('wrote', `${OUT}/${file}`)
}

await browser.close()
