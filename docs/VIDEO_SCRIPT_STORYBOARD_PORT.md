# Video Script → Storyboard Port

One-click **auto-storyboard from the script** for Video production. It reuses the
existing Storyboard engine, segments the script into 15s (or 18s) boards — one
board per video-generation clip — and keeps the brand kit + lookback continuity
intact. The feature is mostly *wiring the script into the storyboard planner*
rather than a new engine.

## How it fits what already exists

- **`VideoScriptPanel`** generates a `VideoScript` — contiguous **beats** over
  `0..totalSeconds` (runtimes 15/30/45/60/90).
- **`StoryboardPanel`** + server `generateStoryboardPlan` (AI action
  `storyboardPlan`) already produce **connected cinematic boards** with **STRICT
  lookback** ("board k continues from board k−1"), character/product refs,
  narrative/b-roll modes, and the MotherMode brand-voice + art-direction system
  prompt. Boards persist on `review.storyboard` (`StoryboardPack`) and render in
  Image Studio.
- So the script-driven flow feeds the planner **one board per
  video-generation segment**, then writes the result to the same
  `review.storyboard` store the manual panel uses.

## The model: one board = one video-gen segment

Because renders are done in **15s or 18s generations**, a board maps 1:1 to a
segment window. Given a script of `totalSeconds`:

- `segmentLength` = **15** (default) or **18**, chosen by a small toggle.
- `boardCount = ceil(totalSeconds / segmentLength)` → 15s→1, 30s→2, 45s→3,
  60s→4, 90s→6 (at 15s). Capped at **6**.
- Board `k` covers window `[k·L, (k+1)·L)` and is fed **only that window's
  beats** (VO/shot/on-screen/b-roll), so its `imagePrompt`/`videoPrompt` reflect
  exactly what happens in that clip, while `lookbackSummary` keeps
  character/wardrobe/world congruent across all segments.

## Changes (small, additive, back-compat)

### 1. `src/lib/mothermode/content/review.ts` — widen board count + window fields
- `StoryboardCount`: `1|2|3|4` → **`1|2|3|4|5|6`** (a 90s/15s script needs 6).
- `StoryboardBoard` gains optional **`startSec?`**, **`endSec?`**,
  **`segmentDuration?`** so a board knows its clip window. All optional →
  existing packs unchanged.

### 2. `src/lib/mothermode/content/scriptStoryboard.ts` — pure segmentation helper (new)
Server-safe, no browser/network imports, fully unit-testable.
- `SCRIPT_SEGMENT_LENGTHS = [15, 18]`, `DEFAULT_SCRIPT_SEGMENT_LENGTH = 15`,
  `MAX_SCRIPT_STORYBOARD_BOARDS = 6`.
- `toSegmentLength(value)` → coerces to a supported clip length (default 15).
- `scriptBoardCount(totalSeconds, L)` → `ceil(total / L)` clamped to `[1, 6]`.
- `splitScriptIntoSegments(script, L)` → `ScriptStoryboardSegment[]`, each with
  `{ index, startSec, endSec, durationSec, beats }`. Every beat is assigned to
  the window containing its `startSec` (clamped to the last window), segments are
  contiguous, and the final window is clamped to the script runtime. Runtime is
  derived from beats when `totalSeconds` is missing.

### 3. `src/utils/integrations/openai-content.ts` — script-aware storyboard prompt
- `StoryboardPlanInput` gains optional **`sourceMode: 'post' | 'script'`** and
  **`segments?: StoryboardSegmentInput[]`** (`{ index, startSec, endSec,
  durationSec, beats: { shot?; onScreen?; voiceover; action?; broll?;
  brollPrompt? }[] }`).
- When `sourceMode === 'script'` and `segments` are present,
  `buildStoryboardPlanUser` appends a **"one board per segment"** block
  (`buildStoryboardSegmentBlock`): "Board k renders segment k as a SINGLE video
  generation; the videoPrompt must be a shootable clip direction for that
  segment window only." The existing **STRICT lookback** block and the brand
  voice + art-direction **system prompt stay exactly as-is**.
- `normalizeStoryboardBoards` echoes each segment's `startSec/endSec/
  segmentDuration` onto the returned board so it always knows its clip window.
  Return shape adds nothing required → back-compat.

### 4. `src/components/mothermode/content/aiClient.ts` — pass segments
- `aiGenerateStoryboardPlan` args gain optional **`sourceMode`** and
  **`segments: AiStoryboardSegment[]`**, threaded into the `postAi` body. No
  breaking change for the existing StoryboardPanel caller.

### 5. `src/app/api/mothermode/ai/route.ts` — forward the fields + clamp
- The `storyboardPlan` handler reads `sourceMode` (`'script'` else `'post'`),
  parses `segments`, **clamps board count to `1..6`**, and forwards
  `segments`/`sourceMode` to `generateStoryboardPlan` (segments only when
  `sourceMode === 'script'`).

### 6. `src/components/mothermode/content/VideoScriptPanel.tsx` — the new UX
When a script exists, a **"Generate storyboard from script"** button plus a
compact **15s / 18s** segment toggle and a computed hint (e.g. "6 boards · one
per 15s clip"). On click it:
- slices `script.beats` into segment windows via `splitScriptIntoSegments`,
- calls `aiGenerateStoryboardPlan({ ..piece.., boardCount: segments.length,
  mode: 'narrative', sourceMode: 'script', segments, model })`,
- writes the result with the shared storyboard setter (`setReviewStoryboard`),
  carrying over any existing `characterRef`/`referenceImages` so brand refs
  persist, and stamping each board's `startSec/endSec/segmentDuration`,
- surfaces an inline "Storyboard ready — N boards" note that links/scrolls to
  the existing Storyboard section for editing + Image-Studio rendering.

The script text also feeds the storyboard `piece.script`/`brollSeeds` so the
planner reads the actual VO.

## Design choices

- **Default segment length = 15s**, toggle to 18s. Board cap = 6 (covers the
  90s max at 15s).
- The auto-generated pack **reuses `review.storyboard`** (single storyboard per
  piece) rather than a separate store — so it opens/edits/renders through the
  existing Storyboard panel and Image Studio with **zero new render plumbing**.
- Mode defaults to **narrative arc** for script-driven boards (each clip is a
  story beat).

## Tests

`tests/lib/script-storyboard.test.ts` covers the pure helper (9 tests):
- `toSegmentLength` accepts 18, defaults everything else to 15 (strings not
  coerced).
- `scriptBoardCount` maps 15→1, 30→2, 45→3, 60→4, 90→6 at 15s; ceils at 18s
  (30→2, 45→3, 90→5); clamps to `[1, MAX]` and handles empty/`NaN` runtimes.
- `splitScriptIntoSegments`: one board per 15s clip for 90s; each beat lands in
  the window containing its start with none dropped; final window clamped to the
  runtime for non-multiples; single 15s board for a 15s script; runtime derived
  from beats when `totalSeconds` is missing.

Run:

```
npx vitest run tests/lib/script-storyboard.test.ts
```

## Files touched

- `src/lib/mothermode/content/review.ts` — `StoryboardCount` widened; board
  window fields added.
- `src/lib/mothermode/content/scriptStoryboard.ts` — new pure helper.
- `src/utils/integrations/openai-content.ts` — `sourceMode`/`segments`, segment
  prompt block, board window echo.
- `src/components/mothermode/content/aiClient.ts` — `sourceMode`/`segments`
  args.
- `src/app/api/mothermode/ai/route.ts` — forward fields, clamp `1..6`.
- `src/components/mothermode/content/VideoScriptPanel.tsx` — button + 15/18
  toggle + write to `review.storyboard`.
- `tests/lib/script-storyboard.test.ts` — segmentation unit tests.
