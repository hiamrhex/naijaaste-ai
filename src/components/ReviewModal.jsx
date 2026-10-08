import { X, TrendingUp } from 'lucide-react';
import { Tag } from './Tag';
import { StarBar } from './StarBar';

export function ReviewModal({ review, restaurant, onClose, isDark }) {
  if (!review) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}
    onClick={onClose}
    >
      <div
        className="slide-in-right"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isDark ? "#111827" : "#ffffff",
          border: `1px solid ${isDark ? "#1F2937" : "#E5E7EB"}`,
          borderRadius: 20, padding: 24, maxWidth: 780, width: "100%",
          maxHeight: "80vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: isDark ? "#F9FAFB" : "#111827" }}>
              {restaurant?.restaurant_name}
            </div>
            <StarBar rating={review.star_rating || 4} />
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: isDark ? "#9CA3AF" : "#6B7280" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{
          fontStyle: "italic", fontSize: 14, lineHeight: 1.7,
          color: isDark ? "#D1D5DB" : "#374151",
          borderLeft: "3px solid var(--orange)", paddingLeft: 14, marginBottom: 16,
        }}>
          "{review.review_text}"
        </div>

        {review.highlight_tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {review.highlight_tags.map((t) => <Tag key={t} variant="orange">{t}</Tag>)}
          </div>
        )}

        {review.persona_match_score !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUp size={13} color="var(--green)" />
            <span style={{ fontSize: 12, color: isDark ? "#9CA3AF" : "#6B7280" }}>
              {Math.round(review.persona_match_score * 100)}% matches your taste profile
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
