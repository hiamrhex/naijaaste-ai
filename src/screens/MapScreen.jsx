import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, Navigation, Heart, MapPin } from 'lucide-react';
import { API } from '../constants/index.js';
import { getFavorites, addFavorite, removeFavorite } from '../lib/auth.js';
import { useLanguage } from '../app/useLanguage.js';
import { ScreenHead } from '../components/ScreenHead.jsx';

// Tile source is swappable without touching code:
// VITE_MAP_TILES="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const TILES = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAP_TILES) ||
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const pinIcon = (i) => L.divIcon({
  className: 'nt-pin-wrap',
  html: `<div class="nt-pin">${i + 1}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const meIcon = L.divIcon({
  className: 'nt-pin-wrap',
  html: '<div class="nt-pin me">●</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`);

export default function MapScreen() {
  const { t } = useLanguage();
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const layerRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle|locating|loading|ready|denied|error
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState(null);
  const [results, setResults] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    getFavorites().then(setFavorites).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([9.08, 8.68], 6);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapObj.current = map;
    return () => {
      map.remove();
      mapObj.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapObj.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (origin) {
      L.marker([origin.lat, origin.lng], { icon: meIcon }).addTo(layer);
      map.flyTo([origin.lat, origin.lng], 13, { duration: 0.8 });
    }
    results.forEach((r, i) => {
      if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return;
      L.marker([r.lat, r.lng], { icon: pinIcon(i) })
        .bindPopup(`<b>${r.name}</b><br/>${r.area || ''}, ${r.city || ''}`)
        .addTo(layer);
    });
  }, [origin, results]);

  const locate = () => {
    setError('');
    if (!navigator.geolocation) {
      setStatus('denied');
      setError('Geolocation is not supported by this browser.');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setOrigin({ lat: latitude, lng: longitude });
        setStatus('loading');
        try {
          const res = await fetch(`${API}/nearby?lat=${latitude}&lng=${longitude}&limit=12&radius_km=25`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error?.message || 'Nearby lookup failed');
          setResults(data.results || []);
          setStatus('ready');
        } catch (err) {
          setError(err.message || t('genericError'));
          setStatus('error');
        }
      },
      (err) => {
        setStatus('denied');
        setError(err.code === 1
          ? 'Location permission denied — enable it to find spots near you.'
          : 'Could not get your location — try again.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const toggleFavorite = async (id) => {
    const isFav = favorites.includes(id);
    setFavorites((prev) => (isFav ? prev.filter((x) => x !== id) : [...prev, id]));
    try {
      const next = isFav ? await removeFavorite(id) : await addFavorite(id);
      setFavorites(next);
    } catch {
      setFavorites((prev) => (isFav ? [...prev, id] : prev.filter((x) => x !== id)));
    }
  };

  return (
    <div>
      <ScreenHead title="Map" subtitle="Spots around you, on the map" />
      <div style={{ padding: '0 16px 24px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          ref={mapRef}
          role="application"
          aria-label="Map of nearby restaurants"
          style={{ height: 320, borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-card)' }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{ATTRIBUTION.replace(/<[^>]+>/g, '')} · tiles swappable via VITE_MAP_TILES</div>

        <button
          onClick={locate}
          disabled={status === 'locating' || status === 'loading'}
          style={{
            background: 'var(--orange)', border: 'none', borderRadius: 11,
            padding: '13px 14px', fontSize: 14, fontWeight: 700, color: '#fff',
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
            opacity: status === 'locating' || status === 'loading' ? 0.7 : 1,
          }}
        >
          {status === 'locating' || status === 'loading'
            ? <><Loader2 size={16} className="spin" /> {t('loadingMap')}</>
            : <><Crosshair size={16} /> Near me</>}
        </button>

        {error && (
          <div role="alert" style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#F87171',
          }}>
            {error}
          </div>
        )}

        {status === 'ready' && results.length === 0 && !error && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <MapPin size={14} /> No spots within 25 km — try widening your search.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="list" aria-label="Nearby restaurants">
          {results.map((r, i) => {
            const isFav = favorites.includes(r.restaurant_id);
            return (
              <div
                key={r.restaurant_id || i}
                role="listitem"
                className="bubble-in"
                style={{
                  border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card-hover)',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: 'var(--green)',
                }}>
                  {fmtKm(r.distance_km)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i + 1}. {r.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.area}, {r.city}</div>
                </div>
                <button
                  onClick={() => toggleFavorite(r.restaurant_id)}
                  title={isFav ? 'Remove from saved' : 'Save spot'}
                  aria-label={isFav ? 'Remove from saved' : 'Save spot'}
                  aria-pressed={!!isFav}
                  style={{
                    background: isFav ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${isFav ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                    borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex', minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span key={String(!!isFav)} className={isFav ? 'heart-pop' : undefined} style={{ display: 'flex' }}>
                    <Heart size={13} color={isFav ? '#F87171' : 'var(--text-muted)'} fill={isFav ? '#F87171' : 'none'} />
                  </span>
                </button>
                {r.directions_url && (
                  <a
                    href={r.directions_url}
                    target="_blank" rel="noopener noreferrer"
                    title="Directions in Google Maps"
                    aria-label={`Directions to ${r.name}`}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: 6, display: 'flex', color: 'var(--orange)', textDecoration: 'none',
                      minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Navigation size={13} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
