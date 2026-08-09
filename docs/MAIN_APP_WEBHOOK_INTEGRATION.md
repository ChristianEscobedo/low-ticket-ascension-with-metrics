# Main App (mothermode) Webhook Integration

The funnel app POSTs signed lifecycle events to the main app so purchases made
in funnels are provisioned — and revoked — inside mothermode, using its product
builder and licensing feature. This document is the build spec for the
mothermode side. Everything the funnel app sends is already implemented on the
funnel side (`src/utils/integrations/dispatch.ts`); you only need to build the
receiver described below.

## TL;DR for the mothermode build

1. Add a `POST /api/webhooks/funnel` route that verifies the
   `x-mothermode-signature` HMAC header, then applies the event.
2. Give every sellable thing in the mothermode product builder a stable
   **product key** (slug). The funnel references it as
   `delivery.product_key`.
3. On `purchase` → upsert the customer, create/extend an **entitlement** for
   each item, and if `license_request` is present, issue a license key through
   the licensing feature.
4. On `refund` / `subscription.canceled` / `comp.revoked` → mark the matching
   entitlements revoked and deactivate the license.
5. On `comp.granted` → create the entitlement (and license) without a payment.

## Configuration (funnel side)

Admin → Integrations → **Main app (mothermode) delivery**:

- `url` — your receiver, e.g. `https://app.mothermode.com/api/webhooks/funnel`
- `secret` — shared signing secret. Store the same value in mothermode env as
  `FUNNEL_WEBHOOK_SECRET`.
- `enabled` + optional page-type filter (`fe`, `oto1`…) to scope which funnel
  stages fire.

Use the card's **Send test event** button after saving — it POSTs a `purchase`
envelope with `metadata.test: true`.

## Signature verification (build this first)

Every request:

- header `x-mothermode-signature: sha256=<hex>`
- signature = HMAC-SHA256 of the **raw request body** with the shared secret.

Reference verifier (Next.js route handler):

```ts
import crypto from 'node:crypto';

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.FUNNEL_WEBHOOK_SECRET!;
  const header = req.headers.get('x-mothermode-signature') ?? '';
  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const ok =
    header.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!ok) return new Response('bad signature', { status: 401 });

  const event = JSON.parse(raw) as FunnelEnvelope;
  // …handle below
  return Response.json({ received: true });
}
```

Return `200` quickly. If you throw or return non-2xx the funnel app logs the
failure but does NOT retry (delivery is best-effort; the customer still gets
their Stripe receipt, and you can replay from the funnel's Purchases page).

## Envelope shape

```jsonc
{
  "id": "evt_1ABC…",              // unique event id — dedupe on this
  "event": "purchase",            // see event types below
  "created_at": "2026-08-09T19:00:00.000Z",
  "data": {
    "customer": { "email": "buyer@x.com", "name": "Buyer Name" },
    "funnel": { "slug": "brain-dump-sales", "step": "upsell1", "page_type": "oto1" },
    "order": {
      "product_id": "prod_XXX",            // Stripe product id (or null)
      "price_id": "price_XXX",             // Stripe price id (or null)
      "amount_cents": 9700,
      "currency": "usd",
      "payment_intent_id": "pi_XXX",       // null for hosted-checkout subs
      "checkout_session_id": "cs_XXX",     // null for inline charges
      "subscription_id": "sub_XXX"         // set on subscription events/orders
    },
    "items": [
      {
        "product_id": "prod_XXX",
        "price_id": "price_XXX",
        "role": "main",                    // main | bump | bonus
        "step": "checkout",                // checkout | upsell1..4
        "delivery": {
          "type": "main_app",              // main_app | url | course | deliverable
          "product_key": "mothermode-os",  // YOUR product-builder key
          "license": true,                 // issue a license key
          "seats": 2,                      // only present when > 1
          // url deliveries carry links instead:
          "links": [{ "label": "", "href": "", "description": "" }],
          // course / deliverable deliveries carry:
          "course_ids": ["…"],
          "deliverable_slug": "…",
          "deliverable_key": "…"
        }
      }
    ],
    // Convenience — first item with delivery.license === true. Use it to mint
    // one license without scanning items:
    "license_request": { "product_key": "mothermode-os", "seats": 1 },
    "refund": {                            // present on event=refund
      "refund_id": "re_XXX",
      "amount_cents": 9700,
      "refunded_at": "2026-08-09T19:05:00.000Z"
    },
    "comp": {                              // present on comp.granted/comp.revoked
      "product_id": "prod_XXX",
      "price_id": null,
      "product_name": "MotherMode OS Monthly",
      "note": "Beta tester"
    },
    "metadata": { "funnel_slug": "…", "step": "…", "test": false }
  }
}
```

Notes on `items`:

- `items` comes from the funnel's **product assignments** (Products tab →
  Assign to funnel page). A purchase at step `upsell2` includes that step's
  main/bump items **plus every bonus** assigned anywhere in the funnel
  (bonuses stack down the ladder by design).
- `delivery.type: 'main_app'` means "this product is provisioned in
  mothermode". Other types are fulfilled by the funnel itself and are included
  only so your reporting sees the full order — you can skip provisioning them.
- If the funnel has no assignments, `items` is `[]` — fall back to
  `order.product_id`/`price_id` as the thing bought.

## Event types and what to do

| `event`                 | When it fires                                        | Action in mothermode                                                        |
| ----------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `purchase`              | Any checkout/upsell charge succeeds (incl. sub start) | Upsert customer by email; grant entitlement per `main_app` item; if `license_request`, issue license (idempotent on `id`). |
| `subscription.created`  | Stripe sub created (may precede/duplicate purchase)   | Ensure entitlement is marked **subscription-backed** with `subscription_id`. Safe to treat as a no-op if purchase already granted. |
| `subscription.canceled` | Admin cancels in funnel admin or Stripe               | Revoke entitlements tied to `subscription_id`; deactivate its license.       |
| `refund`                | Admin refund (funnel UI or Stripe dashboard)          | Revoke entitlements for the order's `payment_intent_id`/`checkout_session_id`; deactivate license. Partial refunds still revoke (flag in your UI if you want partial-credit handling). |
| `comp.granted`          | Admin comps someone in Subscriptions → Comp access    | Grant entitlement + license with no payment. `comp.product_id` may be null → grant your default/all-access per your rules. |
| `comp.revoked`          | Admin revokes a comp                                  | Revoke the comp entitlement for that email + product.                        |
| `test`                  | Integrations → Send test event                        | Verify + log only; do not provision.                                         |

## Data model you'll want in mothermode

If the product builder already has products, add/confirm these:

1. **Product key on products** — a unique slug (`product_key`) per product in
   the builder. The funnel's `delivery.product_key` references it. Expose it
   in the product builder UI as "Integration key" so the admin can copy it
   into the funnel's Products tab assignment form.

2. **Entitlements table** (if not already present):

   ```sql
   create table funnel_entitlements (
     id uuid primary key default gen_random_uuid(),
     customer_email text not null,
     product_key text not null,
     source text not null default 'funnel',     -- 'funnel' | 'comp'
     order_ref jsonb,        -- { payment_intent_id, checkout_session_id, subscription_id }
     event_id text unique,   -- envelope id for idempotency
     status text not null default 'active',     -- 'active' | 'revoked'
     created_at timestamptz default now(),
     revoked_at timestamptz
   );
   create index on funnel_entitlements (customer_email) where status = 'active';
   ```

3. **Licensing hook** — when `license_request` (or any item with
   `delivery.license: true`) arrives, call your existing license-issue function
   with `{ productKey, seats, customerEmail }` and store the issued key on the
   entitlement so `refund`/`subscription.canceled` can deactivate it. Key
   format, activation limits, and seat counting stay entirely inside your
   licensing feature — the funnel never needs to know the key value (if you
   want the key shown on the funnel's success page later, add a `GET
   /api/entitlements/lookup?email=…` endpoint and we'll render it).

## Idempotency + ordering

- Dedupe on `id` (unique per event). Stripe events can arrive twice.
- `subscription.created` can arrive after the matching `purchase` — treat
  grants as upserts keyed by `(customer_email, product_key, order_ref)`.
- `refund` for an order you never saw (e.g. refunded before webhooks were
  enabled): store it and no-op the revoke.

## End-to-end test plan

1. Point the integration at a request bin (or your staging receiver) and hit
   **Send test event** on the card.
2. Run a Stripe test-mode purchase through any funnel checkout
   (`4242 4242 4242 4242`) → expect `purchase` with the checkout-step items.
3. Accept an upsell → expect a second `purchase` with that step's items.
4. Refund it from Admin → Purchases → Refund → expect `refund` and see the
   entitlement revoked.
5. Comp someone from Admin → Subscriptions → Comp access → expect
   `comp.granted`, then revoke → `comp.revoked`.
6. Cancel a test subscription from Admin → Subscriptions → expect
   `subscription.canceled`.
