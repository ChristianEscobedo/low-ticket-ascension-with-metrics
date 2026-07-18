-- MotherMode resource deliverables. One row per (offer slug, resource key)
-- holding an admin-editable override of the long-form HTML handed to a buyer
-- after checkout. Code ships a full default for every resource; this table
-- lets an admin update the copy without a deploy. Read publicly (the
-- delivery page has no per-buyer gate, matching the offer-media pattern);
-- written only by the service role through the admin API.

CREATE TABLE IF NOT EXISTS mothermode_deliverables (
  slug TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  html TEXT NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (slug, key)
);

CREATE INDEX IF NOT EXISTS idx_mothermode_deliverables_slug ON mothermode_deliverables(slug);

ALTER TABLE mothermode_deliverables ENABLE ROW LEVEL SECURITY;

-- Buyers (and the anon server render) read published resource content.
CREATE POLICY "Public read mothermode_deliverables" ON mothermode_deliverables
  FOR SELECT USING (true);

-- Writes happen only through the admin API with the service role.
CREATE POLICY "Service role full access mothermode_deliverables" ON mothermode_deliverables
  FOR ALL TO service_role USING (true) WITH CHECK (true);
