# Image Overlay (Text-on-Image) System Port

Client-side burn-in of on-screen copy onto stills for stories, reels covers, feed posts, and pins.

## Surface

- **Image Studio → Text tab** (`OverlayPanel`)
- Shortcut on **Images card**: **Text** opens studio on that tab

## Flow (v2)

1. Pick a **base image** from the piece gallery (or generate/upload first).
2. **Prefill** pulls hook / first slide / production-script `onScreen` by format.
3. **Drag** the text block on the live preview (freeform `x`/`y` 0–1). Double-click to edit on-canvas. Arrow keys nudge (Shift = larger step).
4. Style: fonts (sans/serif/display/condensed/rounded/mono), weights, size tier + scale slider, styles (none/shadow/glow/outline/pill/box/scrim/brass-line/bar), colors + custom hex, transform, tracking/leading/max-width, opacity sliders.
5. **Snap 3×3** still available as presets (writes freeform coords).
6. **Render to gallery** → canvas PNG at format export size → appended to `review.images`.
7. **Recipe** saved on `review.overlay` (re-openable; not only the baked pixels).

## Core modules

| Path | Role |
|------|------|
| `src/lib/mothermode/content/imageOverlay.ts` | Types, defaults, layout with freeform x/y, styles, `renderOverlayToDataUrl` |
| `src/lib/mothermode/content/review.ts` | `PieceReview.overlay` / `StoredImageOverlay` |
| `src/components/mothermode/content/OverlayPanel.tsx` | Interactive compose UI |
| `src/components/mothermode/content/ImageStudioModal.tsx` | `StudioTab = 'text'` |
| `tests/lib/image-overlay.test.ts` | Prefill, snap, color, transform |

## Recipe fields (v2)

- Placement: `vAlign`/`hAlign` (snap + glyph align), optional `x`/`y` freeform
- Type: `fontId`, `weight`, `size`, `fontScale`, `tracking`, `leading`, `maxWidthPct`, `transform`
- Look: `styleId`, `color`, `customHex`, `shadowStrength`, `bgOpacity`, `textOpacity`
- Output: `baseImage`, `renderedUrl`, `updatedAt`

## Notes

- Browser-only canvas render (no server round-trip).
- Hosted base images need CORS for canvas; data URLs and same-origin storage URLs work.
- Pill/box force ink text when color is white/soft/bone for contrast on bone fill.
- Old v1 recipes (no x/y) still open via snap layout until the user drags.
