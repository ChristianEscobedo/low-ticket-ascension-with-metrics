# RVE-style timeline redesign — handoff

> **2026-08-21 status:** the board is live and at parity — per-type
> lanes, drag/trim/hold, snapping, zoom, Media/Audio rails. This wave
> fixed the last three papercuts: timeline play now drives the Player's
> own transport (smooth), lottie cues play fully (`playbackRate` fit),
> hold-drags persist (ref fix), and the timeline/preview split drags.
> See `docs/TIMELINE_RESIZE_AND_PLAYER_TRANSPORT_PORT.md`.

**Where this picks up.** The Reel Studio timeline is being rebuilt to read like
react-video-editor's (RVE): a left label gutter per track, colored blocks per
type, drag-to-move + edge-trim handles, and a transport bar. The playback bugs
are already fixed and live on main — this phase is purely the timeline's
look + structure.

## Already on main (do NOT redo)

| Commit | What |
|--------|------|
| `1196ae9` | Revert of the broken one-clock commit — the player works |
| `4ce2732` | Lane blocks share the filmstrip's 0–100% time axis |
| `05ace44` | Port doc updated (flags the reverted one-clock commit) |
| `a02492e` | Two-clock + trim-drag — the clock owns `playheadSec` while playing; a trim previews the cut frame without yanking the playhead |
| `4777ce0` | Choppy timeline play — the Player PLAYS itself when the clock plays (no more seekTo-every-frame); the follow effect only corrects real drift |

The playback model these landed: the page's rAF clock (`clockRef` + `clockTick`
in `page.tsx`) is the single writer of `playheadSec` while playing;
`RemotionPreview` gets a `playing` prop that maps to the Player's own transport
(so it plays itself smoothly), and its follow effect only seeks on real
divergence (>6 frames while playing, >1 while paused). While scrubbing, the
`scrubbing` prop pauses the Player and ignores its frame reports.

## The new component (written, compiles, NOT yet mounted)

`src/app/(fullscreen)/admin/reel-studio/TimelineBoard.tsx` — self-contained,
pure presentational. Renders the RVE layout:

- `Lane` — a row with a left label gutter (icon + name) + a track.
- `Block` — a draggable + edge-trimmable block (drag the body to move in time,
  drag the left/right edge to trim). Shared by every lane.
- Lanes: **video** (the scenes, drag to reorder + edge-trim + transition seam +
  keyframe diamonds), **captions**, **media** (image/sticker/lottie), **overlay**
  (b-roll, drag to re-time + × to remove), **audio** (drag to re-time + ×).

It takes the SAME handlers the current `TimelineStrip` mount uses, so behavior
is identical — only the layout changes. Props: `clips, captions, mediaCues,
overlays, audio, total, selectedId, onSelect, onTrim, onReorder, onScrub,
onScrubIn, onLeftTrim, onKeyMove, onTransition, onOverlayMove, onOverlayRemove,
onAudioMove, onAudioRemove`.

## The one thing to fix before mounting

**The video lane drops the `SpriteStrip` filmstrip.** The current
`TimelineStrip` renders each scene's frame thumbnails (`SpriteStrip` →
`/api/admin/reel-sprite`); `TimelineBoard`'s video lane shows only the name +
duration chips. The user explicitly likes the filmstrip — port it into the
video lane's block before mounting, or the timeline regresses visually.

## How to mount it

In `page.tsx`, the current timeline stack is (in order): `TimeRuler` →
`TimelineStrip` (the video filmstrip) → overlay lane → audio lane →
`TimelineLanes` (captions + media) → the playhead line. Replace
`TimelineStrip` + the overlay lane + the audio lane + `TimelineLanes` with ONE
`<TimelineBoard … />`, keeping `TimeRuler` and the playhead line where they are.

Wire the handlers from the existing `TimelineStrip` mount (around the
`<TimelineStrip` JSX) plus:

- `onOverlayMove={(id, offsetSec) => patchOverlay(id, { offsetSec })}`
- `onOverlayRemove={(id) => patch({ overlays: (project.overlays ?? []).filter((x) => x.id !== id) })}`
- `onAudioMove={(offsetSec) => patch({ audio: { ...project.audio!, offsetSec } })}`
- `onAudioRemove={() => patch({ audio: null })}`
- `captions={project.captions ?? {}}`, `mediaCues={project.mediaCues ?? []}`,
  `overlays={project.overlays ?? []}`, `audio={project.audio ?? null}`,
  `total={total}`

Then delete the now-unused `TimelineStrip`/`TimelineLanes` imports if nothing
else references them, and run `npx tsc --noEmit -p tsconfig.json` to confirm
clean.

## Caution

`page.tsx` is ~9800 lines. Read it in slices (`scripts/_peek.cjs <file> <start>
<end>` / `scripts/_grep.cjs <file> <pattern> [ctx]`), never whole. The
`SpriteStrip` component and the `TimelineStrip` mount are the two anchors to
read before editing.
