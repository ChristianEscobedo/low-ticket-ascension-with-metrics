-- MotherMode Community Kit: an admin production tool that turns a short intake
-- into a complete community launch kit (name options, description, qualifying
-- questions, DM scripts, sales-call script, ad content style, and first pinned
-- post). One row per kit; the whole structured kit is stored as JSONB so section
-- shapes stay flexible while the owner frameworks evolve.
--
-- RLS posture: admin-only tool. No anon policies. All reads (including drafts)
-- and every write go through the admin API with the service role, which bypasses
-- RLS. If a public share surface is added later, add a `published` flag plus an
-- anon select policy scoped to that flag, exactly like mothermode_kb_articles.

CREATE TABLE IF NOT EXISTS mothermode_community_kits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,               -- url-safe, stable
  name           TEXT NOT NULL DEFAULT '',           -- chosen community name
  community_type TEXT NOT NULL DEFAULT 'paid',       -- paid | free | both
  status         TEXT NOT NULL DEFAULT 'draft',      -- draft | active | archived
  intake         JSONB NOT NULL DEFAULT '{}'::jsonb, -- niche, audience, promise, platform, price, tone
  kit            JSONB NOT NULL DEFAULT '{}'::jsonb, -- generated resources (see types.ts)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_community_kits_status
  ON mothermode_community_kits (status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: admin-only. Service role bypasses RLS for all access; no anon policies.
-- ---------------------------------------------------------------------------
ALTER TABLE mothermode_community_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_community_kits" ON mothermode_community_kits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
