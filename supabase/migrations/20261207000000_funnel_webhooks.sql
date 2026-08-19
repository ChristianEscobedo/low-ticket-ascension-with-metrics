-- Outbound webhooks: a funnel carries a list of webhook URLs. On a purchase
-- (the main product or a bump), the app POSTs the purchase data to each URL —
-- the main app, GHL, Zapier, anything that takes a JSON POST. A JSONB array
-- of URL strings; empty = no webhooks.
alter table public.mothermode_sales_funnels
  add column if not exists webhooks jsonb not null default '[]'::jsonb;
alter table public.mothermode_optin_funnels
  add column if not exists webhooks jsonb not null default '[]'::jsonb;
