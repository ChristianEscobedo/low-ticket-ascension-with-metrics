# Free-Place Persistence — Finding + Fix

**Reported:** "when on edit it does not persist placement and size when fp is
turned off and render preview is playing on canvas."

## The root cause

The free-place overlay picked its paint with:

```
freePlaceEdit || isActive || power ? css.active : css.word
```

In **Edit** mode every word painted `css.active` (the full theme weight). In
**Preview/render** an idle free-placed word fell back to the thin `css.word`.
So a word you moved in fp looked bigger/bolder in Edit than in Preview — and
because the word is centered (`translate(-50%, 50%)`), the size difference also
shifted the placement. The moment fp toggled off, the word changed size and
position.

## The fix

A free-placed word (one the user explicitly placed — it has `xPct`+`yPct`) is a
DESIGNED word, not an idle one. The `themePaint` ternary in
`src/lib/mothermode/reel/render/captionLayer.tsx` now includes `isFreePlaced`:

```
freePlaceEdit || isActive || power || isFreePlaced ? css.active : css.word
```

so it paints `css.active` (the full theme weight) in Edit AND Preview/render.
The size + placement match, and the render honors it (the layer IS the render
component). The vendored worker copy is synced
(`scripts/sync-vendored-captions.cjs`).

## Verified

- `tests/lib/caption-freeplace-persistence.test.ts` locks it in (2/2) — the
  `isFreePlaced` check is in the `themePaint` ternary, and the layer reads the
  saved `xPct`/`yPct`/`scale`.
- The parity tests pass (8/8); `tsc --noEmit` is clean.
