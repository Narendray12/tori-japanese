import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// GitHub Pages serves a project site from /<repo>/, so the base has to be
// injectable. Locally and on a root domain it stays '/'.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Enabled in dev too, so offline behaviour can be tested without a build.
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['icons/apple-touch-icon.png', 'kanjivg/*.svg'],
      manifest: {
        name: 'Tori — Japanese SRS',
        short_name: 'Tori',
        description:
          'Learn JLPT N5 kanji, vocabulary, and grammar with spaced repetition.',
        lang: 'en',
        theme_color: '#F6F5F1',
        background_color: '#F6F5F1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The stroke-order set is ~80 small SVGs; precaching them keeps
        // lessons complete on a plane.
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // Google Fonts, if the page ever falls back to them.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
