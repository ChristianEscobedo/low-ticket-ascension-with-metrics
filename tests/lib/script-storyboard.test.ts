import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCRIPT_SEGMENT_LENGTH,
  MAX_SCRIPT_STORYBOARD_BOARDS,
  scriptBoardCount,
  splitScriptIntoSegments,
  toSegmentLength,
} from '@/lib/mothermode/content/scriptStoryboard';
import type { VideoScript, VideoScriptBeat } from '@/lib/mothermode/content/review';

/** Build a contiguous script of `total` seconds with beats every `step` s. */
function makeScript(total: number, step = 5): VideoScript {
  const beats: VideoScriptBeat[] = [];
  for (let start = 0; start < total; start += step) {
    const end = Math.min(total, start + step);
    beats.push({
      startSec: start,
      endSec: end,
      voiceover: `line @${start}s`,
    });
  }
  return { totalSeconds: total, beats };
}

describe('toSegmentLength', () => {
  it('accepts 18 and defaults everything else to 15', () => {
    expect(toSegmentLength(18)).toBe(18);
    expect(toSegmentLength(15)).toBe(15);
    expect(toSegmentLength(30)).toBe(15);
    expect(toSegmentLength(undefined)).toBe(15);
    expect(toSegmentLength('18')).toBe(15); // strings aren't coerced
  });
});

describe('scriptBoardCount', () => {
  it('maps runtimes at 15s clips: 15→1, 30→2, 45→3, 60→4, 90→6', () => {
    expect(scriptBoardCount(15, 15)).toBe(1);
    expect(scriptBoardCount(30, 15)).toBe(2);
    expect(scriptBoardCount(45, 15)).toBe(3);
    expect(scriptBoardCount(60, 15)).toBe(4);
    expect(scriptBoardCount(90, 15)).toBe(6);
  });

  it('maps runtimes at 18s clips (ceil)', () => {
    expect(scriptBoardCount(15, 18)).toBe(1);
    expect(scriptBoardCount(30, 18)).toBe(2); // ceil(30/18)=2
    expect(scriptBoardCount(45, 18)).toBe(3); // ceil(45/18)=3
    expect(scriptBoardCount(90, 18)).toBe(5); // ceil(90/18)=5
  });

  it('clamps to [1, MAX] and handles empty/invalid runtimes', () => {
    expect(scriptBoardCount(0, 15)).toBe(1);
    expect(scriptBoardCount(NaN, 15)).toBe(1);
    expect(scriptBoardCount(999, 15)).toBe(MAX_SCRIPT_STORYBOARD_BOARDS);
  });
});

describe('splitScriptIntoSegments', () => {
  it('produces one board per 15s clip for a 90s script', () => {
    const segments = splitScriptIntoSegments(makeScript(90), 15);
    expect(segments).toHaveLength(6);
    expect(segments.map((s) => [s.startSec, s.endSec])).toEqual([
      [0, 15],
      [15, 30],
      [30, 45],
      [45, 60],
      [60, 75],
      [75, 90],
    ]);
    // Every segment is exactly one clip long.
    expect(segments.every((s) => s.durationSec === 15)).toBe(true);
    // 1-based, contiguous indexes.
    expect(segments.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('assigns each beat to the window containing its start', () => {
    const segments = splitScriptIntoSegments(makeScript(30, 5), 15);
    expect(segments).toHaveLength(2);
    // Beats at 0,5,10 → board 1; 15,20,25 → board 2.
    expect(segments[0].beats.map((b) => b.startSec)).toEqual([0, 5, 10]);
    expect(segments[1].beats.map((b) => b.startSec)).toEqual([15, 20, 25]);
    // No beat is dropped.
    const total = segments.reduce((n, s) => n + s.beats.length, 0);
    expect(total).toBe(6);
  });

  it('clamps the final window to the runtime for non-multiples', () => {
    const segments = splitScriptIntoSegments(makeScript(30, 6), 18);
    expect(segments).toHaveLength(2);
    expect([segments[0].startSec, segments[0].endSec]).toEqual([0, 18]);
    // Last window ends at total, not 36.
    expect([segments[1].startSec, segments[1].endSec]).toEqual([18, 30]);
    expect(segments[1].durationSec).toBe(12);
  });

  it('defaults to a single 15s board for a 15s script', () => {
    const segments = splitScriptIntoSegments(
      makeScript(15),
      DEFAULT_SCRIPT_SEGMENT_LENGTH,
    );
    expect(segments).toHaveLength(1);
    expect([segments[0].startSec, segments[0].endSec]).toEqual([0, 15]);
  });

  it('derives runtime from beats when totalSeconds is missing', () => {
    const script = {
      totalSeconds: 0,
      beats: [
        { startSec: 0, endSec: 15, voiceover: 'a' },
        { startSec: 15, endSec: 30, voiceover: 'b' },
      ],
    } satisfies VideoScript;
    const segments = splitScriptIntoSegments(script, 15);
    expect(segments).toHaveLength(2);
  });
});
