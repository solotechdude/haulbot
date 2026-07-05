# Email templates

Haulbot transactional emails, built with [React Email](https://react.email). Templates render to HTML that the backend sends via Resend.

## Develop

From the monorepo root:

```bash
bun install
bun run dev:email   # live preview at http://localhost:3001
```

Or from this package:

```bash
bun run dev
```

The preview server lists every template in `emails/`. Edit and see changes live.

## Export to HTML

```bash
bun run export   # writes static HTML to ./out
```

## Structure

```text
theme.ts            Brand tokens (mirrors the website design system)
components/          Shared building blocks reused by every email
  EmailLayout.tsx    Document shell: head, body, container, preview text, footer
  EmailHeading.tsx   Standard email headline
  EmailText.tsx      Body paragraph (tone + size variants)
  EmailButton.tsx    Brand CTA button
  EmailFooter.tsx    Signature, support contact, legal line
emails/             One file per template (default export = the email)
src/                Render helpers consumed by the backend
  render-magic-link.ts   HTML + plain text for magic-link sends
  welcome.tsx              Subscription confirmed; environment provisioning
  environment-ready.tsx    Environment ready; sign in to finish setup
  magic-link.tsx           Passwordless sign-in link to /solo
  billing/
    receipt.tsx              Payment received
    payment-failed.tsx       Payment failed; update card
    subscription-canceled.tsx Subscription canceled; resubscribe
```

## Authoring a template

Each file in `emails/` default-exports a React component and (by convention) exports `PreviewProps` so the preview server shows realistic content:

```tsx
import { EmailLayout } from "../components/EmailLayout";

export default function MyEmail({ name }: { name: string }) {
  return <EmailLayout preview="Short inbox preview line">...</EmailLayout>;
}

MyEmail.PreviewProps = { name: "Sam" } satisfies Parameters<typeof MyEmail>[0];
```

Keep every email composing `EmailLayout` so brand, spacing, and footer stay consistent.
