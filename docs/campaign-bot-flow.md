# Campaign mode — Telegram bot flow

How a Driver starts a **Campaign** in Telegram. Domain terms: [`CONTEXT.md`](../CONTEXT.md).

## Command

```text
/campaign ORIGIN minRate minPayout
```

| Argument | Required | Example | Meaning |
|---|---|---|---|
| `ORIGIN` | yes | `BRAMPTON`, `DFW` | Relay origin city / market |
| `minRate` | yes | `3` | **Hard Rules** — minimum $/mi to auto-book |
| `minPayout` | yes | `200` | **Hard Rules** — minimum payout to auto-book |

**Examples:**

```text
/campaign BRAMPTON 3 200
/campaign DFW 2.5 800
```

## Defaults (no extra input)

When the Driver does not add optional filters:

| Field | Default |
|---|---|
| Destination | **anywhere** (origin-only search on Relay — no destination filter) |
| Radius | 50 mi |
| Equipment | Tractor + trailer |
| Book priority | Payout desc, then rate desc |
| Board min rate / payout | Same as **Hard Rules** (unless **Wide Net** — future) |

**Anywhere convention:** backend stores `destination === origin`. The bot displays `ORIGIN → anywhere`. The extension leaves Relay’s destination field empty.

## Wizard steps

```text
/campaign ORIGIN minRate minPayout
        ↓
Must-haves summary
  [Add more filters]  [Continue]  [Cancel]
        ↓
Optional filters (if Add more filters)
  [Destination]  [Radius]
  [Done — review]  [Cancel]
        ↓
Review search
  [Start searching]  [Edit filters]  [Save preset*]  [Cancel]
        ↓
When do you need this load?
  [Book now]  [Schedule for later]  [Cancel]
        ↓
Extension armed → pinned Campaign Status message updates in place

* Save preset — stub (P2)
```

### Optional filters (implemented)

| Filter | How to set | Notes |
|---|---|---|
| **Destination** | Tap **Destination**, reply with city code (`ATL`) or `anywhere` | Material change — may require fresh Relay tab (future) |
| **Radius** | Tap **Radius**, reply with miles (`50`, `100`) | Stored in `searchCriteria.radius` |

### Optional filters (planned — Fine-tune)

Work type, load type, driver type, equipment variants, **Wide Net**, board price mins, trip time/distance — mirror Relay load board sections per **Fine-tune** in CONTEXT.

## After arming

1. Backend sets `activeLeg`, `hardRules`, `campaignSessionId`.
2. Extension polls → applies **Search Criteria** on Relay → scans → auto-books loads matching **Hard Rules**.
3. **Campaign Status** — one pinned Telegram message shows route, work state, last scan (no per-tick spam).
4. `/status` or **Details** on the status message for full dump.

## Queued next leg (handoff)

After a book, the Driver picks pickup time (+1h, +3h, etc.). That leg queues with a **Readiness Window**. After `/complete` on the current trip:

- Extension **defers apply** until ~2 minutes before pickup.
- Scan/book starts when readiness time is reached.

## Related commands

| Command | Purpose |
|---|---|
| `/complete` | Clear active trip; arm queued leg if present |
| `/pause` / `/resume` | Stop or resume agent |
| `/status` | Full dispatch snapshot |

## Dev shortcuts

```bash
# Telegram flow (preferred)
/campaign BRAMPTON 3 200

# Direct DB seed (bypasses bot) — haulbot
bun run set:campaign aj@truckpin.com BRAMPTON 3 200
# Optional 4th arg: destination (omit or same as origin = anywhere)
bun run set:campaign aj@truckpin.com BRAMPTON 3 200 ATL
```

## Schema mapping

| Driver input | `activeLeg` field |
|---|---|
| Origin | `searchCriteria.origin` |
| Destination / anywhere | `searchCriteria.destination` (same as origin = anywhere) |
| minRate | `hardRules.minRate` (+ default `boardMinRate` via `resolveBoardMins`) |
| minPayout | `hardRules.minPayout` (+ default `boardMinPayout`) |
| Radius | `searchCriteria.radius` |
| Pickup time | `readinessWindow`, `searchOpensAt` |

See [`packages/shared/src/campaign.ts`](../packages/shared/src/campaign.ts) for board-min default rules.
