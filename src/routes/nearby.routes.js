import { Router } from 'express';
import { haversineKm, parseCoord, directionsUrl } from '../utils/geo.js';
import { getRestaurantsInBox, getRestaurantsByCodes } from '../db/catalogue.js';

const router = Router();

// GET /nearby?lat=6.52&lng=3.38&limit=10&radius_km=25
// Public endpoint — location discovery does not require auth.
router.get('/nearby', async (req, res) => {
  const lat = parseCoord(req.query.lat, -90, 90);
  const lng = parseCoord(req.query.lng, -180, 180);
  if (lat === null || lng === null) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'lat (-90..90) and lng (-180..180) are required' } });
  }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const radiusKm = Math.min(Math.max(Number(req.query.radius_km) || 50, 1), 500);

  // DB box prefilter (indexed lat/lng) keeps this fast at 100k rows;
  // precise haversine + sort stays in JS.
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  const candidates = await getRestaurantsInBox(
    lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta
  );

  const withDistance = [];
  for (const r of candidates) {
    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') continue;
    const distanceKm = haversineKm(lat, lng, r.lat, r.lng);
    if (distanceKm > radiusKm) continue;
    withDistance.push({
      restaurant_id: r.restaurant_id,
      name: r.name,
      city: r.city,
      area: r.area,
      lat: r.lat,
      lng: r.lng,
      cuisine_tags: r.cuisine_tags,
      price_tier: r.price_tier,
      average_rating: r.average_rating,
      review_count: r.review_count,
      spice_profile: r.spice_profile,
      distance_km: Math.round(distanceKm * 10) / 10,
      directions_url: directionsUrl(r.lat, r.lng),
    });
  }

  withDistance.sort((a, b) => a.distance_km - b.distance_km);
  const results = withDistance.slice(0, limit);

  return res.json({
    success: true,
    origin: { lat, lng },
    radius_km: radiusKm,
    count: results.length,
    results,
  });
});

// GET /restaurants/geo?ids=r001,r002 — geo lookup for recommendation cards
// (LLM recommendation payloads do not carry lat/lng).
router.get('/restaurants/geo', async (req, res) => {
  const raw = String(req.query.ids || '');
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'ids query param required' } });
  }
  const found = await getRestaurantsByCodes(ids);
  const geo = {};
  for (const r of found) {
    if (typeof r.lat === 'number' && typeof r.lng === 'number') {
      geo[r.restaurant_id] = { lat: r.lat, lng: r.lng, directions_url: directionsUrl(r.lat, r.lng) };
    }
  }
  return res.json({ success: true, geo });
});

export { router as nearbyRoutes };
