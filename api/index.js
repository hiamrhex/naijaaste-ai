// Vercel serverless entry — imports the Express app WITHOUT calling listen
// (listen lives in src/server.js for local/production-long-running only).
// An Express app is a (req, res) handler, so it is a valid function export.
//
// Same-origin: vercel.json rewrites /api/* to this function, so the
// frontend calls /api/auth/… — strip that mount prefix back to the paths
// Express actually serves (/auth/…, /api/v1/…). Local dev is unaffected
// (requests there never carry the /api prefix).
//
// Vercel rewrite behavior: /api/:path* → function receives :path* as req.url
//   /api/v1/auth/signup  → req.url = "/v1/auth/signup"
//   /api/auth/signup     → req.url = "/auth/signup"
//   /api/health          → req.url = "/health"
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
