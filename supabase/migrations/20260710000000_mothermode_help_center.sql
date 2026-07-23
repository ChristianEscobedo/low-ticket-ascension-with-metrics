-- MotherMode Help Center: knowledge base / help articles + a release changelog,
-- both admin-editable in-app without a deploy. Two tables:
--
--   mothermode_kb_articles  -- categorized help docs (title, slug, body, etc.)
--   mothermode_changelog    -- dated, versioned release notes
--
-- RLS posture mirrors mothermode_deliverables but tightens the public read:
-- anon may SELECT only rows where published = true, so drafts stay private.
-- All writes go through the admin API with the service role, which bypasses
-- RLS. body/excerpt are trusted, hand-authored admin content, never buyer input.

-- ---------------------------------------------------------------------------
-- Knowledge base / help articles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mothermode_kb_articles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,           -- url-safe, stable
  title      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'General',
  excerpt    TEXT,                           -- one-line summary for lists
  body       TEXT NOT NULL,                  -- trusted admin markdown/HTML
  published  BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,     -- within a category
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_pub
  ON mothermode_kb_articles (published, category, sort_order);

-- ---------------------------------------------------------------------------
-- Changelog entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mothermode_changelog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version     TEXT,                                -- e.g. "1.4.0" (optional)
  released_on DATE NOT NULL DEFAULT current_date,
  entry_type  TEXT NOT NULL DEFAULT 'improved',    -- added | improved | fixed | removed
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,                       -- trusted admin markdown/HTML
  published   BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT
);

CREATE INDEX IF NOT EXISTS idx_changelog_pub
  ON mothermode_changelog (published, released_on DESC);

-- ---------------------------------------------------------------------------
-- RLS: anon reads published only; service role does everything.
-- ---------------------------------------------------------------------------
ALTER TABLE mothermode_kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published mothermode_kb_articles" ON mothermode_kb_articles
  FOR SELECT USING (published = true);

CREATE POLICY "Public read published mothermode_changelog" ON mothermode_changelog
  FOR SELECT USING (published = true);

-- Writes (and reading drafts) happen only through the admin API with the
-- service role, which bypasses RLS. No anon insert/update/delete policies.
CREATE POLICY "Service role full access mothermode_kb_articles" ON mothermode_kb_articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access mothermode_changelog" ON mothermode_changelog
  FOR ALL TO service_role USING (true) WITH CHECK (true);
