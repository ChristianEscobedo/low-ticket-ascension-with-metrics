# Millionaire Mindshift - Portable Funnel (Move To A New Next.js Project)

Everything you need to lift the whole funnel (sales page, VSL pages, checkout,
4 upsells, success, and the delivery/members + onboarding page) into a fresh
Next.js App Router project. Copy the files in section 2, satisfy the shared deps
in section 3, wire the env in section 5, and fill the placeholders in section 7.

---

## 1. Routes this funnel produces

```
/millionaire-mindshift                 -> sales page
/millionaire-mindshift/vsl             -> styled VSL page (sticky player + timed CTA)
/millionaire-mindshift/vsl-script      -> VSL script + Seedance prompts (sophisticated)
/millionaire-mindshift/vsl-script-starter
/millionaire-mindshift/vsl-slides-starter  -> cinematic storyboard deck
/millionaire-mindshift/checkout        -> $27 front end (Stripe)
/millionaire-mindshift/upsell          -> OTO1 Clearing Room ($97/mo)
/millionaire-mindshift/upsell-2        -> OTO2 annual upgrade ($597/yr)
/millionaire-mindshift/upsell-3        -> OTO3 Quantum Library ($297)
/millionaire-mindshift/upsell-4        -> OTO4 Done-For-You Build ($500 deposit)
/millionaire-mindshift/success         -> order receipt + delivery cards
/millionaire-mindshift/access          -> members delivery + onboarding checklist
```

Flow: `checkout -> upsell -> upsell-2 -> upsell-3 -> upsell-4 -> success -> access`

---

## 2. Files to copy (the funnel itself)

Copy these paths verbatim into the new project (keep the same paths).

### Pages (`src/app/millionaire-mindshift/`)
```
page.tsx
checkout/page.tsx
success/page.tsx
access/page.tsx
upsell/page.tsx
upsell-2/page.tsx
upsell-3/page.tsx
upsell-4/page.tsx
vsl/page.tsx
vsl-script/page.tsx
vsl-script-starter/page.tsx
vsl-slides-starter/page.tsx
```

### Sales-page components (`src/components/sales-page/`)
```
MillionaireMindshiftSalesPage.tsx
MillionaireMindshiftVSLPage.tsx
VSLScriptViewer.tsx
VSLSlideshow.tsx
mindshift-sections/            (copy the WHOLE folder - 26 files incl.
                                constants.ts, index.ts, useCheckout.ts)
```

### Upsell components (`src/components/upsell/`)
```
MillionaireMindshiftUpsellPage.tsx     (OTO1)
MillionaireMindshiftUpsell2Page.tsx    (OTO2)
MillionaireMindshiftUpsell3Page.tsx    (OTO3)
MillionaireMindshiftUpsell4Page.tsx    (OTO4)
```

### Lib (`src/lib/mindshift/`)
```
purchases.ts          (localStorage purchase tracker - powers success + access)
vslStarterSlides.ts   (storyboard deck data)
```

### Docs read at runtime (repo ROOT - the vsl-script pages read these from disk)
```
MILLIONAIRE_MINDSHIFT_VSL.md
MILLIONAIRE_MINDSHIFT_VSL_STARTER.md
```
> The two `vsl-script*` pages do `fs.readFileSync(path.join(process.cwd(), ...))`.
> Keep these at the project root. On Vercel, if the disk read fails, switch those
> pages to a build-time `import` of the markdown instead.

---

## 3. Shared dependencies to copy (or stub)

These are not Mindshift-specific but the funnel imports them.

### Required (checkout + product data)
```
src/components/checkout/OneClickCheckoutModal.tsx   (OTOs use this)
src/components/checkout/StripeCheckoutForm.tsx      (front-end checkout)
src/hooks/useStripeConfig.ts                        (Stripe publishable key)
src/contexts/ProductContext.tsx                     (GET /api/products)
```

### Optional (safe to stub on day one)
```
src/components/reseller/ResellerTracking.tsx   (affiliate pixel - can be a no-op)
src/components/shared/CourseAccessLinks.tsx    (GET /api/product-courses - the
                                                success + access pages already
                                                render fine without it)
```
> If you skip these, delete their imports/usages in `MillionaireMindshiftSalesPage.tsx`,
> `MillionaireMindshiftVSLPage.tsx`, `success/page.tsx`, and `access/page.tsx`.

---

## 4. Backend API routes the funnel calls

Bring these (or provide equivalents) under `src/app/api/`:
```
create-payment-intent/route.ts   REQUIRED - one-time charges ($27 FE, OTO3, OTO4 deposit)
stripe/checkout/route.ts         REQUIRED - subscription charges (OTO1 monthly, OTO2 annual)
products/route.ts                REQUIRED - ProductContext (can return a static FALLBACK_PRODUCT)
product-courses/[productId]/route.ts   OPTIONAL - only if you keep CourseAccessLinks
<your stripe webhook>            OPTIONAL for UI, REQUIRED for real fulfillment/entitlements
```
> Fastest path: stub `GET /api/products` to return the `FALLBACK_PRODUCT` from
> `mindshift-sections/constants.ts`. The delivery pages read purchases from
> localStorage, so they work without a backend - only real money + real
> entitlement granting needs Stripe + the webhook.

---

## 5. Environment variables (`.env.local`)

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...        # only if you wire the webhook
# Stripe Price IDs used by the subscription OTOs (set in the OTO components):
#   OTO1 Clearing Room monthly, OTO2 annual upgrade
```
> `useStripeConfig` / `products` may also expect Supabase env in the original app.
> If you stub those two routes (section 4) you can drop the Supabase requirement.

---

## 6. npm dependencies

```
npm install next react react-dom lucide-react \
  @stripe/react-stripe-js @stripe/stripe-js stripe \
  react-markdown remark-gfm
```
Plus Tailwind CSS (the whole funnel is Tailwind-only, Luxury Gold theme: black +
amber/gold). Ensure `tailwind.config` content globs include `src/**/*.{ts,tsx}`.

---

## 7. Placeholders to fill before launch

| Where | Constant | What |
|---|---|---|
| `access/page.tsx` | `LINKS` object | All real delivery URLs (welcome video, members area, audios, workbook PDF, community, clearing-room call, vault, 1:1 booking, quantum library, **build onboarding calendar**, support email) |
| `MillionaireMindshiftVSLPage.tsx` | `VSL_VIDEO_SRC` | Finished VSL render (MP4/HLS) |
| `MillionaireMindshiftUpsell4Page.tsx` | (video box) | "What we build" VOD + the build onboarding calendar link |
| `checkout/page.tsx` + OTO components | Stripe IDs / amounts | Confirm live price IDs and amounts |
| `mindshift-sections/constants.ts` | `FALLBACK_PRODUCT` | Name, price, copy |

---

## 8. localStorage keys this funnel owns

```
millionaire_mindshift_ref      affiliate ref captured from ?ref=
mindshift_purchases            what they bought (drives success + access delivery)
millionaire-mindshift-timer    scarcity countdown
mindshift_onboarding_done      access-page onboarding checklist progress
```

---

## 9. Move checklist

- [ ] Copy section 2 files (same paths)
- [ ] Copy section 3 shared deps (or stub the optional ones + remove imports)
- [ ] Add section 4 API routes (or stub `products` + skip webhook for now)
- [ ] Put the two `.md` scripts at project root
- [ ] Set section 5 env + install section 6 deps
- [ ] Fill section 7 placeholders
- [ ] Run `npm run dev`, walk `checkout -> upsell-4 -> success -> access`

---

## 10. Exact version lock (match this repo)

Pin these in the new project's `package.json` so behavior matches 1:1.

```jsonc
{
  "dependencies": {
    "next": "^16.1.4",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "lucide-react": "^0.563.0",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "@stripe/react-stripe-js": "^5.5.0",
    "@stripe/stripe-js": "^8.6.4",
    "stripe": "^20.2.0",
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.91.0",
    "tailwindcss": "^4.1.17",
    "@tailwindcss/postcss": "^4.1.17",
    "postcss": "^8.5.6",
    "autoprefixer": "^10.4.22"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3"
  }
}
```
> Optional (only if you keep emails / validation): `resend ^6.9.2`, `zod ^4.4.3`.
> Tailwind here is v4 (PostCSS plugin), not v3. If you scaffold a v3 project the
> classes still work, but match v4 to avoid config drift.

---

## 11. Copy-paste setup prompts

Three prompts to paste into an AI agent inside the FRESH project, in order.

### Prompt A - Scaffold with matching versions
```
Create a new Next.js 16 App Router project with TypeScript and Tailwind CSS v4.
Pin these exact versions in package.json and install them:
next ^16.1.4, react ^19.2.0, react-dom ^19.2.0, typescript ^5.9.3,
@types/react ^19.2.7, @types/react-dom ^19.2.3, @types/node ^24.10.1,
tailwindcss ^4.1.17, @tailwindcss/postcss ^4.1.17, postcss ^8.5.6, autoprefixer ^10.4.22,
lucide-react ^0.563.0, react-markdown ^10.1.0, remark-gfm ^4.0.1,
@stripe/react-stripe-js ^5.5.0, @stripe/stripe-js ^8.6.4, stripe ^20.2.0,
@supabase/ssr ^0.8.0, @supabase/supabase-js ^2.91.0.
Set up the "@/*" path alias to ./src/* in tsconfig.json. Configure Tailwind v4
via @tailwindcss/postcss and make the content globs cover src/**/*.{ts,tsx}.
Use the standard "next dev" / "next build" / "next start" scripts (no custom server).
```

### Prompt B - Auth (Supabase SSR)
```
Add Supabase auth using @supabase/ssr exactly like this:
1. src/lib/supabase/client.ts -> export createBrowserClient(NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY).
2. src/lib/supabase/server.ts -> export an async createServerClient() that reads/writes
   cookies via next/headers (App Router server components + route handlers).
3. src/lib/supabase/service.ts -> a service-role client using SUPABASE_SERVICE_ROLE_KEY
   for privileged reads (bypasses RLS). Only import this in server code.
4. src/middleware.ts -> refresh the Supabase session on every request and gate
   protected routes. IMPORTANT: leave the whole /millionaire-mindshift/** funnel PUBLIC
   (sales, vsl, checkout, upsells, success, access) so buyers are not forced to log in.
5. src/app/auth/page.tsx -> a simple email magic-link / password sign-in page using the
   browser client, only needed if you later gate the members area behind login.
Env required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY. If these are unset, the app must still run and the funnel
must still work (treat Supabase as optional/guarded with isSupabaseConfigured()).
```

### Prompt C - Stripe connection
```
Wire Stripe to match this funnel's checkout + upsells:
1. src/lib/stripe.ts -> export getStripeAsync() returning a configured Stripe instance
   from STRIPE_SECRET_KEY (return null if unset so routes can 503 gracefully).
2. src/hooks/useStripeConfig.ts -> client hook that loadStripe()s with
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY for <Elements>.
3. POST /api/create-payment-intent -> creates a one-time PaymentIntent from { amount,
   currency, metadata }. Used by the $27 front end, OTO3 ($297), and OTO4 ($500 deposit).
   Stamp metadata.product_id, product_name, customer_email, customer_name, type so the
   webhook can grant access.
4. POST /api/stripe/checkout -> creates a subscription Checkout Session for { type:
   'generic_subscription', priceId, successUrl, cancelUrl, metadata }. Used by OTO1
   (Clearing Room monthly) and OTO2 (annual upgrade).
5. POST /api/stripe/webhook -> verify with STRIPE_WEBHOOK_SECRET; on
   payment_intent.succeeded and checkout.session.completed, read metadata.product_id and
   grant entitlements (look up a product_entitlements table, or no-op if Supabase unset).
   Must be idempotent on event.id.
6. GET /api/products?product_id=... -> return the product for ProductContext. Simplest
   version: return a static FALLBACK_PRODUCT (id, name, price_cents, features). Upgrade to
   a DB lookup later.
Env required: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
plus the Price IDs for the OTO1 monthly and OTO2 annual subscriptions.
Test the chain: $27 PaymentIntent succeeds -> webhook fires -> success page reads the
mindshift_purchases localStorage record -> access page renders the right delivery cards.
```

---

## 12. Merge guide - drop this funnel onto `vercel/nextjs-subscription-payments`

The closest open-source match (Supabase SSR auth + Stripe + a webhook that syncs
products/subscriptions). This section maps every part of the funnel onto that repo.

> Heads up: the repo is officially **sunset** and points to its successor
> `nextjs/saas-starter`. Both share the same shape (App Router + Supabase + Stripe),
> so this mapping holds for either. Pick `nextjs-subscription-payments` if you want
> the Stripe-webhook-syncs-to-Supabase behavior out of the box.

### 12.1 The one big difference: folder layout + alias

The boilerplate has **no `src/` dir**. It uses root `app/`, `components/`, `utils/`,
and `tsconfig` maps `"@/*": ["./*"]`. Your funnel is written for `@/* -> ./src/*`.

**Do this once, first**, so every file in section 2 copies verbatim:
```
1. mkdir src
2. move app/ components/ utils/ middleware.ts  ->  src/
   (Next 16 supports src/app; middleware also moves to src/middleware.ts)
3. tsconfig.json: change   "@/*": ["./*"]   to   "@/*": ["./src/*"]
4. tailwind content glob: add  ./src/**/*.{ts,tsx}
```
After this, the boilerplate's own helpers live at `src/utils/...` and your funnel
files drop into `src/app/millionaire-mindshift/...` exactly as section 2 lists.

### 12.2 Where each shared dep maps

| Your doc (section 3 / prompts) | Boilerplate already has it at | Action |
|---|---|---|
| `src/lib/supabase/client.ts` | `src/utils/supabase/client.ts` | reuse - update your imports, or re-export from `src/lib/supabase` |
| `src/lib/supabase/server.ts` | `src/utils/supabase/server.ts` | reuse |
| `src/lib/supabase/service.ts` (service role) | `src/utils/supabase/admin.ts` | reuse (this is the service-role client) |
| `src/middleware.ts` | `src/middleware.ts` | keep it - it only **refreshes** the session, it does not gate `/millionaire-mindshift/**`, so the funnel stays public. Just confirm the `matcher` doesn't exclude your routes. |
| `src/lib/stripe.ts` `getStripeAsync()` | `src/utils/stripe/server.ts` (exports a ready `stripe`) | use that `stripe` instance instead of `getStripeAsync()` |
| `src/hooks/useStripeConfig.ts` | `src/utils/stripe/client.ts` (`getStripe()`) | the boilerplate uses **hosted** Checkout, so it has no `<Elements>` hook - you must ADD `useStripeConfig` (see 12.4) |
| `ProductContext` -> `GET /api/products` | `src/utils/supabase/queries.ts` `getProducts()` | stub `app/api/products/route.ts` to return `FALLBACK_PRODUCT`, OR rewire ProductContext to `getProducts()` |

### 12.3 The Stripe model gap (read this)

The boilerplate only does **hosted Checkout for subscriptions** and syncs them to
Supabase via `app/api/webhooks/route.ts`. Your funnel needs **inline one-time
payments** too. So:

- **OTO1 ($97/mo) + OTO2 ($597/yr)** - subscriptions. These fit the boilerplate.
  Add a thin `src/app/api/stripe/checkout/route.ts` that calls the existing
  `stripe` helper to create a subscription Checkout Session (your OTO components
  already POST here). Or refactor the OTOs to call the boilerplate's
  `checkoutWithStripe()` server action.
- **FE $27, OTO3 $297, OTO4 $500 deposit** - one-time, inline (Stripe Elements).
  The boilerplate does NOT ship this. Add `src/app/api/create-payment-intent/route.ts`
  (Prompt C #3) using the same `stripe` instance from `src/utils/stripe/server.ts`.

### 12.4 Inline-payments deps to add (boilerplate ships hosted only)

```
pnpm add @stripe/react-stripe-js lucide-react react-markdown remark-gfm
```
(`@stripe/stripe-js` and `stripe` are already in the boilerplate.) Then create the
`useStripeConfig` hook that `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)` for the
`<Elements>` wrapper used by `StripeCheckoutForm` + the OTOs.

### 12.5 Webhook: extend, don't replace

The boilerplate's webhook is at **`src/app/api/webhooks/route.ts`** (note plural,
not `stripe/webhook`). It already handles `product.*`, `price.*`,
`customer.subscription.*`. ADD two cases to it:
```
payment_intent.succeeded        -> grant FE / OTO3 / OTO4 entitlements
checkout.session.completed      -> (already partly there for subs) confirm + grant
```
Keep it idempotent on `event.id`. Point your Stripe Dashboard endpoint (and
`stripe:listen`) at `/api/webhooks`, and set the same `STRIPE_WEBHOOK_SECRET`.

### 12.6 Tailwind version note

This boilerplate is **Tailwind v3** (`tailwind.config.js` + `postcss.config.js`),
not v4. Your funnel is plain utility classes, so it renders fine on v3 - you can
**ignore the "v4" instruction in Prompt A** when using this repo. Just make sure
the `content` globs include your funnel dirs (12.1 step 4).

### 12.7 Runtime markdown + tooling

- Put `MILLIONAIRE_MINDSHIFT_VSL.md` and `MILLIONAIRE_MINDSHIFT_VSL_STARTER.md` at the
  **repo root** (same `fs.readFileSync(process.cwd(), ...)` caveat from section 2).
- The boilerplate uses **pnpm** and a local Supabase (Docker) + Stripe CLI dev loop.
  Run `pnpm dev` and `pnpm stripe:listen` in two terminals (see its README).

### 12.8 Boilerplate-specific move checklist

- [ ] 12.1 - add `src/`, move `app/components/utils/middleware`, fix `@/*` alias + Tailwind glob
- [ ] Copy section 2 funnel files into `src/app/...`, `src/components/...`, `src/lib/mindshift/...`
- [ ] Reuse boilerplate Supabase + `stripe` helpers (12.2) - update imports
- [ ] Add `useStripeConfig` + `pnpm add` the inline-payment deps (12.4)
- [ ] Add `create-payment-intent` route + the `stripe/checkout` route wrapper (12.3)
- [ ] Extend `app/api/webhooks/route.ts` with the two one-time cases (12.5)
- [ ] Stub or rewire `GET /api/products` (12.2)
- [ ] Put the two `.md` scripts at root (12.7)
- [ ] `pnpm dev` + `pnpm stripe:listen`, walk `checkout -> upsell-4 -> success -> access`
