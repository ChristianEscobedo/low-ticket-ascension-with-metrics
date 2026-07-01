-- MotherMode composed versions. One row per saved version: a whole post the team
-- assembled in the Version Composer from a source piece's hook, body, and CTA,
-- then kept in the library to schedule or publish. Scoped to (offer, piece) so a
-- piece's versions live together and the whole team sees the same set. The full
-- SavedVersion (hook/body/cta) lives in the `version` JSONB column so the client
-- renders it exactly as composed. Written and read only by the service role
-- through the admin-gated /api/mothermode/content/versions route.

-- ============================================
-- MOTHERMODE CONTENT VERSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS mothermode_content_versions (
  -- Stable version id, unique within (offer_slug, piece_id).
  id TEXT PRIMARY KEY,
  -- The offer the source piece is scoped to (the hub is opened per offer).
  offer_slug TEXT NOT NULL,
  -- The ContentPiece id the version was composed from (static or generated).
  piece_id TEXT NOT NULL,
  -- The composed post: { hook, body, cta }.
  version JSONB NOT NULL,
  -- Where the version sits in the ship pipeline.
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published')),
  -- When status is scheduled, the time the post should publish.
  scheduled_for TIMESTAMPTZ,
  -- Email of the last admin who wrote this version, for light attribution.
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_versions_offer_piece
  ON mothermode_content_versions(offer_slug, piece_id);
CREATE INDEX IF NOT EXISTS idx_mm_versions_status
  ON mothermode_content_versions(status);
CREATE INDEX IF NOT EXISTS idx_mm_versions_scheduled
  ON mothermode_content_versions(scheduled_for);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE mothermode_content_versions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS but the explicit policy is kept for clarity. There
-- is no public policy: composed versions are internal admin tooling only.
CREATE POLICY "Service role full access mothermode_content_versions"
  ON mothermode_content_versions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
