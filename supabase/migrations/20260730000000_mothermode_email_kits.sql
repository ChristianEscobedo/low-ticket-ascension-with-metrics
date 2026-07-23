-- MotherMode Email Marketing Kit
-- Admin-only authoring table for outcome-driven email SEQUENCES. Sibling of
-- mothermode_lead_gen_kits / mothermode_high_ticket_kits, but sequence-shaped
-- (an ordered EmailMessage[] in `sequence`) and context-native (it stores the
-- shared context-bridge pointers in `context_refs`).
--
-- No anon RLS policy: like the other admin kits, all access is via the
-- service-role client in src/lib/mothermode/email/store.ts, which bypasses RLS.

create table if not exists public.mothermode_email_kits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text,
  campaign_type text not null default 'nurture-to-offer',
  framework text not null default 'story-lesson',
  status text not null default 'draft',
  intake jsonb not null default '{}'::jsonb,
  context_refs jsonb not null default '[]'::jsonb,
  sequence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Newest-first admin listing.
create index if not exists mothermode_email_kits_updated_at_idx
  on public.mothermode_email_kits (updated_at desc);

-- Enable RLS with no policies: only the service role (which bypasses RLS) can
-- read or write. There is no buyer-facing / anon path to this table.
alter table public.mothermode_email_kits enable row level security;

comment on table public.mothermode_email_kits is
  'Admin-only Email Marketing Kit: outcome-driven email sequences. Access via service role only (RLS on, no policies).';
