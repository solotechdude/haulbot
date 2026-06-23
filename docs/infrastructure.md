# Infrastructure

## Compute

| Component | Platform | Runtime |
|---|---|---|
| Backend API | DigitalOcean App | Bun |
| Website | DigitalOcean App | Bun — single app: marketing (`/`), Subscriber Portal (`/solo`), Admin Dashboard (`/admin`) |
| Telegram Bot | DigitalOcean App | Bun worker |
| Remote Browser | AWS WorkSpaces Secure Browser | 1 Dedicated Environment per SOLO Subscription |
| Chrome Extension | AWS S3 | Force-installed CRX via `manifests/solo/updates.xml` |

## Data & services

| Concern | Service |
|---|---|
| Database | DigitalOcean Managed MongoDB |
| Email | Resend |
| Payments | Stripe |
| Secrets | Vault (+ `environment_secret_refs` in MongoDB) |
| Load Analytics | Load Analytics Engine (external, shared multi-product) |

## Architecture principle

Backend orchestrates. Telegram Bot is thin UI. Extension is executor.

```text
Driver (Telegram)
      ↓
Bot worker ──→ Backend (DO App) ──→ MongoDB (DO Managed)
      ↑              ↓
Website            Load Analytics Engine
  /  /solo  /admin      ↑
                     ↑
Extension (AWS Secure Browser) ── Load Telemetry (standard interface)
```

## Website routes (single deploy)

| Route | Surface |
|---|---|
| `/` | Marketing |
| `/solo/*` | Subscriber Portal |
| `/admin/*` | Admin Dashboard |

## Repositories

Hybrid monorepo — backend, website, and bot together; extension separate.

```text
relaybooking-solo/              monorepo
  apps/website/                 DO App
  apps/backend/                 DO App
  apps/bot/                     DO App worker
  packages/shared/              types, API contracts, Load Telemetry interface
  docs/                         planning docs
  CONTEXT.md                    domain glossary

relaybooking-extension/         separate repo
  dist/ → S3 solo channel
```

Four deploys: website, backend, bot, extension (S3 + AWS environment provisioning).

## Related docs

- [architecture.md](./architecture.md) — system design
- [data-model.md](./data-model.md) — MongoDB collections
- [build-plan.md](./build-plan.md) — tracks and launch gates
