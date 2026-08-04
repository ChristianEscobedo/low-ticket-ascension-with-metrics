# R25 — The Playback Clock, Instant Splits, and Overlay Layers

**Status:** shipped. 45/45 reel tests green, `tsc --noEmit` clean.

**R25b (same day, user-verified):** two follow-up fixes after the first pass —
(1) the rAF chain re-scheduled the SAME closure every frame, so `total` froze
at play-press and trimming mid-play still ran to the old end → the loop now
reads `{project, total}` through `clockStateRef`, never a closure; (2) the
timeline's inner container was `min-w-full`, so %-positioned playhead/ruler
stretched to the viewport while px-sized blocks stayed at scale (the playhead
sat PAST the trimmed block) → the container is now exactly `total * 36 * zoom`
px so both references agree.

## Why

Three rounds of "trimmed clip plays through its tail" patches (R21 fence → R23
media-event fence → NaN guard) proved the model was wrong: each clip's `<video>`
free-ran and we tried to *fence* it at the trim. State/element races, NaN ends,
and src-swap gaps kept leaking one repaint of the trimmed tail.

## The fix: ONE clock

`page.tsx` now owns a single playback clock (`clockRef`): a rAF loop advances
the timeline second, and the `<video>` element is a **dumb frame server** that
gets hard-synced every frame (`syncVideoToClock`):

- clock crossed into another scene → swap `v.src` (with a `swappingRef` guard so
  the swap's pause event isn't read as a user pause)
- drift > 0.12s → seek
- clock hits `total` → stop. **Overrun is impossible** because the element never
  decides anything.

`clipAtTime(clips, t)` (timeline.ts) is the lookup: which clip owns timeline
second `t`, its start, and the clip-local offset. The stage shows the clip under
the clock (`stageClip`); the inspector selection (`currentClip`) is separate.

## Instant splits + left-edge trims (no server round-trip)

`ReelClip.trimStartSec` (types.ts) is the in-point. `effectiveClipDuration` now
subtracts BOTH trims. `splitClipAt(clip, localSec)` (timeline.ts) is a pure
client-side split: part A keeps the id with the tail cut, part B rides the SAME
source with `trimStartSec = the cut`. Split (S) and left-edge drag are now
instant, undo-safe, and work with the ffmpeg worker down.

**Compose materializes in-points:** fal compose can't do in-points, so
`compose()` first runs `materializeInPoints()` — each clip with a
`trimStartSec > 0.05` gets re-cut by the ffmpeg worker (the same `split` action
the silence chain uses), leaving a clean 0-start source, then composes.

## Overlay (b-roll) layers

`ReelOverlayClip extends ReelClip` adds `offsetSec` — a clip laid ON TOP of the
main track at a timeline offset. Rides the project JSONB (`overlays` key,
normalized in types.ts, carried by `upsertReelProject` + the save route).

- **Stage:** picture-in-picture `<video>` (bottom-right, 30% width, muted),
  clock-synced in `syncVideoToClock`.
- **Timeline:** a violet lane under the main strip — drag a block to re-time
  its `offsetSec`, ✕ removes it.
- **Scenes panel:** "Overlay layers" card — paste a b-roll URL, it lands at the
  playhead.
- Compose burn-in for layers is **not** in this round (preview-only for now).

## Also fixed

- `upsertReelProject` now carries `captionOverrides` (they were silently dropped
  on save since R17c) and `overlays`.

## Files

- `src/lib/mothermode/reel/types.ts` — `trimStartSec`, `ReelOverlayClip`,
  `overlays` plumbing + normalizers
- `src/lib/mothermode/reel/timeline.ts` — in-point math, `clipAtTime`,
  `splitClipAt`
- `src/lib/mothermode/reel/store.ts` — save carries captionOverrides + overlays
- `src/app/api/admin/mothermode-reel/route.ts` — save route passes them through
- `src/app/(fullscreen)/admin/reel-studio/page.tsx` — the clock, instant
  split/trim, materialize-on-compose, PiP + lane + add-layer UI
