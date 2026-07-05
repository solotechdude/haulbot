# Cold launch outreach — Haulbot

Plain-text cold outreach for the **cold lane** (scraped/compiled leads, no prior
relationship). This is a **script for a cold-email tool** (Instantly, Smartlead,
Lemlist) sent from a **separate warmed domain** — NOT Resend, NOT
`haulbot.online`. See `README.md` in this folder for the guardrails.

- **Angle:** you can't watch the load board while you drive → you miss the good loads
- **CTA:** one click to the demo/landing page
- **Personalization available:** first name only
- **Link:** `https://haulbot.online?utm_source=email&utm_medium=cold&utm_campaign=launch`

---

## Subject lines (pick/test — casual, lowercase, 1:1 feel)

1. `quick question about your load board`
2. `{{firstName}}, booking loads while you drive`
3. `your truck can book its own loads`
4. `still refreshing relay yourself?`
5. `dispatch help for {{firstName}}`

Keep subjects lowercase and short. Avoid "free", "offer", "$", "guarantee", ALL
CAPS, and emojis — they trip spam filters and break the 1:1 illusion.

---

## Email body (~90 words, plain text)

```
Hi {{firstName | there}},

Quick one — you can't really watch the Amazon Relay board while you're
driving, so the good loads get gone and you end up taking what's left.

I built a tool that fixes that. You send one message on Telegram — your
origin, your minimum rate, your minimum payout — and a dedicated agent
watches Relay around the clock and books loads that hit your rules. Hands
stay on the wheel.

It's live now. Worth a 15-second look?

https://haulbot.online?utm_source=email&utm_medium=cold&utm_campaign=launch

— Aj Karim
Founder, Haulbot

Reply STOP and I won't email again.
[ADD MAILING ADDRESS]
```

---

## Optional follow-up (bump, +3 business days, only if no reply)

Reply in the same thread — short is better.

```
Hi {{firstName | there}}, just floating this back up. Even if you're not
looking to hand off dispatch, happy to send the 15-second demo so you can
see how it books to your rules. Want me to send it?

— Aj
```

---

## Before you send (checklist)

- [ ] Replace `[ADD MAILING ADDRESS]` with a real physical postal address (legally required).
- [ ] Confirm the opt-out works — honor every `STOP`/reply within 10 business days.
- [ ] Sending from a **separate domain** (e.g. `try-haulbot.online`), not `haulbot.online`.
- [ ] Mailboxes warmed; keep volume low per inbox (~20–50/day) and ramp slowly.
- [ ] `{{firstName}}` has a fallback ("there") for rows missing a name.
- [ ] Suppress anyone already on the warm/opted-in list to avoid double-sending.
