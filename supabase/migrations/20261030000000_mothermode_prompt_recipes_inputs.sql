-- Prompt bank custom input fields: per-recipe fields the admin fills in at
-- generation time (Test lab, or an explicit pick in the Generate drawer) for
-- extended input/output context. Example: a personal-story recipe asks
-- "Your story in 2-3 sentences" and the filled value grounds the output in
-- real material instead of invented specifics.
--
-- Shape: jsonb array of { id, label, placeholder?, hint?, required? }.
-- Same seed/override semantics as every other recipe column: a DB row whose
-- slug matches a code seed overrides it, deleting the row restores the code
-- default. RLS is unchanged: admin-only, service role does all reads and
-- writes.

alter table mothermode_prompt_recipes
  add column if not exists inputs jsonb not null default '[]'::jsonb;
