# Haulbot

AI dispatch for solo Amazon Relay owner-operators. Drivers control dispatch via Telegram; a dedicated remote agent books loads on Relay.

**Private repo:** https://github.com/solotechdude/haulbot

## Docs

- [docs/README.md](./docs/README.md) — planning index
- [CONTEXT.md](./CONTEXT.md) — domain glossary
- [docs/architecture-first-development.md](./docs/architecture-first-development.md) — AFDP (required before code changes)

## Monorepo

```text
apps/backend/     API orchestrator (Bun + Hono)
apps/website/     Marketing + /solo + /admin (Bun + Vite + React)
apps/bot/         Telegram thin UI worker (Bun)
packages/shared/  Types and API contracts
```

Chrome extension: separate repo `haulbot-extension/` (not in this monorepo).

## Local development

```bash
bun install

# 1. Environment (secrets stay in .env.development.local — gitignored)
cp .env.example .env.development.local

# 2. Dedicated MongoDB (Docker, port 27019, database haulbot)
bun run db:up
bun run seed:dev

# 3. Backend + website
bun run dev:backend   # :8080
bun run dev:website   # :3000

# 4. Stripe local webhooks (separate terminal — backend must be running)
bun run stripe:listen
# Uses Docker stripe/stripe-cli if native CLI is not installed.
# Copy whsec_... → STRIPE_WEBHOOK_SECRET in .env.development.local
```

Other commands: `bun run db:down`, `bun run db:logs`, `bun run dev:bot`

## Campaign command (Telegram)

```text
/campaign ORIGIN minRate minPayout
```

Example: `/campaign BRAMPTON 3 200` — searches from Brampton **anywhere** with $3/mi and $200 min payout to book. Optional destination and radius in the bot wizard. See [docs/campaign-bot-flow.md](./docs/campaign-bot-flow.md).

## Build plan

Track 1 spine (Gate 1): subscribe → provision → `/solo` onboarding → extension poll. See [docs/build-plan.md](./docs/build-plan.md).
