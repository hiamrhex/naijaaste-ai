export function Tag({ children, variant = "default" }) {
  const styles = {
    default: { bg: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "var(--border)" },
    orange: { bg: "rgba(249,115,22,0.12)", color: "var(--orange)", border: "rgba(249,115,22,0.3)" },
    green: { bg: "rgba(16,185,129,0.12)", color: "var(--green)", border: "rgba(16,185,129,0.3)" },
    amber: { bg: "rgba(245,158,11,0.12)", color: "var(--amber)", border: "rgba(245,158,11,0.3)" },
    blue: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  };
  const s = styles[variant] || styles.default;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  );
}
