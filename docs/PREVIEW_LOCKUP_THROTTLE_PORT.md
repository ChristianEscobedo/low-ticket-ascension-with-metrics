# Preview Lock-Up Fix — Throttled Plan Rebuilds — Port Doc

**Date:** 2026-08-20
**Scope:** Reel Studio preview ("locks up every now and then" during drags/edits).
**Tests:** tests/lib/preview-throttle.test.ts (4) · tsc clean.

## The bug

`RemotionPreview` built the render plan in a render-time `useMemo` keyed on the
`project` object. Any edit that streams state changes — a word drag, a cue move,
a style slider — fires at pointermove rate (~60/s), and each change rebuilt the
plan synchronously and handed the Player new `inputProps`, re-rendering the
ENTIRE composition (every OffthreadVideo, every caption word) 60 times a
second. The main thread never gets ahead of the drag: that's the lock-up.

## The fix (two parts, both in the preview layer — the render path is untouched)

1. **Content signature, not object identity** — `RemotionPreview.tsx` computes
   a `JSON.stringify` signature of the plan inputs and only rebuilds when it
   actually changes. A field-level cache (project identity + fps + size +
   flags) lets the 30fps playback re-renders skip even the stringify.
2. **Throttled application** — rebuilds apply at most once per
   `PREVIEW_PLAN_MIN_GAP_MS` (100ms) via `planRebuildWaitMs(lastBuildAt, now)`
   in `src/lib/mothermode/reel/previewThrottle.ts`. The trailing timeout always
   applies the latest signature, so the final state is never stale — a drag
   just previews at ~10fps of plan updates instead of 60.

The plan is now component STATE (`useState` + lazy initializer for the first
frame), updated by the throttle effect — never built inline during render.

## What did NOT change

- The seek/restore/frame-writeback effects are byte-for-byte the same; they
  read `plan` state exactly as before.
- The Player stays mounted; `inputProps` identity only changes when a
  throttled rebuild lands.
- The render worker never sees any of this — it builds its own plan per job.

## Porting notes (Omega-v2)

1. Copy `src/lib/mothermode/reel/previewThrottle.ts` verbatim (pure, no deps).
2. In the target's preview component, replace the plan `useMemo` with the
   `buildArgsRef` + `buildPlan` + `useState` + signature-cache + throttle-effect
   block from `RemotionPreview.tsx` (clearly commented "THE LOCK-UP FIX").
3. Bring `tests/lib/preview-throttle.test.ts`.
