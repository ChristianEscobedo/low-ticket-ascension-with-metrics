-- 1:1 Personalization ("every lead gets their own page").
--
-- Two tables, both service-role only like every mothermode table:
--
--   mothermode_personalization_campaigns
--     Per-funnel settings. `mode` is the whole safety story in one column:
--       off     — token ignored, funnel behaves exactly as before (default).
--       overlay — valid ?pp= tokens get a personalized page; everyone else
--                 sees the generic page.
--       gated   — only valid-token holders see the offer at all; everyone
--                 else gets the decoy page ("blank without the key").
--     Default-off means applying this migration cannot change any live
--     funnel's behavior.
--
--   mothermode_lead_personalizations
--     The cached AI payload for one lead on one funnel. Generated once (on
--     capture or on demand from admin), then read on every page render —
--     AI cost is per-lead, never per-pageview. Unique per
--     (funnel_kind, funnel_id, lead_key) so regeneration upserts in place.

create table if not exists public.mothermode_personalization_campaigns (
  id uuid primary key default gen_random_uuid(),
  funnel_kind text not null check (funnel_kind in ('sales', 'optin')),
  funnel_id uuid not null,
  mode text not null default 'off' check (mode in ('off', 'overlay', 'gated')),
  -- Free-form admin steering injected into the AI pass
  -- ("these leads came from a TikTok about X, keep the tone Y").
  guidance text not null default '',
  -- Optional branded background image for the dynamic email-image endpoint.
  base_image_url text not null default '',
  -- Master switch for this funnel's dynamic email-image URLs.
  email_image_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funnel_kind, funnel_id)
);

create index if not exists mothermode_personalization_campaigns_funnel_idx
  on public.mothermode_personalization_campaigns (funnel_kind, funnel_id);

create table if not exists public.mothermode_lead_personalizations (
  id uuid primary key default gen_random_uuid(),
  funnel_kind text not null check (funnel_kind in ('sales', 'optin')),
  funnel_id uuid not null,
  -- Lowercased recipient email. Not a FK to a lead table on purpose: both
  -- lead tables key on (funnel_id, email) already, and a personalization
  -- must survive a lead row being re-imported or merged.
  lead_key text not null,
  first_name text,
  intent_segment text not null default '',
  payload jsonb not null default '{}'::jsonb,
  model text not null default '',
  -- 'ai' | 'admin' — an admin hand-edit always wins over regeneration
  -- unless explicitly forced.
  source text not null default 'ai',
  generated_at timestamptz not null default now(),
  unique (funnel_kind, funnel_id, lead_key)
);

create index if not exists mothermode_lead_personalizations_lookup_idx
  on public.mothermode_lead_personalizations (funnel_kind, funnel_id, lead_key);

-- No anon RLS policies: service-role only, like every mothermode table.
alter table public.mothermode_personalization_campaigns enable row level security;
alter table public.mothermode_lead_personalizations enable row level security;
