# FP Word-Drag Performance Wave — Port Doc

**Date:** 2026-08-21
**Scope:** Reel Studio free-place (FP) single-word caption edit — drag mount,
move, scale, and effect application. The user report: "super slow clunky and
one word will push other words around … it should be as smooth as the non-FP
move and drag with the full captions."
**Tests:** 309/309 caption tests pass (10 files) · tsc clean · vendored worker
copy re-synced (`render-worker/src/lib/mothermode/reel/render/captionLayer.tsx`
is a byte-copy of the canonical `src/lib/mothermode/reel/render/captionLayer.tsx`).

## The audit (why it was clunky)

The smooth reference — the non-FP block drag (`CaptionDragLayer`) — moves ONE
absolutely-positioned container: local state per move, one commit on pointerup,
nothing else re-layouts. The FP word path had five problems:

1. **Commit reflow.** `captionLayer.tsx` rendered `return null` for placed
   words in the centered inline caption row — on commit the word left the row
   and the siblings re-wrapped/re-centered around the hole. The "push" landed
   all at once on release.
2. **Scale-space mismatch.** The Remotion Player scales the composition to the
   stage (~0.35×), but the drag appended a pixel `translate()` in COMPOSITION
   px — the word crawled at a fraction of the pointer.
3. **Transform war.** A rAF loop re-wrote the glyph's inline transform EVERY
   frame because React re-renders kept clearing it.
4. **Measure loop.** `CaptionEditSurface`'s `dragWords` (fresh array per
   render) and an inline `mapGlyphIndex` closure fed `WordDragLayer`'s measure
   effect, which re-measured every glyph (`querySelectorAll` +
   `getBoundingClientRect`) and called `setGlyphBox` unconditionally — a
   measure → setState → render → measure loop per mousemove on the
   move/scale-box path.
5. **Save storm.** `applyWordMark` did `setProject` (full page re-render +
   plan rebuild) AND `await post({ action: 'save' })` per drag commit, per
   scale commit, per style click, per arrow nudge.

## The fixes (same order)

1. **In-flow placeholder.** `captionLayer.tsx` — a placed word now renders an
   invisible (`visibility:hidden`, `css.word` metrics) `<span>` in its row
   slot instead of `null`. The row NEVER reflows; the overlay glyph paints the
   placed word. Same rule in preview AND render (one canonical file).
2. **Scale-calibrated translate.** `useCaptionEdit.ts` — at grab time the
   handler reads `glyph.width / t.offsetWidth` (and Y) and divides the pixel
   delta by it, so the word tracks the pointer 1:1 on the scaled Remotion
   surface (a no-op on the unscaled edit stage).
3. **Conditional-write rAF.** The paint loop now compares
   `t.style.transform !== want` and only writes on change/clear — no more
   per-frame write fighting React.
4. **Stable identities + a no-op guard.** `CaptionEditSurface`: `dragWords` is
   `useMemo`'d (deps: currentClip/project/playheadSec/showAllCardWords/
   wordPlaceLocal/wordScaleLocal/fxTarget) and `mapGlyphIndex` is a
   `useCallback`. `WordDragLayer`: `setGlyphBox` is a functional update that
   returns `prev` when every box is within 0.05% of the last measure — the
   loop is broken even if the effect re-runs.
5. **Debounced persistence.** `applyWordMark` still `setProject`s immediately
   (local truth), but the save POST is 600ms trailing-debounced via
   `saveTimerRef`/`pendingSaveRef`, with an unmount flush. A burst of arrow
   nudges = ONE save.

## Carry-over checklist

1. `src/lib/mothermode/reel/render/captionLayer.tsx` — the `fp-hole-` placeholder
   block (search `fp-hole-`). Re-vendor the worker copy.
2. `useCaptionEdit.ts` — `glyphScaleX/Y` + the conditional-write `paint` loop +
   the `saveTimerRef`/`pendingSaveRef` debounce in `applyWordMark`.
3. `CaptionEditSurface.tsx` — `useMemo` dragWords + `useCallback`
   mapGlyphIndex (needs the new `react` import).
4. `WordDragLayer.tsx` — the `setGlyphBox` no-op guard.
5. Run the caption suite:
   `npx vitest run tests/lib/caption-freeplace-persistence.test.ts tests/lib/caption-behind-and-freeplace.test.ts tests/lib/caption-word-marks.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts tests/lib/caption-layer-geometry-parity.test.ts tests/lib/stage-caption-single-source.test.ts`
