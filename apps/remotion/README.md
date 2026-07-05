# @haulbot/remotion

Marketing motion graphics for the Haulbot website.

## Commands

```bash
# From repo root
bun run dev:remotion    # Remotion Studio preview
bun run render:hero    # Export WebM + poster to apps/website/public/videos/
```

## Hero composition

`HeroCampaignDemo` — 24s loop, pixel-matched Telegram chat mock, operational motion (typing, scan count, book accent).

Shared components in `src/components/` are reused for capability-section videos in v1.1.

## Website integration

Pre-rendered `/videos/hero-campaign-demo.webm` plays when the hero scrolls into view. `prefers-reduced-motion` or missing video → static `ChatMock` fallback.

After copy changes, update `packages/shared/src/marketing/hero-chat.ts` and re-run `bun run render:hero`.
