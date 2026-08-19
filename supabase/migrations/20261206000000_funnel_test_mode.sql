-- Per-funnel test mode: a funnel can run in Stripe TEST mode (the test keys,
-- the test card 4242…) while the rest run live. The checkout reads the
-- funnel's test_mode and picks the test or live secret key accordingly, so
-- you can prove a new funnel end-to-end before it touches real money.
alter table public.mothermode_sales_funnels
  add column if not exists test_mode boolean not null default false;
alter table public.mothermode_optin_funnels
  add column if not exists test_mode boolean not null default false;
