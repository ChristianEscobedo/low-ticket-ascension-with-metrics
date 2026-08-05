# Media cue sources, cue style + keyframes, and the Cue Autopilot play — port (2026-08-05)

The follow-up to `CAPTION_EFFECTS_MARKS_AND_MEDIA_CUES_PORT.md` (Tier 3). That port
shipped the cue (`{ id, clipId, wordIndex, url }` — an image flies in when a word is
SAID). This one answers the three questions it left open: where the image comes
from, what the cue looks like, and whether the machine can do the whole reel.

## 1. Sources: upload or AI-generate, in the picker

The cue still never changes shape — the source is a picker concern, not a
data-model concern. The picker (cue mode → click a word) gained two source
actions next to the Media Library grid:

- **Upload** rides the existing signed-URL flow: `/api/admin/reel-upload-url`
  now accepts `kind: 'image'` (default ext `png`) → PUT the bytes → public URL.
- **AI-generate** rides the Content Hub image pipeline: a prompt field in the
  picker → `aiGenerateImage(prompt, 'reel')` → hosted URL.

Both then do the same two things in one step: ingest into the Media Library
(`source: 'upload' | 'generated'`, tag `cue`) AND attach to the pending word.
The library keeps every upload/generation, so the next cue — manual, `auto`,
or autopilot — can match it for free.

## 2. Cue style + keyframed motion (the model change)

`ReelMediaCue` gained two optional fields, the exact shape the codebase already
proved out with clips:

- `style?: { widthPct?, xPct?, yPct?, radiusPx?, shadow?, borderPx?, borderColor? }`
  — `normalizeMediaCueStyle` clamps each field and drops unusable keys; when
  nothing survives, the whole style drops and the cue renders the house card.
  A border needs BOTH width and color — a lone width drops, a lone color keeps
  the default 2px so the pick is never invisible. Exported for the autopilot
  handoff: the recipe's style hints ride the SAME clamp the studio editor
  writes through.
- `motion?: MotionKey[]` — the SAME shape clips use. `normalizeMotionKeys` is
  now THE one clamp, shared by `normalizeReelClip` and `normalizeMediaCues`
  (t ≥ 0, scale 0.2–4, pan ±50, rotate ±45, 40-key cap; fewer than two keys
  can't interpolate, so the track drops and the default owns the render).

Keyframe times are **cue-relative seconds** over the cue's window (the word's
span + the 1.0s hold — `cueWindowSec` in the studio mirrors the frame math
`shiftMediaCues` does). A trim that shortens the window plays less of the
track — the same honest behavior clips always had. `shiftMediaCues` carries
style/motion verbatim into the plan; both compositions render them frame-driven
(vendored copies byte-identical, `scripts/sync-vendored-captions.cjs --check`).

UI: each attached cue opens a style/motion editor — sliders for size / x / y /
corner / border / shadow, plus the same motion preset chips scenes use,
expanded over the cue's window. Omit everything and the zero-keyframe case is
the current rise+scale entrance and fade exit.

Tests: `tests/lib/media-cues.test.ts` — style clamps and junk drops, motion
clamps like clips, the save → load round-trip, plan passthrough, and the
bare-cue default.

## 3. The full-auto pipeline, as a GATED recipe

Not a bespoke button — the chain lives in the seeded `reel-cue-autopilot` play,
so it shows in the Plays rail with the run's cost tracking like every other
play. ONE step: expert `design`, `inputFrom: 'brief'`, output artifact
`reel-cue-plan`, `gate: 'approve'`, handoff `{ target: 'reel-cues', generate: true }`.
**The gate sits BEFORE the money**: the owner approves/edits the beat list, and
only then does the handoff match (free) or generate (paid).

- **The artifact** — `reel-cue-plan` = `{ projectId, beats: [{ clipId,
  wordIndex, word, imagePrompt, style? }] }`. `normalizeReelCuePlan` caps 12
  beats, drops junk, defaults a missing word from the prompt's first token.
  Registered in `RESEARCH_ARTIFACT_TYPES`; `handoffTargetsFor` → `['reel-cues']`.
- **The bridge** — `POST /api/admin/reel-cue-autopilot { projectId }` packages
  the reel's indexed transcripts (`REEL_PROJECT_ID` + per-scene clipId + word
  indexes, 120 words/clip, 12k chars cap) into a research-session brief (the
  exact export the recipe's instruction reads), creates the session + run, and
  starts the agent job on the BACKGROUND lane. Returns `{ runId, sessionId,
  jobId, runUrl }` — the studio never blocks on an LLM. 400 when the reel has
  no transcripts; 404 when the recipe isn't seeded.
- **The handoff** — `handoffToReelCues` in `research/handoff.ts`. FREE BEFORE
  PAID is the rule: each beat first runs the SAME deterministic
  `suggestCuesForWords` matcher the studio's `auto` button runs (a used image
  can't serve a second beat — the one-cue-per-pair rule). An unmatched beat
  spends a generation ONLY when the step was told to Build (`generate: true`):
  `generateContentImage` → `hostGeneratedImage` → `ingestMediaAsset`, so the
  library keeps it and the next run matches it free. One cue per (clip, word) —
  a re-run REPLACES the same address (the studio's attachCue semantics). Beats
  whose word fell out of the transcript (a re-transcribe between propose and
  approve) are skipped and named in the label, never silently attached to the
  wrong word.
- **The surfaces** — ArtifactView registers `reel-cues`: "Attach Cues (library
  only)" / Build "Attach Cues (match + generate)" / "Cues Attached",
  Clapperboard icon, href /admin/reel-studio. The studio's cue row carries the
  `autopilot` button that POSTs the bridge and hands the owner the run page.

Tests: `tests/lib/reel-cue-autopilot.test.ts` — plan normalization, artifact
registration, `handed_off_to` round-trip, recipe-step validation, and the
seeded play's exact shape (gate before the money; the instruction names the
export shape the bridge packages).

## Test-debt note

`tests/lib/research-handoff-idempotency.test.ts` mocks the handoff's module
graph; the reel-cues handoff added four dependencies (`reel/store`,
`reel/mediaLibrary`, `openai-content`, `mothermode/storage`) whose real modules
build a Supabase/OpenAI client at import time. They are now mocked in that
suite (the tests never exercise the reel-cues path) — without the mocks the
suite crashes at load with `supabaseUrl is required`.

## Verify

- `npx tsc --noEmit` clean.
- New/changed suites: media-cues (11), caption-word-marks (5),
  reel-cue-autopilot (7), research-handoff-idempotency (5) — all pass.
- Full suite: 132/140 files pass; the 8 failing files are the pre-existing
  env-dependent set (payments, receipts, redact, fencing, compliance,
  review-logic) — none import the modules this work touches.
- Vendored copies byte-identical (`scripts/sync-vendored-captions.cjs --check`).

---

## Round 2 (2026-08-05, evening): hold, drag/scale on the stage, and ambient feel

The owner's follow-up after using it: time-on-screen control, grab-the-image
placement like the caption transform box, a floating wiggle, and one seed
repair. All four ride the existing shapes — nothing new in the model beyond
one field on the cue and one on the style.

### holdSec — the time-on-screen dial

`ReelMediaCue.holdSec?: number` — how long the cue holds after its trigger
word ends. Omit = the house 1.0s (`MEDIA_CUE_HOLD_SEC`). `normalizeMediaCues`
clamps it 0.2–8 and drops junk; `shiftMediaCues` resolves the window as
`word.end + (cue.holdSec ?? MEDIA_CUE_HOLD_SEC)`, still clamped to the clip's
surviving window — the window stays word-derived, so a trim compresses it
honestly. The studio's `cueWindowSec` mirrors the same math (motion presets
expand over the new window), and the editor's **on screen** slider shows the
computed total (word span + hold).

### style.ambient — float / wiggle

`ReelMediaCueStyle.ambient?: 'float' | 'wiggle'`, kept by the same
`normalizeMediaCueStyle` the handoff rides (unknown values drop). Both
compositions render it in `MediaCueLayer` as frame math, never a CSS clock:
float = a ±10px vertical sine at 0.6Hz, wiggle = a ±2.2° rotational sine with
a slight x sway, both **scaled by min(entrance, exit)** so the bob eases in
and out WITH the cue and never pops. It composes on top of the entrance AND
any motion track (appended to the transform string), which is the point: an
ambient feel that doesn't fight the keyframes.

### CueDragLayer — the transform box for cues

`CueDragLayer.tsx`, the cue counterpart of `CaptionDragLayer` with the same
contract (overlay above the Player's DOM, local state while dragging, one
write on release, arrow keys nudge+commit). The differences are derived from
the cue's own model: top-left anchored (the same left/top/width numbers
MediaCueLayer reads — no translateX), the EAST handles drive `widthPct` (the
west/north handles would have to move the anchor, so they don't exist), and
the box's height comes from the image's real aspect read off the file (the
model stores width only). Mounted in BOTH preview branches, only while a
cue's style editor is open, and visible even outside the cue's window — it is
an editing affordance for where the fly-in lands. The editor also gained
**above/below text** chips (snap yPct relative to the caption block's
bottom-anchored positionPct) — the drag box is the precise path.

### The seed repair (the autopilot "not seeded yet" error)

`scripts/seed-agent-recipes.cjs` is a HARDCODED mirror of
`research/recipes/seed.ts` — round 1 added `reel-cue-autopilot` to the TS
seed but not the mirror, so the DB never got the play and the bridge route
404'd. The mirror now carries it (idempotent by slug; re-run seeded all 17).
Also closed the drift gap it exposed: the worker's vendored `types.ts` was
unguarded, so it joined `scripts/sync-vendored-captions.cjs`'s FILES list —
the vendored plan resolves `../types` to that copy, and cue style/holdSec
live there.

### Verify (round 2)

- `npx tsc --noEmit` clean.
- media-cues 14 (holdSec window math, clamp + round-trip, ambient
  round-trip), render-plan 13, reel-cue-autopilot 7, both vendor-parity
  guards 4+4 — 42/42 across the touched suites.
- Vendored copies byte-identical, types.ts now included
  (`scripts/sync-vendored-captions.cjs --check`); the two ReelComposition
  files identical (ambient math in both).
