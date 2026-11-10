// ─── Geo helpers ─────────────────────────────────────────────────────────────
const EARTH_RADIUS_KM = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in km between two lat/lng points. */
export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  // Floating point can push `a` a hair above 1 (antipodal points), which makes
  // Math.asin return NaN. Clamp before taking the root.
  const c = Math.sqrt(Math.min(1, Math.max(0, a)));
  return 2 * EARTH_RADIUS_KM * Math.asin(c);
};

/** Parse and range-check a coordinate query param. Returns number | null. */
export const parseCoord = (value, min, max) => {
  // Number('') and Number(null) are both 0, which would silently place a
  // missing coordinate at the equator/prime meridian.
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};

/** Build a Google Maps directions deeplink (works with the Maps app, no API key). */
export const directionsUrl = (lat, lng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
