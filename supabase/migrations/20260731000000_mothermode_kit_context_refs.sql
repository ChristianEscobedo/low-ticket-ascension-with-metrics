-- Two-way context bridge: give the community, high-ticket, and lead-gen admin
-- kits the same `context_refs` column the email kit already carries. Each ref is
-- a cheap pointer (kind + id, or an inline link/text value) that the generator
-- resolves into a live ContextPack at generation time, so a kit can be built
-- AROUND an owner asset (an offer, another kit) without duplicating its facts.
--
-- JSONB array, defaulting to an empty list so existing rows stay valid. Mirrors
-- mothermode_email_kits.context_refs exactly.

ALTER TABLE mothermode_community_kits
  ADD COLUMN IF NOT EXISTS context_refs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE mothermode_high_ticket_kits
  ADD COLUMN IF NOT EXISTS context_refs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE mothermode_lead_gen_kits
  ADD COLUMN IF NOT EXISTS context_refs JSONB NOT NULL DEFAULT '[]'::jsonb;
