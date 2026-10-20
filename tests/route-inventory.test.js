import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

// Route inventory gate.
//
// Every route the API exposes must either carry an authentication guard or
// appear in the explicit allow-list below with a reason. A new route that
// forgets to be classified fails the build — that is the point: an
// unclassified route is an unauthenticated route nobody reviewed.
//
// The allow-list is the audit trail. Removing an entry means the route lost
// its public status deliberately.

const PUBLIC_ROUTES = new Map([
  // Liveness/readiness probes: must answer without credentials (uptime
  // monitors, load balancers). They expose no user data.
  ['GET /health', 'liveness probe'],
  ['GET /health/ready', 'readiness probe (DB status only)'],

  // Authentication entry points: the credential itself IS the authorisation.
  ['POST /auth/signup', 'account creation'],
  ['POST /auth/signin', 'credential exchange'],
  ['POST /auth/refresh', 'cookie-held refresh token exchange'],
  ['POST /auth/signout', 'revokes the caller\'s own refresh token'],
  ['POST /auth/google', 'Google ID token exchange'],
  ['POST /auth/forgot-password', 'returns an identical body for known and unknown emails'],
  ['POST /auth/reset-password', 'consumes an emailed OTP'],

  // Public catalogue reads: no user data, no writes, no rate-limit bypass
  // (the LLM limiter covers /nearby through the shared limiters).
  ['GET /nearby', 'public restaurant lookup by coordinates'],
  ['GET /restaurants/geo', 'public coordinates for known restaurant ids'],

  // Anonymous LLM endpoints. They are rate limited (RATE_LIMIT_LLM_MAX),
  // create no user-scoped state, and return no user data.
  ['POST /extract-persona', 'pure text → persona, no persistence'],
  ['POST /update-preference', 'pure signal → updated persona, no persistence'],
  ['POST /recommend', 'public catalogue ranking'],
  ['POST /generate-review', 'public catalogue review generation'],
]);

// Routes that authenticate through a *session capability* rather than a
// user token. They are public in the sense that no account is required, but
// they still enforce ownership of the session they address.
const CAPABILITY_ROUTES = new Set([
  'POST /chat',
  'GET /chat/:sessionId',
  'DELETE /chat/:sessionId',
]);

// Recover the literal path from an Express layer regexp, e.g.
// `^\/api\/v1\/?(?=\/|$)` → `/api/v1`, `^\/?(?=\/|$)` → `` (root).
const pathFromRegexp = (source) => {
  const cut = source.split('\\/?(?=')[0].replace(/^\^/, '');
  const cleaned = cut.replace(/\\\//g, '/').replace(/\/$/, '');
  return cleaned === '' ? '' : cleaned;
};

// Walk the Express router tree and collect every (METHOD, path) with the
// names of the handlers in its chain — including guards registered with
// `router.use(path, guard)` (the admin router does exactly that).
const walk = (stack, prefix = '', inherited = []) => {
  const routes = [];
  const guards = stack.filter((l) => !l.route && l.name !== 'router' && l.name);
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
      // A router-level guard applies when its path prefix matches the route.
      const applicable = guards
        .filter((g) => {
          const gp = pathFromRegexp(g.regexp?.source || '');
          return gp === '' || layer.route.path.startsWith(gp);
        })
        .map((g) => g.name);
      for (const method of methods) {
        routes.push({
          method,
          path: `${prefix}${layer.route.path}`,
          handlers: [...inherited, ...applicable, ...layer.route.stack.map((h) => h.name).filter(Boolean)],
        });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const mount = pathFromRegexp(layer.regexp?.source || '');
      routes.push(...walk(layer.handle.stack, `${prefix}${mount}`, inherited));
    }
  }
  return routes;
};

const allRoutes = walk(app._router.stack);

// Collapse the mounted paths: the same router is mounted at /api/v1 and /,
// so a route exists under both. Normalise to the canonical form.
const canonical = (method, path) => {
  const stripped = path
    .replace(/^\/api\/v1/, '')
    .replace(/^\/$/, '/');
  return `${method} ${stripped || '/'}`.replace(/\s+/g, ' ').trim();
};

const inventory = [...new Set(allRoutes.map((r) => canonical(r.method, r.path)))];

describe('route inventory (item 2)', () => {
  it('finds the routes it is supposed to guard', () => {
    // A silent change in how the tree is walked must not make this gate
    // pass vacuously.
    expect(inventory.length).toBeGreaterThan(20);
    expect(inventory).toContain('GET /chat/:sessionId');
    expect(inventory).toContain('DELETE /chat/:sessionId');
    expect(inventory).toContain('GET /admin/stats');
  });

  it('every route is authenticated or explicitly allow-listed', () => {
    // A route is "authenticated" when its chain contains requireAuth or
    // requireAdmin (including guards registered with router.use(path, guard)).
    const isAuthenticated = (key) => {
      const route = allRoutes.find((r) => canonical(r.method, r.path) === key);
      return !!route && route.handlers.some((h) => ['requireAuth', 'requireAdmin'].includes(h));
    };
    const unclassified = inventory.filter(
      (key) =>
        !PUBLIC_ROUTES.has(key) &&
        !CAPABILITY_ROUTES.has(key) &&
        !isAuthenticated(key)
    );
    expect(
      unclassified,
      `routes without an auth guard and without an allow-list entry: ${unclassified.join(', ')}`
    ).toEqual([]);
  });

  it('the allow-list covers exactly the routes that are NOT authenticated', () => {
    // Every allow-listed route must genuinely be unauthenticated — otherwise
    // the allow-list could hide a route that has a guard but is documented
    // as public (which is how claims drift).
    for (const key of PUBLIC_ROUTES.keys()) {
      const route = allRoutes.find((r) => canonical(r.method, r.path) === key);
      expect(route, `allow-list entry ${key} has no matching route`).toBeTruthy();
      const guarded = route.handlers.some((h) => ['requireAuth', 'requireAdmin'].includes(h));
      expect(guarded, `${key} is allow-listed as public but carries an auth guard`).toBe(false);
    }
  });

  it('every allow-list entry corresponds to a real route (no stale entries)', () => {
    const stale = [...PUBLIC_ROUTES.keys()].filter((key) => !inventory.includes(key));
    expect(stale, `allow-list entries with no matching route: ${stale.join(', ')}`).toEqual([]);
  });

  it('every allow-list entry states a reason', () => {
    for (const [route, reason] of PUBLIC_ROUTES) {
      expect(typeof reason, `allow-list entry ${route} has no reason`).toBe('string');
      expect(reason.length).toBeGreaterThan(5);
    }
  });

  it('the session routes are present on every mount (/, /api/v1 and the /api prefix)', () => {
    const chatPaths = allRoutes
      .filter((r) => r.path.includes('/chat/:sessionId'))
      .map((r) => `${r.method} ${r.path}`);
    // Two mounts (canonical + legacy) × GET + DELETE.
    expect(chatPaths.length).toBeGreaterThanOrEqual(4);
    expect(chatPaths.some((p) => p.startsWith('GET') && p.includes('/api/v1/'))).toBe(true);
    expect(chatPaths.some((p) => p.startsWith('DELETE') && p.includes('/api/v1/'))).toBe(true);
    expect(chatPaths.some((p) => p.startsWith('GET') && !p.includes('/api/v1/'))).toBe(true);
    expect(chatPaths.some((p) => p.startsWith('DELETE') && !p.includes('/api/v1/'))).toBe(true);
  });

  it('no route handler is a bare anonymous function on a user-scoped path', () => {
    // The three chat routes are guarded by a session-capability check inside
    // the handler; every other user-scoped route must run requireAuth (or
    // requireAdmin) as a middleware.
    const userScoped = allRoutes.filter((r) =>
      /\/auth\/(me|favorites|saved-places)|\/ratings|\/reports|\/admin/.test(r.path)
    );
    for (const route of userScoped) {
      expect(
        route.handlers.some((h) => ['requireAuth', 'requireAdmin'].includes(h)),
        `${route.method} ${route.path} has no requireAuth/requireAdmin middleware`
      ).toBe(true);
    }
  });
});
