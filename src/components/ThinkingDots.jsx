export function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 14px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--orange)",
            animation: `bounce 1.2s ${i * 0.18}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
  );
}
