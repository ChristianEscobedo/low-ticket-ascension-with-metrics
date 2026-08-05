-- Endpoint learning (roadmap task 4.3)
--
-- Every Monid run records its outcome per endpoint id. Discovery then
-- orders candidates winner-first: the endpoint that has been succeeding
-- lately gets tried before the one that has been 400ing. The endpoint pin
-- still wins outright; this only orders the DISCOVERED pool.
--
-- No anon RLS policies: service-role only, like every research table.

create table if not exists public.mothermode_monid_endpoint_stats (
  endpoint text primary key,
  runs integer not null default 0,
  failures integer not null default 0,
  last_ok_at timestamptz,
  last_fail_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.mothermode_monid_endpoint_stats enable row level security;
