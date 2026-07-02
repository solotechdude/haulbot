# RelayBooking SOLO

An AI dispatch service for solo Amazon Relay owner-operators. The driver sets objectives; a dedicated remote agent searches and books loads on their behalf while they drive.

**Operator docs:** [docs/campaign-bot-flow.md](./docs/campaign-bot-flow.md) — `/campaign ORIGIN minRate minPayout` wizard and defaults.

## Language

**Driver**:
A solo owner-operator who subscribes to the service and interacts primarily through Telegram.
_Avoid_: User (too generic), customer (use only in billing context)

**Dedicated Environment**:
A single AWS Secure Browser instance provisioned exclusively for one Driver for the life of their subscription.
_Avoid_: Worker, browser pool, shared session

**Relay Session**:
The authenticated Amazon Relay account state inside a Driver's Dedicated Environment.
_Avoid_: Browser session (conflicts with Chrome/browser terminology)

**Dispatch Agent**:
The invisible booking assistant that runs inside a Driver's Dedicated Environment and executes dispatch on Relay.
_Avoid_: Bot (reserved for the Telegram interface), extension (implementation detail)

**Telegram Bot**:
The `@SwiftRelaySoloBot` chat interface through which a Driver onboarded, sets goals, and receives updates.
_Avoid_: Agent, dispatcher

**Goal**:
A Driver's high-level dispatch objective expressed in natural language (e.g. weekly revenue target, be home by a date).
_Avoid_: Strategy, campaign, filter

**Strategy**:
The system's interpreted plan for achieving an active **Goal** — opaque to the Driver, consumed by the **Dispatch Agent**.
_Avoid_: Campaign, search rule, filters

**Campaign**:
A Driver-defined search specification that mirrors Amazon Relay load board filters (origin, destination, min payout, min rate, equipment, etc.). **Required via Telegram slash command:** origin, autobooker min rate ($/mi), autobooker min payout. **Defaults without extra input:** destination anywhere, radius 50mi, equipment tractor+trailer. All other Relay filters are optional via the **Add more filters** step or **Fine-tune**. Full flow: [`docs/campaign-bot-flow.md`](./docs/campaign-bot-flow.md).
_Avoid_: Saved search (Relay UI term), filter set, goal

**Campaign Preset**:
A named, reusable **Campaign** configuration the Driver saves and retrieves via the **Telegram Bot** — not Amazon Relay's saved search. **Pinned presets** are named favorites; **Campaign History** keeps recent searches for one-tap reuse; when origin matches a pinned preset, the bot suggests it proactively.
_Avoid_: Saved search, filter template, strategy

**Search Criteria**:
The **Relay filters** a **Campaign** applies on the load board — what Amazon Relay returns as search results (origin/destination + radius, work type, driver type, load type, price/mile min, payout min, trip duration, trip distance, equipment). May be looser than **Hard Rules**.
_Avoid_: Strategy (system-owned), goal, autobooker thresholds

**Book Priority**:
How the **Dispatch Agent** ranks loads that pass **Hard Rules** before attempting **Booking Completion** — default: highest payout first, then highest $/mi.
_Avoid_: Sort order, scoring function, best load heuristic

**Relay Work State**:
Where the **Dispatch Agent** is in a single active load-board cycle — idle, applying filters, ready to scan, scanning, or booking. Overlapping apply/scan/book on the same tab is forbidden to prevent mistaken books and broken flows.
_Avoid_: Extension state, tab state, polling phase

**Campaign Status**:
A single pinned Telegram message updated in place while a **Campaign** is active — route, armed state, **Relay Work State**, and last scan summary. Full detail available via `/status` or a **Details** button; scan ticks do not post to chat.
_Avoid_: Heartbeat message, scan log, agent status feed

**Campaign Review**:
The pre-arm summary step in the **Telegram Bot** wizard — after must-haves (`/campaign ORIGIN minRate minPayout`) and optional filters. Operator can **Start searching**, **Edit filters**, or **Save preset** from one screen.
_Avoid_: Confirmation screen, summary card, campaign preview

**Fine-tune**:
Optional **Campaign** configuration beyond must-haves, organized in the **Telegram Bot** wizard to mirror Relay load board sections (Location → Equipment → Work type → Load type → Driver type → Price → Time). Rarely used filters sit under **Advanced** (board price mins, trip time/distance).
_Avoid_: Advanced search, filter editor, custom filters

**Wide Net**:
A per-**Campaign** mode where **Search Criteria** min payout/rate on Relay are loosened or omitted so the board returns more loads for **Load Telemetry**, while **Hard Rules** stay strict. Heavier autobooker matching; default off.
_Avoid_: Analytics mode, loose search, scout mode

**Material Criteria Change**:
A change to origin, destination, or equipment on an active **Campaign** that requires a fresh Relay **+ New search** tab before re-applying filters — as opposed to in-place tweaks (book mins, **Wide Net**, radius).
_Avoid_: Major edit, filter reset, search refresh

**Campaign Edit**:
Changing an armed **Campaign** while the **Dispatch Agent** is active. Minor tweaks hot-reload in place with a brief Telegram ack. A **Material Criteria Change** requires operator confirmation, a fresh tab, and re-arm.
_Avoid_: Filter update, campaign patch, re-search

**Dispatch Leg**:
One search-and-book cycle from the Driver's current position (or expected post-delivery position) to a booked load.
_Avoid_: Campaign (Campaign defines criteria; Dispatch Leg is the execution unit)

**Continuity Queue**:
An ordered list of upcoming **Campaign** criteria to run after the current **Dispatch Leg** is satisfied — e.g. after DFW → anywhere is booked, activate ATL → FL.
_Avoid_: Parallel campaigns, multi-search

**Readiness Window**:
The earliest pickup time for the next load at the delivery city — derived from the Driver's **Pickup Readiness** choice, delivery ETA, checkout time, and rest.
_Avoid_: Pickup time, delivery time (raw schedule fields alone)

**Leg Transition**:
The moment the **Dispatch Agent** begins searching for the next **Dispatch Leg**, based on the **Readiness Window** — proactively before readiness, but booking only within the window.
_Avoid_: Auto-search on book, immediate handoff

**Next-Leg Handoff**:
The on-book flow where the Driver configures the upcoming leg — **Pickup Readiness**, **Search Criteria** for the delivery city, and optional **Hard Rules**.
_Avoid_: Continuity setup, leg planning

**Pickup Readiness**:
When the Driver wants to pick up their next load at the delivery city — expressed relative to delivery (e.g. +1h, +3h), as a computed suggestion (e.g. ~30h total), or custom time.
_Avoid_: Availability, rest period, Readiness Window (that's the output)

**Load Recommendation**:
Proactive dispatch guidance derived from market analytics — not a live load alert waiting for a Driver tap. Based on historical patterns of when lanes, rates, and origins tend to produce good matches.
_Avoid_: Suggestion, alert, live load notification, tap-to-book

**Market Intelligence**:
Aggregated analytics from the shared **Load Analytics Engine** — lane timing, rate trends, origin heat, seasonal patterns — enriched by SOLO's own fleet telemetry.
_Avoid_: Recommendations (that's the output to the Driver), load board snapshot, in-app analytics

**Load Analytics Engine**:
A separate multi-product analytics platform for Amazon Relay load board data. Ingests telemetry from multiple Relay booking extensions; exposes APIs for aggregates, timing, heat maps, and average prices. SOLO feeds it and consumes from it — not owned by the SOLO dispatch module alone.
_Avoid_: Telemetry warehouse, strategy engine, dispatcher backend

**Load Telemetry**:
The three data points the **Load Analytics Engine** ingests from Relay extensions: loads seen, loads booked, and loads attempted and missed. SOLO emits these through the **same interface** as other Relay booking extensions.
_Avoid_: Board snapshot, agent decision, telemetry event (too generic)

**Hard Rules**:
The **autobooker filters** — minimum payout and $/mi the **Dispatch Agent** requires before auto-booking. Loads below these are dropped; among survivors, **Book Priority** picks which to book first. Independent of **Search Criteria** when the operator wants a wider board net with a stricter book gate.
_Avoid_: Relay filters, board filters, campaign (Campaign is the full spec)

**Availability Prompt**:
A simplified Telegram prompt during **Next-Leg Handoff** — "When would you like to pick up in Atlanta?" with presets relative to delivery or a computed suggestion, plus optional criteria tuning.
_Avoid_: ETA form, rest configuration, HOS settings

**Readiness Choice**:
The Driver's selection from an **Availability Prompt** that sets **Pickup Readiness** and thus the **Readiness Window**.
_Avoid_: Rest period, availability override

**Active Commitment**:
A booked and driver-assigned load the Driver is currently executing (picked up or en route) — the system assumes high completion probability but must handle cancellation or breakdown.
_Avoid_: Current load, active booking

**Booking Completion**:
The full Relay booking workflow the **Dispatch Agent** must finish — book the load, assign it to the known **Driver**, then notify via Telegram. Not merely clicking "book."
_Avoid_: Auto-book, load secured

**Driver Assignment**:
The post-book step on Relay where the load is assigned to a specific driver in the carrier's account — time-sensitive and part of **Booking Completion**. With one driver per **Relay Account**, assignment is automatic with no selection step.
_Avoid_: Confirm, dispatch assign

**Relay Account**:
The Amazon Relay login a **Driver** links to SOLO — one driver per account at GA. Larger fleets give each driver a dedicated subaccount rather than sharing one account with a driver roster.
_Avoid_: Carrier account, Relay login, subaccount (subaccount is a type of Relay Account)

**SOLO Subscription**:
A paid entitlement for one **Driver** — one subscription per **Relay Account**, including fleet drivers on dedicated subaccounts.
_Avoid_: Seat, plan, license

**Product Admin**:
The operator who runs the SOLO product — marketing, development, and day-to-day operations. Single internal role, not a customer-facing fleet manager.
_Avoid_: Fleet Admin, SwiftRelay Ops, admin

**Subscriber Portal**:
The minimal web account surface for a **Driver** at `/solo` — billing, subscription management, and Telegram account linkage. Not dispatch control. Load statistics may come later.
_Avoid_: Dashboard, driver portal, account page

**Admin Dashboard**:
The **Product Admin** control surface at `/admin` — all customers, environments, onboarding timelines, agent health, and support actions. Required at launch. Telegram `/admin` commands deferred post-launch.
_Avoid_: Fleet dashboard, ops portal, CMS

**Relay Alert**:
A notification event from Amazon Relay (e.g. load canceled, schedule change) that the **Dispatch Agent** monitors and forwards to the Driver via Telegram.
_Avoid_: Notification, push, message

**Post-Book Operations**:
Load management after **Booking Completion** — fine-tuning, facility comms, detailed control — handled by the Driver directly on Relay when stopped, not by SOLO.
_Avoid_: Dispatch, after-booking workflow

**Dispatch State**:
The hot-path document the **Dispatch Agent** polls — `activeLeg`, `commitment`, pause flag. Kept tiny for fast reads.
_Avoid_: Strategy, profile, agent state

**Dispatch Plan**:
The cold-path document the backend orchestrates — `continuityQueue`, `handoff`, goal context. Not read by the extension poll loop.
_Avoid_: Campaign list, handoff session store

## Relationships

- A **Driver** has exactly one **Dedicated Environment** while subscribed
- A **Dedicated Environment** hosts exactly one **Relay Session** for that **Driver**
- A **Dispatch Agent** runs in exactly one **Dedicated Environment** and serves exactly one **Driver**
- A **Telegram Bot** conversation is linked to exactly one **Driver** — no cross-driver messaging
- When a **Driver** unsubscribes, their **Dedicated Environment** and **Relay Session** are terminated
- A **Goal** produces a **Strategy** when the Driver is in goal-driven dispatch
- **Campaign** maps **Search Criteria** to Relay and **Hard Rules** to the autobooker; **Wide Net** optionally decouples board mins from book mins
- When **Wide Net** is off and board price mins are unset, **Search Criteria** board mins default to **Hard Rules** mins
- A **Campaign Preset** stores a full or partial **Campaign** for reuse via the **Telegram Bot**; **Campaign History** and lane-matched suggestions reduce re-entry
- **Goal** is the primary dispatch mode; **Campaign** is an explicit alternative the Driver can switch to
- At any moment, exactly one **Dispatch Leg** is active on Relay — the agent cannot search two unrelated origins simultaneously
- The **Dispatch Agent** maintains one canonical load board tab per **Relay Session**; **Relay Work State** prevents overlapping apply, scan, and book
- A **Material Criteria Change** starts a fresh **+ New search** tab; other **Campaign** edits re-apply in place via **Campaign Edit**
- A **Continuity Queue** holds future legs in order; the next leg activates only after the current leg is satisfied (booked)
- **Campaign** B (e.g. ATL → FL) cannot run until **Campaign** A (e.g. DFW → anywhere) is satisfied
- **Leg Transition** to the next leg uses the **Readiness Window**, balancing continuity (search early) against security (don't book loads the Driver can't make)
- An **Active Commitment** can be disrupted (cancellation, breakdown) — the **Continuity Queue** and **Readiness Window** must be recomputed
- The **Readiness Window** is set by a **Readiness Choice** from an **Availability Prompt** — Driver overrides always win over system defaults
- **Availability Prompt** options must be minimal (presets + custom time) because the Driver is on the road and multitasking
- **Next-Leg Handoff** happens **on book** — the system suggests pickup timing (e.g. ~30h = drive + checkout + rest) and lets the Driver fine-tune **Search Criteria** for the delivery city
- **Hard Rules** govern instant auto-booking on live board matches; **Load Recommendations** are analytics-driven guidance delivered before loads appear
- Live loads outside **Hard Rules** are not pushed to the Driver for tap-to-book — they disappear too fast; instead **Market Intelligence** from the **Load Analytics Engine** informs proactive search strategy
- SOLO contributes **Load Telemetry** through the same extension interface as other Relay products — no separate adapter schema
- **Market Intelligence** is consumed via the engine's APIs (aggregates, timing, heat map, average prices) — queried at **Next-Leg Handoff** and briefings, cached locally in SOLO
- **Booking Completion** (book + **Driver Assignment** + notify) is SOLO's core job; **Post-Book Operations** are the Driver's when stopped
- The **Dispatch Agent** monitors Relay for **Relay Alerts** and notifies the Driver; it does not manage detailed post-book comms
- One **Relay Account** maps to one **Driver** — fleets use dedicated subaccounts per driver instead of multi-driver roster selection in SOLO
- One **SOLO Subscription** entitles exactly one **Driver**, one **Dedicated Environment**, and one **Telegram Bot** link — fleet subaccounts each require a separate subscription
- The **Dispatch Agent** polls **Dispatch State** only; **Dispatch Plan** is backend-orchestrated and updated during handoff and queue management
- There is no **Fleet Admin** — larger fleets use separate **Relay Account** subaccounts, each with its own **SOLO Subscription**
- **Product Admin** uses the **Admin Dashboard** for platform operations; **Drivers** use the **Subscriber Portal** for account/billing/Telegram only — dispatch stays in Telegram

## Example dialogue

> **Dev:** "Driver A's Relay session hits a CAPTCHA. Does that affect Driver B?"
> **Domain expert:** "No. Each Driver has their own Dedicated Environment. A's problem is isolated to A."

> **Dev:** "Can one Dispatch Agent talk to multiple Telegram accounts?"
> **Domain expert:** "No. The agent in a Dedicated Environment is bound to that Driver's linked Telegram only."

> **Dev:** "Driver says 'I need $8k this week' but also wants to set origin Memphis and min $2.40/mi. Is that one thing or two?"
> **Domain expert:** "Two modes. **Goal** is the default — the system interprets intent. **Campaign** is when the Driver wants hands-on control: `/campaign MEMPHIS 2.4 800` then optional filters, then arm."

> **Dev:** "What does `/campaign BRAMPTON 3 200` search?"
> **Domain expert:** "Brampton origin, $3/mi and $200 min payout to **book**. Destination defaults to **anywhere** unless the Driver adds a destination filter. Radius defaults 50mi, equipment tractor+trailer."

> **Dev:** "Can the agent search DFW → anywhere and ATL → FL at the same time?"
> **Domain expert:** "No. One truck, one position, one Relay search. DFW → anywhere is the active **Dispatch Leg**. ATL → FL goes in the **Continuity Queue** and starts only after the DFW leg is booked."

> **Dev:** "Driver picked up DFW → ATL. When do we search ATL → FL?"
> **Domain expert:** "Not immediately on book. Compute **Readiness Window**: ETA to Atlanta + safety buffer + rest time. Start proactive search inside that window — early enough to catch scarce loads, late enough not to book something the Driver can't reach."

> **Dev:** "What if the DFW → ATL load gets canceled mid-transit?"
> **Domain expert:** "The **Active Commitment** is void. Recompute from the Driver's actual situation — may restart search from current position, not from Atlanta."

> **Dev:** "How does the system know when the Driver can take the next load?"
> **Domain expert:** "At **Next-Leg Handoff** on book. Ask: 'When would you like to pick up in Atlanta?' Suggest ~30h if we can compute it. Offer presets: 1h after delivery, 3h after delivery, or custom. Keep it one tap."

> **Dev:** "Driver sets min rate $2.50 but a $2.30/mi load is great otherwise. What happens?"
> **Domain expert:** "Don't push the live load — it'll vanish before the Driver taps. Log it in **Market Intelligence**. At the next **Next-Leg Handoff** or briefing, recommend loosening to $2.40 based on what's actually posting on ATL→FL this week."

> **Dev:** "How do we recommend loads if not by alerting on live board?"
> **Domain expert:** "Analytics upfront. Tell the Driver when to search, what lanes are hot, and whether their **Hard Rules** are realistic — before the load appears, not after."

> **Dev:** "Where does market data come from?"
> **Domain expert:** "The **Load Analytics Engine** — shared across Relay products. SOLO feeds it **Load Telemetry** (seen, booked, attempted-and-missed) from our Dispatch Agent. **Next-Leg Handoff** and briefings query the engine's APIs for aggregates, timing, heat maps, and average prices."

> **Dev:** "Driver needs to reassign or talk to a facility after booking. Is that SOLO?"
> **Domain expert:** "No — that's **Post-Book Operations**. Driver logs into Relay when stopped. SOLO owns **Booking Completion** and **Relay Alerts**, not every post-book detail."

> **Dev:** "Is clicking 'book' enough?"
> **Domain expert:** "No. **Booking Completion** includes **Driver Assignment** on Relay. We know the Driver — assign immediately, then notify on Telegram."

> **Dev:** "Relay account has three drivers on the roster. Which one does SOLO assign?"
> **Domain expert:** "SOLO targets one driver per **Relay Account**. Fleets create a dedicated subaccount per driver and link that to SOLO — we don't pick from a roster at book time."

> **Dev:** "Fleet with 5 drivers — one subscription or five?"
> **Domain expert:** "Five. Each subaccount is a separate **SOLO Subscription**, each with its own environment and Telegram link."

> **Dev:** "Does the fleet company get an admin dashboard?"
> **Domain expert:** "No **Fleet Admin**. Each driver self-onboards. The **Product Admin** runs the platform admin dashboard. Drivers get a minimal **Subscriber Portal** for billing and Telegram — dispatch stays in Telegram."

## Flagged ambiguities

- `docs/architecture.md` (formerly plan.md) — pooled browser workers removed; one Dedicated Environment per Driver.
- "Bot" was used to mean both **Telegram Bot** and **Dispatch Agent** — resolved: Telegram Bot is the chat UI; Dispatch Agent is the remote executor.
- "Filters" vs **Campaign** vs **Goal** — resolved: Relay load board fields are **Search Criteria** inside a **Campaign**; NL intent is a **Goal**; the system-owned interpretation is a **Strategy**.
- SOLO extension interface vs engine adapter — **resolved**: SOLO implements the same **Load Telemetry** interface as other Relay extensions; backend may still normalize SOLO-native audit events before emit.
- "Driver never uses Relay" vs direct Relay login — **resolved**: Driver does not use Relay for dispatch/search; may use Relay for **Post-Book Operations** when stopped.
- Multi-driver Relay roster selection — **resolved**: not in SOLO; fleets use per-driver **Relay Account** subaccounts, each a separate **SOLO Subscription**.
- Backend vs bot orchestration — **resolved**: backend orchestrates; **Telegram Bot** is thin UI; **Dispatch Agent** (extension) is executor.
- SOLO payment provider — **resolved for this repo**: Stripe (supersedes PayPal references in legacy SOLO plans).
- Greenfield SOLO schema and legacy `docs/data-model.md` drafts — **resolved**: superseded by [`docs/data-model.md`](./docs/data-model.md).
- Data model shape — **resolved**: hot/cold split — **Dispatch State** (extension poll) + **Dispatch Plan** (backend orchestration) per driver, plus `core/` identity and `telemetry/` append-only with TTL.
- GA scope — **resolved**: complete product at initial launch; no phased feature reduction (Goal mode, Campaign mode, handoff, analytics consume, briefings, alerts — all ship together).
- Fleet Admin dashboard — **resolved**: no fleet admin role; **Product Admin** **Admin Dashboard** for platform ops; **Subscriber Portal** for driver billing/Telegram only.
- Admin dashboard scope at launch — **resolved**: customers list, environment detail (onboarding + agent health + support actions + decision tail); driver stats on portal deferred.
- Website deploy — **resolved**: one website app — marketing, **Subscriber Portal**, and **Admin Dashboard** are route groups, not separate sites.
- Repository layout — **resolved**: monorepo for website + backend + bot + shared packages; Chrome extension in separate repo.
- Product Admin mobile ops — **resolved**: **Admin Dashboard** only at launch; Telegram `/admin` commands post-launch.
