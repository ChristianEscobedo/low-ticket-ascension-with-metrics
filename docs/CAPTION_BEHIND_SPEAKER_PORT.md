# Caption Behind the Speaker — System Port

The "caption behind the speaker" look: the scene is DUPLICATED with its
background removed, and the transparent cutout rides the overlay lane ABOVE the
captions — so the speaker occludes the words you send behind. One click in the
studio, and it renders in the MP4.

## The stack

```
original clip  →  a `behind` word (z 5)  →  THE CUTOUT (z 6)  →  caption block (z 10)  →  front words (z 11)
                       └ under the subject ─┘                        └ every other word stays in front ─┘
```

A word goes UNDER the subject only when you send it there (right-click →
**Behind the subject**). Everything else stays in front.

## The pieces

- **`src/utils/integrations/fal-bg-remove.ts`** — the fal client. DEFAULT MODEL:
  `bria/video/background-removal/v3` (the cost-effective option). Its `auto_zoom`
  crops the output to the smallest rectangle the subject stays inside for the
  whole video (the subject fills the frame), and `output_container_and_codec:
  'mp4_h264'` returns an mp4. Same queue lifecycle as the other fal clients
  (submit → poll → fetch). Endpoint overridable via `FAL_BG_REMOVE_ENDPOINT`
  (the pixelcut `pixelcut/video-background-removal` model is the webm/alpha
  alternative). Auth: `Authorization: Key $FAL_KEY`.
- **`src/app/api/admin/reel-bg-remove/route.ts`** — `POST { videoUrl, fromSec?,
  toSec?, autoZoom?, model? }`. THE WINDOW: `fromSec`/`toSec` trim the clip to
  just the selected span BEFORE the removal (the ffmpeg worker's
  `trimRemoteClip` re-cuts it) — the bria model caps at 60s, so a longer clip
  must process a window, not the whole thing. Then it runs the removal and
  re-hosts the cutout into our storage (fal URLs are signed and expire).
  Returns `{ url, contentType }`.
- **Model catalog** — `BG_REMOVE_MODELS` in the integration: `bria` (the
  DEFAULT — cheapest, mp4 + auto_zoom) and `pixelcut` (webm · alpha). The
  route's `model` picks it; `FAL_BG_REMOVE_ENDPOINT` overrides.
- **Data model** — the cutout is a REAL overlay-lane entry:
  `ReelOverlayClip { …, isCutout: true }` on `ReelProject.overlays[]`
  (round-trips through the store; `normalizeReelOverlay` keeps the flag). It
  shows on the timeline's violet lane — drag to re-time, × to remove. (The
  earlier `ReelProject.cutouts[]` window still renders for back-compat, but the
  editor no longer writes it — nothing could re-time or remove an invisible
  window.)
- **The per-word `behind` mark** — `ReelWordMark.behind?: boolean` in
  `src/lib/mothermode/reel/types.ts` (normalize keeps it). A behind word is
  pinned at its xPct/yPct (it leaves the row flow — the row block is ONE
  z-layer, so a per-word z inside it can't reach the cutout).
- **Render plan** — `src/lib/mothermode/reel/render/plan.ts` rides `isCutout`
  onto the plan's overlays; `shiftWords` carries the word's mark (incl.
  `behind`) verbatim.
- **Caption layer** — `src/lib/mothermode/reel/render/captionLayer.tsx` splits
  the free-placed words into TWO z-layers: `behind === true` paints at z 5
  (UNDER the cutout), the rest at z 11 (over it). The row block stays at z 10.
- **Composition** — `remotion-project/ReelComposition.tsx` renders an
  `isCutout` overlay full-frame at z 6 (between the behind words and the
  block); the legacy `cutouts[]` path also sits at z 6. The vendored worker
  copy (`render-worker/remotion-project/`) is synced — the MP4 agrees.

## The editor actions

- **Make the cutout** — the per-row **Behind** button in the SubtitlePanel
  (right of the phrase text). It processes JUST that card's timing (the bria
  model caps at 60s), and the result lands as a `Cutout · <scene>` layer on the
  violet overlay lane — visible, re-timeable (drag), removable (×).
- **Send a word behind** — right-click a caption word ON THE CANVAS →
  **Behind the subject**. An un-placed word is first pinned exactly where it
  sits (the measured glyph centre), so it never teleports. Right-click again →
  **Bring in front of the subject** to undo.

## The canvas right-click word menu

Right-click any caption word on the canvas (Preview mode) opens the shared
`WordContextMenu` (`WordDragLayer.tsx`): **Free-place this word** / **Remove
placement** / **Behind the subject** + the full per-word style editor
(entrance, scale, color, FX, gradient, ambient, font, hide). In Edit mode the
WordDragLayer's hit boxes own right-click (the same menu). The page resolves
the clicked glyph's `data-caption-word` index back to the clip's own captions
index (`clipWordIndexFromPlanIndex` — the Remotion layer numbers words in the
timeline-merged plan list, the editor writes per-clip).

## Later refinements (same session)

- **Edit shows the on-screen page, not the whole card.** The caption layer's
  "show every word" behavior moved off the `freePlaceEdit` flag onto a new
  `showAllWords` plan flag — OFF by default, so Edit renders the same caption
  page Preview shows (no scatter). The `all` pill on the Edit/Preview toggle
  sets it (`stackEditMode && showAllCardWords`) when you want every word of the
  card. The MP4 never sets it. `WordDragLayer` also stops drawing a hit box for
  an un-placed word that isn't painted (no phantom boxes at guessed positions).
- **Right-click works in Preview.** The composition root is
  `pointer-events: none`, and the placed words carry `pointerEvents: 'none'`
  inline, so a right-click used to fall through to the `<video>` and pop the
  browser's save-video menu. A page-level `[data-caption-word]{pointer-events:
  auto!important}` rule makes the glyphs hit-testable, and the handler resolves
  the word from the FULL hit stack (`document.elementsFromPoint`) — so it works
  whether the click lands on the glyph or on the CaptionDragLayer's block-move
  box above it.
- **Leaving Edit saves.** `exitStackEdit` (the Preview toggle) flushes any
  in-flight drag offsets (`wordPlaceLocal`/`wordScaleLocal`) into the marks and
  POSTs — a drag that never committed is never silently dropped.
- **Word click never seeks.** The Remotion branch's word `onSelect` used to
  `seekTimeline(word.start)` — harmless when Edit showed every word, but with
  the on-screen page it flipped the visible page ("jumped back, showed the
  words before it"). It now selects without touching the playhead. (The
  Edit-stage branch never seeked; both are seek-free now.)
- **The fly-in drag box shows only while the image is on screen.**
  `cueOnScreen(cue)` (trigger word's span + its hold, in timeline seconds) gates
  the `CueDragLayer` — it no longer pins to the selected cue forever. One box
  per on-screen cue; clicking the box grabs AND selects it (`onSelect` →
  `setCueStyleEditId`). The ⚙ chip auto-seeks the playhead to the cue's word so
  the image (and box) appear. Mounted in both branches (Remotion + Edit stage).

## Notes

- The cutout is a transparent video; the `OffthreadVideo` composites its alpha
  over the caption layer. (The bria mp4 output is the cost-effective default;
  the pixelcut webm/alpha path is the alternative if the worker can't composite
  the mp4's alpha directly — set `FAL_BG_REMOVE_ENDPOINT` to switch.)
- `FAL_KEY` must be configured (the route 503s without it).
- Tests: `tests/lib/caption-behind-and-freeplace.test.ts` guards the z-stack,
  the `behind`/`isCutout` round-trips, and the Edit⇄Preview free-place parity.
