# Account Hub — Implementation Plan

The `/solo` portal becomes an **account hub**: the place for everything that doesn't belong in a chat (onboarding, account/connection health, billing). **All dispatch control stays in Telegram.** Rebuilt on the new design system (pine-teal, Instrument Sans, Geist Mono, hairline-ruled).

## Decisions (from grill session)
- **Purpose:** account/billing/onboarding/health hub; no web dispatch controls.
- **Auth:** passwordless `/sign-in` (email a login link). Session is already a 30-day stateless HMAC token — just persist it client-side.
- **Header:** context-aware — "Sign in" when logged out; initials avatar + dropdown (Portal · Manage billing · Sign out) when logged in.
- **Page:** one adaptive layout — checklist-first while onboarding, status-first once active.
- **Sections:** onboarding checklist · read-only agent-status glance · connections · subscription & billing · account. **No danger zone** (cancel via Stripe portal, deletion via support).
- **Billing:** in-app summary + Stripe hosted Billing Portal for all changes.
- **Privacy:** no infra wording anywhere (no "dedicated environment", "isolated browser").

## Conventions
- Frontend calls `/api/*`; Vite proxy rewrites `/api` → backend `/v1`. New endpoints follow this.
- Driver-authed routes use `requireDriverSession()` (Bearer session token; dev accepts `x-user-id`).
- Public routes (`/v1/auth/*`, `/v1/billing/*`) are rate-limited.
- No commits during build (repo has unrelated uncommitted work). Each task: implement → spec review → quality review. Verify with `bun run typecheck` + `bun run build` (website) and `bun run typecheck` (backend).

---

## Task 1 — Backend: billing summary + Stripe Billing Portal
**Files:** `apps/backend/src/stripe/subscriptions.ts`, `apps/backend/src/routes/billing.ts`, (maybe) `apps/backend/src/stripe/checkout.ts`.

- In `upsertSubscriptionFromStripe`, also persist `currentPeriodEnd` (ISO from `subscription.items.data[0].current_period_end` / `subscription.current_period_end`) and `cancelAtPeriodEnd` (`subscription.cancel_at_period_end`) into the `subscriptions` doc.
- Add `GET /v1/billing/summary` (driver-authed via `requireDriverSession()`): returns `{ plan, status, currentPeriodEnd?, cancelAtPeriodEnd? }` for the user's subscription (or `{ status: "none" }` if absent). Never expose Stripe IDs.
- Add `POST /v1/billing/portal-session` (driver-authed): look up `stripeCustomerId` (users or subscriptions doc), call `stripe.billingPortal.sessions.create({ customer, return_url: WEBSITE_URL + "/solo" })`, return `{ url }`. Handle `STRIPE_NOT_CONFIGURED` / missing customer with clear 4xx/503.
- Mount the driver-authed billing routes so they require a session (the existing `/checkout-session` stays public). Split public vs authed sub-routers as needed.

**Verify:** backend typecheck; summary + portal endpoints return sane shapes with a seeded dev user.

## Task 2 — Backend: passwordless sign-in
**Files:** `apps/backend/src/routes/auth.ts`, new `apps/backend/src/email/` (sender), `apps/backend/src/auth/magic-link.ts` (reuse), `.env.example`.

- Add `POST /v1/auth/request-login` `{ email }` (public, rate-limited): normalize email; look up user by email. **Always respond `{ ok: true }`** (no account enumeration). If the user exists, issue a magic-link token and email a sign-in link (`soloPortalUrl(token)`).
- Add a minimal email sender module using **Resend** (`RESEND_API_KEY`, `EMAIL_FROM`). **Dev fallback:** if `RESEND_API_KEY` is unset, `console.log` the sign-in URL instead of sending (so local dev works). Keep the email body plain and infra-free.
- Confirm the existing `GET /v1/auth/magic-link` exchange returns a 30-day `sessionToken` (it does) — no change needed beyond reuse.
- Add `RESEND_API_KEY` + `EMAIL_FROM` to `.env.example`.

**Verify:** backend typecheck; `request-login` for a known dev email logs a working link; unknown email still returns `{ ok: true }`.

## Task 3 — Backend: driver-safe status projection
**Files:** new route on `apps/backend/src/routes/onboarding.ts` (or a new `portal.ts`), reads `getDispatchState`.

- Add `GET /v1/onboarding/agent-status` (driver-authed): return a **scrubbed** projection of `DispatchState`:
  - `running` (‑> `!paused && armed/heartbeat fresh`), `paused`
  - `trip`: `{ origin, destination, status, deliveryEta? }` from `commitment` (or null)
  - `lastScan`: `{ scanned, booked, at }` from `agentStatus.lastScanSummary` (or null)
  - `alert`: neutral kind only — map `relayAccess` → `"reconnect_relay"`, `watchdogAlert.offline` → `"agent_offline"`, else null. **No** infra fields, no raw reasons, no session ids.
  - `heartbeatAt`, `updatedAt`.
- If no dispatch state yet, return `{ running:false, paused:false, trip:null, lastScan:null, alert:null }`.

**Verify:** backend typecheck; response contains no infra/internal fields.

## Task 4 — Privacy copy sweep
**Files:** `apps/website/src/pages/SoloPortalPage.tsx` (STEP_LABELS — will be superseded by rebuild, but sweep any other spots), grep the website + shared for infra wording.

- Replace infra language everywhere in user-facing copy: e.g. "Provisioning your dedicated environment" → "Setting up your account"; "Connect Amazon Relay in Telegram" → "Link Amazon Relay"; remove "dedicated/isolated browser", "environment". (The portal rebuild in Tasks 5–6 carries the final labels; this task is the audit/cleanup pass across any remaining strings.)

**Verify:** grep shows no remaining infra terms in `apps/website/src`.

## Task 5 — Frontend: portal shell + adaptive layout + onboarding checklist
**Files:** `apps/website/src/pages/SoloPortalPage.tsx`, `SoloPortalPage.css` (rebuild on design system).

- Keep the existing auth/token bootstrap + status polling, but restructure UI into the hub layout.
- **Onboarding checklist** component: steps `Set up account · Connect Telegram · Link Amazon Relay · Ready to dispatch`, each done/current/upcoming, infra-free labels, actions (Connect Telegram deep link; Relay/2FA guidance points to Telegram). Reuse existing telegram-deeplink + dev-stub logic.
- **Adaptive ordering:** onboarding incomplete → checklist first, status glance hidden; active → checklist collapses to "Setup complete", status glance first.
- Style with hairline-ruled cards / tokens matching the marketing system (no bespoke colors).

**Verify:** website typecheck + build; renders both states with dev user.

## Task 6 — Frontend: status glance + connections + billing + account
**Files:** `SoloPortalPage.tsx`, `SoloPortalPage.css` (+ small fetch helpers).

- **Agent-status glance** (active only): running/paused, trip (origin→dest, status, ETA), last activity, alert banners ("Reconnect Amazon Relay" / "Agent offline"), each with an **Open in Telegram** deep link. Read from `/api/onboarding/agent-status`. Read-only.
- **Connections:** Telegram (Connected/Not) + Amazon Relay (Connected / Action needed) from profile + status alert. Reconnect routes to Telegram.
- **Subscription & billing:** summary from `/api/billing/summary` (plan, status, renews/cancels-on date); **Manage billing** button → POST `/api/billing/portal-session` then redirect.
- **Account:** email, support/help link, Sign out (clears stored token → `/`).

**Verify:** website typecheck + build; billing button opens portal (or shows clear config error); status glance shows scrubbed data.

## Task 7 — Frontend: `/sign-in` page
**Files:** new `apps/website/src/pages/SignInPage.tsx` (+ css), route in `apps/website/src/main.tsx`.

- Email input → POST `/api/auth/request-login` → "Check your email" confirmation state (shown regardless, to match no-enumeration). Design-system styled. Link back to marketing.

**Verify:** website typecheck + build; submitting shows the sent state.

## Task 8 — Frontend: header avatar + context-aware auth
**Files:** `apps/website/src/components/SiteLayout.tsx`, `SiteLayout.css`; token storage helper.

- Detect session (persisted token). **Logged out:** replace "Account" with a "Sign in" link → `/sign-in`. **Logged in:** initials avatar (teal circle, first letter of email) → dropdown: Portal, Manage billing (portal-session), Sign out.
- Move the session token from `sessionStorage` to `localStorage` (persist across tabs/restarts); update `SoloPortalPage` read/writes accordingly. Keep dev `x-user-id` path working.
- Fetch the email for initials from `/api/onboarding/status` (or cache from portal).

**Verify:** website typecheck + build; header adapts to auth state; sign-out clears session.

## Final
Full-page review + desktop/mobile screenshots of both onboarding and active states; confirm no infra copy leaked.
