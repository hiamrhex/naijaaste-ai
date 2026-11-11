export function Tag({ children, variant = "default" }) {
  const styles = {
    default: { bg: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "var(--border)" },
    orange: { bg: "var(--orange-10)", color: "var(--orange)", border: "var(--orange-30)" },
    green: { bg: "var(--green-light)", color: "var(--green)", border: "var(--green-25)" },
    amber: { bg: "var(--amber-light)", color: "var(--amber)", border: "rgba(224,169,59,0.3)" },
    blue: { bg: "var(--amber-light)", color: "var(--amber)", border: "rgba(224,169,59,0.3)" },
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
