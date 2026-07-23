-- MotherMode High Ticket Kit: an admin production tool that turns a short intake
-- into a complete high-ticket offer and its selling system (offer architecture,
-- a give-away value resource, a 15-minute triage script, a full sales-call
-- script, and an optional ad angle). One row per kit; the whole structured kit
-- is stored as JSONB so section shapes stay flexible while the owner frameworks
-- evolve. High-ticket has one flavor, so there is no community_type column.
--
-- RLS posture: admin-only tool. No anon policies. All reads (including drafts)
-- and every write go through the admin API with the service role, which bypasses
-- RLS. If a public share surface is added later, add a `published` flag plus an
-- anon select policy scoped to that flag, exactly like mothermode_kb_articles.

CREATE TABLE IF NOT EXISTS mothermode_high_ticket_kits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,               -- url-safe, stable
  name         TEXT NOT NULL DEFAULT '',           -- chosen offer/program name
  status       TEXT NOT NULL DEFAULT 'draft',      -- draft | active | archived
  intake       JSONB NOT NULL DEFAULT '{}'::jsonb, -- niche, audience, transformation, price band, proof, tone
  kit          JSONB NOT NULL DEFAULT '{}'::jsonb, -- generated resources (see types.ts)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   TEXT
);

CREATE INDEX IF NOT EXISTS idx_high_ticket_kits_status
  ON mothermode_high_ticket_kits (status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: admin-only. Service role bypasses RLS for all access; no anon policies.
-- ---------------------------------------------------------------------------
ALTER TABLE mothermode_high_ticket_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_high_ticket_kits" ON mothermode_high_ticket_kits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
