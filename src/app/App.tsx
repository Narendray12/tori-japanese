import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Today', kanji: '今' },
  { to: '/library', label: 'Library', kanji: '覧' },
  { to: '/sets', label: 'Sets', kanji: '組' },
  { to: '/stats', label: 'Stats', kanji: '録' },
]

export function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <h1 className="flex items-baseline gap-2">
          <span className="glyph text-3xl" lang="ja">
            鳥
          </span>
          <span className="text-sm font-medium tracking-widest text-ink-soft uppercase">
            Tori
          </span>
        </h1>
        <NavLink
          to="/settings"
          aria-label="Settings"
          className={({ isActive }) =>
            `text-lg ${isActive ? 'text-ai' : 'text-ink-faint hover:text-ink-soft'}`
          }
        >
          ⚙
        </NavLink>
      </header>

      <main className="flex-1 px-5 pb-24">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 border-t border-mist bg-card/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-xl">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-ai' : 'text-ink-faint hover:text-ink-soft'
                }`
              }
            >
              <span className="glyph text-lg" lang="ja" aria-hidden>
                {t.kanji}
              </span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
