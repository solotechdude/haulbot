# RelayBooking SOLO

AI dispatch for solo Amazon Relay owner-operators. Drivers control dispatch via Telegram; a dedicated remote agent books loads on Relay.

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

Chrome extension: separate repo `relaybooking-extension/` (not in this monorepo).

## Local development

```bash
bun install
cp .env.example .env
# Start MongoDB locally, then:
bun run dev:backend   # :8080
bun run dev:website   # :3000
bun run dev:bot       # polling stub
```

## Build plan

Track 1 spine (Gate 1): subscribe → provision → `/solo` onboarding → extension poll. See [docs/build-plan.md](./docs/build-plan.md).
