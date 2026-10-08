import { Star } from 'lucide-react';
import { starsFilled } from '../utils/helpers';

export function StarBar({ rating = 0 }) {
  const filled = starsFilled(rating);
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
      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </div>
  );
}
