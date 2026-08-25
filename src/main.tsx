import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { App } from './app/App'
import { TodayPage } from './features/today/TodayPage'
import { LibraryPage } from './features/library/LibraryPage'
import { ReviewPage } from './features/review/ReviewPage'
import { LessonPage } from './features/lessons/LessonPage'
import { ItemPage } from './features/library/ItemPage'
import { SetsPage } from './features/sets/SetsPage'
import { CramPage } from './features/sets/CramPage'
import { StatsPage } from './features/stats/StatsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { applyTheme, storedTheme } from './app/theme'
import { warmFontCache } from './app/offline'
import { seedIfNeeded } from './db/seed'
import { applySpeechSettings } from './db/settings'

// Theme first, before anything paints, so there is no flash of the wrong one.
applyTheme(storedTheme())

// Kick off seeding immediately; pages read via live queries so they
// fill in as soon as the data lands.
void seedIfNeeded()
void applySpeechSettings()
warmFontCache()

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <TodayPage /> },
        { path: 'library', element: <LibraryPage /> },
        { path: 'review', element: <ReviewPage /> },
        { path: 'lessons', element: <LessonPage /> },
        { path: 'item/:id', element: <ItemPage /> },
        { path: 'sets', element: <SetsPage /> },
        { path: 'cram/:setId', element: <CramPage /> },
        { path: 'stats', element: <StatsPage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    },
  ],
  // Keeps routing correct when the app is served from a subpath.
  { basename: import.meta.env.BASE_URL },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
