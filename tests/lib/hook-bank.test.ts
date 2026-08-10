import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HOOK_SECONDS,
  hookMatches,
  hookToReelClip,
  mountedHookId,
  mountHookOnClips,
  paidSafeHooks,
  rankHooksByScore,
  rowToHookClip,
  unmountHookFromClips,
  type HookClip,
} from '@/lib/mothermode/reel/hookBank';
import type { ReelClip } from '@/lib/mothermode/reel/types';

function makeHook(overrides: Partial<HookClip> = {}): HookClip {
  return {
    id: 'h1',
    name: 'Laundry avalanche',
    url: 'https://cdn.x/h1.mp4',
    source: 'uploaded',
    reaction: 'chaos',
    rights: 'owned',
    durationSec: 1.4,
    spriteUrl: null,
    sheetRef: null,
    hookScore: 82,
    tags: ['kids', 'morning'],
    notes: null,
    createdAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

function makeClip(id: string): ReelClip {
  return { id, name: id, url: `https://cdn.x/${id}.mp4`, durationSec: 5, trimEndSec: 0 };
}

describe('rowToHookClip', () => {
  it('hydrates a DB row and clamps the score into 0-100', () => {
    const h = rowToHookClip({
      id: 'h9',
      name: 'Kitchen on fire-ish',
      url: 'https://cdn.x/h9.mp4',
      source: 'generated',
      reaction: 'shock',
      rights: 'licensed',
      duration_sec: 1.8,
      hook_score: 147,
      tags: ['sheet:mm'],
      sheet_ref: 'twin-1',
      created_at: '2026-08-10T00:00:00.000Z',
    });
    expect(h.source).toBe('generated');
    expect(h.reaction).toBe('shock');
    expect(h.rights).toBe('licensed');
    expect(h.hookScore).toBe(100); // clamped
    expect(h.sheetRef).toBe('twin-1');
  });

  it('falls back to safe defaults for unknown enums and junk scores', () => {
    const h = rowToHookClip({
      id: 'h2',
      name: 'X',
      url: 'https://cdn.x/x.mp4',
      source: 'downloaded-sideways',
      reaction: 'meh',
      rights: 'pirated',
      hook_score: 'not-a-number',
    });
    expect(h.source).toBe('uploaded');
    expect(h.reaction).toBe('shock');
    expect(h.rights).toBe('unknown');
    expect(h.hookScore).toBeNull();
  });
});

describe('the beat-0 mount', () => {
  it('turns a hook into a reel clip with the hook- prefix', () => {
    const c = hookToReelClip(makeHook());
    expect(c).toEqual({
      id: 'hook-h1',
      name: 'Laundry avalanche',
      url: 'https://cdn.x/h1.mp4',
      durationSec: 1.4,
      trimEndSec: 0,
    });
  });

  it('uses the default hook seconds when duration is unknown', () => {
    const c = hookToReelClip(makeHook({ durationSec: null }));
    expect(c.durationSec).toBe(DEFAULT_HOOK_SECONDS);
  });

  it('prepends the hook to the clip list', () => {
    const clips = [makeClip('a'), makeClip('b')];
    const out = mountHookOnClips(clips, makeHook());
    expect(out.map((c) => c.id)).toEqual(['hook-h1', 'a', 'b']);
  });

  it('is idempotent — mounting the same hook twice does not stack it', () => {
    const hook = makeHook();
    const once = mountHookOnClips([makeClip('a')], hook);
    const twice = mountHookOnClips(once, hook);
    expect(twice.filter((c) => c.id === 'hook-h1')).toHaveLength(1);
    expect(twice[0].id).toBe('hook-h1');
  });

  it('unmounts any hook-prefixed clip and reports the mounted id', () => {
    const clips = mountHookOnClips([makeClip('a'), makeClip('b')], makeHook());
    expect(mountedHookId(clips)).toBe('h1');
    const out = unmountHookFromClips(clips);
    expect(out.map((c) => c.id)).toEqual(['a', 'b']);
    expect(mountedHookId(out)).toBeNull();
  });
});

describe('leaderboard + filters', () => {
  it('ranks by score, unscored last', () => {
    const ranked = rankHooksByScore([
      makeHook({ id: 'a', hookScore: 40 }),
      makeHook({ id: 'b', hookScore: null }),
      makeHook({ id: 'c', hookScore: 90 }),
    ]);
    expect(ranked.map((h) => h.id)).toEqual(['c', 'a', 'b']);
  });

  it('matches name, tag, reaction, and source', () => {
    const h = makeHook();
    expect(hookMatches(h, 'laundry')).toBe(true);
    expect(hookMatches(h, 'kids')).toBe(true);
    expect(hookMatches(h, 'chaos')).toBe(true);
    expect(hookMatches(h, 'upload')).toBe(true);
    expect(hookMatches(h, 'nope')).toBe(false);
    expect(hookMatches(h, '')).toBe(true);
  });

  it('paid-safe keeps only owned + licensed', () => {
    const safe = paidSafeHooks([
      makeHook({ id: 'a', rights: 'owned' }),
      makeHook({ id: 'b', rights: 'licensed' }),
      makeHook({ id: 'c', rights: 'meme-fair-use' }),
      makeHook({ id: 'd', rights: 'unknown' }),
    ]);
    expect(safe.map((h) => h.id)).toEqual(['a', 'b']);
  });
});
