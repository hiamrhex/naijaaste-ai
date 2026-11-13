import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// Bump when the navigation/offline behaviour changes so old precaches are
// dropped on activate (see public/sw.js + its tests).
const SW_CACHE_VERSION = 'v2';

export default defineConfig({
  plugins: [
    react({
      // Enable React 18 features
      fastRefresh: true,
    }),
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
        theme_color: '#0C0E0A',
        background_color: '#0C0E0A',
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
      // Both HTML entry points must be declared. Without `app`, Vite only
      // emitted the landing page and /app/index.html 404'd in production
      // even though vercel.json rewrites /app/* to it.
      input: {
        landing: resolve(process.cwd(), 'index.html'),
        app: resolve(process.cwd(), 'app/index.html'),
      },
      output: {
        // Vite 8 (Rolldown) requires manualChunks to be a function.
        // Keep the vendor split during the rollup→rolldown transition.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/react')) return 'vendor';
          if (id.includes('node_modules/lucide-react')) return 'lucide';
          if (id.includes('node_modules/leaflet')) return 'leaflet';
          if (id.includes('node_modules/@google/genai')) return 'google';
          return undefined;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
  optimizeDeps: {
    include: ['lucide-react', 'leaflet'],
  },
  // Dev only: mirror the Vercel /api rewrite so same-origin frontend calls
  // reach the local API during `vite dev`. VITE_API_PROXY lets the e2e suite
  // move the API off the default port (see playwright.config.js).
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '') || '/',
      },
    },
  },
})
