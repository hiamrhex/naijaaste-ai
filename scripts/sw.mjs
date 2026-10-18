// Service-worker offline behaviour.
//
// Run AFTER `npm run build` — these assert on the real generated dist/sw.js,
// because the bug being fixed (navigateFallback serving the offline page for
// server 4xx/5xx) is only observable in the compiled Workbox output.
//
//   npm run test:sw
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const swPath = resolve(root, 'dist/sw.js');
const offlinePath = resolve(root, 'dist/offline.html');

const requireBuild = (t) => {
  if (!existsSync(swPath)) {
    t.skip('dist/sw.js missing — run `npm run build` first');
    return null;
  }
  return readFileSync(swPath, 'utf8');
};

test('navigation is TRUE network-first (no timeout, no cache fallback)', (t) => {
  const sw = requireBuild(t);
  if (!sw) return;
  // The navigation route registration in minified output:
  // E(({request:e})=>e.mode===`navigate`,new M({}),{denylist:[/^\/api\//,/^\/offline\.html$/]})
  // Must have empty options `new M({})` — no networkTimeoutSeconds.
  assert.match(
    sw,
    /,new\s+[A-Za-z$_][\w$]*\(\{\}\)\s*,\s*\{[^}]*denylist/,
    'navigation route must use empty NetworkOnly options (no networkTimeoutSeconds)'
  );
  // Workbox's internal strategy classes contain handlerDidError (for precache);
  // what matters is our navigation route has NO plugins, so no handlerDidError callback.
  // That's verified by the empty options above.
});

test('a server 4xx/5xx is never replaced by the offline page', (t) => {
  const sw = requireBuild(t);
  if (!sw) return;
  // The offline page must be reachable ONLY through the catch handler, which
  // Workbox invokes when the strategy THROWS (a genuine network failure).
  // Legitimate references: the precache manifest entry + the catch-handler lookup.
  const offlineRefs = sw.split('/offline.html').length - 1;
  assert.ok(
    offlineRefs <= 2,
    `offline.html should appear at most twice (precache + catch handler), found ${offlineRefs}`
  );
  assert.match(sw, /setCatchHandler/, 'a catch handler must be registered');
  // No NavigationRoute may be bound directly to the offline URL.
  assert.doesNotMatch(
    sw,
    /NavigationRoute\([^)]*offline\.html/,
    'no navigation route may serve offline.html unconditionally'
  );
});

test('a genuine network failure serves the cached offline page', (t) => {
  const sw = requireBuild(t);
  if (!sw) return;
  // The catch handler must look the offline page up in the cache and return it
  // for navigations, and Response.error() otherwise (never a cached API body).
  assert.match(sw, /caches\.match\(/, 'catch handler must read the offline page from cache');
  assert.match(sw, /navigate/, 'catch handler must branch on navigation requests');
});

test('the offline page is precached so it is available offline', (t) => {
  if (!existsSync(swPath) || !existsSync(offlinePath)) {
    t.skip('dist/sw.js or dist/offline.html missing — run `npm run build` first');
    return;
  }
  const sw = readFileSync(swPath, 'utf8');
  assert.match(sw, /offline\.html/, 'offline.html must appear in the precache manifest');
});

test('caches are versioned and old caches are cleaned on activate', (t) => {
  const sw = requireBuild(t);
  if (!sw) return;
  // The source uses `restaurant-data-${CACHE_VERSION}`; the minifier hoists
  // CACHE_VERSION into a short variable, so assert on the base name plus an
  // interpolated version rather than the literal `restaurant-data-v1`.
  assert.match(
    sw,
    /restaurant-data-\$\{?[\w$]+\}?/,
    'runtime cache name must carry a version'
  );
  // The version value itself must be present somewhere in the bundle.
  assert.match(sw, /`v\d+`/, 'a cache version string must be defined');
  // activate listener deletes stale restaurant-data-* caches.
  assert.match(sw, /addEventListener\(`activate`/, 'an activate listener must exist');
  assert.match(sw, /caches\.delete\(/, 'activate must delete stale caches');
});

test('API routes are never cached', (t) => {
  const sw = requireBuild(t);
  if (!sw) return;
  // Navigation route must denylist /api, and the runtime cache matcher must be
  // restricted to the two public GET endpoints.
  assert.match(sw, /denylist:\[\/\^\\\/api\\\/\//, 'navigation route must denylist /api');
  assert.match(
    sw,
    /\/api\/v1\/nearby/,
    'the only cacheable API paths are the public nearby/geo reads'
  );
  // No cacheable path matches auth, chat, agent, ratings, reports or admin.
  for (const forbidden of ['/auth/', '/chat', '/agent', '/ratings', '/reports', '/admin']) {
    assert.ok(
      !sw.includes(forbidden),
      `service worker must not reference ${forbidden} — it must never be cached`
    );
  }
});