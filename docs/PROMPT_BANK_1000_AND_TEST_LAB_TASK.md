# Prompt Bank: Road to ~1000 Prompts + Test Lab — Task Doc

**Status:** Round 5 shipped (233 prompts total: round 3 in two halves +56, round 5 email ascension +32) + Test Lab shipped + Test Lab output actions shipped
**Surfaces:** `/admin/prompt-bank` (editor + test lab), all content generators, `mothermode_prompt_recipes` table

---

## 1. The goal

Build the MotherMode prompt bank to roughly **1000 A-level, platform-specific
prompts** across text frameworks and image creative frameworks, without ever
dropping the quality bar. We build in rounds. Each round targets the biggest
platform/format gaps first, ships with tests, and gets seeded into
`mothermode_prompt_recipes` so it is programmable from `/admin/prompt-bank`.

**Progress:**

| Round | Added | Total | Contents |
| --- | --- | --- | --- |
| 1 | 95 | 95 | 30 base frameworks, 27 platform-specific frameworks, 24 image recipes (9 FB ads, 8 IG organic, 7 YT thumbs), 14 styles |
| 2 | 50 | 145 | +10 FB ad copy, +8 FB ad image, +8 YT thumbs, +8 LinkedIn organic text, +4 LinkedIn image, +4 IG carousel slide roles, +8 ultra long-form |
| 3 (YouTube half) | 32 | 177 | +10 `ytthumb-` viral thumbnails, +8 `ytshort-` Shorts, +8 `ytlong-` long-form, +6 `ytad-` YouTube ads |
| 3 (TikTok half) | 24 | 201 | +10 `ttshort-` TikTok scripts, +6 `ttad-` Spark-style ads, +8 `ttimg-` TikTok covers |
| 5 (email ascension) | 32 | 233 | +8 `email-` sophisticated sends, +6 `emlf-` essays, +8 `embuy-` buyer/OTO nurture, +4 `emgoal-` goal-driven, +6 `emimg-` email images (+ kit frameworks + trigger wiring) |

## 2. The taxonomy (how 1000 stays organized)

Recipes share one shape (`PromptRecipe`) and three groups. Ids are prefixed by
sub-bank so the bank stays scannable at any size:

- **framework** (text post structures)
  - Base viral frameworks (no prefix): personal-story, headline-list, ...
  - Platform-specific: `x-`, `fb-` (organic), `fb-ad-` (paid), `ig-`,
    `tiktok-`, `yt-`, `li-`, `pin-`, `email-`, `blog-`, `aeo-`
  - Long-form value-forward: `lf-`
- **style** (voices from promptStyles.ts)
- **image** (visual creative frameworks)
  - `fbad-` Facebook ad creatives (kind 'ad')
  - `igorg-` Instagram organic stills
  - `igcar-` Instagram carousel slide roles (cover / teach / proof / cta)
  - `ytthumb-` YouTube thumbnail CTR structures
  - `liimg-` LinkedIn organic images
  - `ttimg-` TikTok cover images (round 3, TikTok half)
  - `emimg-` email header/section images (round 5)
  - Future: `ximg-` (X cards), `pinimg-` (Pinterest pins), `blimg-` (blog/AEO
    headers)

Registry files mirror the same split: `promptBank.ts` (base + platform round
1), `promptBankRound2.ts`, `imagePromptBank.ts`, `imagePromptBankRound2.ts`,
merged into `PROMPT_RECIPES` / `IMAGE_PROMPT_RECIPES`. **Round 3+ follows the
same pattern** (`promptBankRound3.ts`, `imagePromptBankRound3.ts`) so no
single file outgrows review.

## 3. The quality bar (non-negotiable, enforced by tests)

Every recipe, every round:

- Full `whyItWorks` (3 bullets), `{Slot}` template, 2 MotherMode-adapted
  examples, direct craft orders, platforms/formats, goal.
- Voice-safe: no em/en dashes, no NO-list stems (mompreneur, girlboss,
  supermom, glow-up, wine mom), calibration after bold claims, permission
  close, soft CTA (direct-but-warm on ads).
- Image recipes additionally: `kind` set, valid `sizePresetIds`, and an
  explicit no-baked-in-text rule (words always go on with the overlay editor).
- Tests assert counts per sub-bank, unique ids, and the brand lock, so a
  sloppy round cannot merge.

## 4. Round 3 and beyond (the gap map)

Highest-value next rounds, in order:

1. **Round 3 — video-first: SHIPPED in two halves.** YouTube half:
   `ytthumb-` viral thumbnails, `ytshort-` Shorts + `ytlong-` long-form
   scripts, `ytad-` YouTube ads (`PROMPT_BANK_YOUTUBE_ROUND_TASK.md`).
   TikTok half: `ttshort-` TikTok scripts, `ttad-` Spark-style ads,
   `ttimg-` TikTok cover images (`PROMPT_BANK_TIKTOK_ROUND_TASK.md`).
   (Remaining from this bullet: TikTok/Reel spoken-hook menu expansions,
   story-format frameworks for FB/IG story sequences.)
2. **Round 4/5 — commerce + email depth: SHIPPED as the email ascension
   round** (`PROMPT_BANK_EMAIL_ROUND_TASK.md`): sophisticated `email-`
   frameworks, `emlf-` ultra-long-form essays, `embuy-` purchase + OTO
   nurture (next-offer + deep nurture per purchase, OTO welcome +
   ascension per upsell), `emgoal-` goal-driven emails with custom
   offer/goal fields, `emimg-` email images, plus 6 Email Kit ascension
   frameworks and the `frameworkRecipeId` trigger wiring. (Remaining from
   these bullets: cart-abandonment bank recipes, win-back variants,
   seasonal pushes, per-stage ad variants, AEO question families, SEO
   supporting-post structures.)
3. **Round 6 — community + engagement engines:** FB group programming
   (weekly rhythms, prompts, challenges), reply-bait comment strategies,
   UGC prompt campaigns.
4. **Rounds 7+ — depth per platform:** each platform's frameworks expanded
   toward 50-100 each (X cards `ximg-`, Pinterest pin image bank `pinimg-`,
   blog/AEO header bank `blimg-`), plus style variants per framework
   (tonal registers of the winners).

Working estimate: ~150-250 recipes per round lands 1000 around round 6-7
while keeping every entry hand-checked.

## 5. The Test Lab (shipped)

`/admin/prompt-bank` → select any recipe → **Test lab** panel:

- Platform + format selects (defaulted from the recipe, overridable), offer
  select, **Run test**.
- `POST /api/admin/mothermode-prompts/test` resolves the recipe from the
  merged bank (code seeds + DB overrides) and runs the real batch generator
  with `style` (framework/style recipes) or `imageFramework` (image recipes),
  count 1, kind from the recipe.
- The result renders in the actual platform chrome via `PlatformPreview`,
  with the hook, the full image prompt the recipe produced, and the model
  used. Works for testing disabled recipes and DB-overridden edits before
  they go live.
- **Output actions (shipped, `PROMPT_BANK_TEST_ACTIONS_TASK.md`):** the test
  result is a workbench. Composed hook-anchored image prompt with Copy, Add
  hook/prompt as example (dedupe + 6-cap, saved back to the recipe), Save to
  the generated library, Changes field with per-field rewrites + revision
  stack (v1/v2/v3 + restore), Lead magnet from post (seeds the Lead Gen Kit,
  deep-links to `/admin/lead-gen?kit=<id>`), Create sequence (3-5 post
  content funnel via the test route's `action: 'sequence'` + funnel-arc
  guide, per-piece previews, save-all), and Remix into prompt (new custom
  recipe drafted from the output, always unsaved for human review). Helpers:
  `src/lib/mothermode/content/promptBankActions.ts`; tests:
  `tests/lib/prompt-bank-actions.test.ts`.
- **Custom input fields (shipped):** 18 story/lesson/experience recipes
  declare `inputs` (RecipeInputField: the ask, an example placeholder, an
  output steer). The Test lab and the Generate drawer render them; filled
  values ground the output via `recipeInputsBlock`, blank falls back to the
  offer facts. Editor manages the defs; migration `20261030000000` adds the
  column. Round 3+ recipes may declare inputs where real material improves
  output (same quality bar: voice-safe label + placeholder, tested).

## 6. Operating rhythm

1. Author a round (new registry file, merged into the banks).
2. Update the count tests + sub-bank assertions; `npx vitest run
   tests/lib/prompt-bank.test.ts tests/lib/image-prompt-bank.test.ts` and
   `npx tsc --noEmit` must pass.
3. `node scripts/seed-prompt-bank.cjs --dry` to review, then seed for real
   (after the DB has the current migrations).
4. Spot-check 3-5 recipes per round in the Test lab: one FB ad, one IG, one
   YT thumb minimum, and eyeball the platform preview for voice + structure.
5. Update `docs/CONTENT_PROMPT_BANK_SYSTEM_PORT.md` counts and this doc's
   round table.

## 7. Explicit non-goals (for now)

- No auto-generated recipes by AI into the bank (quality is hand-checked per
  entry; the Test lab is the human review loop).
- No performance rollups per recipe yet (needs `ContentPiece.framework`
  keyed ad metrics; already a follow-up in the system port doc).
