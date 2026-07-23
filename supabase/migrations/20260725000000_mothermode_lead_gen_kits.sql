-- MotherMode Lead Gen Kit: an admin production tool that turns a short intake
-- plus a chosen lead-magnet format into a complete, long-form, brand-styled
-- document (ebook, guide, cheat sheet, SOP, course, mini-course, template,
-- checklist, worksheet, swipe file). The whole structured document is stored as
-- JSONB so the block structure stays flexible while formats evolve.
--
-- Buyer delivery does NOT happen through this table: a finished kit is published
-- into mothermode_deliverables (already anon-readable for published overrides)
-- via upsertDeliverable, and the buyer opens it at
-- /mothermode/resource/[slug]/[key]. published_slug / published_key remember
-- where a kit was pushed so re-publishing overwrites the same deliverable.
--
-- RLS posture: admin-only tool. No anon policies. Service role bypasses RLS for
-- all reads (including drafts) and every write, exactly like
-- mothermode_high_ticket_kits.

CREATE TABLE IF NOT EXISTS mothermode_lead_gen_kits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,               -- url-safe, stable
  name           TEXT NOT NULL DEFAULT '',           -- document title
  format         TEXT NOT NULL DEFAULT 'guide',      -- LeadMagnetFormat key
  status         TEXT NOT NULL DEFAULT 'draft',      -- draft | active | archived
  intake         JSONB NOT NULL DEFAULT '{}'::jsonb, -- topic, audience, goal, tone, length, cta
  doc            JSONB NOT NULL DEFAULT '{}'::jsonb, -- the generated document (see types.ts)
  published_slug TEXT,                               -- deliverable slug when published
  published_key  TEXT,                               -- deliverable key when published
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_gen_kits_status
  ON mothermode_lead_gen_kits (status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: admin-only. Service role bypasses RLS for all access; no anon policies.
-- ---------------------------------------------------------------------------
ALTER TABLE mothermode_lead_gen_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_lead_gen_kits" ON mothermode_lead_gen_kits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
