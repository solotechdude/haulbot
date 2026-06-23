# Architecture-First Development Protocol (AFDP)

Single protocol for all AI and human development on RelayBooking SOLO.

**Agents are codebase maintainers, not local optimizers.** Analyze before code. Remove obsolete code after. Success is a simpler codebase — not more lines.

Related: [architecture.md](./architecture.md) · [data-model.md](./data-model.md) · [conventions.md](./conventions.md) · [CONTEXT.md](../CONTEXT.md)

---

## Constitution

```text
Priority:  REUSE  >  EXTEND  >  REFACTOR  >  CREATE

Before writing code:
  1. Search the codebase for existing implementations.
  2. Answer the pre-implementation checklist (below).
  3. Produce an implementation plan.

After writing code:
  4. Remove superseded/duplicate/dead code.
  5. Run Fallow and report the change set.

Never introduce duplicate functionality, UI, APIs, models, or sources of truth.
When new replaces old, old must be removed or explicitly marked for removal.
```

**Code is prohibited until the pre-implementation checklist is complete.**

**Exception:** trivial fixes (typos, formatting) with zero architectural touch.

---

## Decision tree

```text
Does something already satisfy this need?
    │
    ├─ YES, as-is ──────────────────────► REUSE (use unchanged)
    │
    └─ NO / partial
           │
           ├─ Can existing code be extended? ──► EXTEND
           │
           ├─ Can existing code be merged/refactored? ──► REFACTOR, then REUSE or EXTEND
           │
           └─ None of the above ──► CREATE
                  (requires written proof in Phase 3)
```

---

## Pre-implementation checklist

Work through **Phases 1–8 in order**. Use the **six layers** in Phase 1 as a discovery lens — not a separate deliverable.

### Phase 1 — Discover (current state + six layers)

Search the codebase. List what already exists for this request.

**Six-layer lens** — answer for each relevant layer:

| Layer | Look for |
|---|---|
| **UI** | Pages, layouts, `components/ui/`, hooks, state |
| **Application** | Services, handlers, workflows (backend orchestration) |
| **API** | Endpoints, DTOs in `packages/shared`, middleware |
| **Data** | Collections in `core/`, `dispatch/`, `telemetry/` |
| **Infrastructure** | Jobs, cache, storage, monitoring (no new queues without architecture approval) |
| **Dependency** | Shared utils in `packages/shared`, internal imports |

**Produce:**

- **Components** — services, handlers, UI pieces, jobs affected
- **APIs** — related endpoints
- **Collections** — related MongoDB collections and indexes

---

### Phase 2 — Fit (reuse, extend, or refactor?)

Default: **existing systems first.** The burden of proof is on creating something new.

| Question | If yes → |
|---|---|
| Can existing code satisfy this **unchanged**? | **REUSE** |
| Can an existing API, collection, service, admin view, or telemetry event be **extended**? | **EXTEND** |
| Can existing code be **merged or refactored** to cover this without a new component? | **REFACTOR** |
| Must bot/extension stay thin — logic belongs in backend? | Enforce orchestration boundary |

---

### Phase 3 — Justify new (CREATE path only)

Skip if Phase 2 ends at REUSE, EXTEND, or REFACTOR.

Before any new API, collection, DTO, event, service, worker, or cron job, document:

1. Why existing systems cannot support the feature  
2. Why extension/refactor is insufficient  
3. Why a new component is required  
4. What future responsibilities it owns  

**No justification → no new component.**

---

### Phase 4 — Upstream impact (who consumes this?)

What existing systems read or depend on this data or behavior?

- Admin Dashboard (`/admin`) · Subscriber Portal (`/solo`) · Telegram bot  
- Extension poll path · Load Analytics Engine · Stripe · Telemetry / onboarding timeline  

**What breaks if this changes? What must be updated?**

---

### Phase 5 — Downstream impact (who will depend on this?)

What future features will rely on this structure?

- Analytics aggregates · Briefings · Admin reporting · Notifications · Automation  

**Will this still work in six months without duplicating data elsewhere?**

---

### Phase 6 — Single source of truth

For **every field or piece of state** introduced, name one owner. Duplicate ownership is prohibited.

| Concern | System of record |
|---|---|
| User identity | `core/users` |
| SOLO entitlement / billing | `core/subscriptions` (Stripe) |
| Telegram binding | `core/telegram_links` |
| Dedicated Environment | `core/provisioned_environments` |
| Relay credential refs | `core/environment_secret_refs` → vault |
| Hot dispatch config (extension poll) | `dispatch/dispatch_states` |
| Handoff, continuity queue, goal context | `dispatch/dispatch_plans` |
| Onboarding step | Backend resolver (not extension/bot-local state) |
| Goal history (NL input log) | `dispatch/goal_history` |
| Agent decision audit | `telemetry/agent_decisions` |
| Relay alerts | `telemetry/relay_alerts` |
| Onboarding timeline | `telemetry/environment_events` |
| Market lane patterns | Load Analytics Engine (not duplicated in MongoDB) |
| Cross-app types and API contracts | `packages/shared` |
| Orchestration / business logic | Backend only |
| Driver dispatch UX | Telegram bot (thin — render + forward) |
| Relay DOM execution | Extension (poll + execute + telemetry emit) |

Full schema: [data-model.md](./data-model.md).

---

### Phase 7 — Telemetry and analytics (if applicable)

Before adding events or metrics:

1. Is this data already collected?  
2. Can an existing event be extended?  
3. Is it actionable — who consumes it?  

**Unused telemetry is prohibited.**

Load Analytics Engine ingest uses the **standard interface** only: loads seen, booked, attempted-and-missed. No parallel ingest shapes.

---

### Phase 8 — Plan and recommend

**Recommended approach:**

| Category | List |
|---|---|
| **Reuse** | Systems used unchanged |
| **Extensions** | Systems modified |
| **New** | Genuinely new components (Phase 3 justification attached) |
| **Remove** | Obsolete/superseded files or code to delete in this task |

**Change set:** files to modify, remove, or deprecate; imports and dependencies affected.

**Implementation plan:** ordered steps to build.

**Why lowest complexity:** plain-language argument for this approach over alternatives.

→ **Then begin coding.**

---

## Post-implementation audit (required)

After coding, report:

| Deliverable | Content |
|---|---|
| **Files modified** | Path + one-line purpose |
| **Files removed** | Obsolete/superseded code deleted |
| **Dead code removed** | Unused exports, orphaned services, duplicate components |
| **Duplication eliminated** | What was consolidated |
| **Architectural outcome** | Complexity reduced, maintained, or justified increase |

**Verify before done:**

```bash
fallow dupes --format json --quiet || true
fallow dead-code --changed-since main --format json --quiet || true
```

Never leave two active implementations of the same behavior.

---

## Prohibited

- Implementing without searching the codebase first  
- Skipping REUSE — modifying code that could be used as-is  
- Parallel APIs for the same concern (e.g. `/v1/solo/*` when `/v1/dispatcher/*` exists)  
- Duplicate collections, services, DTOs, components, hooks, utils, constants, or business rules  
- Same data stored in two places  
- v2 systems without a migration and removal plan  
- Telemetry or analytics with no defined consumer  
- Admin UI with no operational value  
- Business logic in bot or extension (backend orchestrates)  
- Command queues or event stores beyond [architecture.md](./architecture.md)  
- Leaving old implementation active alongside the new one  
- Adding files when merge/delete was possible  

---

## Success criteria

The best implementation:

- Reuses or extends before creating  
- Preserves architecture (backend orchestrates · bot thin UI · extension executor)  
- Maintains single source of truth  
- Removes obsolete code in the same task  
- Introduces the fewest new moving parts  
- Fully solves the feature  

**The best implementation is not the one with the most code.**

---

## Quick reference (agents)

```text
BEFORE CODE                          AFTER CODE
───────────                          ──────────
Phase 1  Discover (+ six layers)     Files modified / removed
Phase 2  Fit (REUSE>EXTEND>REFACTOR) Dead code removed
Phase 3  Justify CREATE (if needed)  Dupes eliminated
Phase 4  Upstream impact             Fallow dupes + dead-code
Phase 5  Downstream impact
Phase 6  SSOT per field
Phase 7  Telemetry (if any)
Phase 8  Plan → code
```
