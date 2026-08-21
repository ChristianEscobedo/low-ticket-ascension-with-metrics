# Funnel Test Mode + Stripe Checkout — System Port

> The per-funnel test/live toggle and the fully-inline checkout ladder. A
> funnel in test mode charges the Stripe TEST keys end-to-end (the 4242 card
> rehearses the whole FE → upsell → subscription ladder); everything else
> charges live. No mode ever silently falls back to the other mode's keys.

## The pieces

| Piece | Where | What |
|---|---|---|
| The flag | migration `20261206000000_funnel_test_mode.sql` | `test_mode` boolean on the sales funnel row. |
| The switch | `SalesFunnelEditor` settings | A bordered "Test mode" box (label on top, switch inside, "Stripe test keys (4242)" / "Live keys" text, a note linking to /admin/stripe with the exact key the charge needs). Takes effect on save. |
| Mode-aware keys | `src/utils/integrations/runtime-config.ts` | `getStripeSecretKeyForMode(mode)` + `getStripePublishableKeyForMode(mode)` — 'test' reads `secret_key_test` / `publishable_key_test` (DB-first, then the `STRIPE_SECRET_KEY_TEST` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` envs). **No live fallback in test mode, on either key** — a missing test key returns empty/null, never the live one. |
| The client | `src/utils/stripe/config.ts` | `getStripeClientForMode(mode)` builds the Stripe SDK client on the mode's secret. |
| The pk endpoint | `/api/stripe/publishable-key?funnel=<slug>` | Resolves the publishable key for the funnel's mode; the response carries `mode` so the client knows. |
| The client hook | `src/hooks/useStripeConfig.ts` | Caches Stripe.js per funnel slug; `stripePromiseForKey(key)` loads an explicit key. **No live env fallback when the endpoint says the funnel is in test mode.** |
| The config check | `/api/stripe/config-check?funnel=<slug>` | Reports the funnel's mode + each key's presence with last4/length (catches a pk_live pasted into the test field). Detects **restricted keys** (`rk_test` / `rk_live`) and attaches an explicit warning — the one-click bump needs the standard Secret key. The modal uses it to seed a test customer on a test-mode funnel with no prior purchase. |
| The setup guide | `docs/STRIPE_SETUP_GUIDE.md` | The client-facing step-by-step (live keys, the webhook, test keys, the 4242 rehearsal, go-live) matched to the /admin/stripe field labels. |

## The charge paths (all three are mode-aware)

1. **`/api/create-payment-intent`** — the FE checkout + every one-time
   one-click upsell. Reads the funnel's mode by `funnel_slug`, builds the
   client on the mode's secret, and hands the mode's publishable key back
   with the client_secret so the browser confirms with the matching key.
   **The gates:** a test-mode funnel with no test secret 503s ("add the test
   secret key in /admin/stripe"); no test publishable key 503s BEFORE the PI
   exists ("add the test publishable key") — a test PI confirmed against the
   live pk is the `elements/sessions` 400, so the route refuses to create it.
2. **The one-click subscription** (same route, `subscription: true`) — the
   subscription upsell charges inline, no hosted-Checkout redirect. The route
   creates a **mode-local Price** (`prices.create` — never the synced live
   price id, which doesn't exist in the test account) and opens the
   subscription on the buyer's saved card (`default_payment_method`); the
   invoice's PaymentIntent gets the funnel metadata stamped so the webhook
   records the first charge (a subscription created this way has no
   checkout.session). **The first period is confirmed SERVER-SIDE:**
   `default_incomplete` leaves the invoice PI at `requires_confirmation`, so
   the route confirms it on the saved card
   (`paymentIntents.confirm(invoicePiId, { payment_method })`) and returns
   `succeeded` — the buyer never sees a form. (Handing that client_secret to
   the browser instead was the Link-OTP bug: subscription invoice PIs default
   to automatic payment methods, so the Payment Element rendered Link's
   wallet. The sub is now created with
   `payment_settings: { payment_method_types: ['card'] }`, and only a card
   demanding 3DS comes back to the browser, inline and card-only.) **No card
   on file:** the first period pays through the proven plain-PI path (the FE
   checkout's own flow — the webhook records it, `setup_future_usage` saves
   the card), and when that confirm succeeds the modal quietly re-calls with
   `first_period_paid: true` — the subscription opens on the just-saved card
   with a **trial carrying it to the next period**, so no double charge.
3. **`/api/stripe/checkout`** — hosted subscription Checkout. Mode-aware
   secret; in test mode the line item builds from the resolved amount
   (`price_data`), never the synced live price id.

## The card handoff (why the upsell is one-click)

The FE checkout's PaymentIntent carries `setup_future_usage: 'off_session'`,
so a successful payment saves the card on the Stripe customer (keyed by
email). Every upsell's one-click confirm looks the customer up by email **in
the same mode's account** and bills the saved card. Cards are per mode — a
test-mode card only exists in the test account, which is exactly the
isolation the toggle promises. The card form in the modal is the
no-card-on-file fallback (a buyer who skipped the FE checkout); it collects
the card inline, no redirect.

**Every PaymentIntent in this flow is card-only**
(`payment_method_types: ['card']` — the one-click charge, the fallback form
PI, and subscription invoice PIs). `automatic_payment_methods` also enables
**Link**, whose wallet rendered above the form and hijacked the confirm with
a text-message OTP; card-only removes it permanently. And a failed test-mode
attach is LOUD now — the route returns the real Stripe error (naming the
restricted-key fix when the saved key is `rk_…`) instead of silently falling
through to the form. Keys resolve through `stripeKeyClean()`, which strips
invisible copy-paste characters (zero-width spaces, line breaks) that made a
valid key read as `unknown-format`. See
`docs/ONE_CLICK_BUMP_SERVER_CHARGE_PORT.md`.

**The test-mode rehearsal convenience:** a test-mode funnel whose customer
has no saved card gets Stripe's test Visa (`pm_card_visa`) attached
automatically and billed — the 4242 rehearsal is check-the-box, click, done
on every upsell, no prior purchase needed. Live mode never auto-attaches.

**The wiring chain (verified end to end):** `MotherModeCheckout` passes
`funnel_slug` + `step: 'checkout'` and writes `customerData` to localStorage
on success → the upsell routes (`/funnel/[slug]/upsell*`) render
`UpsellPage`, which passes `funnelSlug={funnel.slug}` +
`funnelStep={upsellKey}` down to the modal → the modal reads localStorage
and POSTs with the funnel identity → the route resolves the mode, the
customer (by email, in the mode's account), and the saved card.

## The persistence fix (the test publishable key actually saves)

`src/app/admin/integrations/actions.ts`:

- `mergeConfig` only deletes a non-secret key when the field was **submitted
  blank** (`formData.get` returns `''`). A form that doesn't render the field
  at all (`null` — e.g. the /admin/integrations stripe card has no
  `publishable_key_test` input) leaves the stored value alone instead of
  wiping a key another page owns.
- `publishable_key_test` is in `SECRET_KEYS` — a blank field keeps the stored
  value (write-only, matching the page's mask).
- The /admin/stripe field is `type: 'password'` so the saved-last4 hint shows
  instead of a silently empty box.

## The webhook guard (the phantom-charge fix)

`/api/webhooks` skips any `payment_intent.succeeded` /
`checkout.session.completed` event with no `product_id`/`page_type` metadata
— another app's charge hitting the shared endpoint no longer records a
phantom purchase.

## Verify

- `npx tsc --noEmit` — clean.
- The rehearsal: save both test keys in /admin/stripe, flip a funnel's Test
  mode switch, save, run the FE checkout with 4242 4242 4242 4242, then click
  through the upsells — one-time upsells bill the saved card on confirm, the
  subscription upsell opens inline, and /admin/purchases records each step.
  Skip the FE purchase and the upsells still click through — test mode
  attaches the test Visa when no card is on file.
- The restricted-key recipe needs **PaymentIntents, Customers, PaymentMethods,
  AND Prices — all Write** (the one-click subscription creates a mode-local
  Price and attaches the test Visa; an `rk_` key without those 500s with
  "Permission denied"). Prefer the standard Secret key — config-check flags
  `rk_` keys with a warning, the attach failure returns the real Stripe
  error, and the modal surfaces the server's reason, so a permissions
  failure names its fix.

## Port order

1. The migration (`test_mode` column).
2. `runtime-config.ts` mode resolvers + `utils/stripe/config.ts` client.
3. The two charge routes + the pk endpoint + the config-check.
4. `useStripeConfig` + the checkout components (`MotherModeCheckout`,
   `OneClickCheckoutModal`).
5. The editor switch + the /admin/stripe fields + the `actions.ts` merge
   rules.
6. The webhook guard.
