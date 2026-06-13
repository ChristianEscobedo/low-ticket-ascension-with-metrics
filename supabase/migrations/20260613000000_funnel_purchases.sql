/**
* FUNNEL_PURCHASES
* Records every successful one-time purchase coming through the inline funnel
* (Millionaire Mindshift FE + OTOs). Populated by /api/webhooks from
* `payment_intent.succeeded` and `checkout.session.completed` (mode=payment).
* `stripe_event_id` is the unique idempotency key, so re-deliveries from
* Stripe are absorbed by the unique constraint instead of double-recording.
*/
create table funnel_purchases (
  id uuid primary key default gen_random_uuid(),
  -- Stripe event.id of the webhook that produced this row (idempotency key).
  stripe_event_id text not null unique,
  -- Stripe object refs (one of these is set depending on the source event).
  payment_intent_id text,
  checkout_session_id text,
  -- The product the buyer purchased, e.g. millionaire_mindshift / prod_oto1.
  product_id text,
  -- Funnel stage that produced the sale, e.g. fe / oto1 / oto2 / oto3 / oto4.
  page_type text,
  -- Amount in the smallest currency unit (cents for usd).
  amount_cents bigint not null,
  currency text not null check (char_length(currency) = 3),
  customer_email text,
  customer_name text,
  -- 'succeeded' for the inline funnel; future-proofed for refunds/disputes.
  status text not null default 'succeeded',
  -- Any caller-supplied metadata stamped on the PaymentIntent / Session.
  metadata jsonb,
  created_at timestamp with time zone not null default timezone('utc', now())
);

create index funnel_purchases_created_at_idx on funnel_purchases (created_at desc);
create index funnel_purchases_product_id_idx on funnel_purchases (product_id);
create index funnel_purchases_page_type_idx on funnel_purchases (page_type);
create index funnel_purchases_customer_email_idx on funnel_purchases (customer_email);

-- Lock the table down. Only the service role (used by the webhook handler and
-- the admin stats page via @/utils/supabase/admin) may read or write it.
alter table funnel_purchases enable row level security;
-- No policies = no access for anon / authenticated roles by default.
