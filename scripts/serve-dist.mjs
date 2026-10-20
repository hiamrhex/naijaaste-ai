// Serves the production build (dist/) the way Vercel does: the same
// rewrites (/app/* → /app/index.html) and the same /api/* → function
// mapping, so the service worker and the SPA behave exactly as they will in
// production (Vite's dev server does not emit a service worker at all).
//
//   node scripts/serve-dist.mjs [port] [apiOrigin]
import { createServer } from 'http';
import { request as httpRequest } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const port = Number(process.argv[2] || 4173);
const apiOrigin = process.argv[3] || 'http://localhost:3000';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

// Mirrors api/index.js: /api/v1/* keeps its prefix, every other /api/* path
// is stripped.
const apiPath = (pathname) => {
  if (pathname === '/api') return '/';
  if (pathname.startsWith('/api/v1/') || pathname === '/api/v1') return pathname;
  if (pathname.startsWith('/api/')) return pathname.slice(4) || '/';
  return pathname;
};

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    const target = new URL(apiPath(url.pathname) + url.search, apiOrigin);
    const proxy = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (upstream) => {
        res.writeHead(upstream.statusCode || 502, upstream.headers);
        upstream.pipe(res);
      }
    );
    proxy.on('error', () => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'API unreachable' } }));
    });
    req.pipe(proxy);
    return;
  }

  // Vercel rewrites: /app and /app/* → /app/index.html
  let file = join(dist, url.pathname);
  if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
    file = join(dist, 'app', 'index.html');
  } else if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not found');
  }
  const body = readFileSync(file);
  res.writeHead(200, {
    'content-type': MIME[extname(file)] || 'application/octet-stream',
    'cache-control': file.endsWith('sw.js') ? 'public, max-age=0, must-revalidate' : 'no-cache',
  });
  res.end(body);
});

server.listen(port, () => {
  console.log(`dist preview on http://localhost:${port} (api → ${apiOrigin})`);
});
