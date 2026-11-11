import { Star } from 'lucide-react';
import { starsFilled } from '../utils/helpers';

export function StarBar({ rating = 0 }) {
  // API payloads can carry null or a numeric string; both used to throw from
  // `rating.toFixed` and take the whole card down.
  const value = Number(rating);
  const safeRating = Number.isFinite(value) ? value : 0;
  const filled = starsFilled(safeRating);
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          style={{
            color: i < filled ? "var(--amber)" : "var(--border)",
            fill: i < filled ? "var(--amber)" : "none",
          }}
        />
      ))}
      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>{safeRating.toFixed(1)}</span>
    </div>
  );
}
