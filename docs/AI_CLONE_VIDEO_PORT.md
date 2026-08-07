# AI Clone Video — PORT

The running record of what shipped, per step. The plan lives in
docs/AI_CLONE_VIDEO_TASK.md; this doc is what exists and where it lives.

## Step 1 — The Clone + the character-sheet foundry (shipped 2026-08-07)

**What it is.** A new **Clone** tab in the Clipping Studio
(/admin/reel-studio) — step 1 of the 6-step AI Clone wizard. A clone is a
saved cast member: name, reference photos, an ElevenLabs voice, and a locked
**look bible** (wardrobe / backdrop / lighting / lens) — one string every
downstream prompt quotes verbatim. No photos? The foundry forges a
character sheet with **GPT Image 2** (2×2 turnaround + expression strip,
optional full-body cell for walking b-roll) in ONE call, once per
character — and the sheet lands in the Media Library tagged
`character-sheet`.

**Where it lives.**

- `src/lib/mothermode/reel/clone.ts` — the domain module: `ReelClone`
  entity, `ClonePlan` manifest + `normalizeClonePlan`, the
  `characterSheetPrompt` builder, video-type + framework catalogs, the
  5/10/15s word-count honesty helpers, per-beat voice programming
  (`resolveBeatVoiceParams`, `beatLineForTts`), and `CLONE_COSTS` — the ONE
  cost table (avatar $/sec, Seedance 2.0/2.5 $/sec, ElevenLabs $/1k chars,
  the once-per-character sheet image). Update it from muapi's live pricing
  when the integration lands (the pricing page is JS-rendered; values are
  build-time estimates, marked in the comment).
- `src/lib/mothermode/reel/types.ts` — `clonePlan` on `ReelProject`,
  normalized in `normalizeProjectJson` and serialized in `projectToJson`
  (same pattern as `mediaCues`). `clone.ts` imports nothing from `types.ts`,
  so the value import creates no cycle.
- `src/lib/mothermode/reel/store.ts` — `upsertReelProject` accepts
  `clonePlan`; `markReelComposed` now also forwards `mediaCues` +
  `clonePlan` so a compose never strips them.
- `src/app/api/admin/mothermode-reel/route.ts` — the `save` action forwards
  `mediaCues` (it didn't — a latent drop) and `clonePlan`.
- `src/app/(fullscreen)/admin/reel-studio/ClonePanel.tsx` — the tab UI:
  wizard stepper (step 1 live), clone form, look bible with the locked-line
  preview, voice picker (`aiListVoices` + manual id fallback), the foundry
  (`aiGenerateImage` with `CLONE_SHEET_MODEL = 'gpt-image-2'`), sheet
  preview + Media Library ingest (tagged `character-sheet`), ref-photo
  manager, save-to-manifest. `page.tsx` wires the tab rail, header, panel,
  and `saveClonePlan` (same save path as media cues).
- `tests/lib/clone.test.ts` — 19 tests: normalizer round-trips + drops,
  cost math (per-beat, per-tier, the once-per-character sheet line), sheet
  prompt quoting the bible verbatim, the honesty grid, voice-programming
  resolution + clamps.
- Changelog 2.8.0 in `src/lib/mothermode/help/seedContent/changelog.ts`.

**Verify.** `npx tsc --noEmit` clean; 19/19 clone tests + the 65
neighboring reel tests pass.

**Not in step 1 (next steps own these).** muapi avatar generation
(`src/utils/integrations/muapi.ts` — fal-veed.ts pattern), the
script/framework picker UI, the storyboard gate + cost readout UI, per-beat
generation, extend/re-roll, and the Content Hub cast handoff. The catalogs,
cost tables, manifest shape, and voice resolvers they need are already in
`clone.ts`.

## Step 2 — Script + framework picker (shipped 2026-08-07)

**What it is.** The Clone tab's step 2: pick the video type (Hook ad / UGC
testimonial / VSL / tutorial / announcement — each carries its default
pacing, beat count, and framework), override the framework if you want
(PAS / AIDA / hook-story-offer / the Mindshift VSL structure), type the
topic, and the script writer produces the beats — one spoken line per beat
on the honest 5/10/15s grid, each carrying its **voice programming**
(pace, energy, emphasis words, pause placement). Lines edit in place
(commit on blur), beats delete, a re-write regenerates while the clone
stays locked. Every beat's `@reference 1` is the sheet (or the first ref
photo) automatically. A new script un-approves the storyboard gate.

**Where it lives.**

- `src/utils/integrations/openai-content.ts` — `generateCloneScript` (the
  `cloneScript` action's engine): resolves the text model
  (`resolveTextModel`, key-aware Auto), prompts for `{beats[]}` with line /
  kind / shot / durationSec / pace / energy / emphasis / pauseAfterWord /
  brollPrompt, and normalizes defensively (`normalizeCloneScriptBeats`
  clamps the grid + enums, drops line-less avatar beats).
- `src/app/api/mothermode/ai/route.ts` — the `cloneScript` action
  (admin-gated, clamps inputs, mirrors the videoScript handler).
- `src/components/mothermode/content/aiClient.ts` — `aiGenerateCloneScript`
  browser wrapper (`AiCloneScriptBeat`).
- `src/app/(fullscreen)/admin/reel-studio/ClonePanel.tsx` — the step-2 UI:
  type chips, framework chips (type sets the default), the topic field,
  "write the script", and the beat list with per-beat voice chips
  (`energy · pace · "emphasis" · …@pause`), word counts, line editing, and
  beat removal. Beats persist on the manifest via `onSavePlan`.
- Changelog 2.9.0.

**Verify.** `npx tsc --noEmit` clean; the 19 clone tests still pass (the
manifest normalizer already covers the fields the script writer fills).
