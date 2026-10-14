import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';

const root = dirname(fileURLToPath(import.meta.url));

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
      manifest: {
        name: 'NaijaTaste AI',
        short_name: 'NaijaTaste',
        description: 'Autonomous Nigerian dining concierge — one chat to your perfect spot.',
        theme_color: '#080810',
        background_color: '#080810',
        display: 'standalone',
        scope: '/app/',
        start_url: '/app/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Offline navigations fall back to a static page (never a cached API response).
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Public restaurant data only: safe to revalidate in background.
            // NEVER matches POSTs, /auth/*, /ratings, /reports, /admin, /agent, /chat.
            urlPattern: ({ url }) => url.pathname === '/nearby' || url.pathname === '/restaurants/geo',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'restaurant-data',
              expiration: { maxEntries: 60, maxAgeSeconds: 6 * 3600 },
            },
          },
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
