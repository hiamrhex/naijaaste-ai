// Header scan — shows exactly which security headers a response carries.
//
//   node probes/header-scan.mjs live     → probe the deployed site
//   node probes/header-scan.mjs local    → serve ./dist with the vercel.json
//                                            header rules applied (what the
//                                            platform will send after deploy)
//
// Usage: node probes/header-scan.mjs [live|local] [path ...]
import { readFileSync, existsSync, statSync } from 'fs';
import { createServer } from 'http';
import { join, dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'live';
const paths = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['/', '/app/login', '/sw.js', '/offline.html', '/api/health'];

const WANTED = [
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
];

const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

// Apply the vercel.json header rules the way the platform does: the rules
// whose `source` pattern matches the path contribute their headers.
const pathToRegexp = (source) => {
  // Vercel sources are path-to-regexp. Only the forms this project uses are
  // supported, and an unknown form fails loudly rather than silently
  // matching nothing.
  if (source === '/(.*)') return /^\/(.*)$/;
  if (source === '/:path*') return /^\/(.*)$/;
  if (source === '/:path((?!api/).*)') return /^\/(?!api\/)(.*)$/;
  // A literal path (e.g. "/sw.js").
  if (/^\/[\w./-]+$/.test(source)) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}$`);
  }
  throw new Error(`header-scan: unsupported vercel.json source "${source}"`);
};

const compiled = vercel.headers.map((rule) => ({ ...rule, re: pathToRegexp(rule.source) }));

const headersFor = (pathname) => {
  const out = {};
  for (const rule of compiled) {
    if (!rule.re.test(pathname)) continue;
    for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

let server;
let base;

if (mode === 'local') {
  const dist = join(root, 'dist');
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = join(dist, url.pathname);
    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      file = join(dist, 'app', 'index.html');
    } else if (existsSync(file) && statSync(file).isDirectory()) {
      file = join(file, 'index.html');
    }
    const headers = headersFor(url.pathname);
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain', ...headers });
      return res.end('not found');
    }
    const body = readFileSync(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      ...headers,
    });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  console.log(`# local simulation of vercel.json headers (${compiled.length} rules) on ${base}`);
} else {
  base = 'https://naijataste-ai.vercel.app';
  console.log(`# live header scan → ${base}`);
}

for (const p of paths) {
  const res = await fetch(base + p, { redirect: 'manual' });
  const found = WANTED.map((h) => [h, res.headers.get(h)]).filter(([, v]) => v);
  const missing = WANTED.filter((h) => !res.headers.get(h));
  console.log(`\n${p}  → ${res.status} ${res.headers.get('content-type') || ''}`);
  for (const [k, v] of found) console.log(`  ${k}: ${v.length > 110 ? `${v.slice(0, 110)}…` : v}`);
  if (missing.length) console.log(`  MISSING: ${missing.join(', ')}`);
  else console.log('  all requested headers present');
}

server?.close();
