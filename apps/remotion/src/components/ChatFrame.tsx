import type { CSSProperties, ReactNode } from "react";
import {
  chatTokens,
  CHAT_BODY_HEIGHT,
  CHAT_HEADER_HEIGHT,
  CHAT_HEIGHT,
  CHAT_WIDTH,
} from "../theme/chat-tokens";

export function ChatFrame({
  children,
  messageOpacity = 1,
}: {
  children: ReactNode;
  /** Fade message stack only — wallpaper shell stays visible */
  messageOpacity?: number;
}) {
  return (
    <div
      style={{
        width: CHAT_WIDTH,
        height: CHAT_HEIGHT,
        background: chatTokens.tgIn,
        border: `1px solid ${chatTokens.border}`,
        borderRadius: 18,
        boxShadow: chatTokens.shadow,
        overflow: "hidden",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderBottom: `1px solid ${chatTokens.headerBorder}`,
          background: "#ffffff",
          flexShrink: 0,
          height: CHAT_HEADER_HEIGHT,
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: chatTokens.avatarGradient,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            flexShrink: 0,
          }}
        >
          HB
        </span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: chatTokens.name }}>Haulbot Agent</span>
          <span style={{ color: chatTokens.channel, fontSize: 12.48 }}>bot</span>
        </div>
      </div>
      <div
        style={{
          height: CHAT_BODY_HEIGHT,
          flexShrink: 0,
          boxSizing: "border-box",
          padding: "14px 12px 16px",
          backgroundColor: chatTokens.tgWallpaper,
          backgroundImage:
            "radial-gradient(circle at 22% 12%, rgba(255, 255, 255, 0.55), transparent 42%), radial-gradient(circle at 82% 88%, rgba(255, 255, 255, 0.4), transparent 40%), radial-gradient(rgba(255, 255, 255, 0.3) 1.4px, transparent 1.5px)",
          backgroundSize: "auto, auto, 20px 20px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            opacity: messageOpacity,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function ChatRow({
  from,
  children,
  style,
}: {
  from: "driver" | "bot";
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: from === "driver" ? "flex-end" : "flex-start",
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxWidth: "82%",
          alignItems: from === "driver" ? "flex-end" : "flex-start",
        }}
      >
        {children}
      </div>
    </div>
  );
}
