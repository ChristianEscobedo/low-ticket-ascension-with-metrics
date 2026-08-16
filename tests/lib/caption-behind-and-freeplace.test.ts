import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRenderPlan } from '@/lib/mothermode/reel/render/plan';
import { normalizeProjectJson, normalizeReelOverlay } from '@/lib/mothermode/reel/types';

/**
 * The caption behind-the-speaker stack + the free-place Edit/Preview parity.
 *
 * THREE bugs this guards (see docs/CAPTION_BEHIND_AND_FREEPLACE_TASK.md):
 *
 * 1. FP persistence — Edit mode used to collapse the page into ONE row, so
 *    toggling Edit off reflowed the un-placed words (they "jumped up") and the
 *    drag coords were measured against a box the render never draws. Edit now
 *    renders the SAME theme rows as Preview/render.
 * 2. The "placed text renders thinner" bug — the free-place overlay read its
 *    type metrics (fontFamily/fontWeight/letterSpacing) off css.word, which
 *    does NOT carry them (they live on css.line), so placed words painted at
 *    the browser default weight. The overlay now reads css.line.
 * 3. "Behind" as a real layer — the bg-remove cutout lands on the OVERLAY lane
 *    (visible, re-timeable, removable) and a per-word `behind` mark paints that
 *    word UNDER the cutout (z 5 < cutout z 6 < caption block z 10).
 */

const ROOT = join(__dirname, '..', '..');
const layer = readFileSync(
  join(ROOT, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
  'utf8',
);
const composition = readFileSync(
  join(ROOT, 'remotion-project/ReelComposition.tsx'),
  'utf8',
);
const workerComposition = readFileSync(
  join(ROOT, 'render-worker/remotion-project/ReelComposition.tsx'),
  'utf8',
);

describe('free-place Edit ⇄ Preview ⇄ render parity', () => {
  it('Edit renders the SAME rows as Preview — no one-row collapse branch', () => {
    // The old `const rows = freePlaceEdit ? [one row] : themeRows` is gone —
    // rows come from the theme's slicer in BOTH modes.
    expect(layer).not.toContain('const rows = freePlaceEdit');
    // The build-stack hide is a VISIBILITY concern gated by the "show all
    // words" opt-in (showAllWords), not the Edit flag — default Edit shows just
    // the on-screen page (Preview's visibility), so the card no longer scatters.
    expect(layer).toContain('isBuildStack && !showAllWords && frame < w.fromFrame');
  });

  it('the free-place overlay reads its type metrics off css.line, not css.word', () => {
    // css.word/css.active do NOT carry fontFamily/fontWeight/letterSpacing —
    // reading them there painted placed words at the browser default weight.
    expect(layer).toContain('(css.line as React.CSSProperties).fontWeight');
    expect(layer).toContain('(css.line as React.CSSProperties).fontFamily');
    expect(layer).toContain('(css.line as React.CSSProperties).letterSpacing');
  });
});

describe('caption behind the speaker — the layer + the z-stack', () => {
  it('splits placed words into a BEHIND (z 5) and a FRONT (z 11) layer', () => {
    expect(layer).toContain('w.mark?.behind === true');
    // The behind layer paints UNDER the cutout (z 6), the front one over it.
    expect(layer).toMatch(/mark\?\.behind === true\),\s*\n\s*5,/);
    expect(layer).toMatch(/mark\?\.behind !== true\),\s*\n\s*11,/);
  });

  it('the composition z-indexes the cutout BETWEEN the behind words and the block', () => {
    // Both the legacy cutouts[] path AND the overlay-lane (isCutout) path sit at z 6.
    expect(composition).toContain('ov.isCutout ? 6 : undefined');
    expect(composition).toContain('zIndex: 6');
    // The worker's copy must agree (it draws the MP4).
    expect(workerComposition).toContain('ov.isCutout ? 6 : undefined');
  });

  it('the behind flag survives save/load (normalizeProjectJson keeps it)', () => {
    const json = normalizeProjectJson({
      clips: [
        { id: 'c1', name: 'A', url: 'https://cdn.example.com/a.mp4', durationSec: 5 },
      ],
      captions: {
        c1: [
          { word: 'hello', start: 0, end: 0.5, mark: { xPct: 50, yPct: 20, behind: true } },
        ],
      },
    });
    expect(json.captions.c1[0].mark?.behind).toBe(true);
    expect(json.captions.c1[0].mark?.xPct).toBe(50);
  });

  it('the cutout flag survives normalizeReelOverlay and rides the render plan', () => {
    const ov = normalizeReelOverlay({
      id: 'o1',
      name: 'Cutout',
      url: 'https://cdn.example.com/cutout.webm',
      durationSec: 2,
      offsetSec: 1,
      isCutout: true,
    });
    expect(ov?.isCutout).toBe(true);

    const plan = buildRenderPlan({
      clips: [
        { id: 'c1', name: 'A', url: 'https://cdn.example.com/a.mp4', durationSec: 5, trimEndSec: 0 },
      ],
      audio: null,
      captions: {
        c1: [{ word: 'hello', start: 0, end: 0.5, mark: { xPct: 50, yPct: 20, behind: true } }],
      },
      captionStyle: 'karaoke',
      overlays: ov ? [ov] : [],
    });
    expect(plan.overlays[0]?.isCutout).toBe(true);
    // The word's mark rides the plan verbatim (shiftWords passthrough).
    expect(plan.words[0]?.mark?.behind).toBe(true);
  });
});
