-- Hook Bank: a tagged, scored library of 0.5-3s opening clips that mount as
-- beat 0 on the reel timeline (the pattern interrupt before the content).
--
-- WHY ITS OWN TABLE AND NOT A MEDIA-LIBRARY TAG
-- ---------------------------------------------
-- A hook is not just a video URL. It carries a reaction taxonomy (what the
-- viewer is supposed to FEEL in the first second), a rights field (fetched
-- clips are not all safe for paid ads), a provenance ref back to the clone
-- sheet that generated it, and a hook score that the leaderboard ranks on.
-- The media library stays the generic asset home; the hook bank is the
-- opinionated, scored subset the reel studio mounts from. Hooks ALSO ingest
-- into the media library (source='hook-bank') so AI prompts can use them as
-- seeds — one asset, two views.

create table if not exists mothermode_hook_clips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  -- where the clip came from
  source text not null default 'uploaded'
    check (source in ('uploaded', 'fetched', 'generated')),
  -- what the first second is supposed to make the viewer feel
  reaction text not null default 'shock'
    check (reaction in (
      'shock', 'laugh', 'confusion', 'satisfaction',
      'relatability', 'chaos', 'curiosity', 'awe'
    )),
  -- can this go in a paid ad without a takedown risk
  rights text not null default 'owned'
    check (rights in ('owned', 'licensed', 'meme-fair-use', 'unknown')),
  duration_sec numeric,
  sprite_url text,
  -- provenance: the clone sheet / character that generated it, when known
  sheet_ref text,
  -- 0-100 hold score; null until scored (manual now, metric-derived later)
  hook_score numeric,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url)
);

create index if not exists mothermode_hook_clips_reaction_idx
  on mothermode_hook_clips(reaction);
create index if not exists mothermode_hook_clips_source_idx
  on mothermode_hook_clips(source);
create index if not exists mothermode_hook_clips_score_idx
  on mothermode_hook_clips(hook_score desc nulls last);
create index if not exists mothermode_hook_clips_tags_idx
  on mothermode_hook_clips using gin(tags);
