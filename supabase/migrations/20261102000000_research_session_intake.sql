-- Research Lab onboarding: the research brief a session searches WITH.
--
-- An offer name is not a research query (a low-ticket product has no public
-- footprint), so sessions carry an intake brief: goal, audience, problem and
-- category keywords, competitor products + voices, subreddits, seed links.
-- The suggest-intake / find-context flows draft it; the agent's system prompt
-- reads it. See docs/RESEARCH_LAB_SYSTEM_PORT.md.

alter table public.mothermode_research_sessions
  add column if not exists intake jsonb not null default '{}'::jsonb;

comment on column public.mothermode_research_sessions.intake is
  'Research brief (ResearchIntake JSON): goal, audience, problemKeywords, categoryKeywords, competitorProducts, competitorVoices, subreddits, seedLinks.';
