# One-Click Bump: Server-Side Charge, No Form, No Link — System Port

> The one-click upsell is a button click and a confirmation checkbox, nothing
> else. The server charges the buyer's saved card directly — the same pattern
> as the proven masterclass app's `create-one-click-payment` (PI with
> `customer` + `payment_method` + `confirm: true`, no Elements, no browser
> round-trip). This port fixes the three ways the flow leaked into a card
> form with Stripe Link's OTP on top.

## The bug (what the buyer saw)

Click "Complete Purchase" on a bump → instead of an instant charge, the
Payment Element mounted with a **Link** panel on top ("link — tes•••@gmail.com,
Visa •••• 4242, Use this card"), a "Select a payment method to pay with"
error, and a text-message OTP. Three separate leaks produced it:

1. **The silent attach.** Test-mode rehearsal attaches `pm_card_visa` when
   the customer has no card. The attach was `.catch(() => undefined)` — a
   restricted key (`rk_test_…` without `paymentMethods: write`) or a key with
   an invisible copy-paste character failed SILENTLY, and the route fell
   through to the fallback PaymentIntent.
2. **Link on the fallback PI.** The fallback PI used
   `automatic_payment_methods: { enabled: true }`, which enables Link. The
   Payment Element rendered Link's wallet above the card form; Link
   recognized the email and demanded its OTP.
3. **The subscription path never charged server-side.** The one-click
   subscription created the sub with `payment_behavior: 'default_incomplete'`
   — which does NOT charge the card — and handed the invoice PI's
   client_secret to the browser. Subscription invoice PIs use automatic
   payment methods, so Link rode that form too. This was the leak in the
   reported screenshot (the $29/mo membership bump).

## The fixes

All in `src/app/api/create-payment-intent/route.ts` unless noted.

| Fix | What |
|---|---|
| **Server-side invoice confirm** | After the subscription create, the route confirms the invoice's PI itself: `paymentIntents.confirm(invoicePiId, { payment_method: savedCard.id })`. `succeeded`/`processing` → `{ status: 'succeeded' }` and the modal advances. Only a card demanding 3DS comes back to the browser (inline, card-only). A card that can't pay → the sub is cancelled (never bills) and the flow falls to the plain card-only PI, which saves the new card; the modal's `first_period_paid` follow-up opens the sub with the trial carry, no double charge. |
| **Card-only everywhere** | Every PI this flow creates is `payment_method_types: ['card']`: the one-click charge, the fallback form PI, and the subscription's invoice PIs (`payment_settings: { payment_method_types: ['card'] }` on `subscriptions.create`). Link can never render, so no OTP, ever. |
| **Loud attach failure** | The test-mode attach captures its error. In test mode a failed attach STOPS the flow with the real Stripe message — and when the resolved key starts with `rk_`, the error names the exact fix (save the standard "Secret key" `sk_test_…`, not a "Restricted key"). No more silent fall-through to a form. |
| **Key sanitizer** | `stripeKeyClean()` in `src/utils/integrations/runtime-config.ts` strips everything that isn't `[A-Za-z0-9_]` from every Stripe key as it resolves (secret, test secret, both publishables, webhook secret). A zero-width space / BOM / line break from a dashboard copy no longer makes a valid key read as `unknown-format` and 401 every call. |
| **Restricted-key detection in config-check** | `/api/stripe/config-check` reports `rk_test` / `rk_live` prefixes with an explicit warning ("the one-click bump charge needs the standard Secret key"), and `chargeWouldUse` returns an ERROR naming the fix when a test-mode funnel's secret is restricted. |
| **Error body surfacing** | `OneClickCheckoutModal`'s one-time path parsed the response only after an ok check, discarding the server's reason on a 500. It parses first now — the modal's error box shows the real message. |

## Every upsell surface rides this path (the future-funnels guarantee)

There is no per-funnel checkout code. Every surface converges on the same
modal + route, so a funnel built tomorrow inherits all of it:

- Builder funnels: `/funnel/[slug]/upsell` … `upsell-4` → `UpsellPage`
  (passes `funnelSlug={funnel.slug}` + `funnelStep={upsellKey}`) →
  `MotherModeUpsellPage` → `OneClickCheckoutModal` → `/api/create-payment-intent`.
- Catalog pages `/mothermode/upsell*` → `MotherModeUpsellPage` → same.
- Millionaire Mindshift `/millionaire-mindshift/upsell*` → the modal directly.
- The FE checkout (`MotherModeCheckout`) writes `customerData` to
  localStorage and its PI carries `setup_future_usage: 'off_session'` — the
  first purchase saves the card; every bump after is checkbox → one click.
- Hosted subscription checkout (`/api/stripe/checkout`) was already
  card-only.

The only per-funnel setup that exists: standard (not restricted) Stripe keys
in /admin/stripe, and the funnel's test/live toggle.

## Verify

- `npx tsc --noEmit` — clean. `npx vitest run tests/lib/funnel-commerce.test.ts` — 15/15.
- The rehearsal: test-mode funnel, no prior purchase → open a bump, check the
  box, click. Spinner → success → advance. No form, no Link panel, no OTP.
  Repeat on a subscription bump (the invoice-PI path) and a one-time bump.
- The negative paths: save an `rk_test_` key → config-check shows `rk_test`
  with the warning, and the bump's error box names the fix. Save a key with a
  trailing line break → the sanitizer strips it, prefix reads `sk_test`.

## Related

- `docs/FUNNEL_TEST_MODE_AND_STRIPE_CHECKOUT_PORT.md` — the mode toggle, the
  key resolution, the card handoff (updated for this port).
- `docs/STRIPE_SETUP_GUIDE.md` — the client-facing key setup.
