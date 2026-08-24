/**
 * The webfont stylesheet is requested while the page is parsed, which on a
 * first visit happens before the service worker controls the page. It
 * therefore never lands in the runtime cache and fails on the first offline
 * load. Fetching it again once the worker is in charge fills that gap.
 *
 * The individual font files are deliberately NOT precached. Google splits the
 * Japanese faces into a hundred-odd unicode-range subsets per weight, so
 * forcing them all down would cost several megabytes to save a typeface. They
 * cache themselves as you browse online, and offline the stacks fall back to
 * Hiragino Mincho and Hiragino Sans, which ship with iOS and macOS. Everything
 * the app needs to function is precached; only the lettering degrades.
 */
export function warmFontCache(): void {
  if (!('serviceWorker' in navigator)) return
  void navigator.serviceWorker.ready.then(async () => {
    const sheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
      .map((l) => l.href)
      .filter((href) => href.includes('fonts.googleapis.com'))
    await Promise.all(
      sheets.map((href) => fetch(href, { mode: 'no-cors' }).catch(() => undefined)),
    )
  })
}
