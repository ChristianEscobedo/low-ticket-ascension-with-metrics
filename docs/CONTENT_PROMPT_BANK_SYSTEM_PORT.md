# Prompt Bank System Port

**Status:** Shipped (round 5: 233 prompts total: 147 frameworks + 72 image recipes + 14 styles; Test Lab, output actions, custom input fields, and generator-surface pickers shipped)
**Owner surface:** Content hub Generate drawer, all text and image generators, `/admin/prompt-bank`
**DB table:** `mothermode_prompt_recipes` (migrations `20261028000000_mothermode_prompt_recipes.sql`, `20261029000000_mothermode_prompt_recipes_image_group.sql`, `20261030000000_mothermode_prompt_recipes_inputs.sql`)
**Roadmap doc:** `docs/PROMPT_BANK_1000_AND_TEST_LAB_TASK.md` (road to ~1000 prompts)

## What this is

A programmable bank of A-level, platform-specific post frameworks that drives
every text generator in the content hub, plus a parallel bank of A-level image
creative frameworks that drives image-prompt generation. Each recipe mirrors
the owner's swipe-file format (Why it works -> Template with {Slots} ->
Examples) and adds generation orders (`craft`), per-platform execution notes,
and MotherMode-adapted exemplar openers. The code registry is the
version-controlled seed; database rows make every recipe editable, toggleable,
and extensible at runtime.

## The text bank (147 builtin frameworks)

Round 5 (the email ascension round, `promptBankRound5.ts`, spec
`PROMPT_BANK_EMAIL_ROUND_TASK.md`) added 26 email frameworks in four
families: 8 `email-` sophisticated sends (founder letter, teach
everything, story receipt, objection FAQ, honest last call, quick win,
open-loop tease, PS close), 6 `emlf-` ultra-long-form value essays
(ultimate guide, deep dive, research report, masterclass, encyclopedia,
serial chapter), 8 `embuy-` purchase + OTO nurture frameworks mapped to
the email trigger taxonomy (welcome receipt, first win, next-offer seed,
deep nurture arc, OTO welcome, OTO ascend, refund save, review ask), and 4
`emgoal-` goal-driven frameworks (book a call, attend event, reply survey,
community join). All `platforms: ['email']`, `formats: ['email']`, organic
(no `kind`). Eleven declare the round-5 inputs bar, including the custom
`offer` field (every ascension + offer-pointing recipe) and the custom
`goal` field (the whole `emgoal-` family). The Email Kit gained 6 matching
ascension frameworks (`buyer-welcome`, `ascension-bridge`, `deep-nurture`,
`oto-ascend`, `goal-driven`, `ps-close` in
`email/frameworks/ascension.ts`), and any kit email can now carry a
`frameworkRecipeId` that steers its expand pass through the recipe's craft
block (see "Email kit trigger wiring" below).

Round 4 (the TikTok half of the video-first round, `promptBankRound4.ts`)
added 16 frameworks: 10 `ttshort-` TikTok scripts (5 viral: stitch answer,
comment reply, green screen receipt, voiceover reset, running count; 5
value: stopped doing, quiet method, ranked list, watch-me, photo carousel)
and 6 `ttad-` TikTok ads (Spark proof post, UGC testimonial, native
problem-first, real-time demo, genuine question, $7 stack; all `kind:
'ad'`, goal clicks, formats `['video', 'reel']`), all `platforms:
['tiktok']`. Five declare the round-4 inputs bar (ttshort-stitch-answer,
ttshort-comment-reply, ttshort-day-count, ttad-spark-proof,
ttad-ugc-testimonial). The 8 cross-posted `ytshort-` frameworks all carry
tiktok `platformNotes` now, so no `ttshort-` recipe near-duplicates a
Short.

Round 3 (the YouTube round, `promptBankRound3.ts`) added 22 script
frameworks: 8 `ytshort-` Shorts (formats `['reel']`), 8 `ytlong-` long-form
(formats `['long']`), and 6 `ytad-` YouTube ads (`kind: 'ad'`, goal clicks,
formats `['long', 'reel']`), all `platforms: ['youtube']`. Five declare the
round-3 inputs bar (ytshort-story-loop, ytlong-teardown-audit,
ytlong-experiment-vlog, ytlong-confession-hour, ytad-testimonial-ugc).

`src/lib/mothermode/content/promptBank.ts` — the owner's 17 requested
frameworks (Questions+proof, Personal story, Analogies, Current events,
Normalize X, Experience lessons, Bragging, Challenge beliefs, Confident
directives, Feel good, Headline+list, Highly actionable, Comparisons, Niched
entertainment, Do-this-not-that, Formula for X, 80/20 rule), 13
platform-native additions (How I went from X to Y — with the owner's exact
template and 8 reference tweets, I did X for N days, Start over, Mistakes,
Harsh truths, Teardown, Named method, Receipts, Myth vs truth, Signs you are
X, Open-loop storytime, Letter to my younger self, Aphorism), plus **27
channel-specific frameworks** engineered for one platform's native mechanics
each: X thread blueprint / hot take / bookmark bomb, FB colorblock
conversation / group question, 4 FB ad-copy frameworks (PAS,
Before-After-Bridge, UGC proof, Offer stack, all marked `kind: 'ad'`), IG
carousel classroom / reel loop / send-to-a-friend, TikTok 3-second hook / POV
skit / storytime loop, YT title+thumbnail pair / retention intro / value
density, LinkedIn line-break essay / data pattern / working-mother reframe,
Pinterest SEO how-to / listicle saves, Email subject+preheader / open-loop
story, Blog SEO listicle, AEO answer capsule. Round 2 (`promptBankRound2.ts`)
adds 26 more: 10 FB ad-copy frameworks (question hook, stat first, myth
buster, checklist, founder note, objection flip, price anchor, proof wall,
demo script, one big idea, all `kind: 'ad'`), 8 LinkedIn organic frameworks
(case study, poll insight, document teach, myth retirement, operating
principle, week review, hiring lens, translation table), and 8 ultra
long-form value-forward structures (ultimate guide, deep-dive system,
encyclopedia, serial chapter, research report, masterclass, framework
application, exhaustive list).

`PromptRecipe`: id, label, hint, group (framework|style|image), goal
(replies|saves|shares|follows|clicks), whyItWorks[], template, exampleHooks[],
craft, platforms[], formats[], kind? (organic|ad), sizePresetIds?[],
platformNotes{}, sourceUrls[], inputs?[] (custom input fields), builtin,
enabled.

### Custom input fields (recipe.inputs, shipped)

Extended input/output context: a recipe can declare `inputs`, an array of
`RecipeInputField { id, label, placeholder?, hint?, required? }` the admin
fills in before a run so the output grounds in real material instead of
invented specifics. Example: personal-story asks "Your story in 2-3
sentences"; journey-flex asks for the crappy before, the impressive after,
and the mechanism. Filled values compose via `recipeInputsBlock(recipe,
values)` (pure, in promptBank.ts) into a "User-supplied material" block
injected right after the craft block, with each field's `hint` steering how
the model uses the value. Always optional: empty fields are skipped and the
model invents from the offer facts, so Auto rotation and unattended batches
never break. 18 story/lesson/experience-family recipes carry curated inputs
(personal-story, experience-lessons, journey-flex, experiment-recap,
start-over, mistakes, harsh-truths, teardown, named-method, receipts, brag,
open-loop, letter-younger, current-events, challenge-beliefs, normalize-x,
tiktok-storytime-loop, analogy). The 20261030000000 migration adds the
`inputs jsonb` column; the store round-trips it with a defensive normalizer
(`asInputFields`: id + label required, optional keys present-only).
Surfaces: the Test lab renders the fields under the test controls
(`inputValues` in the test route body), the Generate drawer renders them when
an explicit framework chip with inputs is picked (`recipeInputs` through
`/api/mothermode/content/generated` into `BatchInput.recipeInputs`), and the
prompt-bank editor manages the field defs themselves (add/edit/remove: the
ask, the id, the placeholder, the output steer, the expected flag).

## The image bank (72 builtin image recipes)

Round 5 (`imagePromptBankRound5.ts`) added 6 `emimg-` email image
frameworks, the email sub-bank from the roadmap: calm header, offer hero,
receipt proof, welcome scene, event card (date-safe zone), and the minimal
divider. All are brand-locked, type-ready compositions on the
`email-header` preset (1200x600, 2:1) composed to read at 600px wide
inside an email client, `kind: 'organic'`, goal clicks.

Round 4 (`imagePromptBankRound4.ts`) added 8 `ttimg-` TikTok cover
frameworks, the missing cover sub-bank from the roadmap: title field,
series hero, before-after split, telling object, hands mid-method, count
row, quiet scene, receipt close-up. All are brand-locked, type-ready 9:16
compositions on the `ig-fb-story` preset (1080x1920) with TikTok chrome
safe zones (bottom quarter and right rail stay quiet; the title zone lives
upper-middle left), `kind: 'organic'`, goal clicks.

Round 3 (`imagePromptBankRound3.ts`) added 10 `ytthumb-` viral thumbnail
frameworks: contrast marker, curiosity-gap object, split decision, countdown
still, documentary grab, empty chair, prop confession, scale contrast,
then-now map, and confessional light. All are brand-locked, type-ready
compositions (no baked-in text; the overlay editor carries the words) on the
`yt-thumb` preset, taking the thumbnail sub-bank from 15 to 25.

`src/lib/mothermode/content/imagePromptBank.ts` — same `PromptRecipe` shape
with `group: 'image'`, but the template is an image-generation scene skeleton
with {Slots}, the craft is art direction, and exampleHooks are complete filled
prompts. Seven sub-banks:

- **Facebook ad creatives** (`fbad-*`, kind 'ad', goal clicks, ad size
  presets): pattern interrupt, before-after split, product hero, UGC native,
  type-ready card, proof receipt, versus face-off, offer flat lay, brand
  color field.
- **Instagram organic images** (`igorg-*`, kind 'organic'): single-object
  story, cinematic quiet moment, flat-lay system, carousel cover space, hands
  at work, before-after frame, quote-ready scene, POV candid.
- **YouTube thumbnails** (`ytthumb-*`, kind 'organic', yt-thumb 1280x720):
  curiosity scene, result hero, before-after split, big-number hero, versus
  face-off, peak moment, and the opt-in face close-up (the only recipe that
  allows a face, reserved for a real person on file). Round 2 adds: checklist
  hero, 30-day timeline, minimal object, physical chart, mirror split, offer
  stack, myth busted, day in the life.
- **LinkedIn organic images** (`liimg-*`, round 2): quote card, document
  cover, process diagram, calm desk.
- **Instagram carousel slide roles** (`igcar-*`, round 2): numbered cover,
  teaching slide, proof slide, CTA slide, one visual language per carousel.
  Round 2 also adds 8 FB ad creatives: question card, ticked list,
  handwritten note, phone in hand, mechanism sketch, quote card, circled
  date, page in hand.
- **TikTok covers** (`ttimg-*`, round 4, kind 'organic', ig-fb-story
  1080x1920): title field, series hero, before-after split, telling object,
  hands mid-method, count row, quiet scene, receipt close-up.
- **Email images** (`emimg-*`, round 5, kind 'organic', email-header
  1200x600): calm header, offer hero, receipt proof, welcome scene, event
  card, divider rule.

Every image recipe locks the brand rules: renders stay clean of baked-in text
(words go on later with the overlay editor), faces stay soft or absent unless
the recipe opts in, palette stays warm bone / deep aubergine / aged brass.
`imageRecipeCraftBlock(recipe, platform?)` composes the full art-direction
block (craft + skeleton + why + platform note + target sizes from
`platformSizes.ts` + examples + the IMAGE_STYLE art-direction lock).
`imageRecipesFor(platform?, kind?)` filters for pickers.

## How generators use it

- **Batch (Generate drawer):** `resolveBankForBatch` in
  `src/utils/integrations/openai-content.ts`. An explicit framework chip
  injects `recipeCraftBlock` (craft + template + why + platform note + example
  openers). **Auto + Distinct-posts mode rotates** a different fitting
  framework onto every piece (`FRAMEWORK ROTATION (strict)` block), so a batch
  of 5 is 5 proven structures, not 5 rewords. The JSON schema requires
  `"framework"` per piece; `normalizePiece` stores it on `ContentPiece.framework`
  and the review list badges it.
- **Rewrite:** `RewriteInput.framework` restructures a hook/caption/body
  through the recipe.
- **Amplify:** `AmplifyTextInput.framework` / `AmplifyPartsInput.framework`
  shape hooks/angles/CTAs/bodies through the recipe.
 - **Voice safety:** recipes are pre-fitted to the voice (calibration,
   permission close, no NO-list words, no em dashes) and the hard-coded
   VOICE_RULES always win, so no admin edit can break brand compliance.
 - **Image stages:** `BatchInput.imageFramework` injects the image recipe's
   craft block into the batch prompt's `VISUAL CREATIVE FRAMEWORK (strict)`
   line so every `media.prompt` executes it; `ImagePromptsInput.imageFramework`
   (Amplify two-stage image pipeline) and `VariationBriefInput.imageFramework`
   (Variation Lab brief conversion) do the same. Resolution goes through
   `resolveImageRecipeById` (enabled, group-checked); an image recipe id in
   the text `style` slot is ignored, so image recipes never leak into copy.

## Programmability (DB-over-seed merge)

- `src/lib/mothermode/content/promptBankStore.ts` (server-only):
  `ALL_SEED_RECIPES` (147 frameworks + 72 image recipes) is the seed pool.
  `resolveAllRecipes()` merges `mothermode_prompt_recipes` rows over the code
  seeds (same slug = override incl. `enabled`; new slug = custom recipe),
  `resolveEnabledRecipes()` is the generator pool, `resolveImageRecipeById`
  (group-checked image lookup), `upsertRecipe`, `deleteRecipeRow` (delete a
  builtin row = reset to code default), `setRecipeEnabled`. Every read
  degrades to the code registry when the table is absent or Supabase is
  unconfigured, so generation never hard-fails.
- `/api/admin/mothermode-prompts` (GET merged bank, POST upsert, DELETE
  ?slug= reset/delete), behind `requireAdminRoute`. RLS: no public policies;
  service role only. The `20261029000000` migration widened `recipe_group`
  to allow 'image' and added the `kind` + `size_presets` columns.
- `scripts/seed-prompt-bank.cjs` upserts the 147 frameworks + 72 image recipes
  + 14 styles (`node scripts/seed-prompt-bank.cjs`, `--dry` to preview).
- `/admin/prompt-bank` (`page.tsx` + `PromptBankEditor.tsx`, sidebar link):
  search/filter/group (framework / style / **image** / custom), enable
  toggles, full-field editing with platform/format chips and per-platform
  notes, enable/disable, reset-to-default, custom recipes, copy assembled
  prompt, and a live assembled-prompt preview per platform. Image recipes get
  the placement-kind select, the size-preset toggles, image-aware field
  labels (prompt skeleton / art direction / example prompts), and the
  art-direction preview. **Import from notes** pastes a swipe-file entry
  (Why it works / Template / Examples) and parses it into a draft via
  `src/lib/mothermode/content/promptBankImport.ts` (`parseNotionEntry`,
  `slugifyRecipeId`).

## Generate drawer

`BatchPanel.tsx` shows the voice-style chip wall (mode-colored) plus the
shared `<FrameworkPicker>` ("Steer with a bank framework" toggle + selector),
both feeding the existing `style` param. The picker is hydrated from the live
merged bank (see the next section), so DB customs, edits, and toggles appear
without a deploy. On this surface the selector runs in `fitsOnly` mode: it
lists ONLY the frameworks recommended for the selected platform + format
(nothing from other platforms shows), and a pick that stops fitting after a
channel change drops back to Auto automatically. Auto's hint explains the
per-piece rotation. Draft cards badge the executed framework label (looked up
in the merged bank, so custom labels badge correctly). When the picked
framework declares custom input fields, the picker's **Your material** block
renders and the filled values ride `recipeInputs` into the batch. On facebook
(ad), instagram (organic), youtube, tiktok, and email, an **Image creative
(image bank)** select (also hydrated from the merged bank) picks the image
recipe every draft's `media.prompt` executes; Auto keeps the default scene
brief.

## Email kit trigger wiring (round 5)

Any Email Marketing Kit email can carry an optional `frameworkRecipeId` (an
`EmailMessage` field riding the sequence JSONB; normalized present-only, so
no migration and full back-compat). The kit editor shows a **Bank framework**
select per email, hydrated from the live merged bank via
`usePromptBankRecipes()` and ordered by the pure
`orderEmailRecipesForTrigger(recipes, trigger)` helper in
`promptBankActions.ts` (email-platform framework recipes only, the matching
`embuy-` / `emgoal-` / close families first when the sequence's enrollment
trigger is `purchase` / `upsell_purchase` / `refund` / `booking` /
`abandon`). When set, `aiExpandEmail` injects the recipe's full craft block
via `recipeCraftBlock(recipe, 'email')` plus a `recipeInputsBlock` whose
`goal` and `offer` fields fill automatically from the kit intake (the
recipe's other fields fall back to the offer facts, same as the Test lab).
The assignment survives per-email rewrites, and the flow canvas trigger
node shows a read-only hint chip naming the fitting family
(`triggerRecipeFamilyLabel`). Resolution goes through `resolveRecipeById`
(enabled-only, DB-over-seed merged), so disabled recipes silently degrade
to framework-only generation.

## Generator-surface pickers (shipped)

One shared picker on every generation surface (spec:
`PROMPT_BANK_GENERATOR_PICKERS_TASK.md`). Two pieces:

- **`usePromptBankRecipes()`** (`src/components/mothermode/content/
  usePromptBankRecipes.ts`): fetches `GET /api/admin/mothermode-prompts` once
  per session (module-level cache + in-flight dedupe), returns the enabled
  merged bank, and degrades to the code registry on any failure. Every picker
  (and the drawer's badge labels + image select) reads from it, which retires
  the old "chips are code-registry only" debt everywhere.
- **`<FrameworkPicker>`** (`src/components/mothermode/content/
  FrameworkPicker.tsx`): the "Steer with a bank framework" toggle (default
  off = unchanged behavior) plus a selector ordered by the pure
  `orderRecipesForPicker(recipes, platform, format, groups)` helper in
  `promptBankActions.ts` — strong fits first, grouped in optgroups
  (Frameworks / Styles / Image creative), `label · hint` options, disabled
  recipes excluded. When the pick declares `inputs`, the same **Your
  material** fields from the Test lab render and the values pass through as
  `recipeInputs`.

Surfaces (all riding the existing params, no new generator internals):

| Surface | Picker groups | Params sent |
| --- | --- | --- |
| Generate drawer (`BatchPanel.tsx`) | framework + style | `style`, `recipeInputs` (+ hydrated image-bank select for `imageFramework`) |
| Rewrite tabs (`RewriteField.tsx`, `HookVariants.tsx`) | framework + style | `framework`, `recipeInputs` on action 'rewrite' |
| Amplify / Refine command box (`AmplifyPanel.tsx`) | framework + style | `framework`, `recipeInputs` on action 'amplifyParts' (applies to every part) |
| Version composer image stage (`AmplifyComposer.tsx`) | image only | `imageFramework`, `recipeInputs` on action 'imagePrompts' |
| Variation Lab brief (`VariationLabPanel.tsx`, inside Image Studio) | image only | `imageFramework`, `recipeInputs` on action 'variationBrief' |

Plumbing notes: the `/api/mothermode/ai` route now passes `framework` +
`recipeInputs` for rewrite/amplify/amplifyParts and `recipeInputs` for
imagePrompts/variationBrief (a `strMap` guard drops blank values), and the
generators inject `recipeInputsBlock` right after the craft block, the same
as the batch path. The one-shot `scripts/add-recipe-inputs.cjs` is deleted
(the inputs live in the registry + seed).

## Test lab (shipped)

`/admin/prompt-bank` edit panel → **Test lab**: pick platform, format, and
offer, hit **Run test**, and `POST /api/admin/mothermode-prompts/test`
(`src/app/api/admin/mothermode-prompts/test/route.ts`) resolves the recipe
from the merged bank and runs the real batch generator with `style`
(framework/style) or `imageFramework` (image), count 1, kind from the recipe.
The piece renders in the actual platform chrome via `PlatformPreview`, with
the hook, the full image prompt the recipe produced, and the model used.
Works for disabled recipes and unsaved DB edits.

### Test lab output actions (shipped)

Every test result is a workbench (spec: `PROMPT_BANK_TEST_ACTIONS_TASK.md`),
pure helpers in `src/lib/mothermode/content/promptBankActions.ts`:

- **Composed image prompt, first-class + Copy.** The hook-anchored
  `buildImagePrompt(scene, hook)` composition renders under the hook with its
  own Copy button; image-group recipes note which image creative framework
  shaped the scene.
- **Add as example.** Appends the output's hook (or image prompt for image
  recipes) to the recipe's `exampleHooks[]` via `appendExample` (dedupe
  case/whitespace-insensitive, 6-cap with the oldest dropping off + notice),
  then upserts the recipe. The bank learns from real outputs: good test
  results become steering examples for every future run.
- **Save to library.** Persists the piece to the content hub generated
  library (`POST /api/mothermode/content/generated`, action 'save') with a
  fresh id per save and `framework: recipeId` intact for later analytics.
  Saved state links to `/admin/content`.
- **Changes field + revision stack.** Freeform edit instructions applied per
  field (hook, caption, body) through `POST /api/mothermode/ai` action
  'rewrite' with `framework: recipeId` (the route now passes it through).
  Each apply pushes a revision (v1, v2, v3...) with one-click restore
  (truncate-after-restore), and **Run again** re-generates from the recipe so
  structure and words iterate independently.
- **Lead magnet from post.** Seeds the Lead Gen Kit: theme to topic, hook to
  transformation, body/caption to the notes brief, then `fillIntake` +
  `outline` through `/api/mothermode/leadgen-ai` and a draft kit save. The
  **Open the kit** link deep-links to `/admin/lead-gen?kit=<id>` (the kit
  editor honors the `kit` param on mount).
- **Create sequence (content funnel).** `POST /api/admin/mothermode-prompts/test`
  with `{ action: 'sequence', source, count }` (3-5, default 4) runs the batch
  generator in variations mode with the piece as `source` plus the
  `funnelArcGuide` arc (post 1 hooks, middles prove/deepen/flip, last
  converts). Every piece carries the recipe id. The draft list shows per-piece
  hook + funnel role badge + expandable `PlatformPreview`, per-piece **Save**,
  and **Save all**.
- **Remix into prompt.** `buildRemixDraft(source, piece, existingIds)` drafts
  a NEW custom recipe from what the test produced: `<sourceId>-remix` id
  (counter-deduped), label from the hook, whyItWorks seeded from the source, a
  {Slot} template re-derived from the output's structure (feed/carousel/
  thread/script shapes via `deriveTemplateFromPiece`), and the output's hook
  (or image prompt) as the first example. Lands as an unsaved editor draft
  for human review, never auto-saved (same path as Import from notes).

## Tests

`tests/lib/prompt-bank.test.ts`: registry integrity (147 unique ids, valid
platform/format refs, no em/en dashes, no NO-list stems), platform-specific
framework coverage (one tight fit per channel, FB ad kinds), round-2 coverage
(10 FB ads + 8 LinkedIn + 8 long-form), round-3 coverage (8 ytshort + 8
ytlong + 6 ytad, 5 inputs-bar recipes), round-4 coverage (10 ttshort + 6
ttad, 5 inputs-bar recipes, ytshort tiktok cross-post notes complete),
round-5 coverage (8 email- + 6 emlf- + 8 embuy- + 4 emgoal-, 11 inputs-bar
recipes incl. the offer + goal fields), owner-framework coverage,
journey-flex template fidelity (8 source URLs), recipesFor, recipeCraftBlock
platform-note scoping, rotation (fits-first, fill, custom pool), assignment
lines, store row round-trip, Notion import parser (owner-paste end-to-end,
tolerant paths), slugify.

`tests/lib/image-prompt-bank.test.ts`: image registry integrity (72 unique
ids, 17/8/25/4/4/8/6 sub-bank split, valid size presets, voice-safe,
brand-locked no-baked-in-text rule), round-2 sub-banks, round-3 ytthumb
coverage, round-4 ttimg coverage (ig-fb-story presets, tiktok platforms),
round-5 emimg coverage (email-header presets, email platforms),
imageRecipesFor filtering (tiktok organic = 8, email organic = 6),
imageRecipeCraftBlock composition (sizes, examples, art-direction lock,
platform-note scoping), size labels, store round-trip for the image group
(kind + size_presets), ALL_SEED_RECIPES totals (219).

`tests/lib/prompt-bank-actions.test.ts` also covers the round-5
trigger-wiring helpers: orderEmailRecipesForTrigger (email-platform
framework recipes only, round-5 families present, trigger-matched family
first with registry order otherwise) and triggerRecipeFamilyLabel (names
the fitting family per trigger, empty otherwise).

`tests/lib/email-kit.test.ts` covers the round-5 kit surface: the 6
ascension frameworks resolve with full specs and the enum/registry never
drifts, the pre-post-purchase campaign remap (welcome → buyer-welcome,
bridge → ascension-bridge), and normalizeEmail round-tripping
`frameworkRecipeId` (present, absent, and blank cases).

`tests/lib/prompt-bank-actions.test.ts`: the Test lab output-action helpers:
appendExample (append, dedupe, empty reject, 6-cap with dropped-oldest
notice, multiline collapse), deriveTemplateFromPiece (feed/carousel/thread
shapes, empty-hook fallback), buildRemixDraft (source-seeded draft, id
counter-dedupe, platform/format fallback, image-recipe fidelity with the
prompt as the example), clampSequenceCount (default 4, 3-5 band),
funnelArcGuide (arc beat order per count, clamping, voice-safe),
orderRecipesForPicker (fits first with registry order inside, no-channel
identity, group filtering for text vs image surfaces, disabled excluded,
group-respecting fits, fitsOnly narrows to the channel recommendations).

`tests/lib/prompt-bank.test.ts` also covers custom input fields: the curated
story/lesson family carries inputs, every declared field is well-formed and
voice-safe (unique ids per recipe, no dashes, no NO-list stems),
recipeInputsBlock (composes with the output steer, skips empty values, empty
when nothing filled, empty for input-less recipes, multiline collapse), and
the store inputs round-trip (survives recipeToRow/rowToRecipe, malformed defs
drop out at the row boundary).

## Follow-ups (not shipped)

- **Round 6, community + engagement engines** (the next round per the
  roadmap): FB group programming (weekly rhythms, prompts, challenges),
  reply-bait comment strategies, UGC prompt campaigns. (The video-first
  round shipped in two halves: YouTube +10 `ytthumb-`, +16
  `ytshort-`/`ytlong-`, +6 `ytad-`; TikTok +10 `ttshort-`, +6 `ttad-`, +8
  `ttimg-`. The email ascension round shipped as +26 text (+8 `email-`, +6
  `emlf-`, +8 `embuy-`, +4 `emgoal-`) + 6 `emimg-`, plus the kit
  frameworks and trigger wiring, spec `PROMPT_BANK_EMAIL_ROUND_TASK.md`.
  Remaining commerce gaps: cart-abandonment bank recipes, win-back
  variants, seasonal pushes, per-stage ad variants.)
- Sequence-to-Planner series mapping (the Test lab sequence draft saves to
  the library; mapping it onto planner cards via the `AddPlanCard` plumbing
  is the noted v2, carried as the optional stretch from the shipped pickers
  task `PROMPT_BANK_GENERATOR_PICKERS_TASK.md`).
- Framework-level performance rollups once ad metrics key off
  `ContentPiece.framework`.
- Image bank coverage for more channels (X cards `ximg-`, Pinterest pins
  `pinimg-`, blog/AEO headers `blimg-`).
- Framework pickers on the storyboard / frame-pack / video-script surfaces
  (those generators have no bank params yet; a separate task if wanted, per
  the pickers spec's non-goals).
- Email enrollment dispatch (send-time wiring from `email/triggers.ts` to
  an ESP; the documented future work in
  `EMAIL_TRIGGER_FUNNEL_MAPPING_SYSTEM_PORT.md` §7).


