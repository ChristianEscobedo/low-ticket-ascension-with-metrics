import { describe, expect, it } from 'vitest';
import { normalizeProjectJson } from '@/lib/mothermode/reel/types';
import { shiftWords } from '@/lib/mothermode/reel/render/plan';
import { entranceStyle } from '@/lib/mothermode/reel/render/captionLayer';
import { CAPTION_ANIMS } from '@/lib/mothermode/reel/captions';

describe('per-word marks: normalization', () => {
  it('keeps valid marks, drops unknown anims (never a silent substitution)', () => {
    const json = normalizeProjectJson({
      clips: [],
      captions: {
        a: [
          { word: 'hello', start: 0, end: 0.5, mark: { anim: 'springPop', color: '#FF0000', scale: 1.5, stagger: 0.05 } },
          { word: 'world', start: 0.6, end: 1.0, mark: { anim: 'not-real', color: '', scale: 99 } },
          { word: 'gone', start: 1.1, end: 1.4, mark: { anim: 'not-real', color: '' } },
          { word: 'again', start: 1.5, end: 1.9 },
        ],
      },
    });
    const words = json.captions.a;
    expect(words[0].mark).toEqual({ anim: 'springPop', color: '#FF0000', scale: 1.5, stagger: 0.05 });
    // anim + color dropped as junk; scale 99 is a real value, clamped — never a substitution.
    expect(words[1].mark).toEqual({ scale: 3 });
    expect(words[2].mark).toBeUndefined(); // BOTH keys junk → the whole mark drops
    expect(words[3].mark).toBeUndefined();
  });

  it('clamps scale and stagger into their ranges', () => {
    const json = normalizeProjectJson({
      clips: [],
      captions: { a: [{ word: 'big', start: 0, end: 0.4, mark: { scale: 99, stagger: 9 } }] },
    });
    expect(json.captions.a[0].mark).toEqual({ scale: 3, stagger: 0.5 });
  });

  it('shiftWords carries the mark to the render plan', () => {
    const out = shiftWords(
      [{ word: 'hello', start: 0, end: 0.5, mark: { anim: 'cascade', color: '#FFD400' } }],
      { clipStartFrame: 10, trimStartSec: 0, effectiveSec: 5, fps: 30 },
    );
    expect(out[0].mark).toEqual({ anim: 'cascade', color: '#FFD400' });
  });
});

describe('entranceStyle: every CaptionAnim has a frame-driven case', () => {
  it('no anim falls through to pop by accident — each produces its own shape at e=0.5', () => {
    for (const anim of CAPTION_ANIMS) {
      const style = entranceStyle(anim, 0.5) as Record<string, unknown>;
      const isNone = anim === '';
      expect(
        isNone || Object.keys(style).length > 0,
        `${anim} produced an empty style mid-entrance`,
      ).toBe(true);
    }
  });

  it('settles visible at e=1 (opacity fully in, scale ≈ identity)', () => {
    for (const anim of CAPTION_ANIMS) {
      const style = entranceStyle(anim, 1) as Record<string, unknown>;
      if (typeof style.opacity === 'number') {
        expect(style.opacity, `${anim} opacity at e=1`).toBeCloseTo(1, 5);
      }
      if (typeof style.transform === 'string' && style.transform.includes('scale(')) {
        // sin(π) ≈ 1e-16, so settled scales are 1 within float noise, not === 1.
        const m = style.transform.match(/scale\(([-0-9.e]+)/);
        expect(Math.abs(Number(m?.[1] ?? 1) - 1), `${anim} scale at e=1`).toBeLessThan(0.01);
      }
    }
  });
});
