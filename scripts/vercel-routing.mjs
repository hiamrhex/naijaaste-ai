// Reads the API-facing rewrites out of vercel.json so the local production
// preview routes exactly like the deployment. A rewrite is API-facing when its
// destination points at the serverless function ("/api…").
//
// The generic "/api/:path*" → "/api" rewrite is excluded: serve-dist proxies
// /api/* directly (see scripts/serve-dist.mjs), and applying it would collapse
// every API path to "/api".
import { readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const loadApiRewrites = () =>
  JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).rewrites.filter(
    (r) => r.destination.startsWith('/api') && !r.source.startsWith('/api')
  );

// Returns the rewritten pathname for an API-facing rewrite, or null.
// Supports exact sources and a trailing "/:path*" wildcard.
export const rewriteApiTarget = (pathname, rewrites) => {
  for (const rewrite of rewrites) {
    if (rewrite.source === pathname) return rewrite.destination;
    if (!rewrite.source.endsWith('/:path*')) continue;
    const prefix = rewrite.source.slice(0, -'/:path*'.length);
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return rewrite.destination.replace(':path*', pathname.slice(prefix.length + 1));
    }
  }
  return null;
};
