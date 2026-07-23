/**
 * Pure voiceover timing math for the Video production panel. No network, no
 * ElevenLabs import — this module only turns a set of beat texts into a single
 * combined string (recording where each beat starts) and maps a character-level
 * alignment back into per-beat time marks and clip durations. Keeping this
 * network-free makes the timing logic unit-testable in isolation; the actual
 * synthesis and hosting live in the API route.
 */

/** Joiner inserted between beats when concatenating into one combined track.
 *  A single space reads naturally for TTS while adding negligible duration at
 *  each boundary, so beat marks land where the words actually change. */
export const VO_JOINER = ' ';

/** One beat's voiceover text, addressed by its 0-based index in the script. */
export interface VoBeatInput {
  index: number;
  text: string;
}

/** Where each beat's text starts within the combined string (char offset). */
export interface CombinedVoText {
  text: string;
  /** offsets[i] is the char offset where beat i's text begins. */
  offsets: number[];
}

/** A per-beat time window resolved from an alignment (seconds from 0). */
export interface VoBeatMark {
  index: number;
  startSec: number;
  endSec: number;
}

/** The minimal alignment shape we read — matches ElevenLabsAlignment. */
export interface AlignmentLike {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/**
 * Concatenate every beat's voiceover into one string for a single-track
 * generation, recording the character offset where each beat begins so the
 * alignment can later be mapped back to per-beat time marks. Beats keep their
 * given order; empty texts are preserved so indices stay aligned.
 */
export function buildCombinedVoText(beats: VoBeatInput[]): CombinedVoText {
  const offsets: number[] = [];
  let text = '';
  beats.forEach((b, i) => {
    if (i > 0) text += VO_JOINER;
    offsets.push(text.length);
    text += (b?.text ?? '').trim();
  });
  return { text, offsets };
}

/** Clamp an index into [0, len-1]; returns 0 for an empty range. */
function clampIdx(i: number, len: number): number {
  if (len <= 0) return 0;
  if (!Number.isFinite(i) || i < 0) return 0;
  if (i >= len) return len - 1;
  return Math.floor(i);
}

/**
 * The synthesized track's total length in seconds: the end time of its last
 * character. Returns 0 for an empty/degenerate alignment.
 */
export function alignmentDurationSec(alignment: AlignmentLike): number {
  const ends = alignment?.character_end_times_seconds ?? [];
  if (ends.length === 0) return 0;
  const last = ends[ends.length - 1];
  return Number.isFinite(last) ? Math.max(0, last) : 0;
}

/**
 * Map beat start offsets (from buildCombinedVoText) onto a character alignment,
 * producing a contiguous per-beat time window. Beat i starts at the alignment
 * time of its first character; it ends where the next beat starts (or, for the
 * last beat, at the track's end). Times are rounded to the millisecond.
 */
export function beatMarksFromAlignment(
  offsets: number[],
  alignment: AlignmentLike,
): VoBeatMark[] {
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  const n = Math.min(starts.length, ends.length);
  if (n === 0 || offsets.length === 0) {
    return offsets.map((_, i) => ({ index: i, startSec: 0, endSec: 0 }));
  }
  const total = alignmentDurationSec(alignment);
  const round = (v: number) => Math.round(v * 1000) / 1000;

  return offsets.map((off, i) => {
    const startIdx = clampIdx(off, n);
    const startSec = Math.max(0, starts[startIdx] ?? 0);
    let endSec: number;
    if (i < offsets.length - 1) {
      const nextIdx = clampIdx(offsets[i + 1], n);
      endSec = Math.max(startSec, starts[nextIdx] ?? total);
    } else {
      endSec = Math.max(startSec, total);
    }
    return { index: i, startSec: round(startSec), endSec: round(endSec) };
  });
}

/**
 * Signed drift of an actual beat start vs its planned (script) start, in
 * seconds. Positive = the VO reaches this beat later than the script window
 * says; negative = earlier. Rounded to the millisecond.
 */
export function beatDriftSec(actualStartSec: number, plannedStartSec: number): number {
  const d = (actualStartSec ?? 0) - (plannedStartSec ?? 0);
  return Math.round(d * 1000) / 1000;
}
