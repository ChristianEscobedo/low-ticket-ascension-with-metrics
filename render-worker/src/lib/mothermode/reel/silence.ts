/**
 * R3 auto-cut-silence (pure, unit-testable, zero server deps).
 *
 * Finds silent gaps in a clip from its Whisper word timings, and re-times the
 * words for the speech-tight segments that remain after the gaps are cut.
 * The actual cutting is orchestrated by the page through the existing split
 * worker (one in-point trim at a time) — this module is the honest math:
 * where the silence is, and where every word lands once it is gone.
 */
import type { ReelWord } from './types';

export interface SilenceGap {
  /** Seconds into the source clip where the silence starts (padded). */
  start: number;
  /** Seconds into the source clip where speech resumes / the clip ends (padded). */
  end: number;
}

/** Minimum raw gap between words that counts as "dead air". */
export const DEFAULT_MIN_GAP_SEC = 0.6;
/** Padding kept on each side of a cut so words never get clipped mid-phoneme. */
export const DEFAULT_PAD_SEC = 0.15;
/** Minimum cuttable gap after padding (the split worker needs room on both sides). */
export const MIN_CUTTABLE_SEC = 0.4;

function round1(n: number): number {
  // epsilon kills float noise at .x5 boundaries (2.8499999 → 2.9, not 2.8)
  return Math.round((n + 1e-9) * 10) / 10;
}

/**
 * Locate silent gaps: leading dead air before the first word, mid gaps at or
 * over the threshold, and trailing air after the last word. Each gap is
 * shrunk by `padSec` on the speech side(s) so the cut never bites a word.
 * Gaps that end up too short to cut safely are dropped.
 */
export function findSilenceGaps(
  words: ReelWord[],
  clipDurSec: number,
  opts?: { minGapSec?: number; padSec?: number },
): SilenceGap[] {
  const minGap = opts?.minGapSec ?? DEFAULT_MIN_GAP_SEC;
  const pad = opts?.padSec ?? DEFAULT_PAD_SEC;
  if (!Array.isArray(words) || words.length === 0 || !(clipDurSec > 0)) return [];

  const sorted = words.slice().sort((a, b) => a.start - b.start);
  const gaps: SilenceGap[] = [];
  const push = (start: number, end: number) => {
    const s = Math.max(0, round1(start));
    const e = Math.min(round1(clipDurSec), round1(end));
    if (e - s >= MIN_CUTTABLE_SEC) gaps.push({ start: s, end: e });
  };

  // Leading dead air (cut from 0 — no pad on the left edge).
  if (sorted[0].start >= minGap) push(0, sorted[0].start - pad);

  // Mid gaps.
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].start - sorted[i - 1].end;
    if (gap >= minGap) push(sorted[i - 1].end + pad, sorted[i].start - pad);
  }

  // Trailing air (cut to the end — no pad on the right edge).
  const last = sorted[sorted.length - 1];
  if (clipDurSec - last.end >= minGap) push(last.end + pad, clipDurSec);

  return gaps;
}

/** Total seconds a set of gaps removes. */
export function gapTotalSec(gaps: SilenceGap[]): number {
  return round1(gaps.reduce((sum, g) => sum + (g.end - g.start), 0));
}

/**
 * The speech-tight segments that remain after cutting `gaps` from
 * [0, clipDurSec], in order. Always at least one when words exist.
 */
export function keptSegments(gaps: SilenceGap[], clipDurSec: number): SilenceGap[] {
  const segs: SilenceGap[] = [];
  let cursor = 0;
  for (const g of gaps) {
    if (g.start > cursor) segs.push({ start: cursor, end: g.start });
    cursor = Math.max(cursor, g.end);
  }
  if (cursor < clipDurSec) segs.push({ start: cursor, end: clipDurSec });
  return segs;
}

/**
 * Re-time words for one kept segment [segStart, segEnd] of the source clip:
 * a word belongs to the segment when its midpoint lands inside it, gets
 * clamped to the segment edges, then shifted so the segment starts at 0
 * (matching the new in-point-trimmed clip the split worker produces).
 */
export function remapWordsForSegment(
  words: ReelWord[],
  segStart: number,
  segEnd: number,
): ReelWord[] {
  if (!Array.isArray(words) || segEnd <= segStart) return [];
  const out: ReelWord[] = [];
  for (const w of words) {
    const mid = (w.start + w.end) / 2;
    if (mid < segStart || mid >= segEnd) continue;
    const start = round1(Math.max(segStart, w.start) - segStart);
    const end = round1(Math.min(segEnd, w.end) - segStart);
    if (end < start) continue;
    out.push({ word: w.word, start, end });
  }
  return out;
}
