# Conventions

How we write code for Haulbot. Cursor rules in [`.cursor/rules/`](../.cursor/rules/) enforce these during development.

## Principles

| Principle | Meaning |
|---|---|
| Minimal | Smallest correct solution; no speculative features |
| Clean | Readable names, typed shared contracts, fail closed |
| No duplicates | One component, one type, one orchestration path — Fallow enforces |
| Balanced | Not over-engineered (no event bus v1); not under-engineered (full Booking Completion) |

## Architecture

Backend orchestrates → bot renders → extension executes. See [architecture.md](./architecture.md).

**All implementation follows the [Architecture-First Development Protocol (AFDP)](./architecture-first-development.md)** — Phases 1–8 before code, post-implementation audit after.

## Monorepo layout

```text
apps/website/     marketing + /solo + /admin
apps/backend/     API orchestrator
apps/bot/         Telegram thin UI
packages/shared/  types, API contracts (only cross-app import)
```

Extension lives in separate repo `haulbot-extension/`.

## UI

- Primitives: `apps/website/src/components/ui/`
- Tokens: single source (`styles/tokens.css` or Tailwind theme)
- Visual guide: [website-design.md](./website-design.md)
- **Never** duplicate Button/Input/Badge variants — use props

## Quality gates (Fallow)

```bash
# Before merge
fallow audit --base main --gate new-only --format json --quiet || true
fallow dupes --format json --quiet || true
```

Config: [`.fallowrc.json`](../.fallowrc.json) — boundary violations and circular deps are errors; duplication is zero-tolerance by convention.

## Cursor rules index

| Rule | Scope |
|---|---|
| `architecture-first-development.mdc` | Always — AFDP: Phases 1–8 pre-code, post-implementation audit, REUSE > EXTEND > REFACTOR > CREATE |
| `project-core.mdc` | Always — architecture, scope, philosophy |
| `typescript.mdc` | `**/*.{ts,tsx}` |
| `ui-components.mdc` | `apps/website/**` |
| `monorepo-boundaries.mdc` | `apps/**` |
| `fallow-audits.mdc` | Always — audit workflow |
