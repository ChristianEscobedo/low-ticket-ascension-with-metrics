# Media cue sources, cue style + keyframes, and the Cue Autopilot play â€” port (2026-08-05)

The follow-up to `CAPTION_EFFECTS_MARKS_AND_MEDIA_CUES_PORT.md` (Tier 3). That port
shipped the cue (`{ id, clipId, wordIndex, url }` â€” an image flies in when a word is
SAID). This one answers the three questions it left open: where the image comes
from, what the cue looks like, and whether the machine can do the whole reel.

## 1. Sources: upload or AI-generate, in the picker

The cue still never changes shape â€” the source is a picker concern, not a
data-model concern. The picker (cue mode â†’ click a word) gained two source
actions next to the Media Library grid:

- **Upload** rides the existing signed-URL flow: `/api/admin/reel-upload-url`
  now accepts `kind: 'image'` (default ext `png`) â†’ PUT the bytes â†’ public URL.
- **AI-generate** rides the Content Hub image pipeline: a prompt field in the
  picker â†’ `aiGenerateImage(prompt, 'reel')` â†’ hosted URL.

Both then do the same two things in one step: ingest into the Media Library
(`source: 'upload' | 'generated'`, tag `cue`) AND attach to the pending word.
The library keeps every upload/generation, so the next cue â€” manual, `auto`,
or autopilot â€” can match it for free.

## 2. Cue style + keyframed motion (the model change)

`ReelMediaCue` gained two optional fields, the exact shape the codebase already
proved out with clips:

- `style?: { widthPct?, xPct?, yPct?, radiusPx?, shadow?, borderPx?, borderColor? }`
  â€” `normalizeMediaCueStyle` clamps each field and drops unusable keys; when
  nothing survives, the whole style drops and the cue renders the house card.
  A border needs BOTH width and color â€” a lone width drops, a lone color keeps
  the default 2px so the pick is never invisible. Exported for the autopilot
  handoff: the recipe's style hints ride the SAME clamp the studio editor
  writes through.
- `motion?: MotionKey[]` â€” the SAME shape clips use. `normalizeMotionKeys` is
  now THE one clamp, shared by `normalizeReelClip` and `normalizeMediaCues`
  (t â‰¥ 0, scale 0.2â€“4, pan Â±50, rotate Â±45, 40-key cap; fewer than two keys
  can't interpolate, so the track drops and the default owns the render).

Keyframe times are **cue-relative seconds** over the cue's window (the word's
span + the 1.0s hold â€” `cueWindowSec` in the studio mirrors the frame math
`shiftMediaCues` does). A trim that shortens the window plays less of the
track â€” the same honest behavior clips always had. `shiftMediaCues` carries
style/motion verbatim into the plan; both compositions render them frame-driven
(vendored copies byte-identical, `scripts/sync-vendored-captions.cjs --check`).

UI: each attached cue opens a style/motion editor â€” sliders for size / x / y /
corner / border / shadow, plus the same motion preset chips scenes use,
expanded over the cue's window. Omit everything and the zero-keyframe case is
the current rise+scale entrance and fade exit.

Tests: `tests/lib/media-cues.test.ts` â€” style clamps and junk drops, motion
clamps like clips, the save â†’ load round-trip, plan passthrough, and the
bare-cue default.

## 3. The full-auto pipeline, as a GATED recipe

Not a bespoke button â€” the chain lives in the seeded `reel-cue-autopilot` play,
so it shows in the Plays rail with the run's cost tracking like every other
play. ONE step: expert `design`, `inputFrom: 'brief'`, output artifact
`reel-cue-plan`, `gate: 'approve'`, handoff `{ target: 'reel-cues', generate: true }`.
**The gate sits BEFORE the money**: the owner approves/edits the beat list, and
only then does the handoff match (free) or generate (paid).

- **The artifact** â€” `reel-cue-plan` = `{ projectId, beats: [{ clipId,
  wordIndex, word, imagePrompt, style? }] }`. `normalizeReelCuePlan` caps 12
  beats, drops junk, defaults a missing word from the prompt's first token.
  Registered in `RESEARCH_ARTIFACT_TYPES`; `handoffTargetsFor` â†’ `['reel-cues']`.
- **The bridge** â€” `POST /api/admin/reel-cue-autopilot { projectId }` packages
  the reel's indexed transcripts (`REEL_PROJECT_ID` + per-scene clipId + word
  indexes, 120 words/clip, 12k chars cap) into a research-session brief (the
  exact export the recipe's instruction reads), creates the session + run, and
  starts the agent job on the BACKGROUND lane. Returns `{ runId, sessionId,
  jobId, runUrl }` â€” the studio never blocks on an LLM. 400 when the reel has
  no transcripts; 404 when the recipe isn't seeded.
- **The handoff** â€” `handoffToReelCues` in `research/handoff.ts`. FREE BEFORE
  PAID is the rule: each beat first runs the SAME deterministic
  `suggestCuesForWords` matcher the studio's `auto` button runs (a used image
  can't serve a second beat â€” the one-cue-per-pair rule). An unmatched beat
  spends a generation ONLY when the step was told to Build (`generate: true`):
  `generateContentImage` â†’ `hostGeneratedImage` â†’ `ingestMediaAsset`, so the
  library keeps it and the next run matches it free. One cue per (clip, word) â€”
  a re-run REPLACES the same address (the studio's attachCue semantics). Beats
  whose word fell out of the transcript (a re-transcribe between propose and
  approve) are skipped and named in the label, never silently attached to the
  wrong word.
- **The surfaces** â€” ArtifactView registers `reel-cues`: "Attach Cues (library
  only)" / Build "Attach Cues (match + generate)" / "Cues Attached",
  Clapperboard icon, href /admin/reel-studio. The studio's cue row carries the
  `autopilot` button that POSTs the bridge and hands the owner the run page.

Tests: `tests/lib/reel-cue-autopilot.test.ts` â€” plan normalization, artifact
registration, `handed_off_to` round-trip, recipe-step validation, and the
seeded play's exact shape (gate before the money; the instruction names the
export shape the bridge packages).

## Test-debt note

`tests/lib/research-handoff-idempotency.test.ts` mocks the handoff's module
graph; the reel-cues handoff added four dependencies (`reel/store`,
`reel/mediaLibrary`, `openai-content`, `mothermode/storage`) whose real modules
build a Supabase/OpenAI client at import time. They are now mocked in that
suite (the tests never exercise the reel-cues path) â€” without the mocks the
suite crashes at load with `supabaseUrl is required`.

## Verify

- `npx tsc --noEmit` clean.
- New/changed suites: media-cues (11), caption-word-marks (5),
  reel-cue-autopilot (7), research-handoff-idempotency (5) â€” all pass.
- Full suite: 132/140 files pass; the 8 failing files are the pre-existing
  env-dependent set (payments, receipts, redact, fencing, compliance,
  review-logic) â€” none import the modules this work touches.
- Vendored copies byte-identical (`scripts/sync-vendored-captions.cjs --check`).

---

## Round 2 (2026-08-05, evening): hold, drag/scale on the stage, and ambient feel

The owner's follow-up after using it: time-on-screen control, grab-the-image
placement like the caption transform box, a floating wiggle, and one seed
repair. All four ride the existing shapes â€” nothing new in the model beyond
one field on the cue and one on the style.

### holdSec â€” the time-on-screen dial

`ReelMediaCue.holdSec?: number` â€” how long the cue holds after its trigger
word ends. Omit = the house 1.0s (`MEDIA_CUE_HOLD_SEC`). `normalizeMediaCues`
clamps it 0.2â€“8 and drops junk; `shiftMediaCues` resolves the window as
`word.end + (cue.holdSec ?? MEDIA_CUE_HOLD_SEC)`, still clamped to the clip's
surviving window â€” the window stays word-derived, so a trim compresses it
honestly. The studio's `cueWindowSec` mirrors the same math (motion presets
expand over the new window), and the editor's **on screen** slider shows the
computed total (word span + hold).

### style.ambient â€” float / wiggle

`ReelMediaCueStyle.ambient?: 'float' | 'wiggle'`, kept by the same
`normalizeMediaCueStyle` the handoff rides (unknown values drop). Both
compositions render it in `MediaCueLayer` as frame math, never a CSS clock:
float = a Â±10px vertical sine at 0.6Hz, wiggle = a Â±2.2Â° rotational sine with
a slight x sway, both **scaled by min(entrance, exit)** so the bob eases in
and out WITH the cue and never pops. It composes on top of the entrance AND
any motion track (appended to the transform string), which is the point: an
ambient feel that doesn't fight the keyframes.

### CueDragLayer â€” the transform box for cues

`CueDragLayer.tsx`, the cue counterpart of `CaptionDragLayer` with the same
contract (overlay above the Player's DOM, local state while dragging, one
write on release, arrow keys nudge+commit). The differences are derived from
the cue's own model: top-left anchored (the same left/top/width numbers
MediaCueLayer reads â€” no translateX), the EAST handles drive `widthPct` (the
west/north handles would have to move the anchor, so they don't exist), and
the box's height comes from the image's real aspect read off the file (the
model stores width only). Mounted in BOTH preview branches, only while a
cue's style editor is open, and visible even outside the cue's window â€” it is
an editing affordance for where the fly-in lands. The editor also gained
**above/below text** chips (snap yPct relative to the caption block's
bottom-anchored positionPct) â€” the drag box is the precise path.

### The seed repair (the autopilot "not seeded yet" error)

`scripts/seed-agent-recipes.cjs` is a HARDCODED mirror of
`research/recipes/seed.ts` â€” round 1 added `reel-cue-autopilot` to the TS
seed but not the mirror, so the DB never got the play and the bridge route
404'd. The mirror now carries it (idempotent by slug; re-run seeded all 17).
Also closed the drift gap it exposed: the worker's vendored `types.ts` was
unguarded, so it joined `scripts/sync-vendored-captions.cjs`'s FILES list â€”
the vendored plan resolves `../types` to that copy, and cue style/holdSec
live there.

### Verify (round 2)

- `npx tsc --noEmit` clean.
- media-cues 14 (holdSec window math, clamp + round-trip, ambient
  round-trip), render-plan 13, reel-cue-autopilot 7, both vendor-parity
  guards 4+4 â€” 42/42 across the touched suites.
- Vendored copies byte-identical, types.ts now included
  (`scripts/sync-vendored-captions.cjs --check`); the two ReelComposition
  files identical (ambient math in both).

---

## Round 3 — caption feel, Word FX, and SFX (2026-08-05)

**Caption feel (block motion).** `CaptionOverrides.blockMotion` (`still` /
`float` / `wiggle`) in captions.ts owns the block’s ambient motion:
`resolveCaptionStyle` strips float/wiggle from the preset’s blockFx and adds
the chosen one (page-level fx like ghostFade survive; never both float AND
wiggle). `CaptionBlockFx` gained `'wiggle'` — rendered in captionLayer.tsx as
a frame-clock sway next to the float bob. The Word FX panel’s “block feel”
chips write it through the same setCaptionOverrides path as every other dial.

**Word FX (per-word effects).** `ReelWordMark` gained `ambient` (float/wiggle
bob/sway while the word is on screen, eased in), `fx` (glow / gradient /
shine / pulse / underline / marker, frame-derived), `fxColor`, and `sfx`
({url, volume}). normalizeWordMark whitelists the fx names and drops junk
(same no-substitution rule as anims). captionLayer’s `applyWordMarkExtras`
composes ambient+glow/gradient/shine/pulse onto the word style; underline and
marker render as real spans inside the word (a marker needs a layer behind
the glyphs). The FX flow mirrors the cue flow: fx mode turns subtitle word
clicks into picks (amber underline), and the Word FX panel applies the
effect to every picked word via the mark slot (no new save path).

**SFX (one-shot sounds).** `ReelMediaCue.sfx` + `ReelWordMark.sfx` —
normalizeCueSfx keeps http(s) URLs, clamps volume 0–1. plan.ts passes the
cue sfx through (RenderMediaCue.sfx); ReelComposition renders every sfx as
an `<Audio>` in a Sequence at the cue/word’s first frame, so preview and
MP4 agree by construction. Studio: a library-audio select + upload (lands in
the Media Library kind=audio tagged sfx) in both the cue editor and the
Word FX panel.

**Above/below chip fix.** The snap chips now seat edges, not flat offsets:
the caption block’s height from rows × sizePx (the layer’s own sizePx/360 ×
frameW scale, 1.15em lines) and the cue’s height from widthPct × the
image’s probed aspect (module-level `cueAspectCache` in page.tsx) — a
portrait card is ~2× taller than a landscape one at the same widthPct, and
the flat offsets were landing on the text.

**Render diagnostics.** /api/admin/reel-render echoes `cues` + `wordMarks`
counts next to captionStyleSent; the worker’s `[worker] caption plan:` log
line prints them too — one render now answers “did the plan carry the cue/FX”
from either side. (Also repaired server.js’s runRender head, lost in a crash.)

### Verify (round 3)

- `npx tsc --noEmit` clean.
- caption-word-marks 8 (mark ambient/fx/fxColor/sfx keep+drop, blockMotion
  strip/own/survive, cue sfx keep+drop), media-cues 14, render-vendor-parity
  4, geometry-parity 4, stage-single-source 5, preset round-trip 186 — all
  green; vendored copies re-synced byte-identical (4 files) + ReelComposition
  copied.
- Full suite: 46 failures in 8 files — ALL in unrelated subsystems (Stripe
  receipts/webhooks/create-payment-intent, research-fencing/recap,
  compliance-pass, review-logic) — pre-existing, zero overlap with this round.

### Round 3b — FX settings + per-word font (2026-08-05)

- `ReelWordMark` gains `fxAmount` (0.2–3, one intensity dial: glow radius /
  pulse amplitude / marker opacity / underline+strike thickness / shine band /
  jelly squash) and `font` (whitelisted against WORD_FONTS — the preset
  catalog's families). Five effects join WORD_FX: tilt, outline, strike,
  blink, jelly (all frame math; strike shares the underline's span pattern).
- buildRenderPlan ships every marked family in plan.fonts (deduped with the
  style's own) so the worker loads per-word fonts — a font nobody fetches
  renders as a fallback face in the MP4.
- Word FX panel: amount slider + font select + the five new chips, applied
  to the picked words through the same mark slot; clear strips them too.
- The image fly-in settings were never removed (the ? on a cue chip) — the
  user asked; confirmed intact.
- Verify: tsc clean; marks suite 10/10 (fxAmount keep/clamp, font keep/drop,
  plan.fonts inclusion); vendored re-synced byte-identical.

### Round 3c — individual scope, hover readouts, density + second color, always-visible fly-in settings (2026-08-05)

- **Scope toggle** in the Word FX panel: 'all picked' = the bulk editor;
  'one word' = a single target word whose controls are SEEDED from its mark
  (key-remount re-seeds on target change). applyWordMarks routes by scope;
  applyWordMark is the single-word writer. Individual is the truth — global
  is bulk, and marks were per-word all along.
- **Hover readouts**: every word in the subtitle list gets a tooltip line
  via `wordMarkSummary(mark)` in types.ts ("glow · fx #ffd400 ? #ff6b6b ·
  ×2 · density 1.5 · Anton · float · sfx ?") — shared, pure, testable.
- **fxDensity** (0.2–3): glow stacks halo layers, shine packs more sweeps
  per cycle, pulse/blink/jelly frequencies scale. **fxColor2**: the
  gradient's end and the shine band's light. Both normalized + mirrored +
  clamped like the rest of the mark.
- **Fly-in settings are always on screen** when a cue exists — the ? on a
  chip picks WHICH cue the editor shows instead of toggling it. The "settings
  are gone" complaint was structural; this kills it.
- Verify: tsc clean; marks 10/10; parity suites 32/32; vendored re-synced.

### Round 3d — z-layer + always-visible drag box (2026-08-06)

- **style.z**: 'below' (the house default) paints the cue UNDER the caption
  layer (captions sit at zIndex 10 now, in captionLayer.tsx); 'above' sets
  the cue card's zIndex to 20 in BOTH ReelComposition files, so it paints
  OVER the text. Intermediates carry no z, so the comparison is global — a
  layer, not a position; x/y still place the box. The ? over text / ? under
  text chips write z + snap yPct as a convenience. normalizeMediaCueStyle
  keeps/drops it like the rest.
- **The cue drag box is always visible** (same rule as the style editor):
  both preview branches fall back to the clip's first cue when no ? pick is
  set, tracking `currentClip` — the editor and the box always edit the same
  cue. Hiding it behind the ? toggle is what made it feel "gone".
- Verify: tsc clean; cue/mark/parity suites 28/28; compositions identical.
