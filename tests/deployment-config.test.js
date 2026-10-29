import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

const headerValue = (rule, key) =>
  rule.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

const ruleFor = (source) => vercel.headers.find((h) => h.source === source);

describe('deployment config (vercel.json)', () => {
  it('keeps the function duration above our own LLM budget', () => {
    // The API must outlive the Gemini deadline (GEMINI_TOTAL_TIMEOUT_MS) plus
    // the cold start, or Vercel kills the function and answers with plain
    // text instead of our JSON error.
    const maxDuration = vercel.functions['api/index.js'].maxDuration;
    expect(maxDuration).toBeGreaterThanOrEqual(60);
    expect(maxDuration).toBeGreaterThan(35 + 10);
  });

  it('sends a strict CSP to the documents Vercel serves statically', () => {
    // D-2: helmet only covers API responses; the SPA documents bypass it.
    // The rule excludes /api so the API keeps exactly one CSP (from helmet).
    const rule = ruleFor('/:path((?!api/).*)');
    expect(rule).toBeTruthy();
    const csp = headerValue(rule, 'Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('sends anti-framing and hardening headers to static documents', () => {
    const rule = ruleFor('/:path((?!api/).*)');
    expect(headerValue(rule, 'X-Frame-Options')).toBe('SAMEORIGIN');
    expect(headerValue(rule, 'X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue(rule, 'Referrer-Policy')).toBeTruthy();
  });

  it('does not apply the static CSP to API responses (helmet owns those)', () => {
    // The rule must carry a negative lookahead for /api, otherwise the API
    // responses would end up with two different CSP headers.
    const rule = ruleFor('/:path((?!api/).*)');
    expect(rule.source).toContain('(?!api/)');
  });

  it('keeps the service worker revalidatable and scoped to the root', () => {
    const rule = ruleFor('/sw.js');
    expect(headerValue(rule, 'Cache-Control')).toMatch(/max-age=0/);
    expect(headerValue(rule, 'Service-Worker-Allowed')).toBe('/');
  });

  it('keeps the /api rewrite and the /app SPA fallback', () => {
    const sources = vercel.rewrites.map((r) => r.source);
    expect(sources).toContain('/api/:path*');
    expect(sources).toContain('/app/:path*');
    expect(sources).toContain('/health');
  });

  it('preserves the health path through the /api rewrite', () => {
    // api/index.js strips the "/api" prefix and normalizes "/api" to "/".
    // Rewriting /health -> /api therefore lands on "/", which Express does
    // not serve (it only has /health and /health/ready), so probes 404'd.
    const rewrite = (source) => vercel.rewrites.find((r) => r.source === source);
    expect(rewrite('/health').destination).toBe('/api/health');
    expect(rewrite('/health/:path*').destination).toBe('/api/health/:path*');
  });
});

describe('static documents are CSP-safe', () => {
  it('offline.html has no inline script (strict script-src blocks it)', () => {
    const html = readFileSync(join(root, 'public', 'offline.html'), 'utf8');
    const inlineScripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || [];
    expect(inlineScripts).toHaveLength(0);
    expect(html).toContain('/offline.js');
  });

  it('the landing page has no inline script either', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const inlineScripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || [];
    expect(inlineScripts).toHaveLength(0);
  });

  it('the offline script file exists and is served from public/', () => {
    expect(existsSync(join(root, 'public', 'offline.js'))).toBe(true);
  });
});
