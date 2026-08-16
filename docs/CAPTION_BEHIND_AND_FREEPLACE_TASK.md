# Caption Behind the Speaker + Free-Place Precision — Task

## Status: SHIPPED (2026-08-15)

All four pieces landed. See `docs/CAPTION_BEHIND_SPEAKER_PORT.md` for the
system port and `tests/lib/caption-behind-and-freeplace.test.ts` for the
guards (48/48 caption tests pass, tsc clean). Summary:

- **fp persistence** — Edit mode now renders the SAME theme rows as
  Preview/render (the one-row collapse is gone), and the free-place overlay
  reads its type metrics (fontFamily/fontWeight/letterSpacing) off `css.line`
  (they were never on `css.word` — the "placed text renders thinner" bug).
  Edit ⇄ Preview ⇄ render map 1:1.
- **Behind rebuild** — the bg-remove cutout is a REAL overlay-lane layer
  (`isCutout` on `ReelProject.overlays[]`) — visible on the violet lane,
  re-timeable (drag), removable (×). A per-word `behind` mark paints that word
  UNDER the cutout (z 5 < cutout z 6 < block z 10 < front words z 11).
- **Per-word move + right-click menu** — right-click any caption word on the
  canvas (Preview) opens the shared `WordContextMenu`: Free-place / Remove
  placement / Behind the subject + the full style editor. Edit mode's
  WordDragLayer owns right-click there (the same menu).
- **Round 2/3 polish (same session)** — Edit mode shows just the on-screen
  caption page by default (the new `showAllWords` plan flag, off unless the
  `all` pill is on — no more whole-card scatter); right-click works in Preview
  (the `[data-caption-word]{pointer-events:auto}` rule + an `elementsFromPoint`
  hit-stack, so it lands on the glyph even under the block-move box); leaving
  Edit saves pending placements (`exitStackEdit`); a word click no longer seeks
  the playhead; and the fly-in drag box shows only while the image is on screen
  (`cueOnScreen`), with click-to-select + the ⚙ auto-seek.

---

Four linked pieces on the caption editing flow. The fp persistence bug is the
priority (it's a deep layout issue); the "Behind" rebuild + the per-word move +
the right-click menu build on it.

## 1. The fp persistence bug (the priority — still not exact)

**Reported:** "the fp edit still is not exact after removing fp edit on the
preview — the un-editing text jumps up a bit and the size does not persist."

**The deep issue:** Edit mode and Preview/render render DIFFERENT layouts.
- **Edit** (`freePlaceEdit` on): the layer renders ONE row holding every word
  of the phrase (all visible + draggable).
- **Preview/render**: the layer renders the theme's rows (a slice) + the
  free-placed words in the absOverlay.

So the Edit-mode drag positions the word against the Edit-mode layout, which
differs from the Preview layout. When you toggle to Preview, the un-edited
words reflow from the one-row-holding-everything to the theme's rows — they
jump. And the free-placed word's size: the first fix (the `isFreePlaced` check
in the `themePaint` ternary, so a placed word paints `css.active` in Edit AND
Preview) is in + locked in (`tests/lib/caption-freeplace-persistence.test.ts`),
but the LAYOUT difference (Edit's one-row vs Preview's theme rows) is the
deeper half — the drag coords are computed against the Edit box, which isn't
the Preview box.

**The fix direction:** make Edit mode render the SAME layout as Preview (the
theme's rows + the absOverlay), so the drag coords map 1:1. The Edit-mode
"show every word" is a VISIBILITY concern (you must see all words to drag
them), not a LAYOUT concern — the words should sit where Preview puts them,
just all visible + draggable. Audit `captionLayer.tsx`'s `rows` computation
(the `freePlaceEdit ? [one row] : theme rows` branch) and the WordDragLayer's
`snapPct` (the box it measures against).

## 2. "Behind" as a timeline layer (the rebuild)

**Reported:** "the remove background is only removing the background — we need
to make a new layer over the original too, and the text can move back."

**The model:** the cutout is a NEW LAYER over the original — a duplicate clip
on the overlay lane (the background-removed version of the scene, on top), not
an invisible `cutouts[]` window. You see it on the timeline, re-time it,
remove it. Then a per-word "place behind" puts a word UNDER the layer (z-index
back) — the speaker occludes that word.

- The current `cutouts[]` + the composition's cutout layer become the overlay
  lane entry (a `ReelOverlayClip` with the cutout URL + a `isCutout` flag).
- A per-word `mark.behind = true` renders that word UNDER the cutout layer
  (z-index below it); the rest render over it.
- A mode setting (global default + per-word override): `word-behind` (a
  selected word goes behind — the default), `effect` (the whole caption block
  under it), `replace-bg` (the cutout replaces the background — later).

## 3. Move ONE caption without moving all of them

**Reported:** "would be great to be able to move the text on screen without
moving all captions — right now if I move the text all of the captions are set
there too."

**The issue:** the CaptionDragLayer moves the WHOLE caption block (the
`xPct`/`positionPct` overrides apply to every word). The user wants to move
ONE caption (a word) without moving all of them — that's the free-place
per-word move (the WordDragLayer), but it should be reachable without entering
fp mode first.

**The fix direction:** a per-word drag on the preview that free-places JUST
that word (writes its `xPct`/`yPct`) without touching the block overrides.
The right-click menu (#4) is how you reach it.

## 4. Right-click the preview text for actions

**Reported:** "would be great to be able to right click text on preview and do
things like behind trigger or fp trigger."

**The model:** a right-click context menu on the preview's caption text:
- **Free-place** — drag this word anywhere (the per-word move, #3).
- **Behind** — place this word behind the cutout layer (the per-word
  place-behind, #2).
- **Style / FX** — the existing WordDragLayer style menu (entrance, scale,
  color, FX, font).

The WordDragLayer already has a right-click style menu — this extends it with
the free-place + behind actions, and mounts it on the preview's caption text
(not just in fp mode).

## The order

1. **The fp persistence bug** — the deep layout fix (Edit renders Preview's
   layout). Everything else builds on a precise fp.
2. **"Behind" as a timeline layer** — the cutout on the overlay lane + the
   per-word place-behind + the mode setting.
3. **The per-word move + the right-click menu** — the UX that reaches them.

## Verified so far

- The `isFreePlaced` themePaint fix is in + locked in
  (`tests/lib/caption-freeplace-persistence.test.ts`, 2/2) — a placed word
  paints the full theme weight in Edit AND Preview/render.
- The "Behind" v1 pipeline is built (the fal bria integration, the
  `reel-bg-remove` route with the window trim, the model catalog, the
  SubtitlePanel per-row trigger). The timeline-layer rebuild (#2) replaces the
  invisible `cutouts[]` window with a real overlay-lane entry.
- `docs/FREEPLACE_PERSISTENCE_FINDING.md` + `docs/CAPTION_BEHIND_SPEAKER_PORT.md`
  are the port docs.
