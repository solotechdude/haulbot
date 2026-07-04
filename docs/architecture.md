# Architecture

Haulbot is a remote dispatch platform. Telegram is the driver interface; AWS Secure Browser is the execution environment. The backend orchestrates everything.

See [`CONTEXT.md`](../CONTEXT.md) for domain terms.

## Core principle

```text
Driver → Telegram Bot → Backend → Dispatch Agent (extension) → Amazon Relay
                              ↕
                    Load Analytics Engine
```

- **Backend orchestrates** — state machines, handoff, strategy, engine queries
- **Telegram Bot is thin UI** — renders prompts and buttons; forwards to backend API
- **Extension is executor** — DOM automation, book + assign, telemetry emit, polls dispatch state

The browser is not the product. Booking loads while the driver drives is the product.

## Isolation model

One binding chain per paying driver:

```text
1 Driver ↔ 1 Relay Account ↔ 1 SOLO Subscription ↔ 1 Dedicated Environment ↔ 1 Telegram link
```

- Dedicated Environment = AWS WorkSpaces Secure Browser, provisioned on subscribe, terminated on unsubscribe
- Larger fleets use dedicated Relay subaccounts — each gets its own subscription and onboarding
- No multi-driver roster selection, no shared browser pools

## Components

| Component | Deploy | Role |
|---|---|---|
| **Website** | DO App | Marketing (`/`), Subscriber Portal (`/solo`), Admin Dashboard (`/admin`) |
| **Backend** | DO App | Orchestration, APIs, Stripe, vault refs, analytics engine client |
| **Telegram Bot** | DO App worker | Driver chat UI; webhook in prod |
| **Extension** | S3 → Secure Browser | Relay DOM automation, Load Telemetry |
| **Load Analytics Engine** | External | Market intelligence; shared across Relay products |
| **MongoDB** | DO Managed | Persistence |
| **Vault** | External | Relay credentials |

## Web surfaces

| Route | Audience | At launch |
|---|---|---|
| `/` | Prospects | Marketing, pricing, signup |
| `/solo/*` | Drivers | Billing, Telegram link, onboarding wizard |
| `/admin/*` | Product Admin | Customers, environments, onboarding, agent health, support |

Drivers do **not** configure dispatch on the web. Dispatch lives in Telegram.

Product Admin is a single internal operator — not a fleet manager role.

## Dispatch model

### Modes

| Mode | Driver input | System behavior |
|---|---|---|
| **Goal** (primary) | Natural language — e.g. "$8k this week, Atlanta by Thursday" | Backend interprets → Strategy → `activeLeg` |
| **Campaign** | Load-board-style Search Criteria — origin, radius, min rate, min payout, equipment | Applied directly to Relay UI filters |

Both modes produce one **active Dispatch Leg** at a time. Not parallel searches.

### Sequential continuity

```text
Active Dispatch Leg (e.g. DFW → anywhere)
        ↓ booked + assigned
Continuity Queue (e.g. ATL → FL waits here)
        ↓ leg transition
Next Dispatch Leg
```

Leg B cannot run until Leg A is booked. Continuity is ordered, not parallel.

### Hard Rules vs recommendations

| Type | Behavior |
|---|---|
| **Hard Rules** | Auto-book instantly on live board match + assign driver |
| **Load Recommendations** | Analytics-driven guidance at Next-Leg Handoff or briefings — not live tap-to-book alerts |

Hot loads disappear in seconds. Recommendations come from **Market Intelligence**, not live load pushes.

### Readiness and leg transition

**Next-Leg Handoff** runs on **Booking Completion** (not on book click alone):

1. Book load on Relay
2. Assign driver (automatic — one driver per Relay Account)
3. Notify driver on Telegram
4. **Availability Prompt** — "When pick up in [city]?" with presets (+1h after delivery, +3h, computed suggestion, custom)
5. Fine-tune Search Criteria for next leg (radius, heading, rates)
6. Optional **Load Recommendations** from analytics engine

**Readiness Window** = earliest allowed pickup time. Agent may search proactively before readiness but only books within the window.

**Leg transition:** search opens at `readiness − lookahead`; book floor = readiness time.

### Active Commitment disruptions

- Load canceled on Relay → Relay Alert → notify driver → recompute from actual position
- Driver breakdown → driver reports via Telegram → reset commitment and queue

Post-book facility comms and detailed load management → **Post-Book Operations** on Relay when driver is stopped.

## Booking Completion flow

```text
Extension: Hard Rules match on live board
        ↓
Extension: book → assign driver (same session, seconds apart)
        ↓
Extension: POST booking event + Load Telemetry
        ↓
Backend: set commitment, open handoff, query analytics engine
        ↓
Bot: Telegram notify + Availability Prompt + criteria tuning
        ↓
Backend: patch dispatch_plan → promote to dispatch_state.activeLeg when ready
        ↓
Extension: polls activeLeg → searches next leg
```

Assignment failure = booking failure. Do not notify driver until Booking Completion is confirmed.

## Load Analytics Engine

**Feed (async):** SOLO extension emits **Load Telemetry** via the same interface as other Relay extensions:

- Loads seen
- Loads booked
- Loads attempted and missed

**Consume (at decision points):** Backend queries engine APIs; caches locally:

- Aggregates, timing, heat maps, average prices
- Used at Next-Leg Handoff and morning briefings

Backend may normalize SOLO-native `agent_decisions` audit events before telemetry emit.

## Relay Alert monitoring

Extension watches Relay notification UI while agent is active. Minimum at launch: **load canceled**.

Forward to backend → Telegram push to driver. Driver handles details on Relay when stopped.

## Onboarding flow

```text
① Subscribe (Stripe)
② Provision Dedicated Environment + force-install extension
③ Ready email → /solo
④ Magic-link sign-in → Connect Telegram (QR + deep link)
⑤ Extension boots → reports ready → waits
⑥ Bot: /connect_relay → Relay credentials via Telegram (vault)
⑦ Relay authenticated (+ /2fa if needed) → agent active
⑧ Driver sets first Goal or Campaign in Telegram (`/campaign ORIGIN minRate minPayout`)
```

Relay credentials enter via Telegram only — not the Subscriber Portal.

## Steady-state loop

```text
Driver: /campaign ORIGIN minRate minPayout  (or /goal)
        ↓ optional filters → review → Book now
        ↓
Backend: updates dispatch_state.activeLeg (+ dispatch_plan if needed)
        ↓
Extension: polls activeLeg → applies Search Criteria on Relay
        ↓
Extension: evaluates loads → auto-books Hard Rules matches (Book Priority)
        ↓
Booking Completion → handoff → next leg
        ↓
Load Telemetry → Analytics Engine
```

See [campaign-bot-flow.md](./campaign-bot-flow.md) for the Telegram wizard, **anywhere** default, and queued-leg readiness behavior.

## Explicit non-goals

- Fleet admin dashboard or multi-seat company management
- Telegram `/admin` commands at launch
- Driver-facing Secure Browser portal
- Human approval gate before booking (Hard Rules matches)
- Headless Puppeteer — must be real Relay Chrome UI
- Pooled browser workers
- Live tap-to-book recommendations
- Subscriber Portal load statistics (post-launch)
