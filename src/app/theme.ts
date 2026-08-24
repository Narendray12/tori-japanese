export type Theme = 'system' | 'light' | 'dark'

const KEY = 'tori.theme'

/**
 * Read from localStorage rather than the database so the first paint already
 * has the right colours. IndexedDB is async and would flash the wrong theme.
 */
export function storedTheme(): Theme {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(KEY, theme)
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      matchMedia('(prefers-color-scheme: dark)').matches)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#16191C' : '#F6F5F1')
}
