import { describe, expect, it } from 'vitest';

import { clipPlaybackAction, effectiveClipDuration } from '@/lib/mothermode/reel/timeline';
import type { ReelClip } from '@/lib/mothermode/reel/types';

/**
 * R23 — "the preview keeps playing the whole video after I trim it".
 *
 * The trimmed block on the timeline is the clip's REAL end. These lock the
 * decision the stage makes on every frame, so the tail can never leak again.
 */
function clip(partial: Partial<ReelClip> = {}): ReelClip {
  return {
    id: 'c1',
    name: 'scene',
    url: 'https://example.com/a.mp4',
    durationSec: 30,
    trimEndSec: 0,
    ...partial,
  } as ReelClip;
}

describe('clipPlaybackAction — the trim is the end of the scene', () => {
  it('keeps rolling while the playhead is inside the trimmed block', () => {
    const c = clip({ durationSec: 30, trimEndSec: 20 }); // effective: 10s
    expect(clipPlaybackAction(0, c, { isLast: true })).toBe('play');
    expect(clipPlaybackAction(5, c, { isLast: true })).toBe('play');
    expect(clipPlaybackAction(9.5, c, { isLast: true })).toBe('play');
  });

  it('STOPS at the trim on the last scene — it does not play the trimmed tail', () => {
    const c = clip({ durationSec: 30, trimEndSec: 20 }); // effective: 10s
    expect(clipPlaybackAction(10, c, { isLast: true })).toBe('stop');
    // the frames that used to leak (11s…30s of source) all stop now
    expect(clipPlaybackAction(12, c, { isLast: true })).toBe('stop');
    expect(clipPlaybackAction(29.9, c, { isLast: true })).toBe('stop');
  });

  it('ADVANCES at the trim when another scene follows', () => {
    const c = clip({ durationSec: 30, trimEndSec: 20 });
    expect(clipPlaybackAction(10, c, { isLast: false })).toBe('advance');
    expect(clipPlaybackAction(25, c, { isLast: false })).toBe('advance');
  });

  it('fences a hair early so the tail never leaks for a repaint', () => {
    const c = clip({ durationSec: 10, trimEndSec: 0 });
    expect(clipPlaybackAction(9.98, c, { isLast: true })).toBe('stop');
    expect(clipPlaybackAction(9.9, c, { isLast: true })).toBe('play');
    // and the epsilon is tunable for slower sampling paths (onTimeUpdate)
    expect(clipPlaybackAction(9.8, c, { isLast: true, epsilonSec: 0.25 })).toBe('stop');
  });

  it('agrees with the length the timeline strip draws', () => {
    const c = clip({ durationSec: 12.5, trimEndSec: 4.5 });
    const end = effectiveClipDuration(c); // 8s — exactly the block's width
    expect(clipPlaybackAction(end - 0.5, c, { isLast: true })).toBe('play');
    expect(clipPlaybackAction(end, c, { isLast: true })).toBe('stop');
  });

  it('an untrimmed clip plays its full source', () => {
    const c = clip({ durationSec: 8, trimEndSec: 0 });
    expect(clipPlaybackAction(4, c, { isLast: true })).toBe('play');
    expect(clipPlaybackAction(7.5, c, { isLast: true })).toBe('play');
    expect(clipPlaybackAction(8, c, { isLast: true })).toBe('stop');
  });

  it('never stops on a garbage time (metadata not ready yet)', () => {
    const c = clip({ durationSec: 30, trimEndSec: 20 });
    expect(clipPlaybackAction(Number.NaN, c, { isLast: true })).toBe('play');
    expect(clipPlaybackAction(-1, c, { isLast: true })).toBe('play');
  });

  it('respects the 0.1s floor a fully-trimmed clip keeps', () => {
    const c = clip({ durationSec: 5, trimEndSec: 5 }); // clamped to MIN_CLIP_SECONDS
    expect(effectiveClipDuration(c)).toBe(0.1);
    expect(clipPlaybackAction(0.2, c, { isLast: false })).toBe('advance');
  });

  it('R24 regression — an UNDEFINED trimEndSec must not break the fence (NaN → plays forever)', () => {
    // Legacy rows / partial patches can arrive without trimEndSec. It used to
    // make effectiveClipDuration NaN, so `localSec >= NaN` was never true and
    // the video rolled straight past the block — the exact bug the user saw.
    const legacy = clip({ durationSec: 30, trimEndSec: undefined as unknown as number });
    expect(Number.isFinite(effectiveClipDuration(legacy))).toBe(true);
    expect(effectiveClipDuration(legacy)).toBe(30);
    expect(clipPlaybackAction(29.99, legacy, { isLast: true })).toBe('stop');
    expect(clipPlaybackAction(31, legacy, { isLast: true })).toBe('stop');
    expect(clipPlaybackAction(5, legacy, { isLast: true })).toBe('play');
  });

  it('R24 — a corrupt clip (garbage duration) fences at the floor, never rolls on', () => {
    // NaN duration → treated as 0 → the 0.1s floor → playback stops almost immediately.
    const corrupt = clip({ durationSec: Number.NaN });
    expect(clipPlaybackAction(3, corrupt, { isLast: true })).toBe('stop');
    expect(clipPlaybackAction(0.05, corrupt, { isLast: true })).toBe('play');
    // Zero duration: fenced at the same floor — advances (never plays the "rest").
    const zero = clip({ durationSec: 0 });
    expect(clipPlaybackAction(3, zero, { isLast: false })).toBe('advance');
  });
});
