import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';

const root = dirname(fileURLToPath(import.meta.url));

// Bump when the navigation/offline behaviour changes so old precaches are
// dropped on activate (see public/sw.js + its tests).
const SW_CACHE_VERSION = 'v1';

export default defineConfig({
  plugins: [
    react(),
    {
      // Dev-only: serve the SPA shell for /app/* (mirrors the Vercel rewrite).
      // Preview/prod behavior is covered by contract tests, not this plugin.
      name: 'spa-app-fallback',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/app' || req.url.startsWith('/app/') || req.url.startsWith('/app?')) {
            req.url = '/app/index.html';
          }
          next();
        });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      // InjectManifest: we ship our own sw.js so navigation is network-first
      // and the offline page appears ONLY on a genuine network failure —
      // never as a stand-in for a server 4xx/5xx. (generateSW's
      // navigateFallback serves the cached fallback for EVERY navigation,
      // which is the bug this replaces. See tests/sw.test.js.)
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        // Must match the glob precache + the version const inside public/sw.js.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'NaijaTaste AI',
        short_name: 'NaijaTaste',
        description: 'Autonomous Nigerian dining concierge — one chat to your perfect spot.',
        theme_color: '#080810',
        background_color: '#080810',
        display: 'standalone',
        scope: '/app/',
        start_url: '/app/',
        version: SW_CACHE_VERSION,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Multi-page: / serves the landing page (index.html), the app lives at /app.
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        app: resolve(root, 'app/index.html'),
      },
    },
  },
  // Dev only: mirror the Vercel /api rewrite so same-origin frontend calls
  // reach the local API during `vite dev`.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '') || '/',
      },
    },
  },
})
