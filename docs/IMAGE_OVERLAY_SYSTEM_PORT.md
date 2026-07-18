# Image Overlay (Text-on-Image) System Port

Client-side burn-in of on-screen copy onto stills for stories, reels covers, feed posts, and pins.

## Surface

- **Image Studio → Text tab** (`OverlayPanel`)
- Shortcut on **Images card**: **Text** opens studio on that tab

## Flow

1. Pick a **base image** from the piece gallery (or generate/upload first).
2. **Prefill** pulls hook / first slide / production-script `onScreen` by format.
3. Edit **primary + sub**, font (sans/serif/mono), weight, size, style (shadow / pill / scrim / brass-line), color, 3×3 position.
4. Live CSS preview (approximate).
5. **Render to gallery** → canvas PNG at format export size (e.g. 1080×1920 story) → appended to `review.images`.
6. **Recipe** saved on `review.overlay` (re-openable; not only the baked pixels).

## Core modules

| Path | Role |
|------|------|
| `src/lib/mothermode/content/imageOverlay.ts` | Types, defaults, `suggestOverlayText`, `wrapLines`, `layoutOverlay`, `renderOverlayToDataUrl` |
| `src/lib/mothermode/content/review.ts` | `PieceReview.overlay` / `StoredImageOverlay`; `isEmptyReview` |
| `src/components/mothermode/content/OverlayPanel.tsx` | Compose UI |
| `src/components/mothermode/content/ImageStudioModal.tsx` | `StudioTab = 'text'` |
| `tests/lib/image-overlay.test.ts` | Prefill + canvas size helpers |

## Notes

- Browser-only canvas render (no server round-trip).
- Hosted base images need CORS for canvas; data URLs and same-origin storage URLs work.
- Pill style forces ink text when color is white for contrast on bone box.
