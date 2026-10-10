import { MapPin, Star, Navigation, Heart, Loader2, Crosshair, X, Map } from 'lucide-react';

const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`);

export function NearbyPanel({ loading, error, nearby, onRetry, onClose, favorites, onToggleFavorite }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Crosshair size={16} color="var(--green)" />
          </div>
          <div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Near You
            </span>
            {nearby && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {nearby.count} spot{nearby.count === 1 ? '' : 's'} within {nearby.radius_km} km
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onRetry}
            title="Refresh location"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: 6, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
            }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Crosshair size={14} />}
          </button>
          <button
            onClick={onClose}
            title="Close nearby panel"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: 6, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: '#F87171',
          }} role="alert">
            {error}
          </div>
        </div>
      )}

      {/* Keyless Google Map embed centered on user location */}
      {nearby && (
        <div style={{ margin: '0 16px 12px', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <iframe
            title="Nearby restaurants map"
            src={`https://maps.google.com/maps?q=${nearby.origin.lat},${nearby.origin.lng}&z=13&output=embed&hl=en`}
            style={{ width: '100%', height: 160, border: 0, display: 'block', filter: 'grayscale(0.15)' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}

      {/* Results list */}
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && !nearby && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
            <Loader2 size={15} className="spin" /> Getting your location…
          </div>
        )}
        {nearby?.results?.map((r, i) => {
          const isFav = favorites.includes(r.restaurant_id);
          return (
            <div
              key={r.restaurant_id}
              className="bubble-in"
              style={{
                border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
                animationDelay: `${i * 60}ms`,
                background: 'var(--bg-card-hover)',
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 11, color: 'var(--green)',
              }}>
                {fmtKm(r.distance_km)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
                  color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={10} /> {r.area}, {r.city}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Star size={10} fill="var(--amber)" /> {r.average_rating}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button
                  onClick={() => onToggleFavorite(r.restaurant_id)}
                  title={isFav ? 'Remove from saved' : 'Save spot'}
                  aria-label={isFav ? 'Remove from saved' : 'Save spot'}
                  style={{
                    background: isFav ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${isFav ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                    borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex',
                  }}
                >
                  <Heart size={13} color={isFav ? '#F87171' : 'var(--text-muted)'} fill={isFav ? '#F87171' : 'none'} />
                </button>
                <a
                  href={r.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Directions in Google Maps"
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex',
                    color: 'var(--orange)', textDecoration: 'none',
                  }}
                >
                  <Navigation size={13} />
                </a>
                <a
                  href={`https://maps.google.com/maps?q=${r.lat},${r.lng}&z=16&output=embed&hl=en`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on map"
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex',
                    color: 'var(--text-muted)', textDecoration: 'none',
                  }}
                >
                  <Map size={13} />
                </a>
              </div>
            </div>
          );
        })}
        {nearby && nearby.results.length === 0 && !error && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 7 }}>
            <MapPin size={14} /> No spots within {nearby.radius_km} km — try widening your search.
          </div>
        )}
      </div>
    </div>
  );
}
