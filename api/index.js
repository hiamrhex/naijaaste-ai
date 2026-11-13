import { app } from '../src/app.js';
import { normalizeApiPath } from '../src/lib/apiPath.js';
import { initMonitoring, captureException } from '../src/lib/monitoring.js';

// Cold start: opt-in error tracking (SENTRY_DSN unset → quiet no-op).
await initMonitoring().catch(() => {});

export default (req, res) => {
  // Normalize Vercel-rewritten paths to what Express mounts expect. The rules
  // live in src/lib/apiPath.js so the dist preview and this entry cannot drift.
  req.url = normalizeApiPath(req.url);
  try {
    return app(req, res);
  } catch (syncError) {
    // A sync crash before Express got the request would otherwise vanish
    // with a Vercel 500 and no signal; capture what we can, then rethrow.
    captureException(syncError, { tags: { requestId: req?.id, url: req?.url } });
    throw syncError;
  }
};
