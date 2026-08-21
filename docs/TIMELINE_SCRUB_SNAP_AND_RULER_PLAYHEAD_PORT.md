# Timeline Scrub Snap + Ruler Playhead — Port Doc

**Date:** 2026-08-20
**Scope:** Reel Studio timeline — the "better playhead" pass.
**Tests:** tests/lib/scrub-snap.test.ts (6) · tsc clean.

## What landed

1. **Magnetic scrub snapping** — dragging the TimeRuler used to land on
   whatever 0.1s the pointer resolved to. Now a scrub within ~10px of a scene
   boundary lands ON it (0, every clip's `timelineStartOf`, the reel's end) —
   the CapCut/Premiere magnet. The threshold is pixel-derived
   (`(10 / rect.width) * totalSec`), so it tightens for free as the ruler
   zooms in.
2. **The playhead ON the ruler** — the strip's brass line used to be the only
   marker, so a ruler scrub had nothing to aim at. The ruler now draws the
   playhead (a line through the ticks + a diamond on the top edge) from a new
   optional `playheadSec` prop, wired from the page's studio clock.

## Files

| File | Change |
|---|---|
| `src/lib/mothermode/reel/scrubSnap.ts` | NEW — `snapToTargets(t, targets, thresholdSec)` + `timelineSnapTargets(clipStarts, totalSec)`. Pure, junk-proof (non-finite targets/inputs never snap). |
| `src/app/(fullscreen)/admin/reel-studio/page.tsx` | `TimeRuler`: new `playheadSec?` prop + marker JSX; `scrubFromEvent` snaps via the lib. Usage site passes `playheadSec={playheadSec}`. Import added. |
| `tests/lib/scrub-snap.test.ts` | 6 tests: capture inside threshold, free between boundaries, exact-threshold capture, junk never snaps, target list shape. |

## What did NOT change

- The strip's own playhead line (rAF-coalesced drag) is untouched — the ruler
  marker is additive.
- Pointer capture, zoom-aware ticks, word ticks, and boundary notches all
  behave as before; snapping only affects the value passed to `onScrub`.

## Porting notes (Omega-v2)

1. Copy `scrubSnap.ts` + its test verbatim (pure, no deps).
2. In the target's ruler component: compute `snapTargets` from clip starts,
   call `snapToTargets` inside the pointer-to-seconds conversion, and render
   the playhead marker from the studio clock prop.
