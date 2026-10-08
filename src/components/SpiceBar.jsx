import { Flame } from 'lucide-react';

export function SpiceBar({ level = 0, max = 5 }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: max }).map((_, i) => (
        <Flame
          key={i}
          size={13}
          style={{
            color: i < level ? "var(--orange)" : "var(--border)",
            fill: i < level ? "var(--orange)" : "none",
            transition: "color 0.2s",
          }}
        />
      ))}
    </div>
  );
}
