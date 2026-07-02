# Build Plan

Complete product at initial launch — no phased feature reduction. See [architecture.md](./architecture.md) for system design.

## Four parallel tracks

```text
Track 1 — Spine + onboarding        (S1→S4)
Track 2 — Execution agent             (E1→E4)   starts after S4
Track 3 — Backend orchestration       (O1→O4)   starts after E3
Track 4 — Bot + intelligence UX       (T1→T4, I1→I3)   parallel with Track 3
```

### Track 1 — Spine + onboarding

| ID | Deliverable |
|---|---|
| S1 | Stripe subscribe → SOLO entitlement |
| S2 | Provision Dedicated Environment + force-install extension |
| S3 | `/solo` onboarding wizard — magic link, Connect Telegram, onboarding step polling |
| S4 | Extension boot in Secure Browser — auth, poll empty `dispatch_states`, emit heartbeat |

### Track 2 — Execution agent

| ID | Deliverable |
|---|---|
| E1 | Campaign mode — apply Search Criteria to Relay load board UI |
| E2 | Hard Rules evaluator + instant auto-book |
| E3 | Booking Completion — book + assign driver + confirm |
| E4 | Relay Alert monitoring (cancel minimum) + Load Telemetry emit |

### Track 3 — Backend orchestration

| ID | Deliverable |
|---|---|
| O1 | Next-Leg Handoff on Booking Completion — readiness presets, criteria tuning |
| O2 | Continuity Queue + leg transition (readiness window, searchOpensAt) |
| O3 | Goal mode — NL input → strategy → `activeLeg` |
| O4 | Load Analytics Engine consume — cache at handoff + morning briefing |

### Track 4 — Bot + intelligence UX

| ID | Deliverable |
|---|---|
| T1 | Onboarding commands — `/start`, `/connect_relay`, `/2fa` |
| T2 | Steady-state — `/goal`, `/campaign ORIGIN minRate minPayout`, `/status`, `/pause`, `/resume`, `/explain` — see [campaign-bot-flow.md](./campaign-bot-flow.md) |
| T3 | Handoff prompts — inline keyboards, pickup readiness, criteria fine-tune |
| T4 | Push alerts — booked, canceled, briefing |
| I1 | Load Telemetry feed to analytics engine (standard interface) |
| I2 | Engine API integration — aggregates at handoff |
| I3 | Load Recommendations — analytics-driven guidance (not live alerts) |

### Admin (parallel with Track 1–3)

| ID | Deliverable |
|---|---|
| A1 | `/admin` — customer list, subscription status, onboard step |
| A2 | Environment detail — onboarding timeline, agent health, support actions |
| A3 | Decision tail per driver |

Telegram `/admin` commands — **post-launch**.

## Integration gates

Prove end-to-end at each gate. Launch when all are green.

| Gate | Proves |
|---|---|
| **Gate 1** | Driver subscribes, onboards, extension alive, polling empty state |
| **Gate 2** | Campaign → book → assign → Telegram notify |
| **Gate 3** | Handoff → next leg searches within readiness window |
| **Gate 4** | Goal mode + analytics recommendations at handoff |
| **Gate 5** | Cancel alert → commitment reset → continuity recompute + briefing |
| **Launch** | All gates + admin dashboard operational |

## Launch scope checklist

### Driver experience
- [ ] Subscribe via Stripe
- [ ] Onboard via `/solo` + Telegram + Relay creds
- [ ] Campaign mode with load-board Search Criteria
- [ ] Goal mode with NL interpretation
- [ ] Hard Rules auto-book + assign
- [ ] Next-Leg Handoff on book
- [ ] Relay cancel alerts
- [ ] Morning briefing with market intelligence

### Product Admin
- [ ] `/admin` customer list + environment detail
- [ ] Onboarding timeline + support actions
- [ ] Agent health + decision tail

### Infrastructure
- [ ] 4 deploys: website, backend, bot, extension (S3)
- [ ] AWS Secure Browser provisioning per subscription
- [ ] Vault for Relay credentials
- [ ] Analytics engine feed + consume

## Known build risks

1. **Assign-driver DOM flow** — confirm Relay UI automation; treat assign failure like book failure
2. **Relay Alert types** — start with cancel; expand as discovered
3. **Analytics engine API contract** — document before Track 4
4. **Goal NL → strategy** — define acceptance tests early in Track 3
5. **429 / anti-automation** — extension pause and backoff behavior

## Local development

```text
MongoDB (local or DO dev)
  ↑
Backend :8080
  ↑
Website :3000  (/, /solo, /admin)
  ↑
Bot polling (dev) / webhook (prod)
  ↑
Extension (unpacked dist/ in Chrome or Secure Browser stub)
```

Critical env alignment: shared service tokens between backend and bot; Stripe webhook secret; vault credentials; analytics engine endpoint.
