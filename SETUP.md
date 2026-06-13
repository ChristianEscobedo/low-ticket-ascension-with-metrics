# Setup Guide

This is the single source of truth for getting the project running locally and
in production. It covers Supabase, Stripe, Auth (email + OAuth), the admin
dashboard, and adding new funnels.

---

## 1. Quick start (local dev)

Prereqs: **Node 20+**, **pnpm**, **Docker** (for local Supabase), and the
**Stripe CLI** ([install](https://stripe.com/docs/stripe-cli#install)).

```bash
pnpm install
cp .env.local.example .env.local        # then fill in values (see §2 + §3)
pnpm supabase:start                     # starts local Supabase in Docker
pnpm supabase:reset                     # applies all migrations
pnpm stripe:listen                      # in a second terminal — prints whsec_...
pnpm dev                                # in a third terminal
```

Open <http://localhost:3000>.

> Restart `pnpm dev` after editing `.env.local` — Next does not hot-reload env files.

---

## 2. Supabase

### 2a. Local (recommended for dev)

`pnpm supabase:start` boots Postgres + Auth + Storage in Docker. Then:

```bash
pnpm supabase:status   # prints API URL, anon key, service_role key
```

Copy those three values into `.env.local`:

| `.env.local` key                  | from `supabase:status`        |
|----------------------------------|-------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`        | `API URL`                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | `anon key` (a.k.a. publishable) |
| `SUPABASE_SERVICE_ROLE_KEY`       | `service_role key`            |

> Newer Supabase dashboards rename "anon" → "publishable key" — same JWT, same
> value. The code reads `NEXT_PUBLIC_SUPABASE_ANON_KEY` so keep that name.

Apply migrations (creates `customers`, `subscriptions`, `products`, `prices`,
`users`, and `funnel_purchases`):

```bash
pnpm supabase:reset
```

### 2b. Remote (production / shared dev)

1. Create a project at <https://app.supabase.com>.
2. **Settings → API** → copy URL, anon key, and service_role key into
   `.env.local` (or your Vercel env vars).
3. Link and push migrations:
   ```bash
   pnpm supabase:link        # one-time, asks for project ref + db password
   pnpm supabase:push        # uploads supabase/migrations/*.sql
   ```
4. **Authentication → URL Configuration** → set the **Site URL** to your prod
   domain and add `https://your-prod.vercel.app/**` + `http://localhost:3000/**`
   under **Redirect URLs**.

### 2c. Regenerating types

After any schema change:

```bash
pnpm supabase:generate-types   # writes types_db.ts (local schema)
```

For a linked remote project, edit the script in `package.json` to use
`--linked` instead of `--local`.

---

## 3. Stripe

1. Get keys from **Dashboard → Developers → API keys** (use **Test mode** in dev):
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_…)
   - `STRIPE_SECRET_KEY` (sk_test_…)
2. Start the webhook listener — it prints `whsec_…` on first run:
   ```bash
   pnpm stripe:listen
   ```
   Copy that into `STRIPE_WEBHOOK_SECRET`.
3. (Optional) Seed test products & prices:
   ```bash
   pnpm stripe:fixtures
   ```
4. Test cards: `4242 4242 4242 4242` (any future expiry, any CVC, any ZIP).
   Full list: <https://stripe.com/docs/testing>.

### Going to production

- Switch the dashboard to **Live mode**, copy live keys into your hosting env.
- Create a real webhook endpoint in **Developers → Webhooks** pointing at
  `https://yourdomain.com/api/webhooks` and copy its signing secret into
  `STRIPE_WEBHOOK_SECRET`. Subscribe to (at minimum):
  `product.*`, `price.*`, `checkout.session.completed`,
  `customer.subscription.*`, `payment_intent.succeeded`.

---

## 4. Auth

Email + password and magic-link sign-in work out of the box once Supabase is
configured. Toggles live in `src/utils/auth-helpers/settings.ts`
(`allowEmail`, `allowPassword`, `allowOauth`).

### 4a. Google OAuth

1. <https://console.cloud.google.com/apis/credentials> → **Create OAuth client
   ID** → **Web application**.
2. **Authorised redirect URI** =
   `https://<your-supabase-project>.supabase.co/auth/v1/callback`
   (also visible in the Supabase dashboard).
3. Copy **Client ID** + **Client secret** into Supabase Dashboard →
   **Authentication → Providers → Google** → enable.

### 4b. GitHub OAuth

1. <https://github.com/settings/developers> → **New OAuth App**.
2. **Authorization callback URL** =
   `https://<your-supabase-project>.supabase.co/auth/v1/callback`.
3. Copy **Client ID** + a new **Client secret** into Supabase Dashboard →
   **Authentication → Providers → GitHub** → enable.

Provider secrets live in Supabase — there are **no OAuth env vars** in this app.

---

## 5. Admin dashboard

Routes under `/admin/*` are gated by `ADMIN_EMAILS` (comma-separated):

```env
ADMIN_EMAILS=you@example.com,teammate@example.com
```

Leave empty in dev to allow any signed-in user. Pages: Overview,
Funnel Stats, Customers, Subscriptions, Purchases, Products.

---

## 6. Adding a new funnel

See `funnel-transfer.md` for the full pattern. Short version: copy the
`/millionaire-mindshift` directory, add the new route prefix to
`CHROMELESS_PREFIXES` in `src/app/layout.tsx`, and create matching Stripe
products. Webhook + admin dashboard pick them up automatically.
