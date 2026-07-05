# Campaigns

Marketing / outreach copy for Haulbot — distinct from the
transactional templates in `../emails/`. Read this before sending anything.

## Two lanes, kept strictly separate

| Lane | Who | How it's sent | Format |
|---|---|---|---|
| **Warm** | Opted-in leads, prior contacts | Resend from `haulbot.online` | Branded HTML: [`../emails/marketing/launch-announcement.tsx`](../emails/marketing/launch-announcement.tsx) |
| **Cold** | Scraped/compiled leads, no relationship | Cold-email tool (Instantly/Smartlead) from a **separate** domain | Plain text: [`cold-launch.md`](./cold-launch.md) |

## Hard rules (protect your deliverability)

1. **Never send the cold list through Resend or `haulbot.online`.** Cold
   outreach violates Resend's acceptable-use policy and will get the account
   suspended. Worse, it burns your primary domain's reputation, so
   paying-customer transactional emails (welcome, magic-link, receipts) start
   landing in spam.
2. **Cold uses a separate, warmed lookalike domain** (e.g. `try-haulbot.online`),
   with SPF/DKIM/DMARC set up and mailboxes warmed before any volume.
3. **Every commercial email needs a real physical postal address and a working
   opt-out** (CAN-SPAM / CASL). The `[ADD MAILING ADDRESS]` placeholders must be
   filled before sending.
4. **Suppress overlap** — anyone on the warm list should not also get the cold
   sequence.
5. **Keep the transactional footer out of marketing** — marketing emails use
   `MarketingFooter` (unsubscribe + address); transactional emails use
   `EmailFooter`.

## Warm lane usage

Preview and export like any other template:

```bash
bun run dev --port 4321    # preview launch-announcement
bun run export             # render to HTML
```

Sending options:
- **Resend Broadcasts** (recommended for a launch blast): paste the exported
  HTML, and swap the props for Resend merge tags — `firstName` → `{{{FIRST_NAME|there}}}`
  and `unsubscribeUrl` → `{{{RESEND_UNSUBSCRIBE_URL}}}`.
- **Resend API** (per-recipient): render the component with real `firstName`,
  `landingUrl`, `unsubscribeUrl`, and `mailingAddress`.
