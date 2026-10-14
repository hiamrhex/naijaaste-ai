import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import request from 'supertest';
import { app } from '../src/app.js';
import { escapeHtml, otpHtml } from '../src/services/email.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

const walkJs = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkJs(full));
    else if (['.js', '.jsx'].includes(extname(full))) out.push(full);
  }
  return out;
};

describe('XSS guards (item 3)', () => {
  it('no dangerouslySetInnerHTML or javascript: URLs anywhere in src', () => {
    const offenders = walkJs(SRC).filter((f) => {
      const text = readFileSync(f, 'utf8');
      return text.includes('dangerouslySetInnerHTML') || /javascript\s*:/i.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it('otpHtml escapes markup in names and codes', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml('A&B "quoted"')).toBe('A&amp;B &quot;quoted&quot;');
    const html = otpHtml({ name: '<script>alert(1)</script>', code: '123456' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('123456');
  });

  it('API error bodies are JSON with nosniff, even for script payloads', async () => {
    const evil = '<script>alert(1)</script>';
    const res = await request(app).get(`/${encodeURIComponent(evil)}`).expect(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // Reflected path stays data inside JSON — never an HTML document.
    expect(res.headers['content-type']).not.toMatch(/text\/html/);
  });

  it('markup in chat text stays JSON-typed, never an HTML document', async () => {
    // Markup is legitimate message text (React escapes it on render); the
    // contract that matters is the response stays JSON with nosniff,
    // whether the LLM answers (200) or is down (502).
    const res = await request(app)
      .post('/chat')
      .send({ message: '<img src=x onerror=alert(1)>' });
    expect([200, 502]).toContain(res.status);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
