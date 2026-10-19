// Vercel serverless entry — imports the Express app WITHOUT calling listen
// (listen lives in src/server.js for local/production-long-running only).
// An Express app is a (req, res) handler, so it is a valid function export.
//
// Same-origin: vercel.json rewrites /api/* to this function, so the
// frontend calls /api/auth/… — strip that mount prefix back to the paths
// Express actually serves (/auth/…, /api/v1/…). Local dev is unaffected
// (requests there never carry the /api prefix).
import { app } from '../src/app.js';
import { initMonitoring, captureException } from '../src/lib/monitoring.js';

// Cold start: opt-in error tracking (SENTRY_DSN unset → quiet no-op).
await initMonitoring().catch(() => {});

export default (req, res) => {
  // Two documented path shapes arrive here through the /api rewrite:
  //   /api/v1/…       → the router's CANONICAL base (src/app.js mounts /api/v1)
  //                       → keep as-is, Express strips the /api/v1 base itself.
  //   /api/auth|agent… → same-origin lightweight prefix the SPA uses
  //                       → strip the outer /api so the mounted-at-/ routers match.
  if (req.url === '/api') {
    req.url = '/';
  } else if (req.url.startsWith('/api/v1/') || req.url === '/api/v1') {
    // keep as-is; the /api/v1 mount handles it
  } else if (req.url.startsWith('/api/')) {
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
