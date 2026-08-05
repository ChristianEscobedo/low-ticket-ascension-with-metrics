# Color Block + Slideshow Formats — System Port

Two new native social formats added to the MotherMode content suite:

1. **Facebook color-block posts** (`format: 'colorblock'`) — the native FB
   big-text-on-color post. No image; a short hook renders large and bold on a
   solid (or gradient) brand background.
2. **TikTok photo-mode slideshows** (`format: 'slideshow'`) — the swipeable
   multi-image TikTok post. Each slide is a real image with its own styled,
   editable text overlay (the TikTok text-editing feature).

Both are first-class: catalog pieces, AI generation, platform-accurate previews,
per-slide text editing, export, and compliance.

## Model

- `types.ts` — `ContentFormat` gains `'colorblock' | 'slideshow'`; `ContentPiece`
  gains `colorBlock?: ColorBlockStyle` (`{ bg, gradient?, fontScale? }`).
- `constants.ts` — `FORMAT_LABEL` entries, `PLATFORM_FORMATS.facebook +=
  'colorblock'`, `.tiktok += 'slideshow'`, plus `COLOR_BLOCK_SWATCHES` (brand
  palette), `COLOR_BLOCK_MAX_CHARS` (130), and slideshow min/max slide bounds.
- `colorBlock.ts` (new) — `colorBlockStyleFor`, `colorBlockBackground`,
  `colorBlockFontScale` (native length-based scale-down), `fitsColorBlock`, and
  `renderColorBlockToDataUrl` (canvas square PNG for schedulers).
- `platformSizes.ts` / `imageOverlay.ts` — `canvasSizeForFormat` (colorblock
  1080×1080, slideshow 1080×1920), `defaultPresetIdsForFormat`,
  `isMultiFrameFormat('slideshow') = true`.

## Previews

- `previews/FacebookPreview.tsx` — `ColorBlock` surface: FB header + the big-text
  block (scaled like native) + engagement rail.
- `previews/TikTokPreview.tsx` — `PhotoMode` surface: 9:16 frame, active slide
  image + per-slide text, photo-mode chip + swipe dots, caption + rail.
- `ContentSheet.tsx` — `slideshow` added to `isDeck` so the frame selector and
  autoplay work.
- `ContentCard.tsx` — `ColorBlockVisual` renders the piece's brand background +
  active hook (scaled like native) as the card's square tile in place of a media
  frame, so color blocks show their swatch visually in the library grid, not
  just text. Rendered whenever the piece is a color block with no uploaded image.

## Text editing (TikTok text feature)

- `review.ts` — `slideOverlays?: Record<number, StoredImageOverlay>` on the piece
  review (rides the review JSONB, no migration), plus `withSlideOverlay` /
  `withoutSlideOverlay` pure helpers.
- `components/.../SlideTextPanel.tsx` (new) — per-slide on-canvas editor reusing
  the shared `ImageOverlay` recipe (font, weight, color, size, case, freeform
  x/y). Burn bakes text onto the slide image via `renderOverlayToDataUrl` and
  hosts it back to the review gallery.
- `components/.../ColorBlockPanel.tsx` (new) — FB block composer: palette
  swatches, font scale, and "render as image" to gallery.
- Both render inside the ContentSheet **Edit** tab for their formats.

## AI generation

- `openai-content.ts` — `formatFieldGuide` entries for both formats (colorblock:
  hook-only under 130 chars + a brand `colorBlock` pick; slideshow: 4–8 slides
  with on-slide text + caption + cover media prompt), `needsImagePrompt`
  (slideshow true, colorblock false), and `normalizePiece` colorBlock parsing
  (hex-validated).

## Export + compliance

- `index.ts` `pieceToText` — colorblock prints as `COLOR BLOCK bg <hex>` + text;
  slideshow prints slides like a carousel.
- `platformCompliance.ts` `formatIssues` — colorblock >130-char note + stray-media
  note; slideshow slide-count bounds + caption-length note. Voice patterns cover
  the new text fields automatically.

## Tests

- `tests/lib/colorblock-slideshow.test.ts` — 12 cases: labels/platform wiring,
  sizes/presets, swatch/gradient/scale/ceiling helpers, pieceToText for both,
  catalog presence, per-slide overlay store/clear, and compliance flag/pass.

## Catalog

- `facebook.ts` — 6 color-block pieces (`fb-colorblock-1..6`), confidante/wedge
  registers, brand backgrounds.
- `tiktok.ts` — 4 photo-mode pieces (`tt-slideshow-1..4`), 6–7 slides each with
  per-slide text + caption, UGC voice.

## Verify

```
npx tsc --noEmit
npx vitest run tests/lib/colorblock-slideshow.test.ts tests/lib/platform-compliance.test.ts tests/lib/content-export.test.ts
```
