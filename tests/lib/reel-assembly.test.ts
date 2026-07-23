import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CLIP_SECONDS,
  boardClipDuration,
  assembledBoards,
  boardsReadyForAssembly,
  boardsRemaining,
  wantsVoiceover,
  assemblyVoiceoverUrl,
  describeWrapper,
  buildReelAssemblyPlan,
} from '@/lib/mothermode/content/reelAssembly';
import type {
  PieceReview,
  StoryboardBoard,
} from '@/lib/mothermode/content/review';

/** Minimal rendered board factory. */
function board(index: number, over: Partial<StoryboardBoard> = {}): StoryboardBoard {
  return {
    index,
    title: `Board ${index}`,
    scenes: [],
    imagePrompt: 'p',
    lookbackSummary: '',
    videoStatus: 'done',
    videoUrl: `https://cdn.example.com/clip-${index}.mp4`,
    ...over,
  };
}

function review(boards: StoryboardBoard[], over: Partial<PieceReview> = {}): PieceReview {
  return {
    storyboard: { boardCount: 2, mode: 'narrative', boards },
    ...over,
  };
}

describe('boardClipDuration', () => {
  it('prefers an explicit segment duration', () => {
    expect(boardClipDuration(board(1, { segmentDuration: 15 }))).toBe(15);
  });
  it('falls back to the window length', () => {
    expect(boardClipDuration(board(1, { startSec: 0, endSec: 18 }))).toBe(18);
  });
  it('uses the default when no hints are present', () => {
    expect(boardClipDuration(board(1))).toBe(DEFAULT_CLIP_SECONDS);
  });
});

describe('board readiness', () => {
  it('reports ready only when every board is rendered', () => {
    expect(boardsReadyForAssembly(review([board(1), board(2)]))).toBe(true);
    const partial = review([board(1), board(2, { videoStatus: 'idle', videoUrl: undefined })]);
    expect(boardsReadyForAssembly(partial)).toBe(false);
    expect(boardsRemaining(partial)).toBe(1);
  });
  it('is not ready with zero boards', () => {
    expect(boardsReadyForAssembly(review([]))).toBe(false);
  });
  it('ignores boards whose url is not http(s)', () => {
    const bad = review([board(1), board(2, { videoUrl: 'data:video/mp4;base64,xx' })]);
    expect(boardsReadyForAssembly(bad)).toBe(false);
  });
  it('orders assembled boards by index', () => {
    const out = assembledBoards(review([board(3), board(1), board(2)]));
    expect(out.map((b) => b.index)).toEqual([1, 2, 3]);
  });
});

describe('wrapper helpers', () => {
  it('detects voice wrappers', () => {
    expect(wantsVoiceover('voice')).toBe(true);
    expect(wantsVoiceover('voice+music')).toBe(true);
    expect(wantsVoiceover('silent')).toBe(false);
    expect(wantsVoiceover('music')).toBe(false);
  });
  it('reads the combined voiceover url', () => {
    const r = review([board(1)], {
      videoScript: {
        totalSeconds: 5,
        beats: [],
        voiceover: { durationSec: 5, mode: 'combined', audioUrl: 'https://a/v.mp3' },
      },
    });
    expect(assemblyVoiceoverUrl(r)).toBe('https://a/v.mp3');
  });
  it('describes each wrapper', () => {
    expect(describeWrapper('silent')).toMatch(/clips only/i);
    expect(describeWrapper('music')).toMatch(/coming soon/i);
  });
});

describe('buildReelAssemblyPlan', () => {
  it('errors when there are no boards', () => {
    const res = buildReelAssemblyPlan(review([]), 'silent');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no storyboard boards/i);
  });
  it('errors when a board is unrendered', () => {
    const res = buildReelAssemblyPlan(
      review([board(1), board(2, { videoStatus: 'idle', videoUrl: undefined })]),
      'silent',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/1 clip still needs/i);
  });
  it('builds an ordered, timed plan for a silent reel', () => {
    const res = buildReelAssemblyPlan(
      review([board(2, { segmentDuration: 15 }), board(1, { segmentDuration: 18 })]),
      'silent',
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.boardOrder).toEqual([1, 2]);
      expect(res.plan.durationSec).toBe(33);
      expect(res.plan.audioUrl).toBeUndefined();
      expect(res.plan.clips[0].url).toContain('clip-1');
    }
  });
  it('errors on a voice wrapper without a voiceover track', () => {
    const res = buildReelAssemblyPlan(review([board(1)]), 'voice');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no voiceover track/i);
  });
  it('includes the voiceover url on a voice wrapper', () => {
    const r = review([board(1, { segmentDuration: 10 })], {
      videoScript: {
        totalSeconds: 10,
        beats: [],
        voiceover: { durationSec: 10, mode: 'combined', audioUrl: 'https://a/v.mp3' },
      },
    });
    const res = buildReelAssemblyPlan(r, 'voice');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.plan.audioUrl).toBe('https://a/v.mp3');
  });
});
