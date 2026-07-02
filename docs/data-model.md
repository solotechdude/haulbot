# Data Model

Minimal MongoDB schema optimized for one hot read path (extension polling) and thin writes. See [`CONTEXT.md`](../CONTEXT.md) for domain terms.

## Design rules

1. **One poll path** — extension reads `dispatch_states` only
2. **No command queue** — extension polls; backend orchestrates
3. **No event store v1** — append-only telemetry with TTL
4. **Hot/cold split** — poll document stays ~500 bytes; handoff/queue lives separately
5. **Split collections only when access pattern or volume differs**

## Databases

Three logical databases on one DO Managed MongoDB cluster:

```text
core/         identity, billing, infra        — changes rarely
dispatch/     orchestration state             — hot path
telemetry/    audit, alerts, onboarding       — write-heavy, TTL
```

## Collections

### `core`

| Collection | Purpose |
|---|---|
| `users` | Identity |
| `subscriptions` | Stripe SOLO entitlement — one per driver |
| `telegram_links` | 1:1 Telegram ↔ user |
| `provisioned_environments` | Dedicated Environment records (AWS Secure Browser) |
| `environment_secret_refs` | Vault pointers for Relay credentials |

### `dispatch`

| Collection | Purpose | Read by extension |
|---|---|---|
| `dispatch_states` | Hot path — `activeLeg`, `commitment`, pause | ✅ poll |
| `dispatch_plans` | Cold path — `continuityQueue`, `handoff`, goal context | ❌ |
| `goal_history` | Append-only NL goal log (optional, low volume) | ❌ |

### `telemetry`

| Collection | Purpose | TTL |
|---|---|---|
| `agent_decisions` | Accept / reject / book audit | 30–90 days |
| `relay_alerts` | Cancel, schedule change | 90 days |
| `environment_events` | Onboarding timeline | long |
| `booking_completions` | Book + assign outcomes | long |

Load Telemetry to the analytics engine is emitted via the standard extension interface — not duplicated in MongoDB.

## Document shapes

### `dispatch_states` (hot — extension polls this)

```javascript
{
  userId,                          // unique index
  paused: false,
  activeLeg: {
    mode: "goal" | "campaign",
    searchCriteria: {
      origin, destination, radius, heading,
      boardMinRate, boardMinPayout, wideNet, equipment,
      workType, driverType, loadType,
      tripDurationMin, tripDurationMax,
      tripDistanceMin, tripDistanceMax
    },
    hardRules: { minRate, minPayout },
    bookPriority: "payout_then_rate",
    readinessWindow: ISODate,
    searchOpensAt: ISODate
  },
  commitment: { ... } | null,
  campaignSessionId: UUID,          // set when Driver arms via Book now
  campaignStatusPin: { telegramChatId, messageId },
  agentStatus: { relayWorkState, armed, lastScanSummary, updatedAt },
  heartbeatAt: ISODate,
  updatedAt: ISODate
}
```

### `dispatch_plans` (cold — backend + bot only)

```javascript
{
  userId,                          // unique index
  continuityQueue: [
    {
      searchCriteria: { /* same shape as activeLeg */ },
      hardRules: { minRate, minPayout },
      pickupReadiness: { type: "after_delivery", hours: 3 } | { type: "absolute", at: ISODate }
    }
  ],
  handoff: {
    deliveryCity,
    suggestedReadiness: ISODate,
    awaitingField: "readiness" | "criteria" | null,
    marketSnapshot: { /* cached analytics engine response */ }
  } | null,
  lastGoalId: ObjectId | null,
  updatedAt: ISODate
}
```

### `core/subscriptions`

```javascript
{
  userId,
  plan: "SOLO",
  stripeSubscriptionId,
  status: "active" | "canceled" | "past_due",
  createdAt, updatedAt
}
```

### `telemetry/agent_decisions`

```javascript
{
  userId, loadId, decision: "accept" | "reject" | "book" | "attempt",
  reasonCodes: ["hard_rule_miss", "readiness_window", "429_pause", ...],
  loadSnapshot: { origin, destination, rate, payout },
  createdAt
}
```

## Indexes (GA minimum)

```text
dispatch_states.userId          unique
dispatch_plans.userId           unique
agent_decisions.{userId, createdAt}
relay_alerts.{userId, createdAt}
subscriptions.userId
telegram_links.userId           unique
provisioned_environments.userId unique
```

No other indexes at launch.

## Write patterns

| Event | Write |
|---|---|
| Extension polls | Read `dispatch_states` by userId |
| Driver sets campaign via Telegram | Bot → `POST /v1/bot/dispatch/campaign` — `/campaign ORIGIN minRate minPayout`; see [campaign-bot-flow.md](./campaign-bot-flow.md) |
| Hard Rules match → book + assign | Extension executes; POST booking_completion; backend sets `commitment`, opens `handoff` in plan |
| Driver taps handoff button | Bot → backend patches `dispatch_plans.handoff` |
| Handoff complete | Backend promotes next leg → `dispatch_states.activeLeg`; clears `handoff` |
| Load canceled | Extension detects; backend clears `commitment`, recomputes `activeLeg` |
| Goal submitted | Append `goal_history`; backend interprets → patch `activeLeg` |
| Unsubscribe | Terminate environment; archive or delete dispatch docs |

## Deliberately excluded

| Cut | Why |
|---|---|
| `dispatch_agents` | 1:1 with driver — merged into `dispatch_states` |
| `browser_sessions`, `workers` | Replaced by `provisioned_environments` |
| `agent_tasks`, message queue | Extension polls strategy |
| `search_campaigns` | Embedded in `activeLeg` / `continuityQueue` |
| `strategies` + `goals` as separate hot collections | `activeLeg` is the strategy; `goal_history` logs input |
| `conversations` | Handoff state in `dispatch_plans.handoff` |
| `load_opportunities` | Analytics engine owns market data |
| `booking_attempts` | Covered by `agent_decisions` + `booking_completions` |
| Full event store | `telemetry/` is sufficient at launch |
| `companies` / fleet billing | No fleet admin; each driver is independent |
