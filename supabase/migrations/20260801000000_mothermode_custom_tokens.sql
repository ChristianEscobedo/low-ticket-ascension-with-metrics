-- MotherMode custom merge tokens: admin-defined `{{key}}` markers that surface
-- in the email editor's Tokens dropdown AND resolve at render/export time from
-- their stored default value. Complements the static EMAIL_MERGE_TOKENS catalog
-- (src/lib/mothermode/email/tokens.ts) with editable, per-workspace values.
--
-- RLS posture mirrors mothermode_kb_articles / mothermode_deliverables: all
-- writes (and reads) go through the admin API with the service role, which
-- bypasses RLS. key/label/default_value are trusted, hand-authored admin content.

CREATE TABLE IF NOT EXISTS mothermode_custom_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,          -- bare key, e.g. 'coach_name' ([a-z0-9_])
  label         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  default_value TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_tokens_key
  ON mothermode_custom_tokens (key);

-- ---------------------------------------------------------------------------
-- RLS: service role does everything; no anon policies (admin API only).
-- ---------------------------------------------------------------------------
ALTER TABLE mothermode_custom_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_custom_tokens" ON mothermode_custom_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
