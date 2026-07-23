import { describe, expect, it } from 'vitest';
import {
  applyOverlayTransform,
  canvasSizeForFormat,
  defaultOverlay,
  freeformCssTransform,
  getOverlayColor,
  layoutOverlay,
  overlayPrimaryPx,
  overlaySubPx,
  snapPosition,
  suggestOverlayText,
  wrapLines,
} from '@/lib/mothermode/content/imageOverlay';

/**
 * Minimal fake 2D context: `layoutOverlay`/`wrapLines` only ever set `.font`
 * and call `measureText`, so a per-character width is enough to exercise the
 * wrap + block-width math deterministically (no real canvas/DOM needed).
 */
function fakeCtx(perChar = 10): CanvasRenderingContext2D {
  return {
    font: '',
    measureText: (s: string) => ({ width: s.length * perChar }),
  } as unknown as CanvasRenderingContext2D;
}




import type { ContentPiece } from '@/lib/mothermode/content/types';
import type { PieceReview } from '@/lib/mothermode/content/review';

const basePiece = {
  id: 't1',
  platform: 'instagram',
  format: 'feed',
  kind: 'organic',
  title: 'Test',
  theme: 'mental load',
  tone: 'confidante',
  hook: 'the tabs never close',
  cta: 'link in bio',
} as ContentPiece;

describe('imageOverlay helpers', () => {
  it('defaults to bottom-center bold white shadow with v2 scales', () => {
    const o = defaultOverlay();
    expect(o.vAlign).toBe('bottom');
    expect(o.hAlign).toBe('center');
    expect(o.weight).toBe('bold');
    expect(o.color).toBe('white');
    expect(o.styleId).toBe('shadow');
    expect(o.fontScale).toBe(1);
    expect(o.maxWidthPct).toBe(0.88);
    expect(o.transform).toBe('none');
    expect(o.enabled).toBe(true);
  });

  it('scales primary font from frame height (preview matches burn-in)', () => {
    // L tier = 6.2% of height at scale 1
    expect(overlayPrimaryPx(1920, 'l', 1)).toBe(Math.round(1920 * 0.062));
    expect(overlayPrimaryPx(400, 'l', 1)).toBe(Math.round(400 * 0.062));
    // Half-height preview should be half the export primary size
    const exportPx = overlayPrimaryPx(1920, 'l', 1);
    const previewPx = overlayPrimaryPx(960, 'l', 1);
    expect(previewPx).toBe(Math.round(exportPx / 2));
    expect(overlaySubPx(100)).toBe(55);
  });


  it('sizes story/reel as 9:16', () => {
    expect(canvasSizeForFormat('story')).toEqual({ width: 1080, height: 1920 });
    expect(canvasSizeForFormat('reel')).toEqual({ width: 1080, height: 1920 });
  });

  it('prefers slide text for story format', () => {
    const piece = {
      ...basePiece,
      format: 'story',
      slides: [{ text: 'empty your head', sub: '$7' }],
      hook: 'ignored hook',
    } as ContentPiece;
    expect(suggestOverlayText(piece, {})).toEqual({
      text: 'empty your head',
      sub: '$7',
    });
  });

  it('prefers onScreen for reel when script exists', () => {
    const piece = {
      ...basePiece,
      format: 'reel',
      script: [{ at: '0-3', onScreen: 'POV: 40 tabs', voiceover: 'hi' }],
    } as ContentPiece;
    const review: PieceReview = {
      videoScript: {
        totalSeconds: 30,
        beats: [
          {
            startSec: 0,
            endSec: 3,
            voiceover: 'hi',
            onScreen: 'from production script',
          },
        ],
      },
    };
    expect(suggestOverlayText(piece, review).text).toBe(
      'from production script',
    );
  });

  it('falls back to hook for feed', () => {
    expect(suggestOverlayText(basePiece, {}).text).toBe('the tabs never close');
  });

it('snapPosition sets freeform CENTER coords (inset so block stays on-frame)', () => {
    const tl = snapPosition('top', 'left');
    // Center of a top-left block — not the edge (0.06), so translate(-50%) stays on-canvas.
    expect(tl.x).toBe(0.22);
    expect(tl.y).toBe(0.16);
    expect(tl.vAlign).toBe('top');
    expect(tl.hAlign).toBe('left');

    const mid = snapPosition('middle', 'center');
    expect(mid.x).toBe(0.5);
    expect(mid.y).toBe(0.5);

    const br = snapPosition('bottom', 'right');
    expect(br.x).toBe(0.78);
    expect(br.y).toBe(0.84);
  });

  it('freeformCssTransform always centers the block on (x,y)', () => {
    // Align args are ignored — center-only so drag never parks text off-frame.
    expect(freeformCssTransform('center', 'middle')).toBe(
      'translate(-50%, -50%)',
    );
    expect(freeformCssTransform('left', 'top')).toBe('translate(-50%, -50%)');
    expect(freeformCssTransform('right', 'bottom')).toBe(
      'translate(-50%, -50%)',
    );
    expect(freeformCssTransform()).toBe('translate(-50%, -50%)');
  });


  it('applies text transform', () => {
    expect(applyOverlayTransform('Hi There', 'uppercase')).toBe('HI THERE');
    expect(applyOverlayTransform('Hi There', 'lowercase')).toBe('hi there');
    expect(applyOverlayTransform('Hi', 'none')).toBe('Hi');
  });

  it('resolves custom hex color', () => {
    expect(getOverlayColor({ color: 'custom', customHex: '#abCDef' })).toBe(
      '#abCDef',
    );
    expect(getOverlayColor({ color: 'brass' })).toBe('#B08D57');
  });

  it('wrapLines accounts for letter-spacing so canvas breaks match the DOM', () => {
    // Fake ctx: each character measures 10px wide (spaces included).
    const ctx = {
      font: '',
      measureText: (s: string) => ({ width: s.length * 10 }),
    } as unknown as CanvasRenderingContext2D;

    // "aaaa aaaa" = 9 glyphs → 90px natural width. maxWidth 95 fits it on one
    // line with no tracking...
    expect(wrapLines(ctx, 'aaaa aaaa', 95, 0)).toEqual(['aaaa aaaa']);

    // ...but with tracking the DOM (and now the canvas) wraps to two lines,
    // because the tracked advance (90 + 10*8 = 170) exceeds maxWidth. This is
    // the fix that stops the burn-in from packing more per line than the
    // preview and rendering slightly narrower.
    expect(wrapLines(ctx, 'aaaa aaaa', 95, 10)).toEqual(['aaaa', 'aaaa']);
  });

  it('layout block content width tracks the preview max-content ratio', () => {
    // The CSS preview uses `width: max-content` + `letter-spacing`, so a single
    // fitting line's box width == natural glyph width + tracking between glyphs.
    // The canvas layout must produce the SAME fraction of the frame or the
    // burn-in reads narrower/wider than the live preview.
    const ctx = fakeCtx(10);
    const width = 1000;
    const height = 1000;
    const overlay = defaultOverlay({
      text: 'AAAAAAAAAA', // 10 glyphs → 100px natural width at 10px/char
      sub: '',
      styleId: 'none', // no box padding, so blockWidth == pure content width
      size: 's', // 3.5% of height → primaryPx 35
      fontScale: 1,
      tracking: 0.1, // 0.1em → trackingPx 3.5
      maxWidthPct: 0.88,
    });

    const layout = layoutOverlay(ctx, overlay, width, height);

    const primaryPx = overlayPrimaryPx(height, 's', 1); // 35
    const trackingPx = primaryPx * 0.1; // 3.5
    const glyphs = 10;
    const naturalWidth = glyphs * 10; // 100
    // DOM max-content folds tracking between the glyphs (n-1), same model the
    // canvas wrap/measure now uses.
    const expectedContent = naturalWidth + trackingPx * (glyphs - 1);

    expect(layout.primaryLines).toEqual(['AAAAAAAAAA']); // fits one line
    expect(layout.blockWidth).toBeCloseTo(expectedContent, 5);
    // Same fraction of the frame that the CSS preview reproduces.
    expect(layout.blockWidth / width).toBeCloseTo(expectedContent / width, 5);
  });
});



