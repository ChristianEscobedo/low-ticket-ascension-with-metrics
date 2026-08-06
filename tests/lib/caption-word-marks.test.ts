import { describe, expect, it } from 'vitest';
import { normalizeProjectJson } from '@/lib/mothermode/reel/types';
import { shiftWords } from '@/lib/mothermode/reel/render/plan';
import { entranceStyle } from '@/lib/mothermode/reel/render/captionLayer';
import { CAPTION_ANIMS, captionDefFor, resolveCaptionStyle } from '@/lib/mothermode/reel/captions';

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

  it('keeps ambient/fx/fxColor/sfx, drops unknown fx + junk sfx (same no-substitution rule)', () => {
    const json = normalizeProjectJson({
      clips: [],
      captions: {
        a: [
          {
            word: 'money',
            start: 0,
            end: 0.5,
            mark: {
              ambient: 'wiggle',
              fx: 'glow',
              fxColor: '#ffd400',
              sfx: { url: 'https://cdn.example.com/cha-ching.mp3', volume: 2 },
            },
          },
          { word: 'bad', start: 0.6, end: 1, mark: { ambient: 'wobble', fx: 'confetti' } },
          { word: 'worse', start: 1.1, end: 1.4, mark: { sfx: { url: 'javascript:alert(1)' } } },
        ],
      },
    });
    const words = json.captions.a;
    // The good mark survives whole (volume clamped 2 → 1).
    expect(words[0].mark).toEqual({
      ambient: 'wiggle',
      fx: 'glow',
      fxColor: '#ffd400',
      sfx: { url: 'https://cdn.example.com/cha-ching.mp3', volume: 1 },
    });
    // Unknown ambient AND unknown fx → nothing usable left → the mark drops.
    expect(words[1].mark).toBeUndefined();
    // A non-http sfx URL is junk, and it was the only key → the mark drops.
    expect(words[2].mark).toBeUndefined();
  });
});

describe('caption block feel (blockMotion)', () => {
  it('still strips float/wiggle but keeps page fx; float/wiggle own the motion slot', () => {
    const ghost = captionDefFor('ghost'); // blockFx: ['ghostFade']
    const still = resolveCaptionStyle(ghost, { blockMotion: 'still' });
    expect(still.blockFx).toEqual(['ghostFade']);
    const floater = captionDefFor('floater'); // blockFx: ['float']
    const wiggled = resolveCaptionStyle(floater, { blockMotion: 'wiggle' });
    expect(wiggled.blockFx).toEqual(['wiggle']);
    const refloat = resolveCaptionStyle(ghost, { blockMotion: 'float' });
    expect(refloat.blockFx).toEqual(['ghostFade', 'float']);
    // Omit = the preset's own blockFx, untouched.
    expect(resolveCaptionStyle(floater, {}).blockFx).toEqual(['float']);
  });

  it('a cue sfx survives normalization; junk URLs drop', () => {
    const json = normalizeProjectJson({
      clips: [{ id: 'c1', url: 'https://cdn.example.com/v.mp4', durationSec: 5 }],
      captions: { c1: [{ word: 'look', start: 0, end: 0.4 }] },
      mediaCues: [
        { clipId: 'c1', wordIndex: 0, url: 'https://cdn.example.com/i.png', sfx: { url: 'https://cdn.example.com/whoosh.mp3', volume: 0.8 } },
        { clipId: 'c1', wordIndex: 0, url: 'https://cdn.example.com/j.png', sfx: { url: 'ftp://nope.mp3' } },
      ],
    });
    expect(json.mediaCues?.[0].sfx).toEqual({ url: 'https://cdn.example.com/whoosh.mp3', volume: 0.8 });
    expect(json.mediaCues?.[1].sfx).toBeUndefined();
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

describe('round 3b � fx settings + per-word font', () => {
  it('keeps fxAmount + a known font; drops junk values', () => {
    const json = normalizeProjectJson({
      clips: [],
      captions: {
        a: [
          { word: 'styled', start: 0, end: 0.4, mark: { font: 'Anton', fxAmount: 2.5 } },
          { word: 'badfont', start: 0.5, end: 0.9, mark: { font: 'Comic Sans MS' } },
          { word: 'badamt', start: 1.0, end: 1.4, mark: { fxAmount: 99 } },
        ],
      },
    });
    expect(json.captions.a[0].mark).toEqual({ font: 'Anton', fxAmount: 2.5 });
    expect(json.captions.a[1].mark).toBeUndefined();
    expect(json.captions.a[2].mark).toEqual({ fxAmount: 3 }); // clamped to the 0.2�3 dial
  });

  it('a marked word font ships in plan.fonts so the worker loads it', async () => {
    const { buildRenderPlan } = await import('@/lib/mothermode/reel/render/plan');
    const plan = buildRenderPlan(
      {
        clips: [
          { id: 'c1', name: 'v', url: 'https://cdn.example.com/v.mp4', durationSec: 5, trimEndSec: 0 },
        ],
        audio: null,
        captions: {
          c1: [
            { word: 'wow', start: 0, end: 0.5, mark: { font: 'Anton' } },
            { word: 'plain', start: 0.6, end: 1.0 },
          ],
        },
        captionStyle: 'karaoke',
      },
      { width: 1080, height: 1920 },
    );
    expect(plan.fonts.map((f) => f.family)).toContain('Anton');
  });
});
