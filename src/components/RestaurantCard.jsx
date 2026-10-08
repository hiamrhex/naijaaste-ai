import { useState } from 'react';
import { MapPin, Sparkles, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Tag } from './Tag';
import { SpiceBar } from './SpiceBar';
import { StarBar } from './StarBar';
import { PRICE_MAP } from '../constants';

export function RestaurantCard({ rec, index, onReview, persona }) {
  const [expanded, setExpanded] = useState(false);
  const matchPct = Math.round((rec.match_score || 0) * 100);
  const price = PRICE_MAP[rec.price_tier?.toLowerCase()] || "₦₦";

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

        {/* Cuisine tags */}
        {rec.cuisine_tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {rec.cuisine_tags.slice(0, 4).map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
        )}

        {/* Reasoning quote */}
        <div style={{
          borderLeft: "2px solid var(--orange)",
          paddingLeft: 10, marginBottom: 10,
          fontStyle: "italic", fontSize: 12,
          color: "var(--text-secondary)", lineHeight: 1.55,
        }}>
          {rec.reasoning}
        </div>

        {/* Why love + concern */}
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

        {/* Generate review button */}
        <button
          onClick={(e) => { e.stopPropagation(); onReview(rec); }}
          style={{
            width: "100%", marginTop: 4,
            background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)",
            borderRadius: 10, padding: "8px 14px",
            fontSize: 12, fontWeight: 600, color: "var(--orange)",
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(249,115,22,0.16)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(249,115,22,0.08)"}
        >
          <Sparkles size={13} />
          Generate AI Review for Me
        </button>
      </div>
    </div>
  );
}
