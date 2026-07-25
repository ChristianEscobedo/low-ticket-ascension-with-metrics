-- MotherMode Sales Funnels
--
-- DB-driven full sales funnels in the Editorial Warm brand. One row per
-- funnel holds identity + JSONB content blocks for every step of the path:
-- optin → sales → vsl → checkout → upsell1-4 → success → access.
--
-- Leads land in mothermode_sales_funnel_leads (unique per funnel+email).
-- Events stream into mothermode_sales_funnel_events for analytics.
--
-- Public pages read published funnels via the service-role store (same pattern
-- as optin funnels). Admin CRUD is service-role only. No anon write policies —
-- capture goes through /api/funnel/capture.
--
-- Flow: /funnel/[slug] → /funnel/[slug]/sales → /funnel/[slug]/vsl
--       → /funnel/[slug]/checkout → /funnel/[slug]/upsell → upsell-2/3/4
--       → /funnel/[slug]/success → /funnel/[slug]/access

CREATE TABLE IF NOT EXISTS mothermode_sales_funnels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'draft',      -- draft | published | archived
  -- Optional links into the rest of MotherMode
  offer_slug       TEXT,                               -- /mothermode/[slug] after success
  lead_gen_slug    TEXT,                               -- lead-gen kit slug (magnet source)
  deliverable_slug TEXT,                               -- mothermode_deliverables slug
  deliverable_key  TEXT,                               -- mothermode_deliverables key
  email_kit_id     TEXT,                               -- Email Marketing kit id to auto-enroll
  -- Stripe / product links
  product_id       TEXT,                               -- Stripe product id for metadata
  -- Page content blocks (see src/lib/mothermode/sales/types.ts)
  optin            JSONB NOT NULL DEFAULT '{}'::jsonb,
  sales            JSONB NOT NULL DEFAULT '{}'::jsonb,
  vsl              JSONB NOT NULL DEFAULT '{}'::jsonb,
  checkout         JSONB NOT NULL DEFAULT '{}'::jsonb,
  upsell1          JSONB NOT NULL DEFAULT '{}'::jsonb,
  upsell2          JSONB NOT NULL DEFAULT '{}'::jsonb,
  upsell3          JSONB NOT NULL DEFAULT '{}'::jsonb,
  upsell4          JSONB NOT NULL DEFAULT '{}'::jsonb,
  success          JSONB NOT NULL DEFAULT '{}'::jsonb,
  access           JSONB NOT NULL DEFAULT '{}'::jsonb,
  footer           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Stats
  view_count       INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  checkout_count   INTEGER NOT NULL DEFAULT 0,
  purchase_count   INTEGER NOT NULL DEFAULT 0,
  upsell1_yes      INTEGER NOT NULL DEFAULT 0,
  upsell1_no       INTEGER NOT NULL DEFAULT 0,
  upsell2_yes      INTEGER NOT NULL DEFAULT 0,
  upsell2_no       INTEGER NOT NULL DEFAULT 0,
  upsell3_yes      INTEGER NOT NULL DEFAULT 0,
  upsell3_no       INTEGER NOT NULL DEFAULT 0,
  upsell4_yes      INTEGER NOT NULL DEFAULT 0,
  upsell4_no       INTEGER NOT NULL DEFAULT 0,
  revenue_cents    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_mothermode_sales_funnels_status
  ON mothermode_sales_funnels (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS mothermode_sales_funnel_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id    UUID NOT NULL REFERENCES mothermode_sales_funnels(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  first_name   TEXT,
  status       TEXT NOT NULL DEFAULT 'captured',       -- captured | checkout_started | purchased | upsell_skipped
  step_reached TEXT NOT NULL DEFAULT 'optin',          -- optin | sales | vsl | checkout | upsell1-4 | success | access
  purchased    BOOLEAN NOT NULL DEFAULT false,
  purchase_amount_cents INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_mothermode_sales_funnel_leads_funnel
  ON mothermode_sales_funnel_leads (funnel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mothermode_sales_funnel_leads_email
  ON mothermode_sales_funnel_leads (email);

CREATE TABLE IF NOT EXISTS mothermode_sales_funnel_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id   UUID NOT NULL REFERENCES mothermode_sales_funnels(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES mothermode_sales_funnel_leads(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,                            -- view | optin_submit | sales_view | vsl_view | checkout_start | purchase | upsell_yes | upsell_no | success_view | access_view
  step        TEXT,                                    -- which step the event relates to
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mothermode_sales_funnel_events_funnel
  ON mothermode_sales_funnel_events (funnel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mothermode_sales_funnel_events_type
  ON mothermode_sales_funnel_events (event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: service-role only. Public reads/writes go through Next.js API routes
-- that use the service role after validation.
-- ---------------------------------------------------------------------------
ALTER TABLE mothermode_sales_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_sales_funnel_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_sales_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_sales_funnels"
  ON mothermode_sales_funnels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access mothermode_sales_funnel_leads"
  ON mothermode_sales_funnel_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access mothermode_sales_funnel_events"
  ON mothermode_sales_funnel_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);