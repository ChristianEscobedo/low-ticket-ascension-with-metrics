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

## Step 3 — The storyboard gate + cost readout (shipped 2026-08-07)

**What it is.** The Clone tab's wizard step 4: the storyboard, and the gate
that keeps spend honest. Every beat shows its shot — flip avatar ↔ b-roll
(a line-less b-roll beat can't go avatar), re-frame the angle
(close / medium / wide), rewrite the b-roll visual prompt, nudge the seconds
on the 5/10/15 grid with the dishonest options disabled (a 21-word line
can't sit on a 5s beat). Each beat carries its two **@reference slots**:
@1 is always the locked character sheet (the master resolver backfills it),
@2 is the optional variant (wardrobe / location / product) set from a URL or
a quick-pick of the clone's refs. The **cost readout** never leaves the
screen: a per-beat price chip (voice + video on hover), the Seedance
2.0 ↔ 2.5 toggle showing the plan delta live on the chip, per-beat 2.5 hero
pins, and the totals box (voice / video / runtime / the sheet line —
"$0.00 (forged)" once the character owns a sheet, the once-per-character
honesty copy always on the line). The approve button carries the grand
total; approval stamps `approvedAt`; every edit path (script rewrite, line
edit, shot / kind / duration / tier / ref change, beat removal) re-opens
the gate. Generation (build-order step 4) reads this stamp.

**Where it lives.**

- `src/lib/mothermode/reel/clone.ts` — the gate section:
  `cloneMasterRef` (sheet → first ref), `cloneBeatRefSlots` (the @1/@2
  resolver), `withBeatRefSlot` (pure slot writes — dense array, junk URLs
  are clears, slot-2 writes backfill @1 with the master),
  `storyboardIssues` + `clonePlanApprovable` (the honesty rules, listed
  verbatim in the UI), `approveClonePlan` (stamps both timestamps, never
  mutates), `cloneTierCostDelta` (the live 2.0↔2.5 readout — pinned beats
  price identically in both legs, so only un-pinned seconds move), and
  `clonePlanDurationSec`. No manifest shape changes — the normalizer
  already covered every field this step writes.
- `src/app/(fullscreen)/admin/reel-studio/ClonePanel.tsx` — the step-4 UI:
  the tier toggle with the live delta, per-beat cards (kind flip, grid
  chips with the honest floor, shot chips, b-roll prompt, per-beat hero
  pin, price chip), the @reference slot row (@1 locked thumbnail, @2
  draft input + quick-pick thumbnails), the totals box, and the gate
  (issues list blocks approval; approved banner with timestamp + revise).
  Wizard stepper steps 3 (Script) and 4 (Storyboard) now read live.
- `tests/lib/clone.test.ts` — 31 tests now (12 new): slot resolution order,
  override wins, dense set/clear, master backfill, junk-URL clears, every
  gate rule (no beats, no @1, line-less avatar, prompt-less b-roll, words
  that can't fit), the approve stamp, and the tier delta math.
- Changelog 2.10.0.

**Verify.** `npx tsc --noEmit` clean; 31/31 clone tests + the 121-test reel
neighborhood (media-cues, media-library, veed-presets, reel-schedule,
reel-trim-playback, caption-presets, render-plan) pass.

**Not in step 3 (next steps own these).** The actual generation calls
(muapi avatar + ElevenLabs per-beat voice + Seedance with refs — the gate
stamp is what they check), extend/re-roll with last-frame continuation, and
the Content Hub cast handoff.

## Step 4 — Per-beat generation + assemble (shipped 2026-08-07)

**What it is.** Wizard steps 5 + 6. With the gate stamped, **generate** runs
per beat (or one pass for all): voice first — ElevenLabs reads each line
with THAT beat's voice programming (`resolveBeatVoiceParams` +
`beatLineForTts`, one call per beat) → hosted mp3 (`status: 'voiced'`) —
then video: avatar beats render on the muapi OmniHuman-class talking head
(@1 + the beat's audio + the deterministic direction: shot framing,
delivery note from the beat's energy/pace, the look bible verbatim);
b-roll beats render on Seedance (2.0 default, 2.5 hero pins) WITH the
@reference images riding, so the same character shows up inside the
footage. Provider clips re-host to our storage before they land on the
manifest. A failed beat stamps `status: 'failed'` + the provider's message
and re-enters at the step that failed (never re-buys the voice). Step 6
**assemble** drops every generated beat onto the timeline as scenes, in
manifest order — captions, cues, and the Remotion render work on them for
free.

**Where it lives.**

- `src/lib/mothermode/reel/cloneGenerate.ts` — the pure layer:
  `cloneGenStep` (voice → video → done; failed beats re-enter at the failed
  step), `cloneGenProgress`, `cloneGenerationBlockers` (THE spend gate:
  `approvedAt` + the storyboard honesty rules, failing closed), the
  deterministic prompts (`cloneAvatarPrompt` — framing + delivery + bible;
  `cloneBrollPrompt` — the visual + `@image1`/`@image2` addressing +
  bible), `cloneRefImagesFor` (dense slot-ordered refs), the model tables
  (`CLONE_AVATAR_MODEL = 'omnihuman-1'` — verify against the live muapi
  catalog; `CLONE_SEEDANCE_MODELS` per tier), and the assemble helpers
  (`cloneAssembleBeats`, `cloneSceneName`).
- `src/utils/integrations/muapi.ts` — NEW: the OmniHuman-class avatar
  client on muapi's model-slug-in-path contract (submit → poll → hosted
  URL), FastAPI `detail[]` error flattening, env-overridable model +
  field names (`MUAPI_AVATAR_MODEL`, `MUAPI_AVATAR_AUDIO_FIELD`,
  `MUAPI_AVATAR_IMAGE_FIELD`).
- `src/app/api/admin/reel-clone-generate/route.ts` — NEW: `POST
  { projectId, beatId }` renders ONE beat one step (the client chains
  voice → video). The gate check runs before any provider call (409 on an
  unstamped/dirty plan); ElevenLabs voice params resolve per beat;
  Seedance reads the beat's pinned tier else the plan toggle; every output
  re-hosts via `uploadAudioBuffer`/`uploadVideoBuffer` before the patch
  returns. Failures return the `failed` patch WITH the error so the
  manifest records it.
- `src/app/(fullscreen)/admin/reel-studio/ClonePanel.tsx` — the step-5 UI:
  per-beat status chips (needs voice / voiced / rendered / failed) with
  generate + retry + watch, the generate-all pass, the locked-until-approved
  copy, and the step-6 assemble card. A project-id-keyed local mirror
  (`planOverride`) keeps the voice→video chain reading the freshest
  manifest without waiting on a save round-trip.
- `src/app/(fullscreen)/admin/reel-studio/page.tsx` — `assembleCloneBeats`:
  beats → `ReelClip[]` scenes appended in order (duration probed, manifest
  duration as fallback), saved, then the tab flips to Scenes.
- `tests/lib/clone-generate.test.ts` — 13 tests: step resolution (incl.
  failed re-entry + visual-only b-roll), the gate (unapproved blocks,
  approved passes, dirty-fails-closed), the prompts (framing per shot,
  delivery defaults, bible verbatim, @image addressing, dense refs),
  assemble order/filtering, the model tables.
- Changelog 2.11.0.

**Verify.** `npx tsc --noEmit` clean; 44/44 clone tests green.

**Env to know.** `MUAPI_API_KEY` (shared with the Seedance pipeline),
`MUAPI_AVATAR_MODEL` (default `omnihuman-1` — confirm the slug + its
audio/image field names against the live catalog on first render),
`MUAPI_SEEDANCE_25_MODEL` (the 2.5 hero slug), `ELEVENLABS_API_KEY`.
`CLONE_COSTS` estimates stay build-time until muapi's live pricing lands.

**Not in step 4 (the last two own these).** Extend/re-roll (append beats,
re-roll one beat, last-frame continuation via `continuesFrom`) and the
Content Hub cast handoff.

## Step 5 — Extend + re-roll (shipped 2026-08-07)

**What it is.** The manifest operations on the wizard's tail. **Extend**
(the dashed box under the script): append a talking-head or b-roll beat —
@1 rides automatically, the honest grid sets its seconds from the word
count, and when the previous beat is rendered the new one stamps
`continuesFrom` with its clip. Appending re-opens the gate (the storyboard
changed). **Re-roll** (the ↺ on a rendered/failed beat in step 5): clears
one beat's outputs back to `planned` — line, voice programming, refs, and
the look-back all survive — so generate re-renders just that beat while the
gate stays stamped.

**Where it lives.**

- `src/lib/mothermode/reel/cloneGenerate.ts` — `cloneExtendBeat` (append +
  the look-back stamp), `cloneBeatForReroll` (drops the five output keys,
  pure), and `CLONE_CONTINUITY_NOTE` — the verbatim continuity line both
  prompt builders gain when `continuesFrom` is set.
- `src/app/api/admin/reel-clone-generate/route.ts` — a continuing b-roll
  beat's start frame is the PREVIOUS beat's last frame, grabbed server-side
  (`extractFrameBuffer` at prev.durationSec − 0.1) and re-hosted
  (`uploadImageDataUrl`); the clone refs still ride as omni-references. No
  frame → @1 stays the start frame (never blocks the render).
- `ClonePanel.tsx` — the extend box (kind chips + one input, Enter adds)
  and the per-beat re-roll button (REPLACE-semantics save so dropped keys
  actually drop).
- `tests/lib/clone-generate.test.ts` — extend index/refs/grid, the
  look-back stamp + continuity note gating, the normalizer round-trip of an
  appended beat, re-roll key-stripping + re-entry at voice.
- Changelog 2.12.0.

## Step 6 — The Content Hub cast handoff (shipped 2026-08-07)

**What it is.** The foundry's sheets are the Hub's cast. Every forged
character sheet (Media Library, tagged `character-sheet`) now appears in
the Hub's storyboard panel as **the cast** row — one click appends it to
the board's reference images, and the Reel Director's Seedance renders
carry the refs as omni-references automatically. One component, both
surfaces: the same character shows up inside the footage.

**Where it lives.**

- `src/lib/mothermode/reel/mediaLibrary.ts` — `characterSheetAssets`: the
  tagged-image filter (http image URLs + the `character-sheet` tag).
- `src/components/mothermode/content/CloneCastPicker.tsx` — NEW: the cast
  row (renders nothing when the library has no sheets).
- `src/components/mothermode/content/StoryboardPanel.tsx` — mounts the
  picker in the References block; a pick appends to `refs` (deduped,
  capped at MAX_STORYBOARD_REFERENCES, "Save refs to pack" persists).
- `src/components/mothermode/content/seedanceClient.ts` —
  `SeedanceSubmitInput.referenceImages` (the client spreads input verbatim
  into the POST; the route already reads them).
- `src/components/mothermode/content/ReelDirectorPanel.tsx` — every board
  render forwards `pack.referenceImages` (http-only filter) so the cast
  rides as omni-references in slot order.
- The helper's coverage rides in `tests/lib/clone-generate.test.ts` (the
  cast describe). Changelog 2.12.0 covers 5 + 6.

**Verify (5 + 6).** `npx tsc --noEmit` clean; 54/54 clone + media-library
tests green (18 in clone-generate, 31 in clone, 5 in media-library).

**That completes the wizard.** The task doc's open question remains the one
to close at first live render: confirm `MUAPI_AVATAR_MODEL`'s slug + field
names and refresh `CLONE_COSTS` from muapi's live pricing.

## The step-1 helpers (shipped 2026-08-07, changelog 2.13.0)

Post-launch UX round on step 1 (the clone card):

- **The clone library** — `cloneLibraryEntries(projects, excludeReelId)` in
  clone.ts derives every clone built on OTHER reels (copy semantics);
  page.tsx passes it to the panel (`library` prop) and a dropdown at the
  top of the clone card fills the whole form on pick — name, look bible,
  voice, refs, sheet. Save casts an independent copy on this reel.
- **AI fill** — `generateCloneAutofill` in openai-content.ts (the
  `cloneAutofill` action on the AI route, `aiCloneAutofill` in aiClient):
  one loose sentence → name + foundry-ready description + the four
  look-bible fields. The ✨ button sits on the clone card header.
- **The stepper shows the real stage** — `wizardStage` derives from the
  manifest (no plan → 1; no beats → 2; unapproved → 4; generating → 5;
  rendered → 6); finished stages check off, the current one glows.
- Coverage: the library describe in tests/lib/clone-generate.test.ts.

## The AI Twins roster (shipped 2026-08-07, changelog 2.14.0)

The architecture round: the twin is an ASSET with a library-first home, and
the studio's Clone tab stopped being a wall of forms.

- **`/admin/ai-twins`** (`src/app/admin/ai-twins/page.tsx`) — THE ROSTER:
  twin cards (sheet thumb, voice, rendered/beats counts, ready chip),
  derived from `twinRoster(projects)` in clone.ts. **New twin** opens
  `TwinFormModal` — the ONLY place the creation form lives (description +
  AI fill, the look bible, the voice picker, the foundry). Edit writes the
  clone back to its owning reel; **New video** creates a fresh reel seeded
  with the twin and deep-links into the studio's Clone tab; delete rides
  the reel route. Sidebar entry in AdminSidebar.tsx.
- **The bridge (UI-first, data-second):** a roster record is a reel named
  `Twin: <name>` (`TWIN_REEL_PREFIX` / `isTwinReel` / `twinReelName`) with
  no scenes whose clonePlan carries the twin — the studio's reel picker
  hides those names. A twin built inside a working reel appears on the
  roster too (`rosterRecord: false`). When the flow proves itself, promote
  the store to a real table and flip the write path.
- **The studio deep-link** — `/admin/reel-studio?reel=<id>` opens that
  reel ON the Clone tab (page.tsx `reelLinkHandledRef` bridge).
- **The studio tab slims** — ClonePanel collapses the twin editor behind
  an "edit twin" toggle once the reel has its twin (`formOpen`); a fresh
  reel (or a deep-linked new-video reel) opens with it expanded.
- Coverage: the twin-roster describe in tests/lib/clone-generate.test.ts.

- **Roster polish (same commit round):** reference photos UPLOAD now (signed-URL flow → Media Library tagged clone/reference-photo → the list) on BOTH the twin modal and the studio ClonePanel; the roster page + modal are on the dark house palette (bone/ink/brass).
