/**
 * R30 RENDER PLAN — the ONE serializable description of a finished reel.
 *
 * Why this exists: burning animations + karaoke captions through ffmpeg filter
 * strings (fal compose → ASS burn-in) is where the render kept breaking. ASS
 * cannot express the modern look at all (per-word scale pops, blur-in, gradient
 * fills, box-grow highlights, Ken-Burns motion), and every attempt to fake it
 * produced a different frame than the editor preview.
 *
 * The fix is to stop describing pixels in a filter string and instead describe
 * the reel as DATA, then render that data with the SAME React components the
 * editor previews with (Remotion). One mapper, one truth:
 *
 *   ReelProject  ──buildRenderPlan()──>  RenderPlan  ──Remotion──>  MP4
 *
 * This module is PURE (no fetch, no fs, no React) so it is fully unit-testable
 * and safe to import from both the API route and the Remotion bundle.
 *
 * Frames, not seconds, are the currency: the renderer is frame-exact, so every
 * boundary is rounded ONCE here. That kills the "captions drift late by a few
 * frames" class of bug for good.
 */
import {
  captionDefFor,
  captionLayoutFor,
  resolveCaptionStyle,
  type CaptionLayout,
  type CaptionStyleDef,
} from '../captions';
import { captionFontsFor, type CaptionFont } from '../captionFonts';
import type { MotionKey } from '../motion';
import { effectiveClipDuration, MIN_CLIP_SECONDS } from '../timeline';
import type { ReelMediaCueStyle, ReelProject, ReelWord, ReelWordMark } from '../types';

/**
 * Unwrap a Remotion preview proxy URL back to its raw source. The studio's
 * preview wraps OffthreadVideo srcs in `/proxy?src=<encoded>` for CORS-free
 * playback; if that wrapped URL reaches the render plan, the worker (a
 * DIFFERENT machine) fetches `localhost:3000/proxy?...`, gets a 500, and
 * Chrome hangs on the frame — the compositor SIGKILL. The render needs the
 * RAW source. Anything that isn't a proxy URL passes through unchanged.
 */
function unwrapProxySrc(src: string): string {
  if (typeof src !== 'string' || !src.includes('/proxy?')) return src;
  try {
    const inner = new URL(src, 'http://x').searchParams.get('src');
    return inner && /^https?:\/\//i.test(inner) ? inner : src;
  } catch {
    return src;
  }
}

// ---------------------------------------------------------------------------
// Plan shape (must stay JSON-serializable — it travels as Remotion inputProps)
// ---------------------------------------------------------------------------

export interface RenderClip {
  id: string;
  name: string;
  /** Public http(s) source. */
  src: string;
  /** Timeline position, in frames. */
  fromFrame: number;
  /** How many frames of this clip play. */
  durationInFrames: number;
  /** In-point in SOURCE seconds (Remotion trims with startFrom). */
  trimStartSec: number;
  /** Keyframed scale/pan/rotate, times still in clip-local seconds. */
  motion?: MotionKey[];
}

export interface RenderOverlay extends RenderClip {
  /** Overlays ride above the main track (b-roll). */
  layer: number;
}

export interface RenderAudio {
  src: string;
  fromFrame: number;
  durationInFrames: number;
}

/** One caption word, timed in TIMELINE frames (already trim-shifted). */
export interface RenderWord {
  text: string;
  fromFrame: number;
  toFrame: number;
  /** Per-word styling, copied verbatim from ReelWord.mark by shiftWords. */
  mark?: ReelWordMark;
}

/**
 * A word-triggered media cue, resolved to TIMELINE frames. The image flies in
 * when its trigger word is spoken and holds after the word ends — the cue's
 * own holdSec when set, else MEDIA_CUE_HOLD_SEC (clamped to the clip's
 * surviving window either way).
 */
export interface RenderMediaCue {
  id: string;
  src: string;
  fromFrame: number;
  durationInFrames: number;
  /** The trigger word (for logs/debugging). */
  wordText: string;
  /** Per-cue look (size/position/frame), copied verbatim from the project. */
  style?: ReelMediaCueStyle;
  /** One-shot sound as the cue flies in, copied verbatim from the project. */
  sfx?: { url: string; volume?: number };
  /**
   * Keyframed motion, CUE-RELATIVE seconds (0 = the frame the cue appears).
   * The cue layer samples it exactly like a clip's track; when it's absent
   * the default rise+scale/fade entrance owns the transform.
   */
  motion?: MotionKey[];
}

/** Default hold after the trigger word ends; a cue's holdSec overrides it. */
export const MEDIA_CUE_HOLD_SEC = 1.0;

export interface RenderPlan {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  clips: RenderClip[];
  overlays: RenderOverlay[];
  audio: RenderAudio | null;
  /** Timeline-absolute word timings for the caption layer. */
  words: RenderWord[];
  /** The preset id the reel was saved with (for logs / cache keys). */
  captionStyleId: string;
  /** Fully resolved style (preset + per-reel overrides already merged). */
  captionStyle: CaptionStyleDef;
  /** Position / size / rows, resolved from the same overrides. */
  captionLayout: CaptionLayout;
  captionOverrides?: import('../captions').CaptionOverrides | null;
  /** Words that render in the active style even when idle. */
  powerWords: string[];
  /** Word-triggered media cues (image fly-ins), frame-resolved. */
  mediaCues: RenderMediaCue[];
  /**
   * Webfonts the renderer must fetch *before* drawing frame 0. The render
   * container ships only Noto, so without this the caption font silently
   * falls back and burns in wrong. Resolved here rather than in the worker
   * because caption styles are user-editable — the worker cannot know which
   * families to fetch, it can only load what it is told.
   * See docs/CAPTION_FONT_MISSING_IN_RENDER_FINDING.md.
   */
  fonts: CaptionFont[];
  /** Optional 0..1 peak buckets for caption waveBounce (from client waveform). */
  audioPeaks?: number[];

}

export interface RenderPlanOptions {
  fps?: number;
  width?: number;
  height?: number;
}

/** Aspect presets — vertical is the default because reels are vertical. */
export const RENDER_SIZES = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
} as const;

export const DEFAULT_FPS = 30;

/** Seconds → frames, rounded once and never negative. */
export function toFrames(sec: number, fps: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return Math.max(0, Math.round(sec * fps));
}

/** Frames a clip contributes — always at least one frame so nothing vanishes. */
function clipFrames(sec: number, fps: number): number {
  return Math.max(1, toFrames(sec, fps));
}

/**
 * Shift a clip's word timings onto the TIMELINE and drop anything the trims cut.
 *
 * Word times arrive in SOURCE seconds (that's what the transcriber returns), so
 * a clip with an in-point must subtract it — otherwise every caption after the
 * first split lands late by exactly the trim, which is what the burned MP4 kept
 * showing while the preview looked fine.
 */
export function shiftWords(
  words: ReelWord[],
  opts: { clipStartFrame: number; trimStartSec: number; effectiveSec: number; fps: number },
): RenderWord[] {
  const { clipStartFrame, trimStartSec, effectiveSec, fps } = opts;
  const out: RenderWord[] = [];
  for (const w of words) {
    const localStart = w.start - trimStartSec;
    const localEnd = w.end - trimStartSec;
    // Fully outside the surviving window → the trim really did remove it.
    if (localEnd <= 0 || localStart >= effectiveSec) continue;
    const from = clipStartFrame + toFrames(Math.max(0, localStart), fps);
    const to = clipStartFrame + toFrames(Math.min(effectiveSec, localEnd), fps);
    const text = w.word.trim();
    if (!text) continue;
    out.push({
      text,
      fromFrame: from,
      toFrame: Math.max(from + 1, to),
      // The mark rides through verbatim — it was validated by normalizeReelWords.
      ...(w.mark ? { mark: w.mark } : {}),
    });
  }
  return out;
}

/**
 * Resolve word-triggered media cues to TIMELINE frames.
 *
 * The cue keys on (clipId, wordIndex) — the same transcript-derived address the
 * subtitle editor shows — so it re-times itself off the word's own start/end.
 * A cue whose word was trimmed away is dropped here (the word is genuinely
 * gone), exactly like shiftWords drops trimmed words.
 */
export function shiftMediaCues(
  project: Pick<ReelProject, 'clips' | 'captions' | 'mediaCues'>,
  fps: number,
): RenderMediaCue[] {
  const out: RenderMediaCue[] = [];
  let cursor = 0;
  for (const clip of project.clips) {
    const effSec = effectiveClipDuration(clip);
    const frames = clipFrames(effSec, fps);
    const trimStartSec = Math.max(0, clip.trimStartSec ?? 0);
    const cues = (project.mediaCues ?? []).filter((c) => c.clipId === clip.id);
    const words = project.captions?.[clip.id] ?? [];
    for (const cue of cues) {
      const w = words[cue.wordIndex];
      if (!w) continue;
      const localStart = w.start - trimStartSec;
      const localEnd = w.end - trimStartSec;
      if (localEnd <= 0 || localStart >= effSec) continue;
      const from = cursor + toFrames(Math.max(0, localStart), fps);
      const to = cursor + toFrames(Math.min(effSec, localEnd + (cue.holdSec ?? MEDIA_CUE_HOLD_SEC)), fps);
      out.push({
        id: cue.id,
        src: unwrapProxySrc(cue.url),
        fromFrame: from,
        durationInFrames: Math.max(1, to - from),
        wordText: w.word,
        // Style + motion ride through verbatim — normalizeMediaCues validated
        // them at load, so the plan stays the faithful pipe (like shiftWords'
        // mark passthrough).
        ...(cue.style ? { style: cue.style } : {}),
        ...(cue.motion && cue.motion.length >= 2 ? { motion: cue.motion } : {}),
        ...(cue.sfx ? { sfx: cue.sfx } : {}),
      });
    }
    cursor += frames;
  }
  return out;
}

/**
 * Build the render plan for a project. Deterministic: the same project always
 * produces the same plan, which is what makes render caching + diffing sane.
 */
export function buildRenderPlan(
  project: Pick<
    ReelProject,
    'clips' | 'audio' | 'captions' | 'captionStyle' | 'captionOverrides' | 'overlays' | 'mediaCues'
  >,
  options: RenderPlanOptions = {},
): RenderPlan {
  const fps = Math.max(1, Math.round(options.fps ?? DEFAULT_FPS));
  const width = Math.max(16, Math.round(options.width ?? RENDER_SIZES.vertical.width));
  const height = Math.max(16, Math.round(options.height ?? RENDER_SIZES.vertical.height));

  const baseDef = captionDefFor(project.captionStyle);
  const captionStyle = resolveCaptionStyle(baseDef, project.captionOverrides ?? null);
  const captionLayout = captionLayoutFor(baseDef, project.captionOverrides ?? null);

  const clips: RenderClip[] = [];
  const words: RenderWord[] = [];
  let cursor = 0; // frames

  for (const clip of project.clips) {
    const effSec = effectiveClipDuration(clip);
    const frames = clipFrames(effSec, fps);
    const trimStartSec = Math.max(0, clip.trimStartSec ?? 0);
    clips.push({
      id: clip.id,
      name: clip.name,
      src: unwrapProxySrc(clip.url),
      fromFrame: cursor,
      durationInFrames: frames,
      trimStartSec,
      ...(clip.motion && clip.motion.length >= 2 ? { motion: clip.motion } : {}),
    });
    const clipWords = project.captions?.[clip.id] ?? [];
    if (clipWords.length) {
      words.push(
        ...shiftWords(clipWords, {
          clipStartFrame: cursor,
          trimStartSec,
          effectiveSec: effSec,
          fps,
        }),
      );
    }
    cursor += frames;
  }

  const durationInFrames = Math.max(1, cursor);

  const overlays: RenderOverlay[] = (project.overlays ?? []).map((o, i) => {
    const effSec = effectiveClipDuration(o);
    return {
      id: o.id,
      name: o.name,
      src: unwrapProxySrc(o.url),
      fromFrame: toFrames(Math.max(0, o.offsetSec), fps),
      durationInFrames: clipFrames(effSec, fps),
      trimStartSec: Math.max(0, o.trimStartSec ?? 0),
      layer: i + 1,
      ...(o.motion && o.motion.length >= 2 ? { motion: o.motion } : {}),
    };
  });

  let audio: RenderAudio | null = null;
  if (project.audio) {
    const fromFrame = toFrames(Math.max(0, project.audio.offsetSec), fps);
    const remaining = Math.max(1, durationInFrames - fromFrame);
    const known = project.audio.durationSec;
    const span =
      known && known > 0 ? Math.min(clipFrames(known, fps), remaining) : remaining;
    audio = { src: unwrapProxySrc(project.audio.url), fromFrame, durationInFrames: span };
  }

  // Words must be monotonic for the karaoke walk (chunking assumes order).
  words.sort((a, b) => a.fromFrame - b.fromFrame);

  return {
    fps,
    width,
    height,
    durationInFrames,
    clips,
    overlays,
    audio,
    words,
    captionStyleId: typeof project.captionStyle === 'string' ? project.captionStyle : 'karaoke',
    captionStyle,
    captionLayout,
    powerWords: project.captionOverrides?.powerWords ?? [],
    mediaCues: shiftMediaCues(project, fps),
    // The style's fonts PLUS any per-word font marks — a font the worker does
    // not fetch renders as a fallback face in the MP4, so marked families
    // ride the same plan.fonts list the preview and the worker both load.
    fonts: (() => {
      const base = captionFontsFor(captionStyle);
      const seen = new Set(base.map((f) => f.family));
      const out = base.slice();
      for (const words of Object.values(project.captions ?? {})) {
        for (const w of words) {
          const fam = w.mark?.font;
          if (fam && !seen.has(fam)) {
            seen.add(fam);
            out.push(...captionFontsFor({ font: fam } as Parameters<typeof captionFontsFor>[0]));
          }
        }
      }
      return out;
    })(),
  };
}

/** Blocking problems — the route refuses to spend a render on a broken plan. */
export function renderPlanErrors(plan: RenderPlan): string[] {
  const errors: string[] = [];
  if (!plan.clips.length) errors.push('Nothing to render — the timeline is empty.');
  for (const c of plan.clips) {
    if (!/^https?:\/\//i.test(c.src)) {
      errors.push(`Clip "${c.name}" is not a public URL — the renderer cannot fetch it.`);
    }
    if (c.durationInFrames < 1) errors.push(`Clip "${c.name}" has no runtime.`);
  }
  if (plan.audio && !/^https?:\/\//i.test(plan.audio.src)) {
    errors.push('The audio track is not a public URL.');
  }
  if (plan.durationInFrames < Math.round(MIN_CLIP_SECONDS * plan.fps)) {
    errors.push('The reel is too short to render.');
  }
  return errors;
}

/** Rough cost/time signal for the UI (Lambda bills by rendered second). */
export function estimateRenderSeconds(plan: RenderPlan): number {
  return Math.round((plan.durationInFrames / plan.fps) * 100) / 100;
}
