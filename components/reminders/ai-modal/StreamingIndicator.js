"use client";

export default function StreamingIndicator() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 4px",
        color: "var(--modal-text-muted)",
        fontSize: "12px",
      }}
    >
      <div style={{ display: "flex", gap: "3px" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              background: "var(--modal-text-muted)",
              animation: "pulse 1.4s infinite",
              animationDelay: `${i * 0.2}s`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}
