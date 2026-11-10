import { describe, it, expect } from 'vitest';
import { haversineKm, parseCoord, directionsUrl } from '../../src/utils/geo.js';

describe('haversineKm', () => {
  it('returns zero for identical points', () => {
    expect(haversineKm(6.5244, 3.3792, 6.5244, 3.3792)).toBe(0);
  });

  it('measures Lagos to Abuja at roughly 530 km', () => {
    const km = haversineKm(6.5244, 3.3792, 9.0765, 7.3986);
    expect(km).toBeGreaterThan(500);
    expect(km).toBeLessThan(560);
  });

  it('never returns NaN for antipodal points (rounding can push a past 1)', () => {
    const km = haversineKm(0, 0, 0, 180);
    expect(Number.isNaN(km)).toBe(false);
    expect(km).toBeGreaterThan(20000);
  });
});

describe('parseCoord', () => {
  it('accepts in-range numbers and numeric strings', () => {
    expect(parseCoord('6.5244', -90, 90)).toBe(6.5244);
    expect(parseCoord(3.3792, -180, 180)).toBe(3.3792);
    expect(parseCoord('-0', -90, 90)).toBe(-0);
  });

  it('rejects out-of-range and non-numeric values', () => {
    expect(parseCoord('91', -90, 90)).toBeNull();
    expect(parseCoord('abc', -90, 90)).toBeNull();
    expect(parseCoord('Infinity', -90, 90)).toBeNull();
  });

  it('rejects blank values instead of coercing them to zero', () => {
    expect(parseCoord('', -90, 90)).toBeNull();
    expect(parseCoord('   ', -90, 90)).toBeNull();
    expect(parseCoord(null, -90, 90)).toBeNull();
    expect(parseCoord(undefined, -90, 90)).toBeNull();
  });
});

describe('directionsUrl', () => {
  it('builds a keyless Google Maps deeplink', () => {
    expect(directionsUrl(6.5, 3.4)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=6.5,3.4'
    );
  });
});
