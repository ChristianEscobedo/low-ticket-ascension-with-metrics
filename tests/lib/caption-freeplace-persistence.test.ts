import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A free-placed word must render IDENTICALLY in Edit AND Preview/render — no
 * size or color shift the moment fp toggles off.
 *
 * THE BUG THIS GUARDS
 * -------------------
 * The free-place overlay picked its paint with `freePlaceEdit || isActive ||
 * power || isFreePlaced ? css.active : css.word`. In Edit mode every placed word
 * painted css.active; in Preview/render an idle placed word fell back to
 * css.word. Two problems: (1) the size/color shifted when fp toggled off ("the
 * fp change does not persist"), and (2) in Edit EVERY placed word wore the
 * highlight color, so "highlighted" stopped meaning "the spoken word".
 *
 * THE FIX
 * -------
 * The ternary no longer references freePlaceEdit or isFreePlaced — it is just
 * `isActive || power ? css.active : css.word`. An idle placed word paints
 * css.word in Edit AND Preview alike (no shift on toggle), and the highlight
 * (css.active) marks only the spoken word. The full theme WEIGHT is untouched:
 * wordCss never sets fontWeight, so the placed word's `fontWeight: themePaint
 * .fontWeight ?? css.line.fontWeight` falls back to the line's theme weight
 * either way — it never renders thinner.
 */
const layer = readFileSync(
  join(__dirname, '../../src/lib/mothermode/reel/render/captionLayer.tsx'),
  'utf8',
);

describe('free-place persistence (Edit === Preview === render)', () => {
  it('the placed-word paint no longer depends on fp mode (Edit === Preview)', () => {
    // The ternary is just isActive || power — no freePlaceEdit / isFreePlaced —
    // so an idle placed word paints css.word in Edit AND Preview (no shift on
    // toggle), and the highlight marks only the spoken word.
    expect(layer).toContain('isActive || power ? css.active : css.word');
    expect(layer).not.toContain('isFreePlaced ? css.active');
  });

  it('the placed word keeps the FULL theme weight (fontWeight falls back to css.line)', () => {
    // wordCss never sets fontWeight, so the placed word's weight comes from the
    // line's theme weight — it never renders thinner than the same word in a row.
    expect(layer).toContain('(css.line as React.CSSProperties).fontWeight');
  });

  it('the free-placed word keeps its saved coords + scale (the layer reads them)', () => {
    // The layer reads the saved xPct/yPct for the position.
    expect(layer).toContain('mark?.xPct');
    expect(layer).toContain('mark?.yPct');
    // And the saved scale for the size.
    expect(layer).toContain('mark?.scale');
  });
});
