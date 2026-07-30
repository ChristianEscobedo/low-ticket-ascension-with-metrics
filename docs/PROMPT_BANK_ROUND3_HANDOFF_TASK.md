# Prompt Bank: Round 3 Handoff — Pick Up Where We Left Off

**Read this first if you are resuming the prompt-bank work.** Rounds 1, 2,
3 (both halves), 4, and 5 (email ascension) are shipped in code and
verified. One database step is still pending before the bank goes live.

---

## 1. Current state (shipped and verified)

**233 prompts total** across three groups, all in code, tested, and typed:

| Group | Count | Where |
| --- | --- | --- |
| Text frameworks | 147 | `promptBank.ts` (base + round 1) + `promptBankRound2.ts` + `promptBankRound3.ts` + `promptBankRound4.ts` + `promptBankRound5.ts` |
| Image recipes | 72 | `imagePromptBank.ts` (round 1) + `imagePromptBankRound2.ts` + `imagePromptBankRound3.ts` + `imagePromptBankRound4.ts` + `imagePromptBankRound5.ts` |
| Styles | 14 | `promptStyles.ts` |

Round 2 added: 10 FB ad-copy frameworks, 8 FB ad image creatives, 8 YT
thumbnail frameworks, 8 LinkedIn organic text frameworks, 4 LinkedIn image
recipes, 4 IG carousel slide-role recipes, 8 ultra-long-form value-forward
structures.

Round 3 (the YouTube half) added: 8 `ytshort-` Shorts script frameworks, 8
`ytlong-` long-form script frameworks, 6 `ytad-` YouTube ad frameworks
(`kind: 'ad'`, goal clicks), and 10 `ytthumb-` viral thumbnail frameworks
(thumbnail sub-bank now 25). Five recipes carry the round-3 inputs bar
(ytshort-story-loop, ytlong-teardown-audit, ytlong-experiment-vlog,
ytlong-confession-hour, ytad-testimonial-ugc).

Round 3 (the TikTok half, round-4 files) added: 10 `ttshort-` TikTok script
frameworks (Stitch answer, comment reply, green screen receipt, voiceover
reset, running count, stopped doing, quiet method, ranked list, watch-me,
photo carousel), 6 `ttad-` Spark-style ad frameworks (`kind: 'ad'`, goal
clicks), and 8 `ttimg-` TikTok cover frameworks (the missing cover sub-bank
from the roadmap, `ig-fb-story` 9:16 preset). Five recipes carry the
round-4 inputs bar (ttshort-stitch-answer, ttshort-comment-reply,
ttshort-day-count, ttad-spark-proof, ttad-ugc-testimonial). All 8
cross-posted `ytshort-` frameworks now carry tiktok `platformNotes`, so no
`ttshort-` recipe near-duplicates a Short. Spec:
`PROMPT_BANK_TIKTOK_ROUND_TASK.md`.

Round 5 (the email ascension round) added: 8 `email-` sophisticated sends,
6 `emlf-` ultra-long-form value essays, 8 `embuy-` purchase + OTO nurture
frameworks (mapped to the email trigger taxonomy so every purchase gets a
next-offer nurture and a deep nurture follow-up, and OTO buyers get their
own welcome + ascension path), 4 `emgoal-` goal-driven frameworks (book a
call, attend event, reply, join), and 6 `emimg-` email image frameworks
(the `email-header` sub-bank). Eleven recipes carry the round-5 inputs
bar, including the custom `offer` and `goal` fields. The Email Kit gained
6 ascension frameworks (`email/frameworks/ascension.ts`) and the
trigger-to-recipe wiring: any kit email can carry a `frameworkRecipeId`
that steers its expand pass through the recipe's craft block (editor
picker, trigger-matched ordering, canvas hint chip; no migration). Spec:
`PROMPT_BANK_EMAIL_ROUND_TASK.md`.

Also shipped:

- **Test Lab** in `/admin/prompt-bank`: select any recipe, pick
  platform/format/offer, **Run test** generates one real piece through the
  actual generator and renders it in `PlatformPreview` (hook + image prompt +
  model shown). API: `POST /api/admin/mothermode-prompts/test`.
- **Dark admin theme** on the whole prompt bank page (matches other editors).
- **Image creative picker** in the Generate drawer (BatchPanel) on FB/IG/YT.
- **Docs:** `CONTENT_PROMPT_BANK_SYSTEM_PORT.md` (system of record),
  `PROMPT_BANK_1000_AND_TEST_LAB_TASK.md` (roadmap to ~1000).

**Verification state:** 45 bank tests green (`prompt-bank.test.ts`,
`image-prompt-bank.test.ts`) plus 26 `prompt-bank-actions` tests and 16
`email-kit` tests, `tsc --noEmit` clean. `node
scripts/seed-prompt-bank.cjs --dry` lists all 233.

## 2. THE ONE BLOCKER: migration not applied yet

The seed fails with `Could not find the 'kind' column of
'mothermode_prompt_recipes' in the schema cache` because migration
`20261029000000_mothermode_prompt_recipes_image_group.sql` has **not been run
against the database**. The service-role key cannot run DDL, so this must be
applied manually, once:

1. Open the Supabase dashboard → **SQL Editor**.
2. Paste the full contents of
   `supabase/migrations/20261029000000_mothermode_prompt_recipes_image_group.sql`
   and run it, then do the same for
   `supabase/migrations/20261030000000_mothermode_prompt_recipes_inputs.sql`
   (the custom-inputs column). (Or `supabase db push` if the project is
   CLI-linked.)
 3. Re-run the seed: `node scripts/seed-prompt-bank.cjs` → expect
    `upserted 233 recipes`.
 4. Spot-check: open `/admin/prompt-bank`, confirm the list shows 233 recipes
    across the framework / style / image / custom filters, and run one
    `emlf-` essay, one `embuy-` buyer email, one `emgoal-` goal email, and
    two `emimg-` images through the **Test lab**; then in the Email Kit
    editor, set a sequence trigger to Purchase and confirm the Bank
    framework picker sorts `embuy-` first and the canvas trigger node shows
    the hint chip.

If the table itself is missing (older DB), run
`20261028000000_mothermode_prompt_recipes.sql` first, then the 20261029 file.

## 3. What is next (round 6: community + engagement engines, when you are ready)

Round 3 was the **video-first** round, landed in two halves, and **both
halves are SHIPPED**. The YouTube half (spec:
`PROMPT_BANK_YOUTUBE_ROUND_TASK.md`): +10 `ytthumb-`, +16
`ytshort-`/`ytlong-`, +6 `ytad-`, 5 inputs-bar recipes, in
`promptBankRound3.ts` + `imagePromptBankRound3.ts`. The TikTok half (spec:
`PROMPT_BANK_TIKTOK_ROUND_TASK.md`): +10 `ttshort-`, +6 `ttad-`, +8
`ttimg-` covers, 5 inputs-bar recipes, in `promptBankRound4.ts` +
`imagePromptBankRound4.ts`, with tiktok `platformNotes` on all 8
cross-posted Shorts instead of near-duplicate recipes.

Round 5 was the **email ascension** round and is **SHIPPED** (spec:
`PROMPT_BANK_EMAIL_ROUND_TASK.md`): +8 `email-`, +6 `emlf-`, +8 `embuy-`,
+4 `emgoal-`, +6 `emimg-`, 11 inputs-bar recipes incl. the offer + goal
fields, in `promptBankRound5.ts` + `imagePromptBankRound5.ts`, plus the
Email Kit ascension frameworks and the `frameworkRecipeId` trigger wiring.
Count assertions updated (121→147 text, 66→72 image, ALL_SEED 187→219),
all suites + `tsc` green, dry-run seed lists all 233. The only remaining
step is the §2 migration apply + real seed (expect `upserted 233
recipes`).

**Round 6 is community + engagement engines** (per the roadmap
`PROMPT_BANK_1000_AND_TEST_LAB_TASK.md` §4): FB group programming (weekly
rhythms, prompts, challenges), reply-bait comment strategies, UGC prompt
campaigns. Same two-file round pattern, same quality bar. Remaining
commerce gaps for a later commerce round: cart-abandonment bank recipes,
win-back variants, seasonal pushes, per-stage ad variants. Candidate image
companions: `ximg-` X cards, `pinimg-` Pinterest pins, `blimg-` blog/AEO
headers.

Follow-up backlog (any order):

- ~~**Test Lab output actions**~~ SHIPPED: all six actions plus the changes
  field live in the Test lab (`promptBankActions.ts` +
  `tests/lib/prompt-bank-actions.test.ts`, 17 tests). Spec:
  `PROMPT_BANK_TEST_ACTIONS_TASK.md`. One v1 deferral remains on the list
  below: sequence-to-Planner series mapping.
- ~~**Custom input fields (recipe.inputs)**~~ SHIPPED: extended input/output
  context on 18 story/lesson recipes. Admin fills fields in the Test lab or
  the Generate drawer; filled values ground the output via
  `recipeInputsBlock`. Editor manages the field defs. NOTE: needs migration
  `20261030000000_mothermode_prompt_recipes_inputs.sql` applied (same manual
  step as §2: paste in the Supabase SQL editor, then re-seed). Tests: 8 new
  cases in `tests/lib/prompt-bank.test.ts`.
- ~~**Generator-surface pickers + debt cleanup**~~ SHIPPED: one shared
  `usePromptBankRecipes()` hook (live merged bank, module-level cache) plus a
  `<FrameworkPicker>` (toggle + fits-first selector + Your material fields)
  on the Generate drawer (chips swapped for live data), the rewrite tabs
  (RewriteField + HookVariants), the Amplify/Refine command box, and both
  image stages (version composer scenes + Variation Lab brief). `framework` /
  `recipeInputs` now ride rewrite, amplifyParts, amplify, imagePrompts, and
  variationBrief end to end; `scripts/add-recipe-inputs.cjs` is deleted.
  Tests: 5 `orderRecipesForPicker` cases in
  `tests/lib/prompt-bank-actions.test.ts`. Spec:
  `PROMPT_BANK_GENERATOR_PICKERS_TASK.md`. NOTE: the two migrations in §2
  still need the same manual apply + re-seed.
- Sequence-to-Planner series mapping: map a Test lab sequence draft onto
  planner cards via the `AddPlanCard` plumbing (the spec's noted v2, deferred
  from the pickers task's optional stretch).
- Framework performance rollups once ad metrics key off
  `ContentPiece.framework`.
- Image bank for more channels: `ximg-` X cards, `pinimg-` Pinterest pins,
  `blimg-` blog/AEO headers.

## 4. Working agreements (keep the bar)

- Every recipe: full whyItWorks (3), {Slot} template, 2 examples, craft,
  platforms/formats, goal. Voice-safe (no em/en dashes, no NO-list stems).
  Image recipes also: `kind`, valid `sizePresetIds`, explicit
  no-baked-in-text rule.
- Tests assert counts per sub-bank — a sloppy round cannot merge.
- Quality over volume toward 1000: hand-check every entry, spot-check 3-5 per
  round in the Test lab before seeding.
