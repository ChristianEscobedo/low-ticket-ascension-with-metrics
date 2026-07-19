import { describe, expect, it } from 'vitest';
import {
  applyOverlayTransform,
  canvasSizeForFormat,
  defaultOverlay,
  getOverlayColor,
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

  it('snapPosition sets freeform coords', () => {
    const s = snapPosition('top', 'left');
    expect(s.x).toBeLessThan(0.2);
    expect(s.y).toBeLessThan(0.2);
    expect(s.vAlign).toBe('top');
    expect(s.hAlign).toBe('left');
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
