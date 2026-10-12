import { useState, useEffect } from 'react';
import { MapPin, Sparkles, TrendingUp, AlertCircle, CheckCircle, Heart, Navigation, ChevronDown, Flag } from 'lucide-react';
import { Tag } from './Tag';
import { SpiceBar } from './SpiceBar';
import { StarBar } from './StarBar';
import { PRICE_MAP } from '../constants';
import { commonsPhoto } from '../lib/photos.js';
import { useLanguage } from '../app/useLanguage.js';

const ART_EMOJI = ['🍲', '🍛', '🌶️', '🍗', '🥘', '🍜'];

export function RestaurantCard({ rec, index, onReview, distanceKm, directionsUrl, isFavorite, onToggleFavorite }) {
  const { t } = useLanguage();
  const [photo, setPhoto] = useState(null);
  const [photoTried, setPhotoTried] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const matchPct = Math.round((rec.match_score || 0) * 100);
  const price = PRICE_MAP[rec.price_tier?.toLowerCase()] || "₦₦";
  const dish = rec.signature_dishes?.[0] || rec.cuisine_tags?.[0];

  useEffect(() => {
    let cancelled = false;
    if (dish) {
      commonsPhoto(dish).then((p) => {
        if (!cancelled) { setPhoto(p); setPhotoTried(true); }
      });
    } else {
      setPhotoTried(true);
    }
    return () => { cancelled = true; };
  }, [dish]);

  return (
    <div
      className="card-stagger"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        overflow: "hidden",
        animationDelay: `${index * 120}ms`,
        transition: "border-color 0.2s, transform 0.2s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
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
          <span style={{ fontSize: 44 }} aria-hidden="true">{ART_EMOJI[(rec.restaurant_name?.length || 0) % ART_EMOJI.length]}</span>
        </div>
      ) : (
        <div className="card-photo-fallback" aria-hidden="true" />
      )}

      {/* Top accent bar */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, var(--orange) ${matchPct}%, var(--border) ${matchPct}%)`,
      }} />

      <div style={{ padding: "14px 16px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "rgba(249,115,22,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 12, color: "var(--orange)",
            }}>
              #{rec.rank}
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.2 }}>
                {rec.restaurant_name}
              </div>
              {rec.location && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <MapPin size={11} color="var(--text-muted)" />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{rec.location}</span>
                  {typeof distanceKm === 'number' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "var(--green)",
                      background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
                      padding: '1px 6px', borderRadius: 20, marginLeft: 2,
                    }}>
                      {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm} km`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            <Tag variant="green">
              <TrendingUp size={10} />
              {matchPct}% match
            </Tag>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{price}</span>
          </div>
        </div>

        {/* Ratings row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          {rec.predicted_rating && <StarBar rating={rec.predicted_rating} />}
          {rec.spice_level !== undefined && <SpiceBar level={rec.spice_level} max={5} />}
        </div>

        {/* Cuisine badges */}
        {rec.cuisine_tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {rec.cuisine_tags.slice(0, 4).map((tag) => <Tag key={tag}>{tag}</Tag>)}
          </div>
        )}

        {/* Why this pick (G) */}
        <button
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
          <ChevronDown size={13} style={{ transform: whyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {whyOpen && (
          <div className="fade-in">
            <div style={{
              borderLeft: "2px solid var(--orange)",
              paddingLeft: 10, marginBottom: 10,
              fontStyle: "italic", fontSize: 12,
              color: "var(--text-secondary)", lineHeight: 1.55,
            }}>
              {rec.reasoning}
            </div>
            {rec.why_they_will_love_it && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                <CheckCircle size={13} color="var(--green)" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{rec.why_they_will_love_it}</span>
              </div>
            )}
            {rec.potential_concern && rec.potential_concern !== "null" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8 }}>
                <AlertCircle size={13} color="var(--amber)" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{rec.potential_concern}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions: review + directions + favorite */}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onReview(rec); }}
            className="pressable"
            style={{
              flex: 1,
              background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)",
              borderRadius: 10, padding: "8px 14px", minHeight: 44,
              fontSize: 12, fontWeight: 600, color: "var(--orange)",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "background 0.15s",
            }}
          >
            <Sparkles size={13} />
            Generate AI Review for Me
          </button>
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open directions in Google Maps"
              aria-label={`Directions to ${rec.restaurant_name}`}
              style={{
                background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "8px 12px", minWidth: 44, minHeight: 44,
                fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                textDecoration: "none", transition: "all 0.15s",
              }}
            >
              <Navigation size={13} />
            </a>
          )}
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(rec.restaurant_id); }}
              title={isFavorite ? 'Remove from saved' : 'Save spot'}
              aria-label={isFavorite ? 'Remove from saved' : 'Save spot'}
              aria-pressed={!!isFavorite}
              style={{
                background: isFavorite ? "rgba(239,68,68,0.1)" : "var(--bg-card-hover)",
                border: `1px solid ${isFavorite ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                borderRadius: 10, padding: "8px 12px", minWidth: 44, minHeight: 44,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              <span key={String(!!isFavorite)} className={isFavorite ? 'heart-pop' : undefined} style={{ display: 'flex' }}>
                <Heart size={14} color={isFavorite ? "#F87171" : "var(--text-muted)"} fill={isFavorite ? "#F87171" : "none"} />
              </span>
            </button>
          )}
        </div>

        {/* Report wrong info (D) */}
        {rec.restaurant_id && (
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <a
              href={`#/settings?report=${encodeURIComponent(rec.restaurant_id)}&type=wrong-info`}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, color: 'var(--text-hint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Flag size={10} /> Report wrong info
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
