-- Brand Bibles: admin-editable visual identity records that reskin the Reel
-- Director / Seedance cinematic pipeline. Consumed as a context source
-- ('brand-bible') via a ContextRef pointer, exactly like the kit stores.
--
-- Admin-only tool: no anon policy. All reads/writes go through the service-role
-- client (which bypasses RLS). If a public share surface ever lands, add an anon
-- read scoped to a `published` flag, mirroring mothermode_help.

create table if not exists public.mothermode_brand_bibles (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  scope            text,
  visual_direction text,
  color_language   text,
  emotion          text,
  camera           text,
  negatives        jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       text
);

-- Newest-first admin listing.
create index if not exists mothermode_brand_bibles_updated_at_idx
  on public.mothermode_brand_bibles (updated_at desc);

-- Optional scope filtering (MotherMode / Omega / Mass).
create index if not exists mothermode_brand_bibles_scope_idx
  on public.mothermode_brand_bibles (scope);

-- RLS on, no policies: service-role only.
alter table public.mothermode_brand_bibles enable row level security;
