/**
 * Scene transitions + the spring caption entrance.
 *
 * A transition lives on the INCOMING clip (`clip.transitionIn`) and the plan
 * OVERLAPS the two scenes by the transition's frames: the incoming clip's
 * fromFrame pulls earlier into the outgoing clip's tail, so both Sequences
 * are mounted for the window and the composition can blend them. Every layer
 * that turns seconds into frames — the plan, the timeline helpers the editor
 * seeks with, and the strip's own math — reads the SAME overlap, or the
 * captions and the playhead drift right of the picture by the overlap.
 */
import { describe, expect, it } from 'vitest';
import {
  buildRenderPlan,
} from '@/lib/mothermode/reel/render/plan';
import {
  clipAtTime,
  reelDurationSec,
  transitionOverlapSec,
} from '@/lib/mothermode/reel/timeline';
import { normalizeReelClip } from '@/lib/mothermode/reel/types';
import {
  entranceProgress,
  entranceStyle,
} from '@/lib/mothermode/reel/render/captionLayer';

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

describe('transitions — normalize round-trip', () => {
  it('keeps a valid transitionIn through save/load', () => {
    const kept = normalizeReelClip(
      clip({ id: 'c2', transitionIn: { type: 'crossfade', durationSec: 0.4 } }),
    );
    expect(kept?.transitionIn).toEqual({ type: 'crossfade', durationSec: 0.4 });
    // No transition on the clip → nothing to round-trip.
    expect(normalizeReelClip(clip())?.transitionIn).toBeUndefined();
  });

  it('drops an unknown type and clamps a wild duration', () => {
    const bogus = normalizeReelClip(
      clip({ id: 'c2', transitionIn: { type: 'spin-around', durationSec: 99 } }),
    );
    expect(bogus?.transitionIn).toBeUndefined(); // unknown type → hard cut
    const wild = normalizeReelClip(
      clip({ id: 'c3', transitionIn: { type: 'whip', durationSec: -2 } }),
    );
    expect(wild?.transitionIn?.durationSec).toBe(0.15); // clamped to the floor
  });
});

describe('transitions — overlap math', () => {
  it('is zero without a transition, the duration with one', () => {
    const a = clip();
    const b = clip({ id: 'c2', durationSec: 2 });
    expect(transitionOverlapSec(b as never, a as never)).toBe(0);
    const bt = clip({
      id: 'c2',
      durationSec: 2,
      transitionIn: { type: 'crossfade', durationSec: 0.4 },
    });
    expect(transitionOverlapSec(bt as never, a as never)).toBe(0.4);
  });

  it('never eats a scene below its solo floor', () => {
    // A 0.5s incoming scene asking for 0.8s: the overlap caps so BOTH scenes
    // keep MIN_CLIP_SECONDS (0.1s) of solo runtime — 0.5 − 0.1 = 0.4.
    const short = clip({
      id: 'c2',
      durationSec: 0.5,
      transitionIn: { type: 'zoom', durationSec: 0.8 },
    });
    const long = clip({ durationSec: 8 });
    expect(transitionOverlapSec(short as never, long as never)).toBeCloseTo(0.4, 5);
  });

  it('reelDurationSec shrinks by the overlap (and is unchanged without one)', () => {
    const plain = [clip(), clip({ id: 'c2', durationSec: 2 })] as never;
    expect(reelDurationSec(plain)).toBe(6);
    const blended = [
      clip(),
      clip({ id: 'c2', durationSec: 2, transitionIn: { type: 'whip', durationSec: 0.5 } }),
    ] as never;
    expect(reelDurationSec(blended)).toBe(5.5);
  });

  it('clipAtTime hands the overlap window to the INCOMING clip', () => {
    const clips = [
      clip(),
      clip({ id: 'c2', durationSec: 2, transitionIn: { type: 'crossfade', durationSec: 0.5 } }),
    ] as never;
    // The seam: c2 starts at 4 − 0.5 = 3.5. Inside [3.5, 4) the incoming clip
    // owns the frame (it is blending in over the outgoing tail).
    const hit = clipAtTime(clips, 3.7);
    expect(hit?.clip.id).toBe('c2');
    expect(hit?.local).toBeCloseTo(0.2, 5);
    // Before the overlap the outgoing clip still owns it.
    expect(clipAtTime(clips, 3.4)?.clip.id).toBe('c1');
  });
});

describe('transitions — the render plan', () => {
  it('pulls the incoming clip earlier by the overlap and tags it', () => {
    const plan = buildRenderPlan(
      project({
        clips: [
          clip(),
          clip({
            id: 'c2',
            durationSec: 2,
            transitionIn: { type: 'crossfade', durationSec: 0.4 },
          }),
        ],
      }),
      { fps: 30 },
    );
    // c1: 4s = 120 frames at 30fps. c2 overlaps 12 frames into c1's tail.
    expect(plan.clips[0].fromFrame).toBe(0);
    expect(plan.clips[0].durationInFrames).toBe(120);
    expect(plan.clips[1].fromFrame).toBe(108); // 120 − 12
    expect(plan.clips[1].transition).toEqual({ type: 'crossfade', frames: 12 });
    expect(plan.clips[0].transition).toBeUndefined(); // the FIRST clip never blends in
    // The composition is 12 frames shorter than the hard-cut version.
    expect(plan.durationInFrames).toBe(168); // 180 − 12
  });

  it('shifts captions and media cues by the same overlap (no drift)', () => {
    const plan = buildRenderPlan(
      project({
        clips: [
          clip({
            id: 'c1',
            durationSec: 2,
          }),
          clip({
            id: 'c2',
            durationSec: 2,
            transitionIn: { type: 'zoom', durationSec: 0.5 },
          }),
        ],
        captions: {
          c1: [{ word: 'hey', start: 0.5, end: 0.9 }],
          c2: [{ word: 'there', start: 0.2, end: 0.6 }],
        },
        mediaCues: [{ id: 'm1', clipId: 'c2', wordIndex: 0, url: 'https://cdn.test/x.png' }],
      }),
      { fps: 30 },
    );
    // c2 starts at frame 60 − 15 = 45. Its word at 0.2s lands at 45 + 6 = 51.
    const w2 = plan.words.find((w) => w.text === 'there');
    expect(w2?.fromFrame).toBe(51);
    // The cue rides its word's window — same overlap, same shift.
    const cue = plan.mediaCues?.[0];
    expect(cue?.fromFrame).toBe(51);
  });
});

describe('spring entrance — the damped overshoot', () => {
  it('settles at identity (scale 1, full opacity) at the end', () => {
    const end = entranceStyle('spring', 1);
    expect(end.transform).toBe('scale(1.0000)');
    expect(end.opacity).toBe(1);
  });

  it('overshoots past 1 mid-entrance (that is the spring)', () => {
    // Somewhere in the middle the damped cosine swings ABOVE 1 — a plain
    // ease-out never does, which is exactly what makes this read as a spring.
    const mid = entranceStyle('spring', 0.35);
    const m = /scale\(([\d.]+)\)/.exec(String(mid.transform ?? ''));
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBeGreaterThan(1.02);
  });

  it('starts from scale ~0 and fades in fast', () => {
    const start = entranceStyle('spring', 0);
    const m = /scale\(([\d.]+)\)/.exec(String(start.transform ?? ''));
    expect(parseFloat(m![1])).toBeLessThan(0.05);
    expect(start.opacity).toBe(0);
  });

  it('entranceProgress feeds spring RAW linear progress over the longer window', () => {
    // At 30fps the spring window is 0.42s ≈ 13 frames; the standard window is
    // 0.18s ≈ 5 frames. Half-way through the LONG window the spring is at 0.5
    // linear — the cubic-eased default would read ~0.875 there.
    const fps = 30;
    const springHalf = entranceProgress(6, 0, fps, 'spring');
    expect(springHalf).toBeCloseTo(6 / 13, 2);
    // The default path is untouched: no anim arg = the cubic over 0.18s.
    const defaultHalf = entranceProgress(2, 0, fps);
    expect(defaultHalf).toBeCloseTo(1 - Math.pow(1 - 2 / 5, 3), 4);
  });
});
