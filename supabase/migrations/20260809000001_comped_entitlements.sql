/**
 * COMPED_ENTITLEMENTS
 * Manual (free) subscription-style grants created from /admin/subscriptions.
 * These never touch Stripe billing — they exist so an admin can comp a customer
 * access and have it show up next to real subscriptions, appear on the customer
 * record, and fan out to the main app over the same webhook channel.
 *
 * Read-side access checks should treat an active row here the same as an
 * active subscription for the matching product.
 */
create table comped_entitlements (
  id uuid primary key default gen_random_uuid(),
  -- Buyer email. The universal join key across the funnel (matches
  -- funnel_purchases.customer_email and Stripe customer email).
  customer_email text not null,
  -- Stripe product/price this comp mirrors (optional but recommended — drives
  -- reporting, the main-app webhook payload, and product-based access checks).
  product_id text,
  price_id text,
  product_name text,
  -- Optional auth user link when the customer already has an account.
  user_id uuid,
  status text not null default 'active' check (status in ('active', 'revoked')),
  -- Admin note (why the comp was given).
  note text,
  created_by text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  revoked_at timestamp with time zone
);

create index comped_entitlements_email_idx on comped_entitlements (customer_email);
create index comped_entitlements_product_idx on comped_entitlements (product_id);
create index comped_entitlements_status_idx on comped_entitlements (status);

-- Service-role only.
alter table comped_entitlements enable row level security;
