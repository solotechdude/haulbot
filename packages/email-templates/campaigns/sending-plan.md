# Safe email sending plan — Haulbot launch

Operational plan for getting the launch emails out **without torching your
domain reputation**. Read alongside [`README.md`](./README.md) (lane rules) and
the templates in [`../emails/marketing/`](../emails/marketing/) and
[`cold-launch.md`](./cold-launch.md).

## Your situation

| Input | Value | Implication |
|---|---|---|
| Warm leads (opted-in) | < 100 | Safe to send this week |
| Cold leads (compiled) | 2,000–10,000 | Needs warmup + separate infra; weeks, not days |
| Timeline | ASAP | Warm now; cold ramps over ~3 weeks |
| Budget | Minimal | There's a real floor cost for cold (~$60–120/mo) |
| Domain | Own `haulbot.online` + DNS | Good — enables proper auth for the warm lane |

## The core rule that protects everything

**Your primary domain `haulbot.online` sends ONLY warm/transactional mail
through Resend. Cold outreach goes through a SEPARATE domain and a cold tool —
never Resend, never your primary domain.** Breaking this burns the reputation
that delivers your customers' receipts and magic-link logins.

---

## Lane A — Warm (<100 opted-in): send this week

Low volume + real consent = low risk. Steps:

1. **Authenticate `haulbot.online` in Resend.** Add the domain in Resend; it
   generates DKIM + return-path records. Add to DNS:
   - **SPF** (TXT): include Resend's send host.
   - **DKIM** (CNAME/TXT records Resend gives you).
   - **DMARC** (TXT at `_dmarc.haulbot.online`): start with
     `v=DMARC1; p=none; rua=mailto:dmarc@haulbot.online` to monitor, tighten to
     `p=quarantine` later.
2. **Send from a real person:** `aj@haulbot.online` (not `no-reply@`). Set a
   real reply-to so responses reach you.
3. **Use Resend Broadcasts.** Import the <100 as an audience. Confirm every one
   truly opted in — if any are shaky, move them to the cold lane instead.
4. **Send in 1–2 small batches**, mid-week, business hours. Watch opens and
   bounces in the Resend dashboard.
5. **Template:** `launch-announcement.tsx` with `{{{FIRST_NAME|there}}}` and
   `{{{RESEND_UNSUBSCRIBE_URL}}}`. Fill the mailing address first.
6. **Hygiene:** remove hard bounces immediately; never resend to them.

Risk at <100 opted-in: minimal. This is your quick win — do it first.

---

## Lane B — Cold (2k–10k): set up now, send in ~2–3 weeks

### Phase 1 — Infrastructure (Day 0–2)

- **Buy 1–2 separate domains** (e.g. `try-haulbot.online`, `gethaulbot.online`).
  Cheap (~$12/yr each). **Never** send cold from `haulbot.online`.
- **Redirect** those domains to your main site so they look legit.
- **Create 2–3 mailboxes per domain** (e.g. `aj@try-haulbot.online`). Google
  Workspace ($6/mo each) or mailboxes bundled with your cold tool.
- **Authenticate each cold domain**: SPF, DKIM, DMARC (`p=none` to start).

### Phase 2 — Warmup (Day 0–14, runs automatically)

- Turn on your cold tool's **built-in warmup** on every mailbox. It auto-sends/
  replies to a warmup network to build reputation.
- **Do not send real cold email during warmup.** ~2 weeks minimum.

### Phase 3 — List verification (Day 0–1, one-time)

- Run the full list through a verifier (MillionVerifier / ZeroBounce /
  NeverBounce). ~$0.004/email → 10k ≈ $40 one-time.
- **Delete** invalid, risky, role (`info@`, `dispatch@`), and catch-all
  addresses. High bounce rate is the #1 reputation killer — this single step
  matters more than anything else.

### Phase 4 — Sending ramp (Day ~14 onward)

- Start **20 emails/day/mailbox**, increase ~10/week, cap ~40–50/day/mailbox.
- Spread across mailboxes; randomize send times; business hours in the
  recipient's timezone.
- Use the plain-text script in `cold-launch.md` — no images, no links except the
  one, no spam words.

### Volume math (why cold can't be rushed)

Safe throughput ≈ `mailboxes × ~35/day`.

| Setup | Daily safe volume | 2,000 leads | 5,000 leads | 10,000 leads |
|---|---|---|---|---|
| 1 domain, 3 mailboxes | ~105/day | ~19 days | ~48 days | ~95 days |
| 2 domains, 6 mailboxes | ~210/day | ~10 days | ~24 days | ~48 days |

To clear the list faster you add mailboxes/domains (more cost) — you never raise
per-mailbox volume. Plan the list size you actually send accordingly; consider
starting with your best 2,000 leads.

### Monitoring (every day you send)

- **Bounce rate < 3%** — if it climbs, stop and re-verify the list.
- **Spam complaints < 0.1%.**
- Watch reply sentiment; honor every `STOP`/opt-out within 10 business days.
- If deliverability drops, pause and re-warm — don't push through it.

---

## Minimal-budget cold stack (realistic floor)

"Minimal" for 2k–10k cold isn't $0 — here's the cheapest safe setup:

| Item | Cost |
|---|---|
| 1–2 sending domains | ~$12/yr each |
| 3–6 mailboxes | ~$6/mo each (or bundled with tool) |
| Cold tool w/ built-in warmup (Instantly or Smartlead) | ~$37–39/mo |
| List verification (one-time) | ~$40 for 10k |
| **First-month total** | **~$60–120** |

If that's still too much right now: **do the warm lane only**, and hold the cold
campaign until you can fund the stack. Sending cold without it will cost you far
more than $100 in lost domain reputation.

---

## Compliance (both lanes, non-negotiable)

- Real **physical postal address** in every email.
- Working **opt-out**, honored within **10 business days**.
- **Accurate** From/subject lines (no deception).
- **CASL (Canada):** cold email to Canadian addresses generally requires prior
  consent and carries steep penalties — if your list has Canadian operators,
  either get consent or exclude them from the cold lane.

---

## Recommended timeline

| When | Warm lane | Cold lane |
|---|---|---|
| **Week 0** | Authenticate domain, send to <100 | Buy domains, create + auth mailboxes, start warmup, verify list |
| **Weeks 1–2** | Handle replies | Warmup continues (no real sends) |
| **Week 3+** | — | Begin ramped cold sends, monitor daily |

## Immediate next actions

1. Fill the `[ADD MAILING ADDRESS]` placeholder in the templates.
2. Authenticate `haulbot.online` in Resend (SPF/DKIM/DMARC) — can be done today.
3. Confirm your <100 warm list is genuinely opted-in, then send Lane A.
4. Register a cold sending domain and pick a cold tool; kick off warmup.
5. Verify the cold list before a single real send.
