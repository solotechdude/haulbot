import { useFadeIn } from "../lib/motion";
import { chatTokens } from "../theme/chat-tokens";

export function ReplyKeyboard({ buttons, startFrame }: { buttons: string[]; startFrame: number }) {
  const opacity = useFadeIn(startFrame, 14);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 4,
        width: "100%",
        opacity,
      }}
    >
      {buttons.map((label) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "8px 10px",
            borderRadius: 9,
            background: "rgba(255, 255, 255, 0.92)",
            color: chatTokens.accent,
            fontSize: 12.8,
            fontWeight: 500,
            boxShadow: chatTokens.keyShadow,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
