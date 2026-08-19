# Funnel Outbound Webhooks — System Port

> Every sale a funnel makes can fan out to the owner's own endpoints — a CRM,
> a community platform, a Zapier catch hook. Funnel-level webhooks fire on
> every sale; each checkout/upsell page can also carry its own list that
> fires only on that page's sale.

## The pieces

| Piece | Where | What |
|---|---|---|
| The column | migration `20261207000000_funnel_webhooks.sql` | `webhooks` jsonb on the funnel row — the funnel-level list. Per-page lists ride the page's content JSONB (`webhooks` field on the checkout + each upsell page), no extra columns. |
| The fire helper | `src/lib/mothermode/sales/webhooks.ts` | POSTs the sale payload (product, amount, customer, page_type, funnel slug) to each URL, fire-and-forget with a timeout; a failing endpoint never blocks the buyer. |
| The charge paths | `/api/create-payment-intent`, `/api/stripe/checkout`, `/api/webhooks` | All three fire the webhooks on a completed sale. |
| The page mapping | the fire helper | `page_type` → the page's list: `fe` → the checkout page's webhooks, `oto1`-`oto4` → upsell1-4's. The page-level list fires **in addition to** the funnel-level one. |
| The editor UI | `WebhooksField` on the page tabs | Click the Checkout tab (or an Upsell tab) in the Pages group — the Webhooks section sits at the bottom: a field per webhook URL, a Test button (fires a sample payload), remove, Add. The funnel-level list lives on the main settings section as the back-compat fallback. |

## The shape

```
sale completes (any charge path)
  ├─ funnel-level webhooks (every sale)
  └─ page-level webhooks (the page whose page_type matches the sale)
```

## Notes for a port

- The payload is the sale record — keep it stable; external endpoints build
  on it.
- Fire-and-forget with a timeout is deliberate: a slow or dead endpoint must
  never hold up the buyer's redirect to the next step.
- The Test button in the editor fires a sample payload so the owner can see
  the receiving end work before a real sale.
- Related guard: the INBOUND Stripe webhook (`/api/webhooks`) skips events
  with no `product_id`/`page_type` metadata, so another app's charges on a
  shared endpoint never record phantom purchases. See
  `FUNNEL_TEST_MODE_AND_STRIPE_CHECKOUT_PORT.md`.
