/**
 * Brand tokens for Haulbot emails.
 *
 * Mirrors the website design system
 * (haulbot/apps/website/src/styles/tokens.css) so transactional
 * emails match the product surface. Email clients don't support CSS custom
 * properties, so tokens are plain values consumed inline by components.
 */
export const theme = {
  color: {
    bg: "#fafafa",
    surface: "#ffffff",
    text: "#0a0a0a",
    muted: "#525252",
    subtle: "#737373",
    border: "#e5e5e5",
    borderStrong: "#d4d4d4",
    accent: "#0F766E",
    accentHover: "#0b5a54",
    accentText: "#ffffff",
    wash: "#f4f4f5",
  },
  radius: {
    base: "14px",
    lg: "20px",
    pill: "999px",
  },
  space: {
    1: "4px",
    2: "8px",
    3: "16px",
    4: "24px",
    5: "40px",
    6: "64px",
  },
  font: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
  },
} as const;

export const brand = {
  productName: "Haulbot",
  wordmark: "Haul",
  wordmarkAccent: "bot",
  supportEmail: "support@haulbot.online",
  websiteUrl: "https://haulbot.online",
} as const;
