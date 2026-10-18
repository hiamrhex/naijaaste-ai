/* NaijaTaste service worker — TRUE NETWORK-FIRST.
 *
 * Navigations: always fetch from network. A 4xx/5xx is a REAL response
 * and is returned untouched so the app renders its own error state.
 * Only a THROWN fetch (offline / DNS / connection reset / timeout) reaches
 * the catch handler → offline.html.
 *
 * No networkTimeoutSeconds. No handlerDidError for navigations.
 * Precached shell is NOT a navigation fallback.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { setCatchHandler } from 'workbox-routing';

const OFFLINE_URL = '/offline.html';
const CACHE_VERSION = 'v2'; // bumped: navigation behaviour changed

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Public restaurant data only — safe to revalidate in background.
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

// Navigation: TRUE NETWORK-FIRST.
// - No timeout: wait for network indefinitely.
// - 4xx/5xx pass through — they are real responses, not errors.
// - Only a THROWN fetch (offline/DNS/connection reset) reaches catch handler.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkOnly({
    // No plugins = no handlerDidError = 4xx/5xx pass through untouched.
  }),
  // Never intercept API or offline page itself.
  { denylist: [/^\/api\//, /^\/offline\.html$/] }
);

// Catch: ONLY thrown fetches (genuine network failure) land here.
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const cached = await caches.match(OFFLINE_URL);
    if (cached) return cached;
  }
  return Response.error();
});

// Skip waiting so new SW controls immediately.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete OUR versioned runtime caches from prior versions.
      // Precaches are cleaned by cleanupOutdatedCaches().
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