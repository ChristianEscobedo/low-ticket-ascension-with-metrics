-- Planner <-> Funnel links + UTM tracking registry.
--
-- Closes the loop that 20261001000000_mothermode_planner.sql left open: a plan
-- card knew *what* it was and *when* it shipped, but not *where it pointed*. So
-- "which funnel is this post driving?" and "which post produced this lead?" were
-- both unanswerable.
--
-- Three moves:
--
--   1. mothermode_content_plan gains funnel_id / funnel_page / destination_url
--      -- the card now names its destination.
--   2. mothermode_utm_links    -- one registry, two entry points. A link minted
--      from the funnel side ("give me something for my IG bio") has plan_id NULL;
--      a link minted from a content card back-fills plan_id. Same table either
--      way, so the Tracking tab and the card drawer read one source of truth.
--   3. mothermode_link_clicks  -- per-click rows behind /go/<code>, so content
--      that gets clicks but no opt-ins stops being invisible.
--
-- Plus utm_content on both lead tables: without it the utm_content=piece_id
-- convention is decorative and per-piece attribution can't actually close.
--
-- ADVERTISING COMPLIANCE INVARIANTS for the /go/<code> redirect. These are not
-- style preferences -- breaking them is what turns a legitimate first-party short
-- link into a policy violation:
--
--   * NO CLOAKING. One code resolves to exactly one destination for every
--     visitor. Never branch the destination on user-agent, geo, referrer, or
--     time. Ad reviewers must see precisely what a buyer sees.
--   * NO OPEN REDIRECT. The destination comes from this table by code lookup
--     only, never from a caller-supplied ?to= parameter.
--   * FIRST-PARTY ONLY. /go/ lives on the same domain that serves the funnel, so
--     the ad's display URL matches its landing domain (third-party shorteners
--     are what the networks actually penalize).
--   * 302, NOT 301. A permanent redirect gets cached by the browser, which both
--     flatlines the click count after the first hit and makes a destination
--     change impossible to roll out.
--   * NO RAW PII. Clicks store a hashed IP (matching the ip_hash convention
--     already used by mothermode_sales_funnel_leads), never the address itself.

-- ============================================
-- CONTENT PLAN -> FUNNEL LINK
-- ============================================
-- ON DELETE SET NULL, not CASCADE: deleting a funnel must not silently delete
-- the content you made for it. The card survives and simply becomes unlinked.
ALTER TABLE mothermode_content_plan
  ADD COLUMN IF NOT EXISTS funnel_id UUID
    REFERENCES mothermode_sales_funnels(id) ON DELETE SET NULL;

-- Which page of the funnel this piece drives: 'optin' | 'sales' | 'vsl' |
-- 'checkout' | 'upsell1'..'upsell4' | 'success' | 'access'. Text, not an enum,
-- to mirror how `stage` stays text against user-editable columns -- and because
-- the funnel page set has already grown once.
ALTER TABLE mothermode_content_plan
  ADD COLUMN IF NOT EXISTS funnel_page TEXT NOT NULL DEFAULT '';

-- Escape hatch for destinations that aren't one of our funnels (a YouTube
-- video, a partner page). Set when funnel_id is NULL.
ALTER TABLE mothermode_content_plan
  ADD COLUMN IF NOT EXISTS destination_url TEXT;

CREATE INDEX IF NOT EXISTS idx_mm_content_plan_funnel
  ON mothermode_content_plan(funnel_id);

-- ============================================
-- UTM LINK REGISTRY
-- ============================================
CREATE TABLE IF NOT EXISTS mothermode_utm_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL when the link was minted from the funnel side with no content card
  -- behind it. This nullability is the entire reason one table serves both
  -- entry points instead of two tables needing to be kept in sync.
  plan_id       UUID REFERENCES mothermode_content_plan(id) ON DELETE SET NULL,
  funnel_id     UUID REFERENCES mothermode_sales_funnels(id) ON DELETE CASCADE,
  funnel_page   TEXT NOT NULL DEFAULT '',
  -- Denormalized from the plan card so utm_content survives the card being
  -- deleted -- otherwise historical lead attribution would go dark.
  piece_id      TEXT NOT NULL DEFAULT '',
  -- Human label for the admin list ("IG bio - March", "TikTok #3").
  label         TEXT NOT NULL DEFAULT '',
  -- Resolved funnel page URL, or a pasted external URL.
  base_url      TEXT NOT NULL DEFAULT '',
  utm_source    TEXT NOT NULL DEFAULT '',
  utm_medium    TEXT NOT NULL DEFAULT '',
  utm_campaign  TEXT NOT NULL DEFAULT '',
  -- Convention: utm_content = piece_id. This is the join key that makes
  -- attribution per-piece rather than per-campaign.
  utm_content   TEXT NOT NULL DEFAULT '',
  utm_term      TEXT NOT NULL DEFAULT '',
  -- Materialized rather than rebuilt on read: this exact string is what got
  -- pasted into the wild, so recomputing it later (after a slug rename, say)
  -- would misreport what was actually published.
  full_url      TEXT NOT NULL DEFAULT '',
  -- Short code behind /go/<code>. Nullable so a plain copy-paste UTM link needs
  -- no redirect; UNIQUE because it is the lookup key.
  short_code    TEXT UNIQUE,
  -- Hot counter for list views; mothermode_link_clicks holds the time series.
  click_count   INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_mm_utm_links_funnel
  ON mothermode_utm_links(funnel_id);
CREATE INDEX IF NOT EXISTS idx_mm_utm_links_plan
  ON mothermode_utm_links(plan_id);

-- Minting the same link twice is a mistake, not a use case: two rows with
-- identical UTMs would split one piece's stats across both. COALESCE keeps the
-- constraint effective for funnel-less external links, where NULL funnel_id
-- would otherwise defeat the uniqueness check entirely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_utm_links_unique_combo
  ON mothermode_utm_links (
    COALESCE(funnel_id::text, ''), funnel_page,
    utm_source, utm_medium, utm_campaign, utm_content
  );

-- ============================================
-- LINK CLICKS
-- ============================================
-- Separate rows rather than only a counter, because "40 clicks" answers far less
-- than "38 of them in the six hours after the reel went up".
CREATE TABLE IF NOT EXISTS mothermode_link_clicks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id    UUID NOT NULL REFERENCES mothermode_utm_links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Hashed, never raw -- see the PII invariant in the header.
  ip_hash    TEXT,
  -- Coarse family ('ios', 'android', 'desktop', 'bot'), not the full UA string:
  -- enough to sanity-check traffic, not enough to fingerprint a person.
  ua_family  TEXT NOT NULL DEFAULT '',
  referrer   TEXT
);

CREATE INDEX IF NOT EXISTS idx_mm_link_clicks_link
  ON mothermode_link_clicks(link_id, clicked_at DESC);

-- ============================================
-- LEAD-SIDE utm_content
-- ============================================
-- The receiving half of the utm_content=piece_id convention. Both capture paths
-- already persist source/medium/campaign; without content the trail stops at
-- the campaign and you can never tell which of twelve posts did the work.
ALTER TABLE mothermode_sales_funnel_leads
  ADD COLUMN IF NOT EXISTS utm_content TEXT;

ALTER TABLE mothermode_optin_leads
  ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- ============================================
-- RLS
-- ============================================
-- Service role bypasses RLS; explicit policies kept for clarity, matching the
-- planner migration. Note the asymmetry: mothermode_utm_links is admin-only,
-- but /go/<code> must resolve for anonymous visitors -- that route uses the
-- service-role client precisely so no anon SELECT policy is needed here. The
-- link table stays unreadable to the public even though its redirects are not.
ALTER TABLE mothermode_utm_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_utm_links"
  ON mothermode_utm_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access mothermode_link_clicks"
  ON mothermode_link_clicks FOR ALL TO service_role
  USING (true) WITH CHECK (true);
