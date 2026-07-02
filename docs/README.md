# RelayBooking SOLO — Documentation

Planning docs for the AI dispatch product. Domain language lives in [`CONTEXT.md`](../CONTEXT.md) at the repo root.

## Index

| Doc | Purpose |
|---|---|
| [architecture.md](./architecture.md) | System components, flows, dispatch model, integrations |
| [data-model.md](./data-model.md) | MongoDB collections, hot/cold split, indexes |
| [infrastructure.md](./infrastructure.md) | Deploy targets, services, repos, routes |
| [build-plan.md](./build-plan.md) | Four build tracks, integration gates, launch scope |
| [website-design.md](./website-design.md) | Visual and UX principles for the single website app |
| [conventions.md](./conventions.md) | Coding standards, UI rules, Fallow audits, Cursor rules |
| [architecture-first-development.md](./architecture-first-development.md) | **AFDP** — pre/post implementation protocol for all code changes |
| [campaign-bot-flow.md](./campaign-bot-flow.md) | **Campaign mode** — `/campaign` command, wizard, defaults, schema mapping |

## Product in one sentence

Solo Amazon Relay drivers set goals or campaigns in Telegram (`/campaign ORIGIN minRate minPayout`); a dedicated remote agent in AWS Secure Browser searches, books, and assigns loads while they drive. See [campaign-bot-flow.md](./campaign-bot-flow.md).

## Hard boundaries

- **SOLO owns:** search, book, assign driver, notify, monitor Relay alerts, next-leg handoff
- **Driver owns when stopped:** post-book operations on Relay directly
- **No fleet admin:** each driver subaccount = separate subscription and onboarding
- **No Telegram `/admin` at launch:** Product Admin uses `/admin` dashboard only
