# Dedicated Environment Provision — Bullet Program

AWS **WorkSpaces Secure Browser (WSW)** execution plane for the Dispatch Agent (Chrome extension). Control plane (backend, Telegram bot, website) stays on DigitalOcean.

**Gate 1 target:** Driver subscribes → Dedicated Environment boots → extension heartbeats → onboarding advances → empty `dispatch_states` poll.

Related: [architecture.md](../architecture.md) · [build-plan.md](../build-plan.md) · [infrastructure.md](../infrastructure.md) · [data-model.md](../data-model.md)

---

## Locked decisions (grill session)

| Decision | Choice |
|---|---|
| Execution environment | AWS WSW — one **portal** per paying driver |
| Region | **`us-east-1` only** — Amazon Relay is US; drivers may be global |
| Instance type | `standard.regular` at launch; bump to `standard.large` only if Relay UI lags |
| Agent uptime | **24/7** remote browser session + extension poll loop |
| Booking aggressiveness | Only when armed (`campaignSessionId` set, not paused) |
| Cost tolerance | **~$7–25/driver/mo** WSW (200h bundle + overage at 24/7) |
| “Environment ready” | **`provisionState: ready` only after first extension heartbeat** — not on `CreatePortal` |
| Environment-ready email | Fire on transition to `ready` (heartbeat), never on portal create alone |
| Driver-facing WSW portal | **Non-goal** — service identity signs in; driver uses Telegram only |
| Telegram bot host | **DigitalOcean App Platform** — unchanged |
| IdP | Audit existing SAML first; **v1 fallback: Amazon Cognito** synthetic user per driver |

---

## Architecture

```text
Driver (Telegram, global)
      ↓
DO: Bot worker ──→ DO: Backend API ──→ DO: MongoDB
                         ↑
AWS us-east-1: WSW Portal (1:1)
      ↓
Remote Chrome + Haulbot extension (24/7 session)
      ↓
relay.amazon.com  +  POST/PATCH api.haulbot.online/v1/dispatcher/*
```

**Isolation chain (unchanged):** 1 Driver ↔ 1 Relay Account ↔ 1 Subscription ↔ 1 Dedicated Environment ↔ 1 Telegram link.

---

## Provision state machine

Replace optimistic single-step `ready` on portal create.

| `provisionState` | Meaning | Driver-visible? |
|---|---|---|
| `pending` | Provision job started | “Setting up your account…” |
| `portal_ready` | WSW portal created + settings associated | Still provisioning |
| `bootstrapping` | Session orchestrator signing in / opening browser | Still provisioning |
| `ready` | **First heartbeat received** | Onboarding → environment_ready step |
| `failed` | Timeout or unrecoverable error | Failed + retry action |
| `terminated` | Unsubscribed / deprovisioned | — |

**Timestamps to add on `provisioned_environments`:**

- `portalReadyAt`
- `sessionBootstrapAt`
- `firstHeartbeatAt`
- `lastBootstrapError`

**Remove / defer:** `extensionInstalled: true` until `firstHeartbeatAt` is set.

---

## End-to-end flow

```text
① Stripe checkout.session.completed
② backend: provisionState = pending
③ CreatePortal (us-east-1, standard.regular, maxConcurrentSessions: 1)
④ Associate browser / network / user settings ARNs
⑤ provisionState = portal_ready
⑥ Create or link IdP service user for userId (Cognito or existing SAML)
⑦ Enqueue session-bootstrap job
⑧ Session orchestrator: sign into portal → remote Chrome starts → extension loads
⑨ Extension: PATCH /v1/dispatcher/state/heartbeat (relayWorkState: idle, armed: false)
⑩ backend: provisionState = ready, firstHeartbeatAt = now
⑪ notifyEnvironmentReady (email) — idempotent via environmentReadyEmailSentAt
⑫ Driver continues onboarding: /solo → Telegram → /connect_relay → Relay login
⑬ active onboarding step when heartbeat + relay creds + agent armed
```

**Unsubscribe:** `deprovisionEnvironment` → delete portal → delete IdP user → kill session → `terminated`.

---

## Program phases

### Phase 0 — AWS foundation (one-time, console + IaC)

**0.1 WSW browser settings**

- [ ] Create browser settings with extension policy:
  - `ExtensionInstallBlocklist: *`
  - `ExtensionInstallAllowlist: <haulbot-extension-id>`
  - `ExtensionSettings`: `force_installed` → S3 `updates.xml` URL
- [ ] Record `WSW_BROWSER_SETTINGS_ARN`

**0.2 WSW network settings**

- [ ] Egress allow: `*.relay.amazon.com`, `*.amazon.com`, `signin.aws.amazon.com`, `api.haulbot.online`
- [ ] Record `WSW_NETWORK_SETTINGS_ARN`

**0.3 WSW user settings**

- [ ] Restrict clipboard/download per security preference
- [ ] Record `WSW_USER_SETTINGS_ARN`

**0.4 Extension publish channel (S3)**

- [ ] CRX build pipeline: `haulbot-extension` → S3 `solo` channel
- [ ] `manifests/solo/updates.xml` points at hosted CRX
- [ ] Confirm extension ID matches browser settings allowlist

**0.5 Identity provider**

- [ ] **Audit:** Okta / Azure AD / Google Workspace / IAM Identity Center — any SAML-capable IdP already in use?
- [ ] If yes: configure WSW portal federation; document app + attribute mapping
- [ ] If no: **Cognito user pool** → SAML to WSW; store pool ID + app client in env
- [ ] Define naming: `haulbot-driver-{userId}` (or hash) per synthetic user

**0.6 IAM for backend provisioner**

- [ ] IAM role/user for DO backend: `workspaces-web:CreatePortal`, `DeletePortal`, associate settings commands
- [ ] Optional: Cognito admin APIs for synthetic user CRUD
- [ ] `PROVISIONER=aws`, `AWS_REGION=us-east-1` in production secrets

**0.7 Cost guardrails**

- [ ] Activate WSW free trial (30 MAU × 3 months) for Gate 1–2 testing
- [ ] CloudWatch billing alarm on WSW MAU + streaming overage

**Verify:** Manually create one portal; service user signs in; force-installed extension appears; Relay homepage loads.

---

### Phase 1 — Backend provision state (monorepo)

**1.1 State machine**

- [ ] `apps/backend/src/provisioning/index.ts` — stop setting `ready` on `CreatePortal` alone
- [ ] Add transitions: `pending` → `portal_ready` → `bootstrapping` → `ready` | `failed`
- [ ] `apps/backend/src/provisioning/aws-workspaces-web.ts` — unchanged create/destroy; optional post-create hook for bootstrap enqueue

**1.2 Heartbeat gates ready**

- [ ] `apps/backend/src/routes/dispatcher.ts` — on first `PATCH /state/heartbeat` for user with `provisionState !== ready`:
  - set `provisionState: ready`, `firstHeartbeatAt`
  - call `notifyEnvironmentReady` (existing idempotent guard)
- [ ] Do **not** send environment-ready email from `provisionDedicatedEnvironment` directly

**1.3 Onboarding + portal projection**

- [ ] `apps/backend/src/onboarding.ts` — `environmentReady` remains `provisionState === "ready"` (now heartbeat-backed)
- [ ] `apps/backend/src/portal/agent-status.ts` — distinguish “provisioning” vs “waiting for agent” vs “online”
- [ ] `apps/website` SoloPortalPage — step copy for `portal_ready` / `bootstrapping` (infra-free labels)

**1.4 Admin timeline**

- [ ] `apps/backend/src/routes/admin.ts` — expose `provisionState`, `portalReadyAt`, `firstHeartbeatAt`, `lastBootstrapError`
- [ ] `environment_events` types: `portal_ready`, `bootstrap_started`, `bootstrap_failed`, `first_heartbeat`, `environment_ready`

**1.5 Data model**

- [ ] Update [data-model.md](../data-model.md) `provisioned_environments` fields
- [ ] `apps/backend/scripts/seed-dev-user.ts` — dev stub skips AWS; can set `ready` + fake `firstHeartbeatAt`

**1.6 Retry + recovery**

- [ ] `POST /v1/onboarding/retry-provision` — reset `failed` → `pending` and re-run driver
- [ ] Stripe webhook `ensureProvisionedIfSubscribed` — same state machine

**Verify:** Dev stub still works; with `PROVISIONER=aws` mocked, heartbeat flips `ready` and sends email once.

---

### Phase 2 — Session orchestrator (new AWS component)

**2.1 v1 session keeper (Gate 1)**

- [ ] Small service in AWS (start: single EC2 or ECS task in `us-east-1`)
- [ ] Poll MongoDB or backend internal API for envs in `portal_ready` / `bootstrapping` / `ready`
- [ ] For each portal: sign in service user (IdP creds from Secrets Manager)
- [ ] Keep remote browser session alive **24/7**
- [ ] On watchdog `offline` / missing heartbeat > N minutes: restart session
- [ ] Report bootstrap status back to backend (internal endpoint or direct Mongo patch)

**2.2 Bootstrap handshake**

- [ ] `portal_ready` → orchestrator picks up → `bootstrapping`
- [ ] Success: extension loads (orchestrator does not set `ready` — heartbeat does)
- [ ] Failure after 3 retries → `failed` + `lastBootstrapError`

**2.3 Timeouts**

| Stage | Timeout | Action |
|---|---|---|
| Portal create | 5 min | `failed` |
| Session bootstrap | 15 min | retry ×3, then `failed` |
| First heartbeat after bootstrap | 10 min | `failed` |

**Verify:** One test driver: subscribe → portal → bootstrap → heartbeat → email → `/solo` step advances.

---

### Phase 3 — IdP user lifecycle (backend driver extension)

**2.1 Interface**

- [ ] Extend `EnvironmentDriver` or add `IdentityDriver`:
  - `createServiceUser(userId)` → external id
  - `deleteServiceUser(userId)`
- [ ] Implement Cognito driver (v1) behind `IDP_DRIVER=cognito` env

**3.2 Provision hook**

- [ ] After `portal_ready`: create service user, store `idpUserId` on `provisioned_environments`
- [ ] On deprovision: delete service user before `DeletePortal`

**Verify:** Deprovision removes Cognito user; resubscribe creates fresh user.

---

### Phase 4 — Extension contract (haulbot-extension repo)

**4.1 Boot heartbeat**

- [ ] On extension service worker start: begin poll loop even when `activeLeg` is null
- [ ] `PATCH /state/heartbeat` with `relayWorkState: idle`, `armed: false`
- [ ] Auth: `x-user-id` + `x-service-token` (`EXTENSION_SERVICE_TOKEN`)

**4.2 24/7 loop**

- [ ] Poll `GET /state` every few seconds
- [ ] When `campaignSessionId` set and not paused: apply filters → scan → book per E1–E3
- [ ] When paused or no active leg: stay `idle`, keep heartbeating
- [ ] Respect `refreshPolicy` from state; emit `boardHealth` on 429/503

**4.3 Relay access**

- [ ] `POST /relay-access` on blocking pages; `resolved: true` when cleared

**Verify:** Gate 1 — empty state poll + heartbeat with no campaign armed.

---

### Phase 5 — Production integration

- [ ] `.do/env.production.yaml` — document new env vars (`IDP_*`, orchestrator secrets if any)
- [ ] `PROVISIONER=aws` in production backend only
- [ ] Admin `/admin` shows provision timeline + agent health
- [ ] Runbook: failed provision, retry, manual portal delete
- [ ] Gate 1 sign-off checklist in [build-plan.md](../build-plan.md)

---

## Environment variables (additions)

| Variable | Component | Purpose |
|---|---|---|
| `PROVISIONER` | backend | `aws` in prod; unset = dev stub |
| `AWS_REGION` | backend | `us-east-1` |
| `WSW_BROWSER_SETTINGS_ARN` | backend | Extension force-install policy |
| `WSW_NETWORK_SETTINGS_ARN` | backend | Egress to Relay + API |
| `WSW_USER_SETTINGS_ARN` | backend | Session limits |
| `IDP_DRIVER` | backend | `cognito` \| `saml` \| `none` (dev) |
| `COGNITO_USER_POOL_ID` | backend | Synthetic users (if Cognito) |
| `COGNITO_REGION` | backend | Usually `us-east-1` |
| `EXTENSION_SERVICE_TOKEN` | backend + extension | Dispatcher auth |
| Orchestrator secrets | session keeper | IdP service credentials, Mongo/API access |

---

## Cost model (24/7, us-east-1, standard.regular)

| Item | Estimate |
|---|---|
| WSW MAU | $7/driver/mo |
| Streaming overage (~520h above 200h bundle) | ~$18/driver/mo |
| **Total WSW** | **~$25/driver/mo** |
| Revenue (SOLO) | $199/driver/mo |

Armed-only refresh does not eliminate streaming cost while session stays open — revisit “session scale-down when paused” in v2 if margin tightens.

---

## Explicit non-goals (this program)

- Multi-region WSW portals per driver geography
- Driver-facing Secure Browser URL or login
- Moving Telegram bot to AWS
- Headless Puppeteer / browser pools
- Marking environment ready without extension heartbeat

---

## Gate 1 acceptance criteria

- [ ] Stripe test subscribe creates portal in `us-east-1`
- [ ] Session orchestrator maintains 24/7 remote browser session
- [ ] Extension force-installed via browser policy
- [ ] First heartbeat within 10 min of bootstrap under normal conditions
- [ ] `provisionState` becomes `ready` only on heartbeat
- [ ] Environment-ready email sent once, after heartbeat
- [ ] `/solo` onboarding advances past “environment” step
- [ ] `GET /v1/dispatcher/state` returns empty leg; extension keeps polling
- [ ] Unsubscribe terminates portal + IdP user + session

---

## Task order (suggested sprint sequence)

```text
Week A: Phase 0 (AWS console) + Phase 4.1 (extension boot heartbeat)
Week B: Phase 1 (backend state machine + email gate)
Week C: Phase 2 v1 (session orchestrator) + Phase 3 (Cognito users)
Week D: Phase 5 (prod wiring) + Gate 1 E2E test
```

Adjust sequencing if extension repo is ahead of AWS foundation — **Phase 0.4 + 0.1** (S3 + browser settings) blocks real WSW testing.
