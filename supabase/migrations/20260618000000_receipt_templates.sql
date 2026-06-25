-- Admin-editable templates for transactional receipts. Keyed by a short
-- slug so future expansion to per-product or per-locale templates is just
-- additional rows. The receipt sender falls back to hardcoded copy when
-- the requested template row is absent, so this table is opt-in.

CREATE TABLE IF NOT EXISTS receipt_templates (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE receipt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access receipt_templates"
  ON receipt_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
