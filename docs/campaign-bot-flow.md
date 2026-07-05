# Campaign mode — Telegram bot flow

How a Driver starts a **Campaign** in Telegram. Domain terms: [`CONTEXT.md`](../CONTEXT.md).

## Entry points

| Entry | Flow |
|---|---|
| **Start search** (reply keyboard) | Full linear wizard from origin |
| `/campaign` (no args) | Same wizard |
| `/campaign ORIGIN minRate minPayout` | Pre-fills origin + book mins → starts at **radius** |
| **Edit full search…** (after book) | Pre-filled wizard → review |

## Linear wizard (must-haves)

```text
Origin(s) → Radius → Equipment → $/mi → Payout → Optional hub → Review → Arm
```

| Step | UI |
|---|---|
| **Origins** | One city at a time, `[Add origin]` up to 5, `[Done → Radius]` |
| **Radius** | Inline chips (25–300 mi) + Other |
| **Equipment** | Main type → multi-select subs (SSOT from `relay-filters.ts`) |
| **$/mi / Payout** | Chip presets + Other |
| **Optional** | Destination, dest radius, pickup, work type, load type |
| **Review** | `[Start now]` · `[Schedule…]` · `[Edit]` · `[Save preset]` · `[Cancel]` |

Navigation: `[← Back]` + `[Cancel]` on steps after origin.

## Defaults

`lastCampaignDefaults` on `dispatch_states` stores last-used radius, equipment, book mins, work/load types — **not origins**.

Loaded automatically on **Start search** and `/campaign`.

## After arming

1. Backend sets `activeLeg`, `hardRules`, `campaignSessionId`, rotates session.
2. Extension applies **Search Criteria** (multi-origin, equipment subs, dest radius) → scans → auto-books.
3. Pinned **dispatch dashboard** updates in place.

## Schema mapping

| Driver input | `activeLeg` field |
|---|---|
| Origin(s) | `searchCriteria.origins[]`, `origin` = first |
| Destination / anywhere | `destination === origin` = anywhere |
| minRate / minPayout | `hardRules` (+ board mins via `resolveBoardMins`) |
| Radius | `searchCriteria.radius` |
| Dest radius | `searchCriteria.destinationRadius` |
| Equipment | `searchCriteria.equipment { main, subs[] }` |
| Work / load type | `workTypes[]`, `loadTypes[]` (bot v1; extension apply v2) |
| Pickup | `readinessWindow`, `searchOpensAt` |

SSOT: [`packages/shared/src/relay-filters.ts`](../packages/shared/src/relay-filters.ts)  
Wizard: [`apps/bot/src/handlers/campaign-wizard.ts`](../apps/bot/src/handlers/campaign-wizard.ts)

## Related commands

| Command | Purpose |
|---|---|
| `/complete` | Clear active trip; promote queued leg |
| `/pause` / `/resume` | Stop or resume agent |
| `/status` | Full dispatch snapshot |
