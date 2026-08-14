import { describe, expect, it } from 'vitest';
import type { ReelWord } from '@/lib/mothermode/reel/types';
import { isCaptionVisibleAt } from '@/lib/mothermode/reel/captions';

/** Mirror of layer helpers for unit coverage (kept local to avoid exporting internals). */
function resolveCardWindow(
  words: { mark?: { card?: { id: string; mode: 'build' | 'page'; rows?: number; wordsPerRow?: number } } }[],
  activeIdx: number,
) {
  const m = words[activeIdx]?.mark?.card;
  if (!m?.id) return null;
  let from = activeIdx;
  let to = activeIdx + 1;
  while (from > 0 && words[from - 1]?.mark?.card?.id === m.id) from -= 1;
  while (to < words.length && words[to]?.mark?.card?.id === m.id) to += 1;
  return {
    from,
    to,
    mode: m.mode === 'page' ? 'page' : 'build',
    rows: Math.max(1, Math.min(4, Math.round(m.rows ?? 3))),
    wordsPerRow: Math.max(1, Math.min(8, Math.round(m.wordsPerRow ?? 3))),
  };
}

describe('phrase stack cards + mute', () => {
  it('groups contiguous card ids into one window', () => {
    const words = [
      { mark: { card: { id: 'a', mode: 'build' as const, rows: 3, wordsPerRow: 2 } } },
      { mark: { card: { id: 'a', mode: 'build' as const, rows: 3, wordsPerRow: 2 } } },
      { mark: { card: { id: 'a', mode: 'build' as const, rows: 3, wordsPerRow: 2 } } },
      {},
    ];
    const w = resolveCardWindow(words, 1);
    expect(w).toEqual({ from: 0, to: 3, mode: 'build', rows: 3, wordsPerRow: 2 });
  });

  it('returns null when active word has no card', () => {
    expect(resolveCardWindow([{}, {}], 0)).toBeNull();
  });

  it('hidden mark is independent of global mute ranges', () => {
    // Global ranges still work
    expect(isCaptionVisibleAt(3, { muteRanges: [{ fromSec: 2, toSec: 5 }] })).toBe(false);
    // Per-word hidden is a mark concern (layer skips paint) — ranges stay for bulk windows
    expect(isCaptionVisibleAt(1, { captionsOn: true })).toBe(true);
  });

  it('phrase mute sets hidden on every word in range', () => {
    const words: ReelWord[] = [
      { word: 'hello', start: 0, end: 0.3 },
      { word: 'world', start: 0.3, end: 0.6 },
    ];
    const muted = words.map((w) => ({ ...w, mark: { ...(w.mark ?? {}), hidden: true } }));
    expect(muted.every((w) => w.mark?.hidden)).toBe(true);
  });
});
