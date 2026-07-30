-- ============================================================================
-- Tracked links can point at a LEAD MAGNET (optin funnel) step, not just a
-- sales funnel step.
--
-- WHY A SECOND FK COLUMN AND NOT A POLYMORPHIC destination_id
-- -----------------------------------------------------------
-- The obvious shape is `destination_kind TEXT + destination_id UUID`. It was
-- rejected: a polymorphic id cannot carry a foreign key, so deleting an optin
-- funnel would leave live /go/<code> links pointing at a funnel that no longer
-- exists. The original table chose ON DELETE CASCADE precisely so retiring a
-- funnel retires its links; a polymorphic column silently trades that for
-- 404s discovered by traffic. Two nullable FKs + a CHECK keeps integrity, at
-- the cost of one column per destination kind -- an acceptable trade while the
-- kinds are countable on one hand.
--
-- Resource / deliverable entries are deliberately NOT added here: they have no
-- public route to send traffic to (they live behind purchase), so a picker for
-- them would mint links that 404. Those stay on the destination_url escape
-- hatch until a public resource page exists.
-- ============================================================================

ALTER TABLE mothermode_utm_links
  ADD COLUMN IF NOT EXISTS optin_funnel_id UUID
    REFERENCES mothermode_optin_funnels(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mm_utm_links_optin_funnel
  ON mothermode_utm_links(optin_funnel_id);

-- A link has ONE destination. Both set would make funnel_page ambiguous (the
-- page vocabularies differ: 'checkout'/'upsell1' vs 'oto'/'thank-you') and the
-- redirect would have to guess. Zero set is still legal -- that's the external
-- destination_url case, which predates this migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mm_utm_links_one_destination'
  ) THEN
    ALTER TABLE mothermode_utm_links
      ADD CONSTRAINT mm_utm_links_one_destination
      CHECK (funnel_id IS NULL OR optin_funnel_id IS NULL);
  END IF;
END $$;

-- The uniqueness guarantee has to learn about the new column, or the same piece
-- pointed at a sales funnel and at an optin funnel with otherwise identical
-- UTMs would collide on the old index and be rejected as a duplicate. Same
-- COALESCE trick as the original: NULL would otherwise defeat the check.
DROP INDEX IF EXISTS idx_mm_utm_links_unique_combo;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_utm_links_unique_combo
  ON mothermode_utm_links (
    COALESCE(funnel_id::text, ''),
    COALESCE(optin_funnel_id::text, ''),
    funnel_page,
    utm_source, utm_medium, utm_campaign, utm_content
  );

COMMENT ON COLUMN mothermode_utm_links.optin_funnel_id IS
  'Lead-magnet (optin funnel) destination. Mutually exclusive with funnel_id; funnel_page then holds an optin step: '''' (step 1) | ''oto'' | ''thank-you''.';
