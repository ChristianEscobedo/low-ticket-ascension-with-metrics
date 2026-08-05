# Caption effects, per-word marks, and word-triggered media cues — port (2026-08-05)

The three-tier caption upgrade, shipped in one pass. Everything renders in the
ONE shared layer (`captionLayer.tsx`), so preview = MP4 by construction.

## Tier 1 — effects in the shared layer (no data model change)

- **All 17 anims are frame-driven now.** `entranceStyle()` covered only 6 of the
  12 CSS anims (the rest silently fell back to pop — Opus's blurIn, Bounce Box,
  Glitch Tape all rendered as pop). Completed all 12 plus 5 new:
  `riseMask`, `springPop`, `neonFlicker`, `glowPulse`, `cascade`.
- **Ghost fade** (`blockFx: ['ghostFade']`): each PAGE of rows fades in on
  arrival and out before the flip. Page boundaries come from the same word
  window `captionRows` uses — derived, never stored (a row index would drift).
- **Float** (`blockFx: ['float']`): ambient bob on the caption block, driven by
  the frame clock (identical loop in the MP4).
- **Karaoke progress fill** (`karaokeFill: true`): the active word fills with
  the active color left-to-right across its OWN fromFrame→toFrame — the
  Submagic/Hormozi sweep, glued to the audio by construction.
- **New presets:** Ghost, Floater, Fill Sweep, Sign On, Cascade.

## Tier 2 — per-word marks

`ReelWord.mark = { anim?, color?, scale?, stagger? }` — words are transcript
DATA (stable address), so they're the one place per-beat styling may live.
- `normalizeWordMark` in types.ts validates against `CAPTION_ANIMS` (unknown
  anim DROPS the key — never a silent substitution), clamps scale 0.5–3,
  stagger 0.005–0.5s. Both junk → the whole mark drops.
- `shiftWords` copies the mark verbatim into the plan; the layer applies it:
  `mark.anim` overrides the preset entrance for that word, `mark.color` carries
  even when idle (and beats gradient fills), `mark.scale` multiplies into the
  transform, `mark.stagger` triggers a per-letter cascade with that delay.
- Tests: `tests/lib/caption-word-marks.test.ts` (normalization + plan
  passthrough + every anim having a frame-driven case).

## Tier 3 — word-triggered media cues (image fly-ins)

`project.mediaCues = [{ id, clipId, wordIndex, url }]` — an image flies in when
a specific word is SAID.
- Keyed on (clipId, wordIndex) — the transcript-derived address. `shiftMediaCues`
  in plan.ts resolves each cue to timeline frames from the word's own start/end
  (+ 1.0s hold, clamped to the surviving window; trimmed-away words drop the
  cue, exactly like shiftWords).
- Both compositions render cues as `<Sequence>`s with a frame-driven rise+scale
  entrance and fade exit (never a CSS clock). remotion-project and
  render-worker/remotion-project carry the IDENTICAL file (edit one, copy over).
- UI (Captions tab): "cue word" toggles cue mode → click a word in the
  SubtitlePanel → pick a Media Library image; cued words get a violet
  underline. "auto" runs the deterministic `suggestCuesForWords` matcher
  (strong transcript words × library names/tags, one cue per pair, cap 8).
- Tests: `tests/lib/media-cues.test.ts` (normalization, frame resolution,
  trimmed-word drop, deterministic proposals).

## The rule that kept this from becoming bug #5

Every effect is FRAME MATH over the word timings — nothing is stored per row or
letter, so a trim/split/re-transcribe can never orphan an effect. Rows and
letters are derived; words hold state. That is the same rule as
`CAPTION_DRAG_AND_RESIZE_HANDLES_TASK.md`, applied to all three tiers.

## Verify

- 242/242 across the 8 caption/render suites · `npx tsc --noEmit` clean ·
  vendored copies byte-identical (`scripts/sync-vendored-captions.cjs --check`)
