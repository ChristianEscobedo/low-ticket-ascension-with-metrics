# Funnel Commerce + Main App Delivery — System Port

Status: **complete** (Stripe-wired checkouts/upsells, product assignments,
refund/comp/cancel management, email-keyed customers, signed main-app delivery
webhook, builder previews + one-click publish).

Companion receiver spec (build the mothermode side from this):
`docs/MAIN_APP_WEBHOOK_INTEGRATION.md`
Base funnel system: `docs/SALES_FUNNEL_SYSTEM_PORT.md`

Tests: `npx vitest run tests/lib/funnel-commerce.test.ts` (15 passing).

---

## What it is

The money layer for the sales funnel system. One Stripe key in Admin →
Integrations (or `/admin/stripe`) makes every funnel checkout and upsell
chargeable, and every purchase fans out to delivery — links/courses hosted
here, or the main app (mothermode) over a signed webhook that carries the
product keys + license requests its product builder and licensing feature
consume.

Three ideas hold it together:

1. **Assignments are data.** A row in `product_funnel_assignments` wires one
   Stripe product into one funnel step (checkout, upsell1-4) with a role
   (main | bump | bonus) and a delivery declaration (url | course |
   deliverable | main_app + license/seats). Checkout pricing, thank-you-page
   delivery cards, and the main-app webhook all resolve from these rows —
   "what the buyer gets" is never hand-copied into page copy.
2. **The server prices, the browser points.** Requests carry `price_id` or
   `funnel_slug` + `step`; `/api/create-payment-intent` and
   `/api/stripe/checkout` resolve the amount from the synced `prices` table
   (assignment → explicit price id → product's first active price → posted
   fallback). A tampered client cannot reprice a checkout.
3. **Lifecycle events keep delivery in sync.** Purchases, refunds, comp
   grants/revokes, and subscription cancels all dispatch to the main app, so
   mothermode can provision AND deprovision without polling.

---

## Files

```
supabase/migrations/20260809000000_product_funnel_assignments.sql
supabase/migrations/20260809000001_comped_entitlements.sql
supabase/migrations/20260809000002_funnel_purchases_refunds.sql

src/lib/mothermode/sales/
  productAssignments.ts  # assignment types, mappers, store, delivery-card flattener
  pricing.ts             # resolveStepCharge (server-authoritative amounts), pageTypeForStep

src/utils/integrations/
  dispatch.ts            # dispatchPurchase + dispatchLifecycleEvent; MainAppEnvelope builder
  types.ts               # 'main_app' provider + MainAppConfig

src/utils/supabase/
  commerce.ts            # refunds (markFunnelPurchaseRefunded), comps CRUD,
                         # email-keyed customer list/detail

src/app/api/
  admin/funnel-products/route.ts   # assignment CRUD + catalog read (admin)
  create-payment-intent/route.ts   # resolveStepCharge + funnel_slug/step metadata
  stripe/checkout/route.ts         # same for hosted subscription Checkout
  webhooks/route.ts                # + charge.refunded; sub created/deleted dispatch;
                                   #   subscription_id stamped on purchase metadata

src/components/
  checkout/OneClickCheckoutModal.tsx        # funnelSlug/funnelStep/stripePriceId props
  mothermode/upsell/MotherModeUpsellPage.tsx
  mothermode/sales/UpsellPage.tsx           # passes slug + step into the modal
  mothermode/checkout/MotherModeCheckout.tsx
  mothermode/sales/CheckoutPage.tsx

src/app/admin/
  products/ProductAssignmentEditor.tsx      # assign-to-funnel-page editor per product
  products/page.tsx
  subscriptions/actions.ts                  # comp / cancel / refund-latest / revoke-comp
  subscriptions/SubscriptionActions.tsx
  subscriptions/page.tsx                    # comp form + comps list + row actions
  purchases/actions.ts                      # refundPurchaseAction (full/partial)
  purchases/RefundButton.tsx
  purchases/page.tsx
  customers/page.tsx                        # email-keyed union (guests + accounts)
  customers/email/[email]/page.tsx          # one buyer: purchases + comps
  stripe/page.tsx                           # + "Funnel checkout readiness" panel
  integrations/page.tsx                     # + Main app (mothermode) delivery card
  integrations/actions.ts                   # main_app registered (url/secret/app_name)
  sales-funnels/parts/ProductPicker.tsx     # catalog picker used by money tabs
  sales-funnels/parts/ui.tsx                # + PagePreviewBar
  sales-funnels/parts/PageTabs.tsx          # preview bar on Optin/VSL/Checkout/Success/Access
  sales-funnels/parts/UpsellTab.tsx         # preview bar + picker per upsell
  sales-funnels/SalesFunnelEditor.tsx       # preview props, Publish now / Move to draft

src/app/funnel/[slug]/success/page.tsx      # merges assignment delivery cards

tests/lib/funnel-commerce.test.ts           # 15 tests: envelope, assignments, cards
docs/MAIN_APP_WEBHOOK_INTEGRATION.md        # mothermode receiver + licensing spec
```

---

## How the pieces move

**Charging.** Funnel page components stamp `funnel_slug` + `step` +
`price_id` (when assigned) onto every charge. `resolveStepCharge` picks the
authoritative amount; the posted amount is only the legacy fallback. Purchases
record into `funnel_purchases` (idempotent on `stripe_event_id`) and land in
/admin/purchases, funnel stats, and the customer record.

**Delivery, here.** The success page merges `assignmentsToDeliveryCards` over
the authored cards (manual cards win on duplicate href). `url` deliveries
render their links; `course` deliveries also grant via
`grantCoursesForPurchase` at webhook time; `deliverable` links point at
`/deliverables/[slug]`. `main_app` items render an "on its way to your inbox"
card — keys never appear on the page.

**Delivery, mothermode.** `dispatchPurchase` / `dispatchLifecycleEvent` POST a
signed envelope (`x-mothermode-signature`, HMAC-SHA256 of the raw body) to the
URL on the Main app integration card. The envelope carries customer, funnel
attribution, order refs, the full `items` array (with per-item delivery
instructions), and a convenience `license_request` for the first licensed
item. Refund/cancel/comp events share the envelope with `refund` / `comp`
blocks. Event table, verifier snippet, entitlements SQL, and test plan live in
`docs/MAIN_APP_WEBHOOK_INTEGRATION.md`.

**Refunds.** Admin → Purchases → Refund (full or partial) or Subscriptions →
Refund latest both call Stripe, mark the row `refunded` (refund id + amount +
timestamp from migration `...02_funnel_purchases_refunds`), and dispatch the
`refund` event. Refunds issued inside the Stripe dashboard arrive as
`charge.refunded` and take the same path.

**Comps.** Subscriptions → Comp access inserts into `comped_entitlements`
(email + optional product + note, no charge), shows in the comps list and on
the customer page, and fires `comp.granted`. Revoke marks it and fires
`comp.revoked`.

**Builder.** Every Pages tab shows a `PagePreviewBar` (status chip, URL,
copy link, open-in-new-tab — drafts render for admins). The header gains
**Publish now / Move to draft** which saves the current content with the
flipped status in one click. Checkout and each Upsell tab embed
`ProductPicker`: pick a catalog product to autofill productId, name, price
cents, Stripe price id, payment type, and interval; the picker also reports
the step's current assignment and any bonuses.

**Readiness.** /admin/stripe lists every published funnel with each enabled
money step marked chargeable (assignment | price id | amount) or "nothing
set", so a funnel can never silently go live without a price.

---

## Notes for the next session

- **Bonus stacking is intentional.** A purchase at `upsellN` delivers that
  step's main/bump items plus EVERY bonus assigned in the funnel (bonuses
  accumulate down the ladder). `loadDeliveryItems` in dispatch.ts implements
  this; keep it if you touch the filter.
- **Partial refunds still revoke** on the main-app side by design; the
  `refund.amount_cents` is in the payload if mothermode wants partial-credit
  handling later.
- **Subscription-mode refunds** (hosted Checkout) don't carry a
  payment_intent on the purchase row; the Purchases page points the admin to
  Subscriptions → Refund latest, which resolves the PI from the latest
  invoice.
- **`manageSubscriptionStatusChange` is user-keyed.** Anonymous funnel
  subscribers have no `customers` row, so that path can miss; the local
  `subscriptions` table is a mirror, and the main-app webhook is the
  entitlement of record. Don't treat the local table as authoritative.
- **Pre-existing suite failures.** `tests/api/create-payment-intent.test.ts`,
  `tests/api/webhooks.test.ts`, `tests/utils/receipt*.test.ts`, and a handful
  of research/reel suites fail at HEAD in this environment (module-scope
  Supabase clients need env the tests never set). Verified identical with my
  changes stashed — not regressions. `tests/lib/funnel-commerce.test.ts`
  hoists dummy env for exactly this reason.
