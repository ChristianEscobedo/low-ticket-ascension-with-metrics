-- MotherMode Planner: the tracking + organization layer that sits on top of the
-- content suite and the sales funnels.
--
-- Three tables, one idea: a *board* owns its column definitions,
-- and every card stores the column id it currently lives in. Columns are
-- admin-configurable (rename / reorder / add / remove) with a seeded default
-- set, so the pipeline can change shape without a migration.
--
--   mothermode_planner_boards  -- column definitions (content + leads)
--   mothermode_content_plan    -- one row per planned content piece
--                                 (feeds BOTH the calendar and the content kanban)
--   mothermode_lead_pipeline   -- sidecar to mothermode_sales_funnel_leads
--                                 (feeds the lead kanban)
--
-- All three are written and read only by the service role through the
-- admin-gated /api/admin/mothermode-planner routes.

-- ============================================
-- PLANNER BOARDS (configurable columns)
-- ============================================
CREATE TABLE IF NOT EXISTS mothermode_planner_boards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'content' boards drive the content kanban + calendar stage colours.
  -- 'leads'   boards drive the lead kanban.
  kind       TEXT NOT NULL CHECK (kind IN ('content', 'leads')),
  name       TEXT NOT NULL DEFAULT '',
  -- PlannerColumn[]: { id, label, color?, wipLimit?, terminal?, autoEvents? }
  -- See src/lib/mothermode/planner/types.ts. Kept as JSONB so adding a column
  -- is a save, not a migration.
  columns    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Exactly one default per kind is expected; enforced by partial unique index.
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_planner_boards_default
  ON mothermode_planner_boards(kind) WHERE is_default;

-- ============================================
-- CONTENT PLAN (calendar + content kanban)
-- ============================================
CREATE TABLE IF NOT EXISTS mothermode_content_plan (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Catalog piece id or generated piece id ('gen_<batch>_<n>').
  piece_id     TEXT NOT NULL,
  -- The offer the piece was planned for; scopes the calendar.
  offer_slug   TEXT NOT NULL DEFAULT '',
  board_id     UUID REFERENCES mothermode_planner_boards(id) ON DELETE SET NULL,
  -- The real, draggable publish moment. This is the source of truth for
  -- exports: buildExportRows prefers it over SavedVersion.scheduledFor and
  -- over the derived campaignStart + week maths. NULL = still in the backlog.
  scheduled_at TIMESTAMPTZ,
  -- PlannerColumn.id on the board above. Text (not an enum) precisely because
  -- columns are user-editable.
  stage        TEXT NOT NULL DEFAULT 'idea',
  -- Denormalized facets so the board/calendar can filter without loading every
  -- ContentPiece body.
  platform     TEXT NOT NULL DEFAULT '',
  format       TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  owner        TEXT,
  due_at       TIMESTAMPTZ,
  priority     INTEGER NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT '',
  blocked      BOOLEAN NOT NULL DEFAULT false,
  -- Position within its kanban column / within a calendar day.
  sort_order   INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  external_url TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   TEXT,
  -- One plan row per piece per offer: planning the same evergreen piece for two
  -- different offers is legitimate, planning it twice for one offer is a bug.
  UNIQUE (piece_id, offer_slug)
);

CREATE INDEX IF NOT EXISTS idx_mm_content_plan_offer
  ON mothermode_content_plan(offer_slug);
CREATE INDEX IF NOT EXISTS idx_mm_content_plan_scheduled
  ON mothermode_content_plan(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_mm_content_plan_stage
  ON mothermode_content_plan(stage);

-- ============================================
-- LEAD PIPELINE (lead kanban)
-- ============================================
-- Deliberately a sidecar rather than new columns on the leads table: capture
-- stays a hot write path owned by /api/funnel/capture, while the pipeline is
-- an admin-owned CRM overlay. Leads with no row here still render, mapped from
-- their existing status / step_reached, so the board is populated with no backfill.
CREATE TABLE IF NOT EXISTS mothermode_lead_pipeline (
  lead_id        UUID PRIMARY KEY
                 REFERENCES mothermode_sales_funnel_leads(id) ON DELETE CASCADE,
  funnel_id      UUID REFERENCES mothermode_sales_funnels(id) ON DELETE CASCADE,
  board_id       UUID REFERENCES mothermode_planner_boards(id) ON DELETE SET NULL,
  stage          TEXT NOT NULL DEFAULT 'new',
  -- true once an admin drags the card. Funnel events then stop overwriting the
  -- stage, so automation never undoes human judgement.
  stage_manual   BOOLEAN NOT NULL DEFAULT false,
  owner          TEXT,
  next_action    TEXT NOT NULL DEFAULT '',
  next_action_at TIMESTAMPTZ,
  -- Expected/booked value for this lead, so column headers can sum a number.
  value_cents    INTEGER NOT NULL DEFAULT 0,
  notes          TEXT NOT NULL DEFAULT '',
  tags           TEXT[] NOT NULL DEFAULT '{}',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_mm_lead_pipeline_stage
  ON mothermode_lead_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_mm_lead_pipeline_funnel
  ON mothermode_lead_pipeline(funnel_id);
CREATE INDEX IF NOT EXISTS idx_mm_lead_pipeline_next_action
  ON mothermode_lead_pipeline(next_action_at);

-- ============================================
-- SEED: default boards
-- ============================================
-- Mirrors DEFAULT_CONTENT_COLUMNS / DEFAULT_LEAD_COLUMNS in
-- src/lib/mothermode/planner/defaults.ts. The app falls back to those constants
-- when no row exists, so this seed is a convenience, not a dependency.
INSERT INTO mothermode_planner_boards (kind, name, columns, is_default)
SELECT 'content', 'Content Pipeline', '[
  {"id":"idea","label":"Idea","color":"#9CA3AF"},
  {"id":"writing","label":"Writing","color":"#F59E0B"},
  {"id":"media","label":"Media","color":"#8B5CF6"},
  {"id":"review","label":"Review","color":"#3B82F6"},
  {"id":"approved","label":"Approved","color":"#10B981"},
  {"id":"scheduled","label":"Scheduled","color":"#06B6D4"},
  {"id":"published","label":"Published","color":"#065F46","terminal":true}
]'::jsonb, true
WHERE NOT EXISTS (
  SELECT 1 FROM mothermode_planner_boards WHERE kind = 'content' AND is_default
);

INSERT INTO mothermode_planner_boards (kind, name, columns, is_default)
SELECT 'leads', 'Lead Pipeline', '[
  {"id":"new","label":"New","color":"#9CA3AF","autoEvents":["optin_submit"]},
  {"id":"nurturing","label":"Nurturing","color":"#F59E0B"},
  {"id":"engaged","label":"Engaged","color":"#8B5CF6","autoEvents":["sales_view","vsl_view"]},
  {"id":"checkout_started","label":"Checkout Started","color":"#3B82F6","autoEvents":["checkout_start"]},
  {"id":"customer","label":"Customer","color":"#10B981","autoEvents":["purchase"]},
  {"id":"upsell_taken","label":"Upsell Taken","color":"#059669","autoEvents":["upsell_yes"]},
  {"id":"call_booked","label":"Call Booked","color":"#06B6D4"},
  {"id":"closed_won","label":"Closed Won","color":"#065F46","terminal":true},
  {"id":"closed_lost","label":"Closed Lost","color":"#B91C1C","terminal":true}
]'::jsonb, true
WHERE NOT EXISTS (
  SELECT 1 FROM mothermode_planner_boards WHERE kind = 'leads' AND is_default
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE mothermode_planner_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_content_plan   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_lead_pipeline  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; the explicit policies are kept for clarity. There
-- are no anon policies: the planner is an internal admin surface.
CREATE POLICY "Service role full access mothermode_planner_boards"
  ON mothermode_planner_boards FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access mothermode_content_plan"
  ON mothermode_content_plan FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access mothermode_lead_pipeline"
  ON mothermode_lead_pipeline FOR ALL TO service_role
  USING (true) WITH CHECK (true);
