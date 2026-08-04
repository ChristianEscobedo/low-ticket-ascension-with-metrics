-- Media Library: one searchable home for every asset the app touches.
--
-- WHY ONE TABLE AND NOT ONE PER SURFACE
-- -------------------------------------
-- Vault assets, reel clips, hub renders, and thumbnails are all the same
-- thing: a named URL with a kind and some tags. Keeping them in separate
-- tables means AI prompts can't use prior media as context (no unified
-- search) and every new surface adds another table. One table with a
-- `source` column gives every surface a filtered VIEW of the same library
-- — the Vault becomes kind=video + tag hook/outro/reaction, Thumbnail Lab
-- exports land as source=thumbnail-lab, hub renders as source=generated.
--
-- Tags are text[] on the asset, not a join table: tag queries here are
-- "filter by one or two tags on a grid", which array-contains handles fine,
-- and the tag UI does suggestions from a distinct-tag rollup instead of
-- managing tag rows.

create table if not exists mothermode_media_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references mothermode_media_folders(id) on delete cascade,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mothermode_media_folders_parent_idx
  on mothermode_media_folders(parent_id);

create table if not exists mothermode_media_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  kind text not null default 'video' check (kind in ('video', 'image', 'audio')),
  source text not null default 'upload'
    check (source in ('upload', 'generated', 'thumbnail-lab', 'vault', 'external')),
  duration_sec numeric,
  thumbnail_url text,
  folder_id uuid references mothermode_media_folders(id) on delete set null,
  tags text[] not null default '{}',
  -- provenance: which reel/variant/project produced this asset, when known
  ref_id text,
  ref_kind text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url)
);

create index if not exists mothermode_media_assets_folder_idx
  on mothermode_media_assets(folder_id);
create index if not exists mothermode_media_assets_kind_idx
  on mothermode_media_assets(kind);
create index if not exists mothermode_media_assets_source_idx
  on mothermode_media_assets(source);
create index if not exists mothermode_media_assets_tags_idx
  on mothermode_media_assets using gin(tags);
create index if not exists mothermode_media_assets_ref_idx
  on mothermode_media_assets(ref_id, ref_kind);
