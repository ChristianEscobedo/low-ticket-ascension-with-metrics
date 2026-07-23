# Reel Assembly System Port

Final stage of the Reel Director pipeline: once every storyboard board carries a
finished Seedance clip, the admin can stitch them into a single reel — optionally
laying a combined voiceover over the whole cut — and persist the result onto the
piece review.

This doc covers the pieces added in this round. The upstream stages (Film Bible
context, `buildSeedancePrompt`, MUAPI Seedance render, per-board persistence) are
covered in `SEEDANCE_VIDEO_PIPELINE_SYSTEM_PORT.md`, `SEEDANCE_RENDER_UX_PORT.md`,
and `SEEDANCE_MODEL_SELECTOR_PORT.md`.

## Data model (`src/lib/mothermode/content/review.ts`)

- `ReelCut` — the persisted final reel on a `PieceReview.reel`:
  - `videoUrl?` — public (Supabase-rehosted) URL of the assembled MP4.
  - `wrapper: ReelWrapper` — audio treatment applied (`silent | voice | music | voice+music`).
  - `boardOrder: number[]` — board indices in the exact stitch order.
  - `durationSec?` — total runtime (sum of source clip durations).
  - `status: ReelCutStatus` — `idle | assembling | done | failed`.
  - `requestId?` — fal request id for the in-flight/last assembly.
- All fields are additive/optional, so existing reviews are unaffected.

## Pure planner (`src/lib/mothermode/content/reelAssembly.ts`)

Storage-agnostic, server-safe, fully unit-tested. No fetch/canvas/React.

- `buildReelAssemblyPlan(review, wrapper): ReelAssemblyResult` — the entry point.
  Returns a clear error string when the piece has no boards, any board is
  unrendered, or a voice wrapper is chosen without a combined voiceover on the
  script. On success returns a `ReelAssemblyPlan` with ordered `clips`,
  `boardOrder`, `wrapper`, optional `audioUrl`, and total `durationSec`.
- Helpers: `assembledBoards`, `boardsReadyForAssembly`, `boardsRemaining`,
  `boardClipDuration` (explicit `segmentDuration` → `startSec/endSec` window →
  `DEFAULT_CLIP_SECONDS`), `wantsVoiceover`, `assemblyVoiceoverUrl`,
  `describeWrapper`.
- Music beds are deferred: `music` / `voice+music` fall back to voice-or-silent
  behavior (surfaced via `describeWrapper`).

## Integration (`src/utils/integrations/fal-ffmpeg.ts`)

Server-only fal.ai ffmpeg compose client. Same submit → poll → fetch lifecycle
as `fal-smart-resize.ts`; reuses the `AiResult` shape.

- `buildComposePayload(input)` — builds the compose "tracks" payload: one video
  track whose keyframes are the clips laid end to end, plus (when present) one
  audio track spanning the full runtime for the voiceover. Exported for tests.
- `assembleReel(input, opts?)` — submits, polls to `COMPLETED` (default 5-min
  timeout, 2s poll), returns `{ videoUrl }`. Handles inline-complete responses,
  `FAILED`/`CANCELLED`, and timeouts with typed error results.
- `isReelAssemblyConfigured()` — true when a `FAL_KEY` / `FAL_API_KEY` is set.
- Endpoint defaults to `fal-ai/ffmpeg-api/compose`, overridable via
  `FAL_FFMPEG_ENDPOINT`. Auth: `Authorization: Key $FAL_KEY`.

## API route (`src/app/api/mothermode/content/reel-cut/route.ts`)

Thin server boundary: validates the incoming clips/audioUrl, calls
`assembleReel`, and returns the composed URL (+ duration). No secrets leak to the
client.

## Client (`src/components/mothermode/content/reelCutClient.ts`)

`assembleReelCut({ clips, audioUrl })` — POSTs to the route and returns
`{ videoUrl, durationSec }`, throwing a friendly error on failure.

## Panel (`src/components/mothermode/content/ReelDirectorPanel.tsx`)

Adds the "Assemble final reel" section beneath the per-board render cards:

- Derives readiness from the pack via `boardsReadyForAssembly` /
  `boardsRemaining`; the assemble button is disabled while any clip is still
  rendering, while assembling, or until all boards are ready.
- On click, wraps the pack as a review, builds the plan (surfacing planner
  errors — e.g. missing voiceover for a voice wrapper), marks the reel
  `assembling` via `patchReviewReelCut`, calls `assembleReelCut`, then persists
  `videoUrl` + `durationSec` + `done` (or `failed`).
- Shows the wrapper description, remaining-clip count, an inline error slot, and
  an inline `<video>` preview of the finished reel.

## Persistence (`src/components/mothermode/content/reviewClient.ts`)

`patchReviewReelCut(offerSlug, pieceId, patch)` — merges a `Partial<ReelCut>`
onto `review.reel` and returns the updated review so the parent can refresh.

## Environment

- `FAL_KEY` (or `FAL_API_KEY`) — required to enable assembly.
- `FAL_FFMPEG_ENDPOINT` — optional override for the compose deployment.

## Tests

- `tests/lib/reel-assembly.test.ts` — 15 tests over the planner (ordering,
  readiness, duration math, wrapper/voiceover rules, error strings).
- `tests/lib/fal-ffmpeg.test.ts` — 3 tests over `buildComposePayload` (sequential
  timestamps, optional audio track, config guard).

All 50 tests across the Seedance/reel/brand-bible suites pass; `tsc --noEmit` is
clean.
