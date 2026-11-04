import { app } from '../src/app.js';
import { initMonitoring, captureException } from '../src/lib/monitoring.js';

// Cold start: opt-in error tracking (SENTRY_DSN unset → quiet no-op).
await initMonitoring().catch(() => {});

export default (req, res) => {
  // Normalize Vercel-rewritten paths to what Express mounts expect:
  // Mounts in src/app.js: "/api/v1" (canonical) and "/" (legacy)
  if (req.url === '/api' || req.url === '/') {
    req.url = '/';
  } else if (req.url.startsWith('/v1/') || req.url === '/v1') {
    // Vercel rewrote /api/v1/... → /v1/...; prepend /api so /api/v1 mount matches
    req.url = '/api' + req.url;
  } else if (req.url.startsWith('/api/v1/') || req.url === '/api/v1') {
    // Direct call (local dev or non-Vercel) — keep as-is
  } else if (req.url.startsWith('/api/')) {
    // SPA calls /api/auth/... → strip /api so "/" mount matches
    req.url = req.url.slice(4) || '/';
  }
  try {
    return app(req, res);
  } catch (syncError) {
    // A sync crash before Express got the request would otherwise vanish
    // with a Vercel 500 and no signal; capture what we can, then rethrow.
    captureException(syncError, { tags: { requestId: req?.id, url: req?.url } });
    throw syncError;
  }
};
