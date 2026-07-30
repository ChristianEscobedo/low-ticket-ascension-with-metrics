-- The programmable prompt bank for the MotherMode content hub.
--
-- The code registries (promptBank.ts frameworks, promptStyles.ts styles) are
-- the version-controlled seeds. This table makes every recipe PROGRAMMABLE:
-- admins edit craft text, toggle recipes on/off, and add custom ones from
-- /admin/prompt-bank, and every generator (batch, variations, amplify,
-- rewrites) merges DB rows over the code seeds at resolve time. A seed slug
-- with a row here is an override; deleting the row restores the code default.
--
-- RLS: admin-only feature. No anon/authenticated policies at all, so the
-- table is invisible to every non-service role. The service role (server
-- routes behind requireAdminRoute) does all reads and writes.

create table if not exists mothermode_prompt_recipes (
  slug text primary key,
  recipe_group text not null default 'framework'
    check (recipe_group in ('framework', 'style')),
  label text not null,
  hint text not null default '',
  goal text not null default 'shares'
    check (goal in ('replies', 'saves', 'shares', 'follows', 'clicks')),
  why_it_works jsonb not null default '[]'::jsonb,
  template text not null default '',
  example_hooks jsonb not null default '[]'::jsonb,
  craft text not null default '',
  platforms jsonb not null default '[]'::jsonb,
  formats jsonb not null default '[]'::jsonb,
  platform_notes jsonb not null default '{}'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  builtin boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists idx_prompt_recipes_enabled
  on mothermode_prompt_recipes (enabled, sort_order);

alter table mothermode_prompt_recipes enable row level security;

-- Service role gets full access (reads merged view + all writes).
drop policy if exists "Service role full access mothermode_prompt_recipes"
  on mothermode_prompt_recipes;
create policy "Service role full access mothermode_prompt_recipes"
  on mothermode_prompt_recipes
  for all
  to service_role
  using (true)
  with check (true);
