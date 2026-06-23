# Website Design

Visual and UX principles for the single website app. Three route groups share one design system:

| Route | Surface | Design weight |
|---|---|---|
| `/` | Marketing | Content-first, storytelling |
| `/solo/*` | Subscriber Portal | Minimal, task-focused |
| `/admin/*` | Admin Dashboard | Functional, information-dense |

Inspired by OpenCompany — premium modern SaaS with founder-led authenticity.

## Core principles

- Content-first design
- Typography-driven hierarchy
- Startup-in-public authenticity
- Apple-level simplicity
- Linear-level spacing discipline
- Vercel-level minimalism
- Documentary storytelling

## Visual characteristics

- Large bold headlines
- High contrast typography
- Massive whitespace
- Minimal color palette
- Real product screenshots
- Real metrics
- Real roadmap and changelog content
- Subtle borders instead of heavy shadows
- Rounded corners (12–20px)
- Clean grid system
- Minimal navigation

## Avoid

- Marketing fluff
- Excessive gradients
- Glassmorphism
- AI robot illustrations
- Corporate stock photos
- Feature-card overload
- Busy dashboards (marketing pages — admin may be denser)
- Decorative animations

## Tone

The site should feel: confident, technical, sophisticated, transparent, founder-led, premium, focused.

The visitor should feel: *"They are building something real."*

## Route-specific guidance

### Marketing (`/`)

- Landing, pricing, changelog, roadmap
- Real screenshots of Telegram flow and admin (when available)
- CTA → Stripe checkout
- No dispatch controls — drive to Telegram after onboarding

### Subscriber Portal (`/solo/*`)

- Minimal at launch: billing, subscription status, Connect Telegram (QR + deep link)
- Onboarding wizard when incomplete — poll backend onboarding step
- No Relay credentials on web — Telegram only
- No dispatch UI — no campaign editor, no load board
- Post-launch: load booking stats, weekly revenue (read-only)

Visual tone: even more minimal than marketing. One task per screen. Large tap targets if viewed on phone during onboarding at a truck stop.

### Admin Dashboard (`/admin/*`)

- Product Admin only — allowlisted identity
- Customer list: email, subscription status, onboard step, agent state
- Environment detail drawer: onboarding timeline, agent health, support actions, decision tail
- Functional over beautiful — clarity beats whitespace here
- Same typography and border system as marketing; denser information layout permitted

## Shared components

- Auth: magic link for drivers; admin allowlist
- Stripe customer portal link for billing management
- Telegram connect widget (QR + `t.me/bot?start=token`)
- Status badges: onboarding step, agent searching / paused / booked / error
