# Sales Funnel Fixes — Session Handoff

A run of fixes to the sales funnel editor + the Stripe wiring. The user has been hitting the same visible issues across the deploy + a dev server + localhost:3001, and the frustration is real. This doc is the full state: what's committed, what each fix does, what's confirmed working, and what's still open.

## The commits on main (the full arc)

| Commit | What it does |
|---|---|
| `0f78ec1` | The Stripe "not configured" fix — the runtime reads the DB-saved keys with no "Enabled" gate. |
| `e9f643a` → `30329b1` | The per-funnel test/live toggle: a Test mode switch on the funnel editor, the dangerous-direction fix (a test-mode funnel never charges the live key), and the switch styling (a label on top, the switch in a bordered box). |
| `1bc5c9d` | The funnel comparison (the Compare panel on the System Map). |
| `ce3f7ee` → `33d06ba` | The outbound webhooks: the migration + the fire helper + all three charge paths + the editor's list UI (a field per webhook, Test, remove, Add). |
| `2495c49` + `31c373a` | The test key read-back + persistence: the Stripe settings page's `maskConfig` list includes `secret_key_test` (the read-back shows "saved"), and the save's `CONFIG_KEYS` list + the `SECRET_KEYS` write-only set include it (the save actually writes it, a blank keeps it). |
| `d06de67` | The Stripe webhook no longer records other apps' charges: `payment_intent.succeeded` + `checkout.session.completed` skip any event with no `product_id`/`page_type` metadata. The phantom $10 was another app's charge hitting the shared webhook. |
| `014a79f` | The per-page webhooks: the checkout + each upsell page carries its own `webhooks` field, a `WebhooksField` on the page tab, and the fire maps the `page_type` to the page's webhooks (fe → checkout, oto1-4 → upsell1-4), fired in addition to the funnel-level ones. |
| `f641c5e` | A visible build marker in the editor's header — "build 014a79f (per-page webhooks)" — a diagnostic to confirm the user is on the latest code. |
| `615de6f` | The "+ New funnel" gives a blank onboarding: the `resetToNew` uses the `blank*` content functions (empty pages), not the MotherMode default copy. The default copy is still behind "Load MotherMode defaults." |

## The issues, one by one

### 1. The switch styling — FIXED, confirmed in the user's screenshot
The Test mode switch was crammed against the label. The fix: a "Test mode" label on top, the switch in a bordered box (`rounded-lg border border-bone/15 bg-ink/40 px-3 py-2`), the "Stripe test keys (4242)" / "Live keys" text next to the switch. The user's latest screenshot shows the fix IS live (the switch is in a bordered box). **Confirmed working.**

### 2. The webhooks per-page — FIXED, on the page tabs
The webhooks were funnel-level only. Now the checkout + each upsell page carries its own webhooks. **The per-page webhooks are on the page tabs: click the Checkout tab (or an Upsell tab) in the Pages group, and the Webhooks section is at the bottom** (a field per webhook, remove, Add). The funnel-level webhooks on the main settings section are the back-compat fallback (they fire on every sale). The page-level ones fire on that page's sale.

### 3. The test charge hitting the live key — the migration + the key
The test key persists now (the save + the read-back + the write-only are all fixed). The remaining: **the `test_mode` migration (`supabase/migrations/20261206000000_funnel_test_mode.sql`) has to run on the deploy's database.** If the column doesn't exist, the funnel's `testMode` reads false and the charge hits the live key. Then: save the test secret key in `/admin/stripe`, flip the funnel's Test mode switch, and the 4242 card works.

### 4. The phantom $10 payment — FIXED
Another app's charge was hitting the shared Stripe webhook. The webhook now skips any event with no `product_id`/`page_type` metadata. **Delete the existing $10 record from `/admin/purchases`.**

### 5. The "+ New funnel" loading the previous data — FIXED
The `resetToNew` was setting the MotherMode default copy (the "Free Starter Kit" text), which looked like the previous funnel's data. Now it uses the blank content functions — a clean slate. The MotherMode copy is still behind "Load MotherMode defaults."

## The "same issue every time" — the diagnostic

The user was seeing the same issues across the deploy + a dev server + localhost:3001. The build marker (`f641c5e`) confirmed the user IS on the latest code — the marker showed in the editor's header. So the fixes ARE live. The remaining confusion was *where* the fixes live: the per-page webhooks are on the page tabs (not the main settings section), and the switch styling fix was already showing in the user's screenshot.

## The deploy checklist

1. **Run the migrations** on the deploy's database: `20261206000000_funnel_test_mode.sql` (the test_mode column) + `20261207000000_funnel_webhooks.sql` (the webhooks column).
2. **Save the test secret key** in `/admin/stripe` (it persists now).
3. **Redeploy** so the latest commits are live.
4. **Delete the phantom $10 record** from `/admin/purchases`.
5. Flip a funnel's Test mode switch, run the 4242 card — it charges the test key.

## Still open (the next batch)

- **The copy steering** — a style picker (Dan Henry, value-forward, etc.) that steers the funnel + email copy. The user wants to steer the copy quality, maybe in the prompt bank or a dedicated place.
- **The email work** — the email preview sheet trigger on the generated card, the send-test (the transactional sender), the markdown stripping (no `*markdown*` bleeding through).
- **The port docs** — the system port docs for the test mode + the webhooks + the comparison.
