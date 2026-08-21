# Timeline Resize + Player-Transport Playback — Port Doc

**Date:** 2026-08-21
**Scope:** Reel Studio timeline/preview — four fixes that together make the
RVE-style TimelineBoard feel native: the timeline play button is as smooth as
the Player's own, lottie cues play their FULL animation, lane hold-drags
persist, and the timeline/preview split is user-resizable.
**Commits:** 1363e35 (transport + lottie fit + hold persist) · the resize
splitter lands in the same wave.
**Tests:** tsc clean; no new runtime state to guard (all four are UI-side).

## 1. Remotion-mode play models the Player's own transport

**Problem.** Pressing play from the TIMELINE toolbar stuttered badly while the
Player's own play button was smooth. The page ran its rAF playback clock
(`startClock` → `clockTick` → setState + `syncVideoToClock` every frame)
ON TOP of the Remotion Player, which was already playing itself via the
`playing` prop — two clocks fighting.

**Fix.** In `page.tsx`, `startClock` and `togglePlay` short-circuit in
remotion preview mode (`previewMode === 'remotion' && !stageIsBlob`): they
just flip `setPlaying` and return. The Player owns playback; the playhead
still tracks via `onPlayerFrame` (already gated on `p.isPlaying()` for the
#185 fix). Pressing play at the end seeks to 0 first (replay-from-the-top).
`RemotionPreview` gained an `onEnded` prop — its frameupdate listener fires
it at `plan.durationInFrames - 1` so the transport stops at the end.

## 2. SafeLottie fits the animation into the cue window

**Problem.** A lottie cue played only the first beat of the animation: the cue
window (holdSec) was shorter than the lottie's own duration and nothing
re-timed it.

**Fix.** `SafeLottie` (in BOTH `remotion-project/ReelComposition.tsx` and
`render-worker/remotion-project/ReelComposition.tsx` — keep them mirrored)
takes a `windowSec` prop. After the JSON validates it reads `ip`/`op`/`fr`,
computes the lottie's own seconds, and sets `playbackRate = lottieSec /
windowSec` (rounded to 2dp) so the full animation lands inside the cue's
on-screen window. Usage:
`<SafeLottie src={cue.src} style={mediaStyle} windowSec={cue.durationInFrames / fps} />`.

## 3. Lane hold-drag persists (stale closure)

**Problem.** Dragging a media cue's right edge on its TimelineBoard lane
snapped back on pointerup — the new hold never saved.

**Fix.** Classic stale closure: the pointerup handler was bound at pointerdown
render time and saw `liveHold === null`. `TimelineBoard.tsx` now mirrors
`liveHold` into `liveHoldRef` on every render and the lane's `onDragEnd`
reads the ref, then calls `onCueHold(id, held.hold)` → `patchCue` →
`saveMediaCues` POST. Rule of thumb: ANY value a window-level pointerup
handler needs must come from a ref.

## 4. Timeline ⇄ preview resize splitter

**Ask.** "Reduce the size of the timeline / expand the preview."

**Fix.** The stage column is already
`grid-rows-[auto_minmax(0,1fr)_auto]` — the stage row is `1fr`, so it
absorbs whatever the timeline row gives up. The patch adds:

- `const [timelineH, setTimelineH] = useState(0)` (0 = auto, the layout
  default) and `timelineBoxRef` next to `stageRef` in `page.tsx`.
- A 6px `cursor-row-resize` splitter bar directly above the timeline box.
  Pointerdown captures `startY` + the box's `offsetHeight`, window-level
  pointermove sets
  `timelineH = clamp(140, startH + (startY - clientY), 70vh)`, pointerup
  removes the listeners. Double-click resets to auto.
- The timeline box becomes
  `className={clsx('shrink-0 px-4 pb-4', timelineH > 0 && 'overflow-y-auto')}`
  with `style={timelineH > 0 ? { height: timelineH } : undefined}`.

Drag UP for a taller timeline (smaller preview), DOWN for a bigger preview.
No persistence — it's a per-session comfort control.

## Carry-over checklist

1. `page.tsx`: the two transport short-circuits, the `onEnded` mount, the
   splitter + `timelineH`/`timelineBoxRef`.
2. `RemotionPreview.tsx`: `onEnded` prop + the last-frame fire.
3. `TimelineBoard.tsx`: `liveHoldRef` mirror + ref-read in `onDragEnd`.
4. Both `ReelComposition.tsx` copies: `SafeLottie` `windowSec` +
   `playbackRate`. Re-sync the vendored worker copy and rebuild the image.
