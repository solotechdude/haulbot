# Rename: RelayBooking SOLO → Haulbot

New domain: **haulbot.online** (registered at Porkbun, owner solotechdude@gmail.com). This plan traces every brand reference across all three project folders and defines what changes vs. what must be preserved. **Discovery only — no edits yet.**

## Golden rule: brand "Relay" vs Amazon "Relay"
The product integrates with **Amazon Relay** (the load board). The word "Relay" therefore appears in two senses:

- **RENAME (brand):** `RelayBooking`, `RelayBooking SOLO`, brand `relaybooking` tokens (npm scope, dirs, DB, storage keys, log prefixes, DOM ids), brand domains (`relaybooking.com`/`.app`/`.local`), Telegram handle `SwiftRelaySoloBot`.
- **PRESERVE (Amazon integration) — DO NOT CHANGE:**
  - Strings: "Amazon Relay", "Relay load board", "Relay session/login/credentials/access", "Secure Browser".
  - Hosts: `relay.amazon.com`, `*.relay.amazon.com`, `*.amazon.com`, `signin.aws.amazon.com`.
  - Code: the extension `src/relay/` directory and all its files; identifiers `relayAccess`, `RelayAccessIssue(Kind)`, `relay-alerts`, `relay-credentials`, `relay-secrets`, `relayReadyAt`, `relay2faPending`, `RELAY_REQUIRE_2FA`, `connect_relay`, `/2fa`, `relay-access` routes, `formatRouteLabel`, `relayWorkState`.
  - Bot command `/connect_relay` and any driver-facing text that literally means "your Amazon Relay account".

Every automated replacement must target brand tokens specifically (e.g. `RelayBooking`, `relaybooking`, `@relaybooking/`, `relaybooking.com`) — never a bare `Relay`/`relay`.

---

## Naming decisions (confirm before implementing)
1. **Product name:** `Haulbot` (drop the "SOLO" suffix — the domain has none). *Recommended.*
2. **Wordmark:** `Haulbot` with the "bot" in teal accent (mirrors current "RelayBooking **SOLO**" two-tone). *Recommended.*
3. **Domain strategy:** standardize everything on `haulbot.online` (replaces both `relaybooking.com` and `relaybooking.app`). Portal stays at `haulbot.online/solo` (or `app.haulbot.online`?). *Recommend single root domain + `/solo`.*
4. **npm scope:** `@relaybooking/*` → `@haulbot/*` (internal only; ~40 import lines + package.json + bun.lock). *Recommend rename for a clean rebrand.*
5. **Directory / repo names:** `relaybooking-solo`, `relaybooking-extension`, `relaybooking-templates`, the root folder, and `relaybooking-solo-product.code-workspace`. High churn + breaks paths, running dev servers, git remotes. *Recommend deferring to a separate opt-in phase (Phase 3).*
6. **Telegram bot handle:** need a new BotFather bot (e.g. `@Haulbot_bot` / `@HaulbotOnlineBot`). External action; code already reads `TELEGRAM_BOT_USERNAME`. *Need the chosen handle.*
7. **Database name:** `relaybooking_solo` → `haulbot`. Dev data is disposable (reseed). *Recommend rename; note any prod data would need migration.*
8. **Storage keys:** `relaybooking_user_id` / `_session_token` / `_admin_token` → `haulbot_*`. Renaming logs current sessions out (acceptable). *Recommend rename.*

---

## Inventory by category (every reference found)

### A. User-facing display name — "RelayBooking SOLO" → "Haulbot"
- `relaybooking-solo/apps/website/index.html` (`<title>`)
- `relaybooking-solo/apps/website/src/components/SiteLayout.tsx:122-123` (wordmark "RelayBooking" + `.site__logo-mark` "SOLO")
- `relaybooking-solo/apps/website/src/pages/MarketingPage.tsx:504` (footer tagline "RelayBooking SOLO — AI dispatch for Amazon Relay owner-operators.")
- `relaybooking-solo/apps/website/src/pages/SoloPortalPage.tsx` (any brand copy)
- `relaybooking-solo/apps/bot/src/handlers/dispatch.ts:133` ("RelayBooking SOLO commands:")
- `relaybooking-solo/apps/bot/src/handlers/onboarding.ts:22,32` (welcome/connect copy — note line 32 also has domain `relaybooking.com/solo`)
- `relaybooking-solo/apps/backend/src/email/mailer.ts:3` (`DEFAULT_FROM = "RelayBooking <login@relaybooking.app>"`)
- Extension `relaybooking-extension/manifest.json:3,14` (`name`, `action.default_title` "RelayBooking SOLO")

### B. Brand domains — `relaybooking.com` / `.app` / `.local` → `haulbot.online`
- `relaybooking-solo/apps/bot/src/handlers/onboarding.ts:32` (`relaybooking.com/solo`)
- `relaybooking-solo/apps/website/src/pages/SoloPortalPage.tsx:547` (`support@relaybooking.app`)
- `relaybooking-solo/apps/backend/src/email/mailer.ts:3` (`login@relaybooking.app`)
- `relaybooking-solo/apps/backend/scripts/seed-dev-user.ts:10` (`dev@relaybooking.local` — dev email; can become `dev@haulbot.local`)
- Extension `manifest.json:29` host permission `https://*.relaybooking.com/*`  ⚠️ (brand API/host — confirm the extension actually needs the brand domain; keep the Amazon hosts untouched)
- Email templates repo: many (`relaybooking.com`, `try-relaybooking.com`, `aj@relaybooking.com`, `_dmarc.relaybooking.com`, unsubscribe/landing/portal URLs) — see section K.

### C. Email from/support addresses
- `login@relaybooking.app` (mailer `DEFAULT_FROM`) → `login@haulbot.online`
- `support@relaybooking.app` (portal) → `support@haulbot.online`
- `.env.example` `EMAIL_FROM=` default guidance

### D. Telegram bot username — `SwiftRelaySoloBot`
- `.env.example:18,23` (`VITE_TELEGRAM_BOT_USERNAME`, `TELEGRAM_BOT_USERNAME`)
- `relaybooking-solo/apps/backend/src/telegram/link.ts:35` (fallback default)
- `relaybooking-solo/apps/website/src/pages/SoloPortalPage.tsx:57` (fallback default)
- `relaybooking-solo/CONTEXT.md:26` (`@SwiftRelaySoloBot`)
- Requires a NEW bot via BotFather (external).

### E. npm scope & package names — `@relaybooking/*`, `relaybooking-*`
- `relaybooking-solo/package.json` (`name: relaybooking-solo`, scripts filtering `@relaybooking/*`, `bot:stop` pkill patterns)
- `apps/backend/package.json`, `apps/bot/package.json`, `apps/website/package.json`, `packages/shared/package.json` (names + `@relaybooking/shared` dep)
- ~30 `import ... from "@relaybooking/shared"` across backend/bot/website
- `relaybooking-solo/bun.lock` (regenerate via install after package.json edits — do NOT hand-edit)
- `relaybooking-extension/package.json` (`name: relaybooking-extension`)
- `relaybooking-templates/email/package.json` (`@relaybooking/email-templates`) + its `bun.lock`

### F. Directory / repo names + workspace (Phase 3, opt-in)
- Folders: `relaybooking-solo/`, `relaybooking-extension/`, `relaybooking-templates/`, root `relaybooking-solo-product/`
- `relaybooking-solo-product.code-workspace` (paths + name)
- Cross-references in docs/rules that name these dirs (`.cursor/rules/monorepo-boundaries.mdc`, `docs/conventions.md`, `docs/infrastructure.md`, `README.md`)
- Impacts: running dev servers' cwd, git remotes, pkill patterns, this plan's own paths.

### G. Database name — `relaybooking_solo`
- `.env.example:3-4` (`MONGODB_URI`)
- `apps/backend/src/db.ts:3`, `scripts/set-campaign-dev.ts:20`, `scripts/reconcile-stripe-user.ts:8`, `scripts/seed-dev-user.ts:7`
- `docker-compose.yml:7,12,14,22` (container name, volume, `MONGO_INITDB_DATABASE`)
- `docs/campaign-bot-flow.md:100`, `README.md:32` (mentions)

### H. Storage keys (browser localStorage)
- `apps/website/src/components/SiteLayout.tsx:9-10`, `apps/website/src/pages/SoloPortalPage.tsx:9-10` (`relaybooking_user_id`, `relaybooking_session_token`)
- `apps/website/src/pages/AdminPage.tsx:8` (`relaybooking_admin_token`)

### I. Internal identifiers & log prefixes (mostly extension)
- Log prefix `[relaybooking]` — dozens across `relaybooking-extension/src/**` (content-script, equipment, mui-autocomplete, trusted-click, scan-loads, background, etc.) and a few in the solo repo. Cosmetic; rename to `[haulbot]`.
- DOM guard `data-relaybooking-active` and `window.__relaybookingListenerRegistered` (`content-script.ts`).
- `apps/backend/src/index.ts:35` service string `relaybooking-backend`; `apps/bot/src/index.ts:65` `relaybooking-bot`.
- `apps/backend/src/provisioning/aws-workspaces-web.ts:42` AWS tag `product: relaybooking-solo`.

### J. Docs / rules / README / CONTEXT
- `relaybooking-solo/CONTEXT.md`, `README.md`, `docs/README.md`, `docs/architecture.md`, `docs/conventions.md`, `docs/architecture-first-development.md`, `docs/infrastructure.md`, `docs/campaign-bot-flow.md`
- `.cursor/rules/*.mdc` (project-core, monorepo-boundaries, typescript, etc.)
- `relaybooking-extension/README.md`, `relaybooking-extension/.cursor/rules/solo-backend-contract.mdc`, `relaybooking-extension/docs/relay-mui-fields.md`
- `README.md:5` GitHub URL `github.com/solotechdude/relaybooking-solo` (repo rename is external)

### K. Email templates repo (`relaybooking-templates/email/`) — full brand surface
- `theme.ts:42-44` (`productName: "RelayBooking SOLO"`, `wordmark: "RelayBooking"`, `wordmarkAccent: "SOLO"`)
- `components/EmailLayout.tsx` (uses `brand.wordmark`/`wordmarkAccent`)
- Every template preview/heading: `emails/welcome.tsx`, `magic-link.tsx`, `environment-ready.tsx`, `billing/{receipt,payment-failed,subscription-canceled}.tsx`, `marketing/launch-announcement.tsx`
- URLs & addresses in previews (`relaybooking.com/...`, `aj@relaybooking.com`, mailing address "RelayBooking · ...", "Founder, RelayBooking")
- Campaign docs (`campaigns/*.md`), READMEs, `package.json`, `bun.lock`
- Note: these also carry infra language ("dedicated dispatch environment") that the earlier privacy sweep removed from the app — consider aligning while renaming.

### L. External / out-of-repo actions (not code, but required for the rename to be real)
- DNS + domain: `haulbot.online` is registered at Porkbun (nameservers already Porkbun, 2 DNS records set); configure app/portal + mail records.
- Resend: authenticate `haulbot.online` (SPF/DKIM/DMARC), new from-addresses.
- Telegram: create new bot via BotFather, set `TELEGRAM_BOT_USERNAME` + webhook.
- Stripe: product/price display name, customer-portal + checkout branding, `return_url`/`success_url` domains (env `WEBSITE_URL`).
- GitHub: rename repos (`relaybooking-solo`, `relaybooking-extension`, `relaybooking-templates`).
- Chrome Web Store listing (extension name/description) if published.
- Amazon Relay host `*.relaybooking.com` in the extension: decide the real brand/API host.

---

## Proposed phased implementation (next step)
- **Phase 1 — User-facing brand (low risk, high visibility):** display name, wordmark, marketing/bot/portal copy, email from/support addresses, domains in copy, `index.html` title, email templates repo. Verify website + bot build.
- **Phase 2 — Internal identifiers (mechanical):** npm scope `@relaybooking→@haulbot` (+ reinstall to regen lockfiles), DB name, storage keys, log prefixes, DOM ids, service strings, AWS tag, `.env.example`. Verify typecheck/build for all apps + extension.
- **Phase 3 — Directory/repo renames (opt-in, high churn):** rename folders, `.code-workspace`, update path references, git remotes. Best done deliberately with servers stopped.
- **Phase 4 — External:** DNS, Resend, BotFather, Stripe, GitHub, Chrome Web Store.

## Verification checklist
- `bun run typecheck` + `bun run build` in `apps/website`; `bun run typecheck` in `apps/backend`; bot + extension builds.
- Audit greps: `RelayBooking`, `@relaybooking/`, `relaybooking.(com|app|local)`, `relaybooking_`, `[relaybooking]`, `SwiftRelaySoloBot` → expect **zero** remaining.
- Audit that Amazon-Relay tokens are **untouched**: `relay.amazon.com`, `src/relay/`, `relayAccess`, `connect_relay`, `RELAY_REQUIRE_2FA` still present.
- Manual smoke: portal loads, sign-in email link, bot welcome copy, extension loads on `relay.amazon.com`.
