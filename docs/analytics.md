# Haulbot analytics (GA4)

Website and backend instrumentation for conversion and onboarding tracking on the **Haulbot** property (`properties/544284907`, measurement ID `G-YXZQMDJX8D`).

## Funnel events (code)

| Event | Where | When |
|-------|-------|------|
| `page_view` | All routes | SPA navigation |
| `select_promotion` | Marketing hero CTA | "Get started" click |
| `begin_checkout` | Marketing subscribe | Checkout session created, before Stripe redirect |
| `purchase` | `/solo?checkout=success` + Stripe webhook | Client once per session; server on `checkout.session.completed` |
| `sign_up` | `/solo?checkout=success` | New subscriber lands on portal |
| `onboarding_step` | `/solo` portal | `telegram_linked`, `relay_ready` |
| `onboarding_complete` | `/solo` portal | `onboardingStep === active` |

Attribution (source / medium / campaign) is automatic when landing URLs include UTMs.

## GA4 Admin checklist

After deploy, mark **key events** (Admin → Events):

- `purchase` (primary conversion)
- `begin_checkout`
- `sign_up`
- `onboarding_complete` (activation)

Keep **Enhanced measurement** on (scrolls, outbound clicks, video).

Optional: **Admin → Product links → Stripe** for revenue backup.

## UTM template

```
https://haulbot.online/?utm_source=SOURCE&utm_medium=MEDIUM&utm_campaign=CAMPAIGN
```

Examples:

| Channel | utm_source | utm_medium | utm_campaign |
|---------|------------|------------|--------------|
| Facebook ad | facebook | paid | launch_v1 |
| Resend email | resend | email | cold_launch |
| Telegram post | telegram | social | group_xyz |

## Environment variables

**Website (build time):**

```env
VITE_GA_MEASUREMENT_ID=G-YXZQMDJX8D
```

**Backend (server-side purchase via Measurement Protocol):**

```env
GA4_MEASUREMENT_ID=G-YXZQMDJX8D
GA4_API_SECRET=          # Admin → Data streams → Haulbot → Measurement Protocol API secrets
```

If `GA4_API_SECRET` is unset, client-side events still work; server-side `purchase` is skipped.

## Reports to watch

- **Acquisition → Traffic acquisition** — source / medium
- **Acquisition → User acquisition** — first touch
- **Monetization / Events** — `begin_checkout` → `purchase` rate
- Custom exploration: `purchase` by `session_campaign` (UTM)

## Audiences (create in GA4 Admin)

| Audience | Rule |
|----------|------|
| Started checkout | `begin_checkout` last 7 days, no `purchase` |
| Subscribers | `purchase` ever |
| Activated | `onboarding_complete` ever |

## Local dev

GA is disabled when `import.meta.env.DEV` is true (`bun run dev:website`). Test with production build or staging deploy.

## Cursor MCP

Query live data via the `google-analytics` MCP server. Setup: `bash scripts/setup-google-analytics-mcp.sh`
