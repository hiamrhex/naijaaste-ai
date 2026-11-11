import { useState, useEffect, useMemo, memo } from 'react';
import { MapPin, Sparkles, TrendingUp, AlertCircle, CheckCircle, Heart, Navigation, ChevronDown, Flag } from 'lucide-react';
import { Tag } from './Tag';
import { SpiceBar } from './SpiceBar';
import { StarBar } from './StarBar';
import { PRICE_MAP } from '../constants';
import { commonsPhoto } from '../lib/photos.js';
import { useLanguage } from '../app/useLanguage.js';

export const RestaurantCard = memo(function RestaurantCard({ rec, index, onReview, distanceKm, directionsUrl, isFavorite, onToggleFavorite }) {
  const { t } = useLanguage();
  // undefined = fetch pending, null/object = settled (no sync setState in effect)
  const [photo, setPhoto] = useState(undefined);
  const [whyOpen, setWhyOpen] = useState(false);
  const matchPct = useMemo(() => Math.round((rec.match_score || 0) * 100), [rec.match_score]);
  const initials = useMemo(() => (rec.restaurant_name || 'NT')
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(), [rec.restaurant_name]);
  const price = useMemo(() => PRICE_MAP[rec.price_tier?.toLowerCase()] || "₦₦", [rec.price_tier]);
  const dish = useMemo(() => rec.signature_dishes?.[0] || rec.cuisine_tags?.[0], [rec.signature_dishes, rec.cuisine_tags]);
  const photoTried = !dish || photo !== undefined;
  const rank = rec.rank ?? index + 1;

  useEffect(() => {
    if (!dish) return undefined;
    let cancelled = false;
    commonsPhoto(dish).then((p) => {
      if (!cancelled) setPhoto(p || null);
    });
    return () => { cancelled = true; };
  }, [dish]);

  return (
    <article className="result-card card-stagger" data-tier={String(index + 1)} style={{ animationDelay: `${index * 110}ms` }}>
      {/* Photo header with gradient fallback */}
      {photo?.url ? (
        <div>
          <img
            src={photo.url}
            alt={`${rec.restaurant_name} — ${dish}`}
            loading="lazy"
            className="card-photo"
            onError={() => setPhoto(null)}
          />
          <div style={{ fontSize: 10, color: "var(--text-hint)", padding: "3px 12px", background: "var(--bg-card-hover)" }}>
            Photo: {photo.author} · Wikimedia Commons
          </div>
        </div>
      ) : photoTried ? (
        <div className="card-photo-fallback" role="img" aria-label={`${rec.restaurant_name} photo placeholder`}>
          <span className="plate-initial" aria-hidden="true">{initials}</span>
        </div>
      ) : (
        <div className="card-photo-fallback" aria-hidden="true" />
      )}

      <div style={{ padding: "14px 16px 16px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
            <span className="rank-stamp">{rank}</span>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em', color: "var(--text-primary)", lineHeight: 1.25, margin: 0 }}>
                {rec.restaurant_name}
              </h3>
              {rec.location && (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  <MapPin size={11} color="var(--text-muted)" aria-hidden="true" />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{rec.location}</span>
                  {typeof distanceKm === 'number' && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--green)", marginLeft: 2 }}>
                      {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm} km away`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            {matchPct > 0 && (
              <span className="match-pill">
                <TrendingUp size={10} aria-hidden="true" />
                {matchPct}%
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{price}</span>
          </div>
        </div>

        {/* Ratings row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          {rec.predicted_rating != null && <StarBar rating={rec.predicted_rating} />}
          {rec.spice_level !== undefined && <SpiceBar level={rec.spice_level} max={5} />}
        </div>

        {/* Cuisine badges */}
        {rec.cuisine_tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {rec.cuisine_tags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)}
          </div>
        )}

        {/* Why this pick (G) */}
        <button
          type="button"
          onClick={() => setWhyOpen((v) => !v)}
          aria-expanded={whyOpen}
          style={{
            background: "none", border: "none", padding: "2px 0 8px",
            fontSize: 12, fontWeight: 600, color: "var(--orange)",
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 4, minHeight: 32,
          }}
        >
          {t('whyPick')}
          <ChevronDown size={13} aria-hidden="true" style={{ transform: whyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {whyOpen && (
          <div className="fade-in">
            <div style={{
              borderLeft: "2px solid var(--orange)",
              paddingLeft: 10, marginBottom: 10,
              fontSize: 12,
              color: "var(--text-secondary)", lineHeight: 1.55,
            }}>
              {rec.reasoning}
            </div>
            {rec.why_they_will_love_it && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                <CheckCircle size={13} color="var(--green)" style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{rec.why_they_will_love_it}</span>
              </div>
            )}
            {rec.potential_concern && rec.potential_concern !== "null" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8 }}>
                <AlertCircle size={13} color="var(--amber)" style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
                <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{rec.potential_concern}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions: review + directions + favorite */}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReview(rec); }}
            className="pressable"
            style={{
              flex: 1,
              background: "var(--orange)", border: "1px solid var(--orange)",
              borderRadius: 10, padding: "8px 14px", minHeight: 44,
              fontSize: 12.5, fontWeight: 700, color: "#FFF8F1",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Sparkles size={13} aria-hidden="true" />
            Write my review
          </button>
          {directionsUrl && (
            <a
              className="icon-btn"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open directions in Google Maps"
              aria-label={`Directions to ${rec.restaurant_name}`}
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <Navigation size={14} aria-hidden="true" />
            </a>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(rec.restaurant_id); }}
              title={isFavorite ? 'Remove from saved' : 'Save spot'}
              aria-label={isFavorite ? 'Remove from saved' : 'Save spot'}
              aria-pressed={!!isFavorite}
              className="icon-btn"
              style={{
                minWidth: 44,
                minHeight: 44,
                color: isFavorite ? 'var(--red)' : 'var(--text-muted)',
                borderColor: isFavorite ? 'var(--red)' : 'var(--border)',
                background: isFavorite ? 'var(--red-light, rgba(229,72,77,0.1))' : 'var(--bg-card)',
              }}
            >
              <span key={String(!!isFavorite)} className={isFavorite ? 'heart-pop' : undefined} style={{ display: 'flex' }}>
                <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
              </span>
            </button>
          )}
        </div>

        {/* Report wrong info (D) */}
        {rec.restaurant_id && (
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <a
              href={`/app/settings?report=${encodeURIComponent(rec.restaurant_id)}&type=wrong-info`}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, color: 'var(--text-hint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Flag size={10} aria-hidden="true" /> Report wrong info
            </a>
          </div>
        )}
      </div>
    </article>
  );
});
