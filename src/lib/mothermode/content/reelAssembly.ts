/**
 * Pure planning for the final reel assembly: turn a piece's rendered storyboard
 * board clips into an ordered, timed stitch plan the ffmpeg integration can
 * compose. Storage-agnostic and server-safe — no fetch, no canvas, no React —
 * so it is trivially unit-testable and shared by the API route and the panel.
 *
 * The assembler only lights up once *every* board carries a finished Seedance
 * clip; a voice wrapper additionally requires a combined voiceover track on the
 * script. Music beds are deferred, so 'music' / 'voice+music' fall back to the
 * voice-or-silent behavior (see describeWrapper).
 */
import type { PieceReview, ReelWrapper, StoryboardBoard } from './review';

/** Fallback per-clip length when a board carries no timing hints. */
export const DEFAULT_CLIP_SECONDS = 5;

/** One ordered, timed source clip in the stitch plan. */
export interface ReelClip {
  /** The board's 1-based index, for reference/ordering. */
  boardIndex: number;
  /** Public (http/https) URL of the rendered clip. */
  url: string;
  /** This clip's runtime in seconds. */
  durationSec: number;
}

/** A fully resolved, ready-to-render stitch plan. */
export interface ReelAssemblyPlan {
  /** Ordered source clips (by board index). */
  clips: ReelClip[];
  /** Board indices in stitch order (mirrors clips). */
  boardOrder: number[];
  /** The audio treatment this plan renders. */
  wrapper: ReelWrapper;
  /** Voiceover track to lay over the cut, for voice wrappers. */
  audioUrl?: string;
  /** Total runtime in seconds (sum of clip durations). */
  durationSec: number;
}

/** Success carries a plan; failure carries a user-facing reason. */
export type ReelAssemblyResult =
  | { ok: true; plan: ReelAssemblyPlan }
  | { ok: false; error: string };

function isHttpUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https?:\/\//i.test(v.trim());
}

/** A board is "rendered" once it has a finished, hosted clip. */
function boardIsRendered(b: StoryboardBoard): boolean {
  return b.videoStatus === 'done' && isHttpUrl(b.videoUrl);
}

/** This board's clip length: explicit segment, else window, else the default. */
export function boardClipDuration(b: StoryboardBoard): number {
  if (typeof b.segmentDuration === 'number' && b.segmentDuration > 0)
    return Math.round(b.segmentDuration);
  if (
    typeof b.startSec === 'number' &&
    typeof b.endSec === 'number' &&
    b.endSec > b.startSec
  )
    return Math.round(b.endSec - b.startSec);
  return DEFAULT_CLIP_SECONDS;
}

/** Ordered boards (by index) that carry a finished, hosted clip. */
export function assembledBoards(review: PieceReview): StoryboardBoard[] {
  const boards = review.storyboard?.boards ?? [];
  return boards
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter(boardIsRendered);
}

/** True when there is ≥1 board and *every* board has a finished clip. */
export function boardsReadyForAssembly(review: PieceReview): boolean {
  const boards = review.storyboard?.boards ?? [];
  if (boards.length === 0) return false;
  return boards.every(boardIsRendered);
}

/** How many boards still need a render before the reel can be assembled. */
export function boardsRemaining(review: PieceReview): number {
  const boards = review.storyboard?.boards ?? [];
  return boards.filter((b) => !boardIsRendered(b)).length;
}

/** True when a wrapper wants a voiceover laid over the clips. */
export function wantsVoiceover(wrapper: ReelWrapper): boolean {
  return wrapper === 'voice' || wrapper === 'voice+music';
}

/** The combined voiceover track to lay over the cut, if the script has one. */
export function assemblyVoiceoverUrl(review: PieceReview): string | undefined {
  const url = review.videoScript?.voiceover?.audioUrl;
  return isHttpUrl(url) ? (url as string).trim() : undefined;
}

/** Human label for a wrapper choice (music is deferred → shown as such). */
export function describeWrapper(wrapper: ReelWrapper): string {
  switch (wrapper) {
    case 'voice':
      return 'Voiceover over clips';
    case 'music':
      return 'Silent (music bed coming soon)';
    case 'voice+music':
      return 'Voiceover over clips (music bed coming soon)';
    case 'silent':
    default:
      return 'Silent (clips only)';
  }
}

/**
 * Build the stitch plan for a piece and wrapper. Returns a clear error string
 * when the piece has no boards, a board is unrendered, or a voice wrapper is
 * chosen without a combined voiceover on the script. Pure.
 */
export function buildReelAssemblyPlan(
  review: PieceReview,
  wrapper: ReelWrapper,
): ReelAssemblyResult {
  const boards = review.storyboard?.boards ?? [];
  if (boards.length === 0) {
    return {
      ok: false,
      error: 'This piece has no storyboard boards to assemble.',
    };
  }
  if (!boardsReadyForAssembly(review)) {
    const n = boardsRemaining(review);
    return {
      ok: false,
      error: `Render every board first — ${n} clip${n === 1 ? '' : 's'} still ${
        n === 1 ? 'needs' : 'need'
      } a Seedance render.`,
    };
  }

  const ordered = assembledBoards(review);
  const clips: ReelClip[] = ordered.map((b) => ({
    boardIndex: b.index,
    url: (b.videoUrl as string).trim(),
    durationSec: boardClipDuration(b),
  }));
  const durationSec = clips.reduce((sum, c) => sum + c.durationSec, 0);

  let audioUrl: string | undefined;
  if (wantsVoiceover(wrapper)) {
    audioUrl = assemblyVoiceoverUrl(review);
    if (!audioUrl) {
      return {
        ok: false,
        error:
          'No voiceover track found. Generate a combined voiceover in the ' +
          'Video Script panel, or choose the Silent wrapper.',
      };
    }
  }

  return {
    ok: true,
    plan: {
      clips,
      boardOrder: clips.map((c) => c.boardIndex),
      wrapper,
      audioUrl,
      durationSec,
    },
  };
}
