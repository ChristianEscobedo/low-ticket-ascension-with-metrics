# Prompt Bank: Generator-Surface Pickers + Debt Cleanup — Task Spec

**Status:** SHIPPED (pickers live on all five surfaces; helper + hook tested;
`scripts/add-recipe-inputs.cjs` deleted). Two carry-overs: the §4.1
migrations + re-seed remain a manual Supabase step (exact steps in
`PROMPT_BANK_ROUND3_HANDOFF_TASK.md` §2), and the §4.4 sequence-to-Planner
stretch is deferred to the follow-ups lists.
**Surfaces:** Generate drawer, Content sheet edit tabs (rewrite), Amplify/Refine
composer, Image Studio / Variation Lab image stages, `/admin/prompt-bank`
**Prereq:** migrations `20261029000000` (image group) and `20261030000000`
(inputs) applied + the 145-recipe seed re-run (see
`PROMPT_BANK_ROUND3_HANDOFF_TASK.md` §2)

---

## 1. What this is

The prompt bank already steers every generator **through API params**, but
only two surfaces expose a picker: the Generate drawer (chips, code registry
only) and the Test lab. Every other generation surface calls the same routes
with no way to choose a framework. This task ships **one shared picker
component — a toggle plus a framework selector — dropped onto every remaining
generation surface**, hydrated from the live merged bank.

Design rule: the API params already exist almost everywhere. This is mostly a
UI rollout plus one shared data hook. No new generator internals.

## 2. The shared component + hook

**`usePromptBankRecipes()`** (client hook): fetches
`GET /api/admin/mothermode-prompts` once (module-level cache), returns
`{ recipes, loading }` filtered to `enabled !== false`. This one hook also
retires the code-registry-only debt everywhere it is used (DB customs and
DB edits appear without a deploy).

**`<FrameworkPicker>`** (client component, dark-theme + light-theme variants
matching the host surface):

- A toggle: **Steer with a bank framework** (default off = today's behavior).
- When on: a select of recipes, strong fits for the surface's
  platform/format first (reuse `recipesFor`), each option `label · hint`.
  Group sections by recipe group (framework / style / image) the way the
  editor filter does, but only offer the groups the surface can execute
  (text surfaces: framework + style; image stages: image only).
- When the picked recipe declares `inputs`, render the same **Your
  material** fields pattern already shipped in the Test lab and the Generate
  drawer (label, required mark, placeholder, output-steer line), and pass the
  values through as `recipeInputs` / the surface's equivalent.

## 3. Surfaces to wire (existing params, in order)

| Surface | Route param that already exists | UI to add |
| --- | --- | --- |
| Generate drawer (`BatchPanel.tsx`) | `style`, `imageFramework`, `recipeInputs` | Swap code-registry chips for the hydrated picker (same look, live data). Shipped in `fitsOnly` mode: the selector lists only the channel's recommendations (nothing from other platforms), and a pick that stops fitting after a channel change drops back to Auto |
| Content sheet rewrite tabs (`ContentSheet.tsx` edit surfaces) | `framework` on `/api/mothermode/ai` action 'rewrite' | Picker above the instructions field; passes `framework` + recipe inputs into the rewrite body |
| Amplify / Refine composer (`AmplifyComposer.tsx`) | `framework` on actions 'amplify' + 'amplifyParts' | Picker in the composer header; applies to every part of the run |
| Image stage (`ImageStudioModal.tsx` / image-prompt runs) | `imageFramework` on action 'imagePrompts' | Image-group-only picker next to the prompt stage controls |
| Variation Lab brief (`variationBrief` surfaces) | `imageFramework` on action 'variationBrief' | Same image-group picker |

## 4. Debt cleanup bundled into this task

1. **Apply the two pending migrations + re-seed** (manual, once): paste
   `20261029000000_mothermode_prompt_recipes_image_group.sql` and
   `20261030000000_mothermode_prompt_recipes_inputs.sql` into the Supabase
   SQL editor, then `node scripts/seed-prompt-bank.cjs` → expect
   `upserted 145 recipes` (18 with custom inputs). Spot-check one FB ad
   recipe and one story recipe with inputs in the Test lab.
2. **Delete `scripts/add-recipe-inputs.cjs`** once the seed lands. It is a
   one-shot authoring script (and carries an unused `appliedIds` variable);
   the inputs live in the registry now, so it has no reason to stay.
3. **Hydrate the Generate drawer** from the same hook (section 3 covers it;
   retires the standing "chips are code registry only" follow-up).
4. **Sequence-to-Planner series mapping** (deferred from the Test actions
   spec): map a Test lab sequence draft onto planner cards via the
   `AddPlanCard` plumbing. Optional stretch inside this task; if it slips,
   keep it on the system-port follow-ups list.

## 5. Tests

- `usePromptBankRecipes` ordering/pure parts: extract a pure
  `orderRecipesForPicker(recipes, platform, format, groups)` helper into
  `promptBankActions.ts` and unit-test it (fits first, group filtering,
  disabled recipes excluded) in `tests/lib/prompt-bank-actions.test.ts`.
- No live AI calls in tests. UI verified by hand in the Test lab and one
  rewrite surface.

## 6. Build order

1. `orderRecipesForPicker` helper + tests.
2. `usePromptBankRecipes` hook + `<FrameworkPicker>` component.
3. Generate drawer hydration (swaps to live data, smallest surface).
4. Rewrite tabs picker (rewrite route already takes `framework`).
5. Amplify composer picker.
6. Image-stage + Variation Lab image pickers (image group only).
7. Debt items 1-3 (migrations note in the PR description, script delete,
   drawer hydration confirmation).
8. Optional stretch: sequence-to-Planner mapping.
9. Docs: update `CONTENT_PROMPT_BANK_SYSTEM_PORT.md` (Generate drawer +
   follow-ups), `PROMPT_BANK_ROUND3_HANDOFF_TASK.md` (backlog), and
   `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` §8h.

## 7. Non-goals

- No new generator params or prompt-injection changes (everything rides the
  existing `framework` / `imageFramework` / `recipeInputs` plumbing).
- No framework pickers on storyboard / frame-pack / video-script surfaces in
  v1 (those generators have no bank params yet; separate task if wanted).
- No per-piece framework mixing inside one batch beyond the existing Auto
  rotation (explicit pick still applies to the whole run).
- No AI-authored recipes into the bank (unchanged standing rule).
