import { useCurrentFrame } from "remotion";

export function TypingIndicator() {
  const frame = useCurrentFrame();
  const phase = Math.floor(frame / 8) % 3;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "8px 12px",
        borderRadius: 14,
        borderBottomLeftRadius: 4,
        background: "#ffffff",
        boxShadow: "0 1px 1px rgba(16, 35, 47, 0.14)",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: i <= phase ? "#9aa7b1" : "#d0d7dd",
            display: "block",
          }}
        />
      ))}
    </div>
  );
}
