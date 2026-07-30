-- Image prompt bank: third recipe group for the programmable prompt bank.
--
-- The code registry imagePromptBank.ts ships A-level image creative
-- frameworks (Facebook ad creatives, Instagram organic images, YouTube
-- thumbnails) with the same seed/override semantics as the text bank: a DB
-- row whose slug matches a code seed overrides it, deleting the row restores
-- the code default. This migration widens the recipe_group check to allow
-- 'image' and adds the two image-specific columns (organic vs ad placement,
-- platform size preset ids) the image recipes carry.
--
-- RLS is unchanged: admin-only, service role does all reads and writes.

alter table mothermode_prompt_recipes
  drop constraint if exists mothermode_prompt_recipes_recipe_group_check;
alter table mothermode_prompt_recipes
  add constraint mothermode_prompt_recipes_recipe_group_check
  check (recipe_group in ('framework', 'style', 'image'));

-- Organic vs paid placement. Null on text frameworks and styles; image
-- recipes and ad-copy frameworks set it.
alter table mothermode_prompt_recipes
  add column if not exists kind text
  check (kind in ('organic', 'ad'));

-- Platform size preset ids (platformSizes.ts) an image recipe renders at.
alter table mothermode_prompt_recipes
  add column if not exists size_presets jsonb not null default '[]'::jsonb;
