/**
 * Reel Studio timeline math (pure, unit-testable, zero server deps).
 *
 * The compose backend (fal ffmpeg-api/compose) understands keyframes as
 * `{ url, timestamp, duration }` laid on tracks — no in-point into a source
 * clip. So v1 trim semantics are honest and simple: a clip plays from its
 * start for `durationSec - trimEndSec` seconds. Reorder changes keyframe
 * order; the audio track starts at `offsetSec` and is capped at the reel
 * runtime when its length is known.
 */
import { makeClipId, type ReelClip, type ReelAudioTrack, type ReelProject } from './types';

/** Minimum playback a clip may contribute (fal rejects zero-length keyframes). */
export const MIN_CLIP_SECONDS = 0.1;

/** Effective playback duration of one clip after BOTH trims (in-point + tail). */
export function effectiveClipDuration(clip: ReelClip): number {
  // `?? 0` matters: clips that arrive without trimEndSec (legacy rows, partial
  // patches) used to make this NaN — and a NaN end means the playback fence
  // NEVER fires, so the video rolled straight past the trimmed block.
  const trimEnd = Math.max(0, clip.trimEndSec ?? 0);
  const trimStart = Math.max(0, clip.trimStartSec ?? 0);
  const dur = Number.isFinite(clip.durationSec) ? clip.durationSec : 0;
  const eff = dur - trimStart - trimEnd;
  return Math.max(MIN_CLIP_SECONDS, Math.round(eff * 1000) / 1000);
}

/** R25: which clip owns timeline-second `t`, with its start + clip-local offset. */
export function clipAtTime(
  clips: ReelClip[],
  t: number,
): { clip: ReelClip; index: number; start: number; local: number } | null {
  if (!clips.length) return null;
  let acc = 0;
  for (let i = 0; i < clips.length; i += 1) {
    const eff = effectiveClipDuration(clips[i]);
    if (t < acc + eff || i === clips.length - 1) {
      return {
        clip: clips[i],
        index: i,
        start: acc,
        local: Math.max(0, Math.min(t - acc, eff)),
      };
    }
    acc += eff;
  }
  return null;
}

/**
 * R25: INSTANT client-side split. Part A keeps the id with the tail cut at
 * `localSec` (seconds into the clip's EFFECTIVE window); part B is a new clip
 * on the SAME source whose in-point is the cut. No server round-trip — the
 * in-point rides `trimStartSec` until compose materializes it.
 */
export function splitClipAt(clip: ReelClip, localSec: number): [ReelClip, ReelClip] {
  const eff = effectiveClipDuration(clip);
  const local = Math.max(MIN_CLIP_SECONDS, Math.min(localSec, eff - MIN_CLIP_SECONDS));
  const cutAt = Math.max(0, clip.trimStartSec ?? 0) + local; // source seconds
  const partA: ReelClip = {
    ...clip,
    trimEndSec: Math.round(Math.max(0, clip.durationSec - cutAt) * 1000) / 1000,
  };
  const partB: ReelClip = {
    ...clip,
    id: makeClipId(),
    name: clip.name.length > 56 ? clip.name : `${clip.name} (2)`,
    trimStartSec: Math.round(cutAt * 1000) / 1000,
  };
  return [partA, partB];
}

/**
 * R15: fit an aw:ah box inside a cw×ch container (letterbox math). The stage
 * canvas is sized in MEASURED pixels so the preview can never be cut off.
 */
export function fitAspect(
  containerW: number,
  containerH: number,
  aspectW: number,
  aspectH: number,
): { w: number; h: number } {
  if (containerW <= 0 || containerH <= 0 || aspectW <= 0 || aspectH <= 0) {
    return { w: 0, h: 0 };
  }
  const scale = Math.min(containerW / aspectW, containerH / aspectH);
  return {
    w: Math.max(0, Math.floor(aspectW * scale)),
    h: Math.max(0, Math.floor(aspectH * scale)),
  };
}

/** Total reel runtime across the ordered clips. */
/**
 * R23 — the ONE authority for "should the preview keep rolling?".
 *
 * The trimmed block on the timeline is the clip's real end. Ask this on every
 * frame with the video's CLIP-LOCAL time and it answers:
 *   - 'play'    → still inside the block, keep rolling
 *   - 'advance' → block is over and another scene follows
 *   - 'stop'    → block is over and this was the last scene
 *
 * Callers must pause the <video> ELEMENT on 'advance'/'stop' — React state
 * alone never stopped the media, which is why a shortened block used to roll
 * on and play the trimmed-away tail.
 */
export type ClipPlaybackAction = 'play' | 'advance' | 'stop';

export function clipPlaybackAction(
  localSec: number,
  clip: ReelClip,
  opts: { isLast: boolean; epsilonSec?: number },
): ClipPlaybackAction {
  // A frame lands a hair before the boundary far more often than exactly on it,
  // so fence slightly early — otherwise the tail leaks for one repaint.
  const eps = opts.epsilonSec != null ? Math.max(0, opts.epsilonSec) : 0.03;
  if (!Number.isFinite(localSec) || localSec < 0) return 'play';
  const end = effectiveClipDuration(clip);
  // Belt and suspenders: a corrupt clip must STOP the preview, never roll on.
  if (!Number.isFinite(end) || end <= 0) return 'stop';
  if (localSec >= end - eps) return opts.isLast ? 'stop' : 'advance';
  return 'play';
}

export function reelDurationSec(clips: ReelClip[]): number {

  const total = clips.reduce((sum, c) => sum + effectiveClipDuration(c), 0);
  return Math.round(total * 1000) / 1000;
}

/** Move a clip one position (-1) earlier or (+1) later. No-op at the edges. */
export function moveClip(clips: ReelClip[], id: string, dir: -1 | 1): ReelClip[] {
  const i = clips.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= clips.length) return clips;
  const next = clips.slice();
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}

/** Move a clip to an absolute index (clamped). */
export function reorderClip(clips: ReelClip[], id: string, toIndex: number): ReelClip[] {
  const i = clips.findIndex((c) => c.id === id);
  if (i < 0) return clips;
  const j = Math.max(0, Math.min(toIndex, clips.length - 1));
  if (i === j) return clips;
  const next = clips.slice();
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}

/** Set a clip's end-trim, clamped to [0, durationSec - MIN_CLIP_SECONDS]. */
export function trimClipEnd(clip: ReelClip, trimEndSec: number): ReelClip {
  const max = Math.max(0, clip.durationSec - MIN_CLIP_SECONDS);
  const trim = Math.max(0, Math.min(trimEndSec, max));
  return { ...clip, trimEndSec: Math.round(trim * 1000) / 1000 };
}

/** Set the audio offset, clamped to [0, reel runtime) when clips exist. */
export function offsetAudio(
  audio: ReelAudioTrack,
  offsetSec: number,
  clips: ReelClip[],
): ReelAudioTrack {
  const total = reelDurationSec(clips);
  const max = Math.max(0, total - MIN_CLIP_SECONDS);
  const off = Math.max(0, Math.min(offsetSec, max));
  return { ...audio, offsetSec: Math.round(off * 1000) / 1000 };
}

/** Validation errors that block composing. Empty array = ready. */
export function timelineErrors(project: Pick<ReelProject, 'clips' | 'audio'>): string[] {
  const errors: string[] = [];
  if (!project.clips.length) errors.push('Add at least one clip to the timeline.');
  for (const c of project.clips) {
    if (!/^https?:\/\//i.test(c.url)) errors.push(`Clip "${c.name}" has no valid source URL.`);
    if (!(c.durationSec > 0)) errors.push(`Clip "${c.name}" is missing its runtime.`);
  }
  if (project.audio && !/^https?:\/\//i.test(project.audio.url)) {
    errors.push('The audio track has no valid source URL.');
  }
  if (project.audio && project.audio.offsetSec >= reelDurationSec(project.clips)) {
    errors.push('The audio starts after the reel ends — pull its offset back.');
  }
  return errors;
}

/**
 * Build the fal compose "tracks" payload for a project: one video track with
 * keyframes laid sequentially at effective durations, plus (when audio is
 * attached) one audio track starting at the offset and capped so it never
 * outlives the reel when its length is known.
 */
export function buildStudioComposePayload(
  project: Pick<ReelProject, 'clips' | 'audio'>,
): Record<string, unknown> {
  let cursor = 0;
  const videoKeyframes = project.clips.map((c) => {
    const dur = effectiveClipDuration(c);
    const kf = { url: c.url, timestamp: Math.round(cursor * 1000) / 1000, duration: dur };
    cursor += dur;
    return kf;
  });
  const total = Math.round(cursor * 1000) / 1000;

  const tracks: Record<string, unknown>[] = [
    { id: 'video', type: 'video', keyframes: videoKeyframes },
  ];

  if (project.audio) {
    const off = Math.max(0, project.audio.offsetSec);
    const known = project.audio.durationSec;
    const span =
      known && known > 0
        ? Math.min(known, Math.max(MIN_CLIP_SECONDS, total - off))
        : Math.max(MIN_CLIP_SECONDS, total - off);
    tracks.push({
      id: 'voiceover',
      type: 'audio',
      keyframes: [
        {
          url: project.audio.url,
          timestamp: Math.round(off * 1000) / 1000,
          duration: Math.round(span * 1000) / 1000,
        },
      ],
    });
  }

  return { tracks };
}
