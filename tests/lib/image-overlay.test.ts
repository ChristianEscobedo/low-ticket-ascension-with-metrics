import { describe, expect, it } from 'vitest';
import {
  applyOverlayTransform,
  canvasSizeForFormat,
  defaultOverlay,
  freeformCssTransform,
  getOverlayColor,
  overlayPrimaryPx,
  overlaySubPx,
  snapPosition,
  suggestOverlayText,
} from '@/lib/mothermode/content/imageOverlay';


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

it('snapPosition sets freeform anchor coords (center = 0.5, not top-left)', () => {
    const tl = snapPosition('top', 'left');
    expect(tl.x).toBeLessThan(0.1);
    expect(tl.y).toBeLessThan(0.1);
    expect(tl.vAlign).toBe('top');
    expect(tl.hAlign).toBe('left');

    const mid = snapPosition('middle', 'center');
    expect(mid.x).toBe(0.5);
    expect(mid.y).toBe(0.5);

    const br = snapPosition('bottom', 'right');
    expect(br.x).toBeGreaterThan(0.9);
    expect(br.y).toBeGreaterThan(0.9);
  });

  it('freeformCssTransform centers the block on the anchor', () => {
    expect(freeformCssTransform('center', 'middle')).toBe(
      'translate(-50%, -50%)',
    );
    expect(freeformCssTransform('left', 'top')).toBe('translate(0%, 0%)');
    expect(freeformCssTransform('right', 'bottom')).toBe(
      'translate(-100%, -100%)',
    );
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
});
