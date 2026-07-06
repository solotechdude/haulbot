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
bun run export              # all templates → ./out (preview / reference)
bun run export:magic-link   # magic-link.html + .txt with send placeholders (used by backend)
```

The backend loads `out/magic-link.{html,txt}` at runtime and substitutes portal URL + recipient email — no React SSR in production. Re-run `export:magic-link` after editing `emails/magic-link.tsx`.

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
out/                Build-time exports (magic-link.{html,txt} for Resend sends)
scripts/
  export-magic-link.ts   Renders magic-link with placeholders for production
src/
  render-magic-link.ts   Dev / export-time React Email render
  fill-magic-link.ts     Runtime placeholder fill (import @haulbot/email-templates/send)
  placeholders.ts      Shared placeholder tokens
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
