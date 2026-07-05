function DoubleCheck() {
  return (
    <svg viewBox="0 0 18 11" width={16} height={10} aria-hidden="true">
      <path
        d="M1 5.9 4.3 9.2 9.8 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.6 9.2 13.1 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BubbleTail({ from }: { from: "driver" | "bot" }) {
  const isDriver = from === "driver";
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        ...(isDriver ? { right: -6 } : { left: -6 }),
        width: 9,
        height: 13,
        background: isDriver ? "#effdde" : "#ffffff",
        clipPath: isDriver ? "polygon(0 0, 100% 100%, 0 100%)" : "polygon(100% 0, 100% 100%, 0 100%)",
      }}
    />
  );
}

type MessageBubbleProps = {
  from: "driver" | "bot";
  text: string;
  time: string;
  mono?: boolean;
  accentLines?: string[];
  style?: React.CSSProperties;
};

export function MessageBubble({ from, text, time, mono, accentLines, style }: MessageBubbleProps) {
  const isDriver = from === "driver";
  const lines = text.split("\n");

  return (
    <div
      style={{
        position: "relative",
        maxWidth: "100%",
        display: "inline-flex",
        alignItems: "flex-end",
        gap: 8,
        padding: "6px 8px 6px 10px",
        borderRadius: 14,
        borderBottomLeftRadius: isDriver ? 14 : 4,
        borderBottomRightRadius: isDriver ? 4 : 14,
        background: isDriver ? "#effdde" : "#ffffff",
        color: "#14181c",
        fontSize: mono ? 13.12 : 14.4,
        lineHeight: 1.35,
        boxShadow: "0 1px 1px rgba(16, 35, 47, 0.14)",
        fontFamily: mono
          ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
          : 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        ...style,
      }}
    >
      <BubbleTail from={from} />
      <span style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>
        {lines.map((line, i) => {
          const accent = accentLines?.some((a) => line.includes(a));
          return (
            <span key={i}>
              {i > 0 ? "\n" : null}
              <span style={accent ? { color: "#0F766E", fontWeight: 600 } : undefined}>{line}</span>
            </span>
          );
        })}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 11,
          lineHeight: 1,
          whiteSpace: "nowrap",
          transform: "translateY(3px)",
          flexShrink: 0,
          color: isDriver ? "#5aae5a" : "#9aa7b1",
        }}
      >
        <span>{time}</span>
        {isDriver ? <DoubleCheck /> : null}
      </span>
    </div>
  );
}
