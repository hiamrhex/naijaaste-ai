/* NaijaTaste service worker.
 *
 * Navigation is NETWORK-FIRST. The offline page is served only when the
 * network genuinely fails — never as a stand-in for a server 4xx/5xx.
 * That is the bug this file replaces: generateSW's navigateFallback registers
 * a NavigationRoute that returns the cached fallback for EVERY navigation,
 * including ones where the server answered with an error. See tests/sw.test.js.
 */
import { precacheAndRoute, cleanupOutdatedCaches, getCacheKeyForURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

const OFFLINE_URL = '/offline.html';
// Keep in sync with SW_CACHE_VERSION in vite.config.js. Bump on any change to
// navigation/offline behaviour so old precaches are dropped on activate.
const CACHE_VERSION = 'v1';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Public restaurant data only. NEVER matches POSTs, /auth/*, /ratings,
// /reports, /admin, /agent or /chat.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname === '/api/v1/nearby' ||
      url.pathname === '/api/v1/restaurants/geo' ||
      url.pathname === '/nearby' ||
      url.pathname === '/restaurants/geo'),
  new StaleWhileRevalidate({
    cacheName: `restaurant-data-${CACHE_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 6 * 3600 }),
    ],
  })
);

// Navigation: always go to the network first. A 4xx/5xx is a real response
// and is returned untouched so the app can render its own error state.
// Only a thrown fetch (offline / DNS / connection reset) reaches the catch.
registerRoute(
  new NavigationRoute(
    new NetworkOnly({
      networkTimeoutSeconds: 8,
      plugins: [
        {
          // Precached shell for the SPA routes when the network is up but the
          // server has no opinion (unknown deep link). Real HTTP errors pass
          // straight through — they are not cache misses.
          handlerDidError: async ({ request }) => {
            const url = new URL(request.url);
            if (url.pathname.startsWith('/app')) {
              const shell = getCacheKeyForURL('/app/index.html');
              if (shell) return (await caches.match(shell)) || Response.error();
            }
            return Response.error();
          },
        },
      ],
    }),
    // Never intercept the API or the offline page itself.
    { denylist: [/^\/api\//, /^\/offline\.html$/] }
  )
);

// Last resort for anything that still failed: genuine network failure only.
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const cached = await caches.match(OFFLINE_URL);
    if (cached) return cached;
  }
  return Response.error();
});

// New SW takes control immediately so the offline fix applies without a
// second visit.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Precached assets use content hashes (workbox-precache-v…), so we
      // cannot filter by CACHE_VERSION there. Delete only OUR versioned
      // runtime caches, plus any stale precache revision set from a prior
      // build (workbox cleans those via cleanupOutdatedCaches above).
      const keys = await caches.keys();
      const ours = [`restaurant-data-${CACHE_VERSION}`];
      const staleRuntime = keys.filter(
        (k) => k.startsWith('restaurant-data-') && !ours.includes(k)
      );
      await Promise.all(staleRuntime.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});
