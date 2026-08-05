# Prompt Bank: Test Lab Output Actions — Task Spec

**Status:** SHIPPED. All six output actions plus the changes field are live in
the `/admin/prompt-bank` Test lab. Helpers:
`src/lib/mothermode/content/promptBankActions.ts`; tests:
`tests/lib/prompt-bank-actions.test.ts` (17 tests). The only v1 deferral:
sequence-to-Planner series mapping (still a follow-up, tracked in the system
port follow-ups). Everything below is the build spec, kept for reference.

**Surface:** `/admin/prompt-bank` Test lab (shipped) + content hub library + Lead
Gen Kit + Planner
**Prereq:** the image-group migration is applied and the 145-recipe seed has
run (see `PROMPT_BANK_ROUND3_HANDOFF_TASK.md` §2)

---

## 1. What this is

Right now the Test lab generates one piece and shows it. This task turns the
test result into a **workbench**: every output can be copied, kept, edited,
saved, expanded, and fed back into the bank. Six output actions plus one
steering field, all living under the test result in the prompt bank editor.

Design rule: reuse existing routes wherever they exist. The only new API is
the sequence expansion. Everything is admin-gated.

## 2. The actions

### 2.1 Image prompt text, first-class + copyable
- Show the **fully composed image prompt** for the test piece (the
  hook-anchored `buildImagePrompt(scene, hook)` composition, and for
  image-group recipes a note of which recipe shaped it via
  `imageRecipeCraftBlock`).
- **Copy** button beside it (same pattern as the assembled-prompt Copy).
- Files: editor only (`PromptBankEditor.tsx`), reuse
  `buildImagePrompt` from `content/constants.ts`.

### 2.2 Add as example
- **Add hook as example** (text recipes) / **Add prompt as example** (image
  recipes): appends the generated hook (or the produced `media.prompt`) to
  the recipe's `exampleHooks[]` and upserts via the existing
  `POST /api/admin/mothermode-prompts`.
- Dedupe against existing examples, cap at 6 (oldest drops off with a notice).
- This is the "bank learns from real outputs" loop: good test outputs become
  the next steering examples for every future run.

### 2.3 Save to library (content hub)
- **Save to library**: persists the test piece via the existing
  `POST /api/mothermode/content/generated` (`action: 'save'`, `pieces: [piece]`,
  `offerSlug`), then shows a Saved state with a link to the content hub
  generated section.
- The piece keeps `framework: recipeId` so analytics can compare recipes later.

### 2.4 Changes field (edit-in-place with instructions)
- A **Changes** textarea + **Apply changes** button under the test result.
- Sends the current test piece's hook/caption/body plus the freeform
  instructions through the existing `POST /api/mothermode/ai`
  (`action: 'rewrite'`, `instructions`, `framework: recipeId`), per field, and
  updates the test piece in place.
- Keep a small revision stack (v1, v2, v3...) with restore, and a
  "Run test again with edits" path so an admin can iterate structure vs words.

### 2.5 Make a lead magnet from the post
- **Lead magnet** button: seeds the Lead Gen Kit with the test piece
  (theme → angle, hook → promise, body → outline seed).
- Implementation: call the existing lead-gen passes
  (`POST /api/mothermode/leadgen-ai`, `action: 'fillIntake'` then
  `'outline'`) with the post content as the brief, create the kit via the CRUD
  route, and deep-link to `/admin/lead-gen?kit=<id>` for review + publish to
  Deliverables.

### 2.6 Create a post sequence / content funnel
- **Sequence** button: expands the test piece into a connected 3-5 post
  content funnel (hook post → proof posts → CTA post).
- New API: extend `POST /api/admin/mothermode-prompts/test` with
  `{ action: 'sequence', count }` (default 4): the batch generator runs in
  `variations` mode with the piece as `source` plus a funnel-arc guide
  (post 1 hooks, middles prove, last converts), each carrying the recipe id.
- Output renders as a mini draft list with per-piece PlatformPreview, each
  with its own **Save to library** and a **Save all**; optional "Send to
  Planner as a series" follow-up (maps to planner cards, reuses
  `AddPlanCard` plumbing — follow-up, not required for v1).

### 2.7 Remix to a new prompt in the prompt bank
- **Remix into prompt**: drafts a NEW custom recipe from what the test
  actually produced: label suggestion, whyItWorks seeded from the source
  recipe, a template re-derived from the output's structure, and the output's
  hook (or image prompt) as the first example.
- Lands as an unsaved draft in the editor (same path as Import-from-notes
  uses), ready to review and save via the existing upsert. Id suggestion:
  `<sourceId>-remix` (dedupe with a counter).

## 3. API surface

| Action | Route | Status |
| --- | --- | --- |
| Add as example / remix save | `POST /api/admin/mothermode-prompts` (upsert) | existing |
| Save to library | `POST /api/mothermode/content/generated` (action 'save') | existing |
| Changes field | `POST /api/mothermode/ai` (action 'rewrite') | existing |
| Lead magnet | `POST /api/mothermode/leadgen-ai` + CRUD | existing |
| Sequence | `POST /api/admin/mothermode-prompts/test` `{action:'sequence'}` | **extend** |

## 4. UI shape

Under the test result in `PromptBankEditor.tsx`:

```
[ Hook + image prompt text (copy)            ]
[ Add as example ] [ Save to library ]
Changes: [ textarea....................... ] [ Apply ]
[ Lead magnet ] [ Create sequence ] [ Remix into prompt ]
Revisions: v1 v2 v3 (restore)
```

- All buttons dark-theme styled (brass solid / bone ghost), disabled while busy.
- Notices inline (Saved, Example added, Draft remixed) using the existing
  notice pattern.

## 5. Tests

- `tests/lib/prompt-bank.test.ts`: example-append helper (dedupe + cap) as a
  pure function extracted to `promptBankImport.ts` or a new
  `promptBankExamples.ts`.
- Remix draft builder: pure function `buildRemixDraft(source, piece)` →
  recipe draft (label, whyItWorks, template, example), unit-tested.
- Sequence request shaping: the test route's `action:'sequence'` body
  validation + kind/format defaults (unit-test the pure parts; no live AI
  calls in tests).

## 6. Build order

1. 2.1 image prompt text + copy (editor only).
2. 2.2 add as example (pure helper + upsert) + tests.
3. 2.3 save to library.
4. 2.4 changes field + revision stack.
5. 2.7 remix into prompt (pure builder + draft path) + tests.
6. 2.6 sequence API + draft list + save-all.
7. 2.5 lead magnet seeding + deep-link.
8. Docs: update `CONTENT_PROMPT_BANK_SYSTEM_PORT.md` (Test lab section) and
   the round table in `PROMPT_BANK_1000_AND_TEST_LAB_TASK.md`.

## 7. Non-goals

- No auto-rendering of test images in this task (Image Studio bridge stays as
  is; the copy path covers prompt text).
- No planner series mapping in v1 (noted as follow-up).
- No AI-authored new recipes into the bank without human review (the remix
  lands as a draft, never auto-saved).
