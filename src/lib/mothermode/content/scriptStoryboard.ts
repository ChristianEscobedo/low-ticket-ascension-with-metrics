/**
 * Pure, server-safe helpers that turn a second-by-second video production
 * script into storyboard segments — one board per video-generation clip
 * (15s or 18s). Board N covers the window [N·L, (N+1)·L) and carries only the
 * beats that start inside it, so each board renders exactly what happens in
 * that clip. Board continuity (character/wardrobe/world) is enforced by the
 * storyboard planner's lookback rules downstream.
 *
 * No imports from the browser or network layers so this stays unit-testable.
 */
import type { VideoScript, VideoScriptBeat } from './review';

/** The clip lengths our video pipeline renders in one generation. */
export const SCRIPT_SEGMENT_LENGTHS = [15, 18] as const;
export type ScriptSegmentLength = (typeof SCRIPT_SEGMENT_LENGTHS)[number];

/** Default clip length when none is chosen. */
export const DEFAULT_SCRIPT_SEGMENT_LENGTH: ScriptSegmentLength = 15;

/** Hard cap on script-derived boards (90s ÷ 15s = 6). */
export const MAX_SCRIPT_STORYBOARD_BOARDS = 6;

/** One clip-sized window of the script, ready to become a storyboard board. */
export interface ScriptStoryboardSegment {
  /** 1-based board/segment index. */
  index: number;
  /** Window start in seconds (inclusive). */
  startSec: number;
  /** Window end in seconds (exclusive, clamped to the script runtime). */
  endSec: number;
  /** Window length in seconds (endSec - startSec). */
  durationSec: number;
  /** Beats whose start falls inside this window, in order. */
  beats: VideoScriptBeat[];
}

/** Coerce an unknown segment length to a supported value (default 15). */
export function toSegmentLength(value: unknown): ScriptSegmentLength {
  return value === 18 ? 18 : 15;
}

/**
 * How many boards a script of `totalSeconds` needs at clip length `L`,
 * clamped to [1, MAX_SCRIPT_STORYBOARD_BOARDS]. A 0/empty runtime yields 1.
 */
export function scriptBoardCount(
  totalSeconds: number,
  segmentLength: ScriptSegmentLength,
): number {
  const total = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const raw = Math.ceil(total / segmentLength) || 1;
  return Math.max(1, Math.min(MAX_SCRIPT_STORYBOARD_BOARDS, raw));
}

/**
 * Slice a script into clip-sized segments. Each beat is assigned to the window
 * containing its `startSec` (clamped to the last window), so every beat lands
 * in exactly one segment and order is preserved. Segments are always contiguous
 * and cover 0..(count·L), with the final window clamped to the script runtime.
 */
export function splitScriptIntoSegments(
  script: Pick<VideoScript, 'totalSeconds' | 'beats'>,
  segmentLength: ScriptSegmentLength = DEFAULT_SCRIPT_SEGMENT_LENGTH,
): ScriptStoryboardSegment[] {
  const beats = Array.isArray(script.beats) ? script.beats : [];
  const total =
    Number.isFinite(script.totalSeconds) && script.totalSeconds > 0
      ? script.totalSeconds
      : beats.reduce((max, b) => Math.max(max, b.endSec ?? 0), 0) ||
        segmentLength;
  const count = scriptBoardCount(total, segmentLength);

  const segments: ScriptStoryboardSegment[] = [];
  for (let i = 0; i < count; i += 1) {
    const startSec = i * segmentLength;
    const endSec = Math.min(total, (i + 1) * segmentLength);
    segments.push({
      index: i + 1,
      startSec,
      endSec: endSec > startSec ? endSec : startSec + segmentLength,
      durationSec: (endSec > startSec ? endSec : startSec + segmentLength) - startSec,
      beats: [],
    });
  }

  for (const beat of beats) {
    const start = Number.isFinite(beat.startSec) ? Math.max(0, beat.startSec) : 0;
    const idx = Math.min(count - 1, Math.floor(start / segmentLength));
    segments[idx].beats.push(beat);
  }

  return segments;
}
