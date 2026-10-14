import { describe, it, expect } from 'vitest';
import { sanitizeNext } from '../src/lib/next.js';

describe('sanitizeNext (open-redirect lockdown)', () => {
  it('keeps clean same-origin paths', () => {
    expect(sanitizeNext('/map')).toBe('/map');
    expect(sanitizeNext('/settings?report=r001')).toBe('/settings?report=r001');
    expect(sanitizeNext('/')).toBe('/');
  });

  it('rejects absolute URLs and schemes', () => {
    expect(sanitizeNext('https://evil.example/phish')).toBe('/');
    expect(sanitizeNext('http://evil.example')).toBe('/');
    expect(sanitizeNext('javascript:alert(1)')).toBe('/');
    expect(sanitizeNext('data:text/html,hi')).toBe('/');
  });

  it('rejects protocol-relative and backslash tricks', () => {
    expect(sanitizeNext('//evil.example/x')).toBe('/');
    expect(sanitizeNext('\\\\evil\\x')).toBe('/');
  });

  it('rejects non-paths, control chars, and overlong input', () => {
    expect(sanitizeNext('map')).toBe('/');
    expect(sanitizeNext('')).toBe('/');
    expect(sanitizeNext(null)).toBe('/');
    expect(sanitizeNext(undefined)).toBe('/');
    expect(sanitizeNext(42)).toBe('/');
    expect(sanitizeNext('/map\nSet-Cookie:x')).toBe('/');
    expect(sanitizeNext('/' + 'a'.repeat(600))).toBe('/');
  });

  it('keeps API paths inside the app (no token-bearing API URLs as next)', () => {
    expect(sanitizeNext('/api/auth/signin')).toBe('/');
  });
});
