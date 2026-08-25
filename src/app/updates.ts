/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register'

/**
 * The service worker is what makes the app work offline, and it is also what
 * makes a new version invisible: the old files keep being served until a fresh
 * worker takes over, which by default is the *next* time the app is opened.
 * That is why an update used to need two launches.
 *
 * Here we register it ourselves so the page can be told the moment a new
 * version is ready, offer a one-tap refresh, and keep checking while the app
 * is open. Nothing reloads on its own: interrupting someone mid-review to
 * install an update would be rude.
 */

/** How often to ask the server whether a new build exists. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

export function watchForUpdates(onReady: () => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {}
  }

  const applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh: onReady,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => void registration.update().catch(() => undefined)
      const timer = setInterval(check, CHECK_INTERVAL_MS)
      // Coming back to the app is the moment worth re-checking: a phone in a
      // pocket has been idle, not offline.
      const onVisible = () => document.visibilityState === 'visible' && check()
      document.addEventListener('visibilitychange', onVisible)
      cleanups.push(() => {
        clearInterval(timer)
        document.removeEventListener('visibilitychange', onVisible)
      })
    },
  })

  applyRef = applyUpdate
  return () => cleanups.forEach((fn) => fn())
}

const cleanups: (() => void)[] = []
let applyRef: ((reload?: boolean) => Promise<void>) | null = null

/** Swap in the waiting version and reload. Data in IndexedDB is untouched. */
export function applyUpdateNow(): void {
  void applyRef?.(true)
}
