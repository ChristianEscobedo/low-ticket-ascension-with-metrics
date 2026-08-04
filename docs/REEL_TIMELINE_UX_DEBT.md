# Reel Timeline UX Debt â€” NEXT SESSION

Logged 2026-08-02 (after R23 trim-playback fix). The user's quote: _"the timeline
isn not working the way it should (it seems a little funky tbh)"_. We fixed the
concrete bug he could name (trimmed clips played their whole source). These are
the rough edges still underneath it, in the order a real editor user would hit them.

Read first: `src/lib/mothermode/reel/timeline.ts` (now has `clipPlaybackAction`),
then the strip + stage in `src/app/(fullscreen)/admin/reel-studio/page.tsx`.

## What R23 + R24 fixed (don't re-do)

- **R23: trimmed clip played its whole source.** The rAF playhead loop consulted React
  `playing` state and only flipped state on `advance` â€” it never called
  `video.pause()`. Any moment state and the element disagreed, the tail leaked.
  Now: `clipPlaybackAction(time, clip, { isLast })` is the ONE authority, called
  from BOTH the rAF loop AND `onTimeUpdate`, and it pauses the element first.
- **R24: the fence was silently dead for any clip with `trimEndSec: undefined`.**
  `effectiveClipDuration` did `durationSec - Math.max(0, clip.trimEndSec)` â€”
  undefined â†’ NaN â†’ `localSec >= NaN` never true â†’ the video rolled past the
  block EVEN ON FRESH ADDS (the user's exact re-report). Now: `trimEndSec ?? 0`,
  NaN-duration guard, corrupt end â†’ `'stop'`, and both fences HARD-clamp
  `v.currentTime` to the cut frame on stop. Locked by 10 tests in
  `tests/lib/reel-trim-playback.test.ts`.

## The debt list

### D1 â€” Whole-reel playback is still a stop-motion flipbook

The preview swaps the `<video key={clipUrl}>` per scene. At every scene
boundary: new network fetch â†’ `loadedmetadata` â†’ `onLoadedMetadata` â†’ `play()`.
So multi-scene playback stutters/blacks for a beat per scene. The composed MP4
already exists as a fallback but never plays the TRIMMED timeline.

**The fix (pick one, A is smaller):**
- **A. Two-deck pattern**: keep TWO `<video>` elements; while deck A plays
  scene N, deck B is already `src`-set + `preload='auto'` + seeked to 0 for
  scene N+1. At `advance`, swap visibility + `play()` the warm deck.
- **B. WebCodecs/MediaSource timeline player** (real solution, big): one canvas,
  frames fed by sequential source buffers. CapCut-lite territory.

### D2 â€” Scrub desync: preview doesn't follow the ruler live while playing

`seekTimeline` seeks only when `currentClip.id === target clip.id` via the ref;
otherwise it queues `pendingSeekRef` â€” which only fires on `loadedmetadata`,
so a scrub while paused into a DIFFERENT scene can show a stale frame until the
element emits metadata. Drag the playhead across scenes while paused and the
stage can sit on the wrong frame.

**The fix:** in `seekTimeline`, if the target scene is already the mounted
element's `data-clip-url`, always `currentTime = offset` immediately; else set
`src` directly instead of relying on `key` remount + pending seek, and seek in
`onloadeddata` (first frame) not just `onloadedmetadata`.

### D3 â€” Trim-by-drag ends at a different place than it looked

`TimelineStrip` computes `pxPerSec` from `eff` (post-trim) but `scrubToCut`
shows `durationSec - trim - 0.05`. During a live right-edge drag the block's
width is driven by `live` state while `scrubToCut` reads the OLD clip â€” one
frame of lag makes the scrub frame wobble left of the handle. Minor but "funky".

**The fix:** pass the LIVE trim value into `scrubToCut` (already does â€” the wobble
is `setLiveTrim(null)` firing before `onTrim` commits state; order the callbacks
so the block never re-renders with the old width between drag-end and patch).

### D4 â€” No way to drag the IN-point visually (left edge is server-only)

Left-edge drag â†’ release â†’ `leftTrimAt` â†’ server `split` â†’ delete part A. The
block JUMPS (new duration, re-probed) and undo history doesn't cover the server
cut (Ctrl+Z restores the pre-split clips array but the SOURCE is gone â€” actually
fine, split is non-destructive to the URL, but the history stack has no entry,
so undo after a left-trim restores something older than expected).

**The fix:** make in-point a first-class `trimStartSec` on `ReelClip`
(client-side, like `trimEndSec`) so the left edge behaves EXACTLY like the
right edge â€” then have `split`/compose honor `trimStartSec`. Bigger migration
(store + compose + tests) but kills a whole class of "funky".

### D5 â€” Audio bed is decorative during multi-scene playback

`syncAudioAt` re-anchors on play/pause/scrub but NOT on the auto-advance â€” when
scene N ends and N+1 starts, the bed keeps its old position (usually right, but
if the user re-scrubbed mid-advance the bed and picture separate). Also the bed
never pauses during the per-scene metadata gap (D1), so it drifts by the gap.

**The fix:** call `syncAudioAt(timelineStartOf(next), true)` inside the advance
path (both rAF + onTimeUpdate copies), and re-sync in `onLoadedMetadata` when
`keepPlayingRef` fires.

### D6 â€” Zoom is linear px/sec, so zoomed-in precision is uniform (fine) but
the playhead auto-scroll teleports (janky)

`stripScrollRef` effect jumps `scrollLeft` to center whenever the playhead
leaves a 40/80px margin. During playback it lurches every ~screen. Editors
scroll-follow smoothly (or use a moving-needle-fixed-strip mode).

**The fix:** ease with `scrollTo({ left, behavior: 'smooth' })` or, better,
playback mode = fixed playhead at 30% width and translate the strip container
by `-playheadX`.

## Order suggestion

D4 first (it makes the left edge honest and unblocks D1's mental model), then
D1-A (two-deck), then D2, D5 together (both are "picture and bed disagree"),
D3 (polish), D6 (polish). D4 touches: `types.ts`, `store.ts`, `fal-ffmpeg.ts`
(compose must trim heads too), `silence.ts` (leftTrim chain), tests.

## Verified at close

`npx vitest run tests/lib/reel-trim-playback.test.ts tests/lib/caption-presets.test.ts tests/lib/reel-studio.test.ts`
â†’ **35/35 green** (8 new trim-playback, 14 caption karaoke, 13 timeline).

## R25 — RESOLVED: the fences are gone, replaced by THE CLOCK

The trimmed-tail saga ended by inverting the model: no more fences. A single rAF playback clock owns the timeline second and the video element is hard-synced to it every frame (swap on scene change, seek on drift > 0.12s, stop at total). Overrun is impossible because the element never decides anything. Split (S) and left-edge trim are now INSTANT client-side ops riding trimStartSec; compose materializes in-points via the ffmpeg worker first. Overlay (b-roll) layers shipped as clock-synced PiP + a violet timeline lane. See docs/REEL_PLAYBACK_CLOCK_AND_LAYERS_R25.md.

## R25b–R28 — FINAL STATUS (2026-08-03): the debt list is closed

Every item above is now resolved or superseded:

- **D1/D2** — the clock drives ONE element; `syncVideoToClock` seeks the mounted element on every timeline change (no remount fences, no stale frames). R25b's `clockStateRef` live mirror fixed the last stale-total leak when trimming mid-play.
- **D3** — `scrubToCut` seeks the CLOCK (single source of truth); drag wobble is gone.
- **D4** — DONE via `trimStartSec`: the left edge is instant client-side exactly like the right; compose materializes in-points via the worker (`sourceSeconds` split mode).
- **D5** — the bed syncs through `syncAudioAt` on every clock tick (advance included), not just play/pause/scrub.
- **D6** — the only remaining polish: auto-scroll-follow is still a hard jump during playback (smooth-follow or moving-needle mode). Low priority.
- **R28 (new surface, not debt)**: `pxPerSec = max(36 × zoom, stripWidth / total)` — the strip always fills the canvas; short timelines zoom in instead of shrinking. See `docs/REEL_STUDIO_R25_R28_PORT.md`.
