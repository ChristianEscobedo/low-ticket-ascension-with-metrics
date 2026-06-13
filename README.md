# SaaS + Funnel Boilerplate

A production-ready Next.js boilerplate that combines **recurring subscriptions**
(Stripe Billing) with **one-time funnel payments** (front-end offer + OTO
upsells) behind a single **admin dashboard** — built on Supabase and Stripe.

Originally forked from
[`vercel/nextjs-subscription-payments`](https://github.com/vercel/nextjs-subscription-payments),
extended with a full sales-funnel runtime and admin tooling.

---

## What's included

### Payments
- 🔁 **Subscriptions** — Stripe Billing + customer portal, plan/price syncing
  via webhooks.
- 💳 **One-time payments** — embedded Payment Element checkout
  (`/api/create-payment-intent`) for front-end offers and one-click upsells.
- 🪜 **Funnels** — example `/millionaire-mindshift` flow with VSL, sales page,
  4-step OTO upsell chain, and saved-card one-click upsells.
- 📬 **Webhook ingestion** — `payment_intent.succeeded`,
  `checkout.session.completed`, `customer.subscription.*`, `product.*`,
  `price.*`. Idempotent on `event.id`; one-time conversions are persisted to
  `funnel_purchases` for analytics.

### Auth
- ✉️ Email + password and magic-link sign-in (Supabase Auth).
- 🔐 **Google** and **GitHub** OAuth (configure in Supabase Dashboard).
- 🔑 SSR-safe session handling via `@supabase/ssr` and a shared middleware.

### Admin dashboard (`/admin`)
Gated by `ADMIN_EMAILS`. Pages:
| Route | What it shows |
|---|---|
| `/admin` | Revenue (30d/all-time), active subs, recent activity |
| `/admin/funnel-stats` | Funnel visualization (FE → OTO1–4), revenue per stage |
| `/admin/customers` | List + per-customer detail (LTV, subs, purchases) |
| `/admin/subscriptions` | Active/canceled subs with plan + MRR |
| `/admin/purchases` | Filterable one-time purchases + CSV export |
| `/admin/products` | Products & prices + **Sync from Stripe** button |

### Funnel chrome control
Funnel routes (anything under a prefix listed in `CHROMELESS_PREFIXES` in
`src/app/layout.tsx`) render without the default site `<Navbar>`/`<Footer>` so
the funnel's own header/CTA bar/footer is the only chrome.

---

## Tech stack

- **Next.js 14** (App Router, Turbopack dev) · React 18 · TypeScript
- **Tailwind CSS 3** + tailwind-merge + class-variance-authority
- **Supabase** (Postgres + Auth + SSR cookies)
- **Stripe** Billing + Payment Intents + Webhooks
- **Vitest** for unit tests
- **lucide-react** for icons

---

## Quick start

```bash
pnpm install
cp .env.local.example .env.local        # fill in Supabase + Stripe values
pnpm supabase:start                     # local Postgres in Docker
pnpm supabase:reset                     # apply migrations
pnpm stripe:listen                      # second terminal — prints whsec_...
pnpm dev                                # third terminal
```

See **[`SETUP.md`](./SETUP.md)** for the full guided setup
(Supabase local + remote, Stripe keys, Google/GitHub OAuth, admin access,
adding a new funnel).

---

## Project structure

```
src/
├── app/
│   ├── (default routes)            # marketing + auth + account
│   ├── admin/                      # admin dashboard (layout-gated)
│   ├── api/
│   │   ├── create-payment-intent/  # one-time payments
│   │   ├── stripe/checkout/        # subscription Checkout Sessions
│   │   └── webhooks/               # Stripe webhook handler
│   ├── millionaire-mindshift/      # example funnel (VSL → FE → OTO1–4)
│   └── layout.tsx                  # injects/skips Navbar/Footer per route
├── components/
│   ├── checkout/                   # Payment Element + one-click modal
│   ├── mindshift-sections/         # funnel page sections
│   └── ui/                         # shared design-system primitives
├── contexts/ProductContext.tsx     # current funnel offer
├── hooks/useStripeConfig.ts        # publishable-key fetch
├── lib/mindshift/                  # funnel utilities (slides, purchases)
├── utils/
│   ├── auth-helpers/               # Supabase auth wrappers
│   ├── stripe/                     # Stripe SDK + helpers
│   └── supabase/
│       ├── client.ts               # browser client
│       ├── server.ts               # SSR client
│       ├── middleware.ts           # session refresh + x-pathname header
│       ├── admin.ts                # service-role admin queries + sync
│       └── queries.ts              # per-request user queries
└── middleware.ts
supabase/migrations/                # includes 2025_*_funnel_purchases.sql
```

---

## Tests

```bash
pnpm test            # vitest run
pnpm test:watch
```

Covers the webhook branches (subscription + one-time + dedupe), the
`create-payment-intent` route (validation, missing env, one-click path), and
funnel utilities.

---

## Going to production

Recap (full steps in `SETUP.md` §3):

1. Switch Stripe to **Live mode**, swap keys in your hosting env.
2. Create a real webhook at `https://yourdomain.com/api/webhooks`; copy its
   signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Push migrations to the remote Supabase project: `pnpm supabase:push`.
4. Set `NEXT_PUBLIC_SITE_URL` to your production domain.
5. Add production callback URLs in Supabase **Auth → URL Configuration**.

---

## License

MIT (inherits from the upstream Vercel template).
