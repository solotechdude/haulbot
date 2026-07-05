/** Pixel values from apps/website MarketingPage.css `.chat` (384px frame). */
export const CHAT_WIDTH = 384;

/** Fixed shell — matches full hero thread; body does not grow with messages. */
export const CHAT_HEADER_HEIGHT = 62;
export const CHAT_BODY_HEIGHT = 430;
export const CHAT_HEIGHT = CHAT_HEADER_HEIGHT + CHAT_BODY_HEIGHT; // 492 — even for H264

export const chatTokens = {
  tgWallpaper: "#c6dcef",
  tgOut: "#effdde",
  tgIn: "#ffffff",
  tgLink: "#168acd",
  border: "#d7dee5",
  headerBorder: "#e7ebee",
  name: "#14181c",
  channel: "#8b98a5",
  stampBot: "#9aa7b1",
  stampDriver: "#5aae5a",
  accent: "#0F766E",
  shadow: "0 1px 2px rgba(10, 10, 10, 0.04), 0 18px 40px -20px rgba(10, 10, 10, 0.18)",
  bubbleShadow: "0 1px 1px rgba(16, 35, 47, 0.14)",
  keyShadow: "0 1px 1px rgba(16, 35, 47, 0.1)",
  avatarGradient: "linear-gradient(135deg, #67b9f0, #2a83d4)",
} as const;
