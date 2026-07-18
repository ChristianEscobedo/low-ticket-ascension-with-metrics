-- Buyer-entered data for interactive resource documents (the Brain Dump
-- Template, Weekly Reset, Delegate Scripts tracker, Load Map builder). One
-- row per (offer slug, resource key, buyer email, period). "Period" lets a
-- buyer keep a running history for recurring resources (a new row per week)
-- while single-instance resources (Load Map, Delegate Scripts) just use the
-- fixed period_key 'ongoing'.
--
-- Email is self-reported (captured at checkout into localStorage, or typed
-- directly into a resource page), not authenticated. This mirrors the rest
-- of the funnel, which has no buyer login. RLS is enabled with zero grants,
-- so only the service role (used exclusively by the API route below) can
-- read or write; the anon key has no access at all.

CREATE TABLE IF NOT EXISTS mothermode_resource_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  key TEXT NOT NULL,
  email TEXT NOT NULL,
  period_key TEXT NOT NULL DEFAULT 'ongoing',
  period_label TEXT NOT NULL DEFAULT 'Ongoing',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (slug, key, email, period_key)
);

CREATE INDEX IF NOT EXISTS idx_mothermode_resource_entries_lookup
  ON mothermode_resource_entries (slug, key, email);

ALTER TABLE mothermode_resource_entries ENABLE ROW LEVEL SECURITY;
-- No policies: RLS enabled with zero grants denies all anon/authenticated
-- access. Only the service-role client (used by /api/mothermode/resource-entries)
-- can read or write this table.
