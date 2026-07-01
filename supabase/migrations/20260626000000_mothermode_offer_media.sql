-- MotherMode sales-page image overrides. One row per (offer slug, image slot)
-- holding the published image URL. Read publicly so every buyer sees the image;
-- written only by the service role through the admin API.

-- ============================================
-- MOTHERMODE OFFER MEDIA
-- ============================================
CREATE TABLE IF NOT EXISTS mothermode_offer_media (
  slug TEXT NOT NULL,
  slot TEXT NOT NULL,
  url TEXT NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (slug, slot)
);

CREATE INDEX IF NOT EXISTS idx_mothermode_offer_media_slug ON mothermode_offer_media(slug);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE mothermode_offer_media ENABLE ROW LEVEL SECURITY;

-- Buyers (and the anon server render) read published image URLs.
CREATE POLICY "Public read mothermode_offer_media" ON mothermode_offer_media
  FOR SELECT USING (true);

-- Writes happen only through the admin API with the service role. The service
-- role bypasses RLS; the explicit policy is kept for clarity.
CREATE POLICY "Service role full access mothermode_offer_media" ON mothermode_offer_media
  FOR ALL TO service_role USING (true) WITH CHECK (true);
