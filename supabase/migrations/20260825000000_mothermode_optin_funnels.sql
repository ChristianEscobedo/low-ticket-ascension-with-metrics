-- MotherMode Optin Funnels
--
-- DB-driven lead-capture funnels in the Editorial Warm brand. One row per
-- funnel holds identity + three content blocks (optin / oto / thankyou) as
-- JSONB so the page shape can evolve without more migrations. Leads land in
-- mothermode_optin_leads (unique per funnel+email).
--
-- Public pages read published funnels via the service-role store (same pattern
-- as deliverables / lead-gen). Admin CRUD is service-role only. No anon write
-- policies — capture goes through /api/optin/capture.
--
-- Flow: /optin/[slug] → capture → /optin/[slug]/oto → /optin/[slug]/thank-you

CREATE TABLE IF NOT EXISTS mothermode_optin_funnels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'draft',      -- draft | published | archived
  -- Optional links into the rest of MotherMode
  offer_slug       TEXT,                               -- /mothermode/[slug] after thank-you
  lead_gen_slug    TEXT,                               -- lead-gen kit slug (magnet source)
  deliverable_slug TEXT,                               -- mothermode_deliverables slug
  deliverable_key  TEXT,                               -- mothermode_deliverables key
  -- Page content blocks (see src/lib/mothermode/optin/types.ts)
  optin            JSONB NOT NULL DEFAULT '{}'::jsonb,
  oto              JSONB NOT NULL DEFAULT '{}'::jsonb,
  thankyou         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Stats
  view_count       INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_mothermode_optin_funnels_status
  ON mothermode_optin_funnels (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS mothermode_optin_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id    UUID NOT NULL REFERENCES mothermode_optin_funnels(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  first_name   TEXT,
  status       TEXT NOT NULL DEFAULT 'captured',       -- captured | oto_accepted | oto_declined
  oto_accepted BOOLEAN NOT NULL DEFAULT false,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  referrer     TEXT,
  user_agent   TEXT,
  ip_hash      TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funnel_id, email)
);

CREATE INDEX IF NOT EXISTS idx_mothermode_optin_leads_funnel
  ON mothermode_optin_leads (funnel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mothermode_optin_leads_email
  ON mothermode_optin_leads (email);

-- ---------------------------------------------------------------------------
-- RLS: service-role only. Public reads/writes go through Next.js API routes
-- that use the service role after validation.
-- ---------------------------------------------------------------------------
ALTER TABLE mothermode_optin_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_optin_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_optin_funnels"
  ON mothermode_optin_funnels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access mothermode_optin_leads"
  ON mothermode_optin_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);
