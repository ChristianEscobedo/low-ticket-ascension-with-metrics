# Stripe Setup — Step-by-Step Guide

The plain-English walkthrough for connecting Stripe to the platform. No code
needed — everything happens in the Stripe dashboard and the admin's
**/admin/stripe** page. Budget 15 minutes.

There are two halves: **Live keys** (real money) and **Test keys** (fake cards,
for trying a funnel before it goes live). You can do Live only and skip Test —
but Test is how you safely rehearse a full purchase.

---

## Part 1 — Get your Live keys into the platform

### Step 1: Open your Stripe API keys

1. Log in at [dashboard.stripe.com](https://dashboard.stripe.com).
2. Make sure the **"Test mode" toggle is OFF** (top-right of the dashboard —
   you want the live keys first).
3. Go to **Developers → API keys**.
4. You'll see two rows:
   - **Publishable key** — starts with `pk_live_...`
   - **Secret key** — starts with `sk_live_...` (click **"Reveal live key"**)

### Step 2: Save them in the admin

1. Open your platform's admin → **/admin/stripe**.
2. Paste:
   - `pk_live_...` into **"Publishable key (live)"**
   - `sk_live_...` into **"Secret key (live)"**
3. Click **Save**. The readiness panel at the top should flip both rows to
   green ("saved in dashboard").

> **Tighter security (optional but recommended):** instead of the full
> `sk_live_...` secret, you can create a **restricted key** (`rk_live_...`) with
> just **PaymentIntents: Write**, **Customers: Write**, and **Prices: Write**
> permissions (Developers → API keys → "Create restricted key"). The platform
> only needs those three (Prices is how the one-click subscription upsell
> creates the mode-local price).

### Step 3: Connect the webhook (so sales get recorded)

The webhook is how Stripe tells the platform "a payment succeeded" — without
it, charges work but nothing shows up in /admin/purchases and no delivery
emails fire.

1. In the Stripe dashboard: **Developers → Webhooks → Add endpoint**.
2. The endpoint URL is shown right on the **/admin/stripe** page (it looks like
   `https://your-domain.com/api/webhooks`). Copy it from there and paste it in.
3. For **events to listen to**, select:
   - `payment_intent.succeeded`
   - `checkout.session.completed`
   - `charge.refunded`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
4. Save the endpoint, then click it and **"Reveal" the Signing secret** — it
   starts with `whsec_...`.
5. Paste that into **"Webhook signing secret"** on /admin/stripe and Save.

**Live mode is done.** Any funnel with Test mode OFF now charges real cards.

---

## Part 2 — Test keys (rehearse a purchase with fake cards)

Do this once, before showing any funnel to a real buyer.

### Step 4: Get the Test keys

1. In the Stripe dashboard, flip the **"Test mode" toggle ON** (top-right).
2. Back to **Developers → API keys** — the keys now start with `pk_test_...`
   and `sk_test_...`.
3. Save them on **/admin/stripe**:
   - `pk_test_...` → **"Test publishable key — for test-mode funnels"**
   - `sk_test_...` → **"Test secret key — for test-mode funnels"**
4. Save. The readiness panel should show all rows green.

> If you used a restricted key for live, make the test one restricted too
> (`rk_test_...`) with the same three permissions: **PaymentIntents: Write**,
> **Customers: Write**, and **Prices: Write**. A restricted key *without* those
> permissions is the #1 cause of the "no TEST key is saved" / "Permission
> denied" errors at checkout — the key saves fine but Stripe refuses to create
> the charge.

### Step 5: Flip a funnel into Test mode

1. Open **/admin/sales-funnels** → pick the funnel.
2. Find the **Test mode** switch (the bordered box in the funnel settings) and
   turn it **ON**.
3. **Save the funnel.** (The switch only takes effect once saved.)

### Step 6: Run a test purchase

1. Open the funnel's checkout page (the live URL, e.g.
   `/funnel/your-funnel/checkout`).
2. Fill in any name + email, continue to payment, and use Stripe's test card:
   - **Card number:** `4242 4242 4242 4242`
   - **Expiry:** any future date · **CVC:** any 3 digits · **ZIP:** any
3. Complete the purchase. You should land on the upsell page — and the
   one-click upsell works in test mode too (it seeds a test customer, so you
   can click straight through the whole ladder).
4. Check **/admin/purchases** — the test sale shows up there.

### Step 7: Go live

When you're happy with the rehearsal:

1. Back in the funnel editor, turn **Test mode OFF** and **Save**.
2. That funnel now charges the live keys — real money, real cards.
3. Test mode is **per funnel**: you can keep a draft funnel in test while
   others run live.

---

## If something's wrong

| Symptom | The cause | The fix |
|---|---|---|
| "No TEST key is saved" at checkout, but you saved it | The test key is a restricted key missing **PaymentIntents: Write** or **Customers: Write** | Edit the restricted key's permissions in Stripe, or use the full `sk_test_...` |
| "Permission denied… does not have the required permissions… Prices Write" on an upsell | The restricted key is missing **Prices: Write** (the one-click subscription creates a mode-local price) | Add Prices: Write to the key at the link in the error, or use the full `sk_test_...` / `sk_live_...` |
| The card form never appears (a spinner or blank box) | The browser loaded the wrong publishable key (live pk against a test charge) | Make sure the **Test publishable key** field is filled in on /admin/stripe — the checkout reads it automatically once saved |
| "Stripe not configured" even though keys are saved | The page cached the old state | Hard-refresh /admin/stripe; the readiness panel re-reads the database on load |
| A weird charge you never made shows in /admin/purchases | An old bug let other apps' charges leak in through the shared webhook — **fixed** | Just delete the record in /admin/purchases; new foreign charges are ignored automatically |
| Sales complete but nothing records / no emails | The webhook (Step 3) isn't connected or the signing secret is wrong | Re-check the endpoint URL + events list, and re-paste the `whsec_...` secret |

## The one-minute version (for the meeting)

1. Stripe dashboard → Developers → API keys → copy `pk_live` + `sk_live`.
2. Paste both into **/admin/stripe** → Save.
3. Developers → Webhooks → add `https://your-domain.com/api/webhooks` with the
   5 events → paste the `whsec_...` signing secret → Save.
4. (Optional rehearsal) flip Stripe's Test mode ON, save the `pk_test` +
   `sk_test` pair, flip the funnel's **Test mode** switch, buy with card
   `4242 4242 4242 4242`.
5. Flip Test mode OFF → the funnel is live.
