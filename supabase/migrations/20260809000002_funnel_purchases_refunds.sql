/**
 * FUNNEL_PURCHASES — refund bookkeeping.
 * The row's `status` moves to 'refunded' when a refund is issued from
 * /admin/purchases (or by the Stripe charge.refunded webhook); these columns
 * record when, which Stripe refund object, and how much (partial refunds
 * supported).
 */
alter table funnel_purchases
  add column if not exists refunded_at timestamp with time zone,
  add column if not exists refund_id text,
  add column if not exists refunded_amount_cents bigint;

create index if not exists funnel_purchases_status_idx on funnel_purchases (status);
