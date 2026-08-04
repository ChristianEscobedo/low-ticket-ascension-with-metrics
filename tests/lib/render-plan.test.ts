import { describe, expect, it } from 'vitest';
import {
  buildRenderPlan,
  estimateRenderSeconds,
  renderPlanErrors,
  shiftWords,
  toFrames,
} from '@/lib/mothermode/reel/render/plan';

const clip = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    name: 'Clip 1',
    url: 'https://cdn.test/a.mp4',
    durationSec: 4,
    trimStartSec: 0,
    trimEndSec: 0,
    ...over,
  }) as never;

const project = (over: Record<string, unknown> = {}) =>
  ({
    clips: [clip()],
    audio: null,
    captions: {},
    captionStyle: 'karaoke',
    captionOverrides: null,
    overlays: [],
    ...over,
  }) as never;

describe('render plan — frames', () => {
  it('rounds seconds to frames once', () => {
    expect(toFrames(1, 30)).toBe(30);
    expect(toFrames(1.017, 30)).toBe(31);
    expect(toFrames(-5, 30)).toBe(0);
  });

  it('lays clips end to end with no gaps or overlaps', () => {
    const plan = buildRenderPlan(
      project({ clips: [clip(), clip({ id: 'c2', durationSec: 2 })] }),
      { fps: 30 },
    );
    expect(plan.clips[0].fromFrame).toBe(0);
    expect(plan.clips[0].durationInFrames).toBe(120);
    // The second clip starts exactly where the first ends — that adjacency is
    // what keeps audio and captions from drifting across cuts.
    expect(plan.clips[1].fromFrame).toBe(120);
    expect(plan.durationInFrames).toBe(180);
    expect(estimateRenderSeconds(plan)).toBe(6);
  });

  it('defaults to a vertical 1080x1920 canvas', () => {
    const plan = buildRenderPlan(project());
    expect([plan.width, plan.height]).toEqual([1080, 1920]);
    expect(plan.fps).toBe(30);
  });
});

describe('render plan — caption timing', () => {
  it('subtracts the clip trim so words are not late', () => {
    const words = shiftWords([{ word: 'go', start: 2, end: 2.5 }] as never, {
      clipStartFrame: 0,
      trimStartSec: 2,
      effectiveSec: 3,
      fps: 30,
    });
    expect(words[0]).toEqual({ text: 'go', fromFrame: 0, toFrame: 15 });
  });

  it('drops words the trim removed', () => {
    const words = shiftWords(
      [
        { word: 'cut', start: 0.1, end: 0.4 },
        { word: 'keep', start: 2.1, end: 2.4 },
      ] as never,
      { clipStartFrame: 0, trimStartSec: 2, effectiveSec: 2, fps: 30 },
    );
    expect(words.map((w) => w.text)).toEqual(['keep']);
  });

  it('offsets words onto the timeline for later clips', () => {
    const plan = buildRenderPlan(
      project({
        clips: [clip(), clip({ id: 'c2', durationSec: 2 })],
        captions: {
          c1: [{ word: 'first', start: 0, end: 0.5 }],
          c2: [{ word: 'second', start: 0, end: 0.5 }],
        },
      }),
      { fps: 30 },
    );
    expect(plan.words.map((w) => [w.text, w.fromFrame])).toEqual([
      ['first', 0],
      ['second', 120],
    ]);
  });

  it('keeps words in order', () => {
    const plan = buildRenderPlan(
      project({
        captions: {
          c1: [
            { word: 'b', start: 1, end: 1.4 },
            { word: 'a', start: 0.2, end: 0.6 },
          ],
        },
      }),
      { fps: 30 },
    );
    expect(plan.words.map((w) => w.text)).toEqual(['a', 'b']);
  });

  it('never emits a zero-length word', () => {
    const plan = buildRenderPlan(
      project({ captions: { c1: [{ word: 'hi', start: 1, end: 1 }] } }),
      { fps: 30 },
    );
    expect(plan.words[0].toFrame).toBeGreaterThan(plan.words[0].fromFrame);
  });
});

describe('render plan — audio + overlays', () => {
  it('clamps the music bed to the reel length', () => {
    const plan = buildRenderPlan(
      project({ audio: { url: 'https://cdn.test/m.mp3', offsetSec: 1, durationSec: 999 } }),
      { fps: 30 },
    );
    expect(plan.audio).toEqual({
      src: 'https://cdn.test/m.mp3',
      fromFrame: 30,
      durationInFrames: 90,
    });
  });

  it('stacks overlays above the main track', () => {
    const plan = buildRenderPlan(
      project({
        overlays: [
          { ...(clip({ id: 'o1' }) as object), offsetSec: 1, durationSec: 1 },
          { ...(clip({ id: 'o2' }) as object), offsetSec: 2, durationSec: 1 },
        ],
      }),
      { fps: 30 },
    );
    expect(plan.overlays.map((o) => [o.fromFrame, o.layer])).toEqual([
      [30, 1],
      [60, 2],
    ]);
  });
});

describe('render plan — validation', () => {
  it('refuses an empty timeline', () => {
    const plan = buildRenderPlan(project({ clips: [] }));
    expect(renderPlanErrors(plan).join(' ')).toMatch(/empty/i);
  });

  it('refuses non-public sources the renderer cannot fetch', () => {
    const plan = buildRenderPlan(project({ clips: [clip({ url: 'blob:local-preview' })] }));
    expect(renderPlanErrors(plan).join(' ')).toMatch(/public URL/i);
  });

  it('passes a well-formed reel', () => {
    expect(renderPlanErrors(buildRenderPlan(project()))).toEqual([]);
  });
});
