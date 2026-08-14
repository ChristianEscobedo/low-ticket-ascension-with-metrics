/**
 * THE caption layer. One implementation, two consumers.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Until now there were two full copies of the caption layer:
 *
 *   remotion-project/CaptionLayer.tsx               <- the studio preview
 *   render-worker/remotion-project/CaptionLayer.tsx <- what actually renders
 *
 * Nothing forced them to agree, and they didn't. The preview scaled the caption
 * font with `sizePx / 390`, the worker with `sizePx / 360` — an 8.3% font-size
 * difference. Font size sets text width, text width sets where rows wrap, so the
 * caption block sat in a different place and broke across different words in the
 * MP4 than on the stage. That was the "captions are aligned differently in the
 * render" bug: not an offset, a scale mismatch feeding the layout. It was hunted
 * for several sessions inside the caption *styles*, where it never lived.
 *
 * The two copies also drifted in behaviour: the preview animated the active word
 * with a CSS `animation` and held the final word forever; the worker drives the
 * entrance off the frame number (CSS animation clocks do not advance between
 * renderMedia screenshots, so keyframes render frozen) and clears the last word
 * after a hold. The frame-driven version is correct in BOTH environments — the
 * Player advances frames too — so it is the one that survives here.
 *
 * WHY IT LIVES IN src/lib AND NOT IN A remotion-project FOLDER
 * -----------------------------------------------------------
 * The worker's Docker image must be self-contained (`COPY . ./` from
 * render-worker/), so it cannot reach up into the app. It therefore keeps a
 * VENDORED copy of this file at
 * render-worker/src/lib/mothermode/reel/render/captionLayer.tsx, kept
 * byte-identical by scripts/sync-vendored-captions.cjs and enforced by
 * tests/lib/render-vendor-parity.test.ts. That is a copy of ONE file with a
 * machine check, not two hand-maintained components — the geometry can no longer
 * diverge without a red test.
 *
 * WHY `frame` IS A PROP INSTEAD OF useCurrentFrame()
 * -------------------------------------------------
 * This module must be importable from the app's TypeScript program (which does
 * not resolve `remotion`, and must not pull the renderer into the web build) and
 * from the worker's Remotion bundle. Taking the frame as a prop keeps it free of
 * any Remotion import; each composition supplies `useCurrentFrame()` in a
 * four-line wrapper.
 *
 * EVERY EFFECT IS FRAME MATH, NEVER A CSS CLOCK
 * ---------------------------------------------
 * Every animation below (word entrances, the ghost page fade, the float bob,
 * the karaoke progress fill, letter cascades) is computed from the frame number
 * and the word timings — the same numbers at render time as on the stage. No
 * effect is stored per word or row, so a trim/split can never orphan one.
 */
import React from 'react';
import {
  isCaptionVisibleAt,
  captionCssFor,
  captionRows,
  emojiFor,
  isPowerWord,
  type CaptionLayout,
  type CaptionStyleDef,
} from '../captions';

/**
 * The editor stage is 360px wide and `sizePx` is authored against it, so this is
 * the divisor that maps stage px to frame px. It is a single constant now
 * precisely because it used to be two literals that disagreed.
 */
export const CAPTION_STAGE_W = 360;

/** How long the FINAL word lingers after it ends, before the line clears. */
export const CAPTION_HOLD_SEC = 0.6;

/** The active word's entrance duration. */
export const CAPTION_ENTER_SEC = 0.18;

/**
 * Default ghost page-fade durations (seconds).
 * Fade fully ON, HOLD at full opacity, then fade fully OFF.
 * Per-preset / override values live on `def.ghost`.
 */
export const GHOST_FADE_IN_SEC = 0.22;
export const GHOST_FADE_OUT_SEC = 0.28;
/** @deprecated use GHOST_FADE_IN_SEC / GHOST_FADE_OUT_SEC */
export const GHOST_FADE_SEC = GHOST_FADE_IN_SEC;

/** One float bob period, seconds. */
export const FLOAT_PERIOD_SEC = 1.8;

/** Default per-letter delay for the cascade anim, seconds. */
export const CASCADE_STAGGER_SEC = 0.035;

/**
 * A per-word style mark (the "this word does its own thing" slot).
 *
 * Structural on purpose: it mirrors `ReelWord.mark` from the app's types.ts.
 * Keep the two shapes in sync — `shiftWords` in plan.ts copies the mark across
 * verbatim, and `normalizeReelWords` in types.ts is what validates it. (The
 * worker DOES vendor types.ts now — the sync guard keeps it byte-identical —
 * but this mirror keeps the layer free of the import either way.)
 */
export interface CaptionWordMark {
  /** Hide this word from paint (phrase mute). */
  hidden?: boolean;
  /** Phrase stack card (see ReelWordMark.card). */
  card?: {
    id: string;
    mode: 'build' | 'page';
    rows?: number;
    wordsPerRow?: number;
    anim?: string;
  };
  /** Free-place frame position (see ReelWordMark.xPct/yPct). */
  xPct?: number;
  yPct?: number;
  /** Entrance anim for THIS word instead of the preset's. */
  anim?: string;
  /** Color override — the word carries it even when idle. */
  color?: string;
  /** Extra scale multiplier for THIS word (the "shout" beat). */
  scale?: number;
  /** Per-letter cascade delay in seconds for THIS word. */
  stagger?: number;
  /** Ambient motion while the word shows: a gentle bob / a soft sway. */
  ambient?: 'float' | 'wiggle';
  /** A persistent effect for THIS word. underline/marker/strike render as spans. */
  fx?:
    | 'glow'
    | 'gradient'
    | 'shine'
    | 'pulse'
    | 'underline'
    | 'marker'
    | 'tilt'
    | 'outline'
    | 'strike'
    | 'blink'
    | 'jelly';
  /** The fx color (halo / underline / marker / gradient anchor). */
  fxColor?: string;
  /** The fx intensity multiplier (0.2–3, default 1). */
  fxAmount?: number;
  /** The fx density (0.2–3, default 1): glow layers, shine bands, frequencies. */
  fxDensity?: number;
  /** A second fx color: the gradient's end and the shine band's light. */
  fxColor2?: string;
  /** A different font for THIS word (the plan ships it in plan.fonts). */
  font?: string;
  /** A one-shot sound at the word's first frame (the composition renders it). */
  sfx?: { url: string; volume?: number };
}

/** One caption word, timed in TIMELINE frames. */
export interface CaptionWord {
  text: string;
  fromFrame: number;
  toFrame: number;
  mark?: CaptionWordMark;
}

/**
 * The slice of a RenderPlan the caption layer reads. Structural on purpose: the
 * app passes its real `RenderPlan`, the worker passes the loosely-typed plan it
 * parses off the wire.
 */
export interface CaptionPlanLike {
  fps: number;
  width: number;
  words: ReadonlyArray<CaptionWord>;
  captionStyle: CaptionStyleDef;
  captionLayout: CaptionLayout;
  powerWords: ReadonlyArray<string>;
}

/**
 * The index of the word being spoken on this frame, or -1 when nothing shows.
 *
 * `holdFrames` bounds the "never blink" hold below. Without a bound the hold
 * runs to the end of the composition: once the transcript is exhausted this
 * returned `words.length - 1` for every remaining frame, freezing the last
 * caption on screen. If the transcript covers only part of the timeline (an
 * untranscribed clip, or words dropped by a trim) that reads as captions
 * "getting stuck partway through".
 */
export function activeWordIndex(
  words: ReadonlyArray<CaptionWord>,
  frame: number,
  holdFrames = 0,
): number {
  for (let i = 0; i < words.length; i += 1) {
    if (frame >= words[i].fromFrame && frame < words[i].toFrame) return i;
  }
  // Between words: hold the last word that has started so the line never blinks.
  let last = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].fromFrame <= frame) last = i;
    else break;
  }
  if (last < 0) return -1;
  // Past the end of the transcript, clear instead of freezing the final word.
  if (last === words.length - 1 && frame >= words[last].toFrame + holdFrames) {
    return -1;
  }
  return last;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Ghost unit opacity for one staggered item (word or letter).
 * unitIndex 0 is first; higher indices lag by staggerFrames on the way IN
 * and on the way OUT (first in, first out — a smooth cascade both ways).
 * Returns 0..1: fade in → hold → fade out.
 */
/** Smoothstep 0→1 (movie-caption ease-in-out). */
export function ghostSmooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Ghost unit opacity for one staggered item (word or letter) or the whole block
 * (unitIndex 0, staggerFrames 0).
 * ease 'smooth' = ease-in-out reveal/dissolve (viral movie-caption feel).
 * Returns 0..1.
 */
export function ghostUnitOpacity(
  frame: number,
  pageStartFrame: number,
  pageEndFrame: number,
  unitIndex: number,
  inF: number,
  outF: number,
  staggerFrames: number,
  ease: 'linear' | 'smooth' = 'smooth',
): number {
  const delay = Math.max(0, unitIndex) * Math.max(0, staggerFrames);
  const localIn = frame - pageStartFrame - delay;
  const localOut = pageEndFrame - frame - delay;
  let inOp = Math.min(1, Math.max(0, localIn / Math.max(1, inF)));
  let outOp = Math.min(1, Math.max(0, localOut / Math.max(1, outF)));
  if (ease === 'smooth') {
    inOp = ghostSmooth(inOp);
    outOp = ghostSmooth(outOp);
  }
  return Math.min(inOp, outOp);
}

/**
 * Vertical drift factor for movie-style fade: +1 at start of fade-in, 0 at hold,
 * -1 at end of fade-out. Multiply by driftEm for translateY.
 */
export function ghostDriftFactor(
  frame: number,
  pageStartFrame: number,
  pageEndFrame: number,
  unitIndex: number,
  inF: number,
  outF: number,
  staggerFrames: number,
): number {
  const delay = Math.max(0, unitIndex) * Math.max(0, staggerFrames);
  const localIn = frame - pageStartFrame - delay;
  const localOut = pageEndFrame - frame - delay;
  if (localIn < inF) {
    // rising onto the frame: start below (positive Y) → 0
    const t = Math.min(1, Math.max(0, localIn / Math.max(1, inF)));
    return 1 - ghostSmooth(t);
  }
  if (localOut < outF) {
    // sinking off: 0 → positive Y
    const t = Math.min(1, Math.max(0, 1 - localOut / Math.max(1, outF)));
    return ghostSmooth(t);
  }
  return 0;
}

/**
 * Ghost opacity keyed to ONE word's spoken window (fromFrame → toFrame).
 * Fade fully ON as the word starts, hold while spoken, fade fully OFF at end.
 * Matches karaoke timing so reveal tracks the speaker.
 */
export function wordSyncedGhostOpacity(
  frame: number,
  fromFrame: number,
  toFrame: number,
  inF: number,
  outF: number,
  ease: 'linear' | 'smooth' = 'smooth',
): number {
  const dur = Math.max(1, toFrame - fromFrame);
  let inFrames = Math.max(1, inF);
  let outFrames = Math.max(1, outF);
  const minHold = 1;
  if (inFrames + outFrames + minHold > dur) {
    const budget = Math.max(2, dur - minHold);
    const total = inFrames + outFrames;
    inFrames = Math.max(1, Math.round((budget * inFrames) / total));
    outFrames = Math.max(1, budget - inFrames);
  }
  const localIn = frame - fromFrame;
  const localOut = toFrame - frame;
  let inOp = Math.min(1, Math.max(0, localIn / inFrames));
  let outOp = Math.min(1, Math.max(0, localOut / outFrames));
  if (ease === 'smooth') {
    // smoothstep
    const s = (t: number) => t * t * (3 - 2 * t);
    inOp = s(inOp);
    outOp = s(outOp);
  }
  if (frame < fromFrame) return 0;
  if (frame > toFrame) return 0;
  return Math.min(inOp, outOp);
}

/** Word-local float/wiggle phase: starts at the word's fromFrame. */
export function wordMotionPhase(
  frame: number,
  fromFrame: number,
  fps: number,
  periodSec: number,
): number {
  const t = Math.max(0, frame - fromFrame) / Math.max(1, fps);
  const p = Math.max(0.25, periodSec);
  return (t / p) * Math.PI * 2;
}



/**
 * The active word's entrance as plain style values for a given progress `e`
 * (0 = just spoken, 1 = settled).
 *
 * Deliberately NOT a CSS `animation`: renderMedia screenshots one discrete frame
 * at a time and the CSS animation clock does not advance between screenshots, so
 * a keyframe animation renders frozen at its first frame for the whole video.
 * That is why burned captions had no motion while the preview looked fine.
 *
 * Every `CaptionAnim` in captions.ts has a frame-driven case here — the CSS
 * keyframes in captions.ts are only for the decorative platform-mock swatches.
 */
export function entranceStyle(anim: string, e: number): React.CSSProperties {
  const p = clamp01(e);
  switch (anim) {
    case 'fade':
      return { opacity: p };
    case 'slide':
      return { transform: `translateY(${(1 - p) * 0.35}em)`, opacity: p };
    case 'flip':
      return {
        transform: `perspective(600px) rotateX(${(1 - p) * -90}deg)`,
        opacity: p,
      };
    case 'spin':
      return {
        transform: `rotate(${(1 - p) * -25}deg) scale(${0.7 + p * 0.3})`,
        opacity: p,
      };
    case 'bounce':
      // 0→60%: grow 0.6→1.12 with fade; 60→100%: settle 1.12→1.
      if (p < 0.6) {
        const t = p / 0.6;
        return { transform: `scale(${0.6 + t * 0.52})`, opacity: t };
      }
      return { transform: `scale(${1.12 - ((p - 0.6) / 0.4) * 0.12})`, opacity: 1 };
    case 'blurIn':
      return {
        filter: `blur(${(1 - p) * 10}px)`,
        transform: `scale(${1.06 - p * 0.06})`,
        opacity: 0.2 + p * 0.8,
      };
    case 'riseUp':
      return { transform: `translateY(${(1 - p) * 0.35}em)`, opacity: p };
        case 'slam': {
      const sc = 1.55 - 0.55 * p;
      const y = (1 - p) * -0.55;
      return { opacity: p, transform: `translateY(${y.toFixed(3)}em) scale(${sc.toFixed(3)})` };
    }
    case 'typewriter':
      return { opacity: p > 0.05 ? 1 : 0 };
    case 'blurPop': {
      const blur = ((1 - p) * 8).toFixed(1);
      const sc = 0.85 + 0.15 * p;
      return { opacity: p, filter: `blur(${blur}px)`, transform: `scale(${sc.toFixed(3)})` };
    }
    case 'neonPulse': {
      const pulse = 0.6 + 0.4 * Math.sin(p * Math.PI);
      return {
        opacity: Math.max(p, pulse),
        transform: `scale(${(0.96 + 0.08 * p).toFixed(3)})`,
        textShadow: `0 0 ${(4 + p * 10).toFixed(1)}px currentColor`,
      };
    }
    case 'zoomSnap': {
      const sc = 0.4 + 0.6 * p;
      return { opacity: p, transform: `scale(${sc.toFixed(3)})` };
    }
    case 'dropIn': {
      const y = (1 - p) * -1.1;
      return { opacity: p, transform: `translateY(${y.toFixed(3)}em)` };
    }
case 'elastic': {
      // Squash-and-stretch: 0→45% stretch in, 45→70% overshoot, 70→100% settle.
      let sx = 1;
      let sy = 1;
      if (p < 0.45) {
        const t = p / 0.45;
        sx = 0.7 + t * 0.42;
        sy = 1.25 - t * 0.35;
      } else if (p < 0.7) {
        const t = (p - 0.45) / 0.25;
        sx = 1.12 - t * 0.16;
        sy = 0.9 + t * 0.14;
      } else {
        const t = (p - 0.7) / 0.3;
        sx = 0.96 + t * 0.04;
        sy = 1.04 - t * 0.04;
      }
      return { transform: `scale(${sx},${sy})`, opacity: clamp01(p * 2.5) };
    }
    case 'glitch':
      // RGB-split jitter through the entrance, then clean.
      if (p < 0.6) {
        const flip = Math.round(p * 20) % 2 === 0;
        return {
          textShadow: flip ? '-2px 0 #f0f,2px 0 #0ff' : '2px 0 #f0f,-2px 0 #0ff',
          transform: `translateX(${flip ? -2 : 2}px)`,
          opacity: 0.6 + p * 0.8,
        };
      }
      return {};
    case 'typeOn':
      return {
        clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
        opacity: 0.4 + p * 0.6,
      };
    case 'shake': {
      const d = 1 - p; // decays to zero as the word settles
      return {
        transform: `translate(${Math.sin(p * Math.PI * 6) * 2 * d}px, ${Math.cos(p * Math.PI * 6) * 1 * d}px) rotate(${Math.sin(p * Math.PI * 6) * 2 * d}deg)`,
      };
    }
    case 'riseMask':
      return {
        transform: `translateY(${(1 - p) * 0.5}em)`,
        clipPath: `inset(0 0 ${(1 - p) * 100}% 0)`,
      };
    case 'springPop':
      return { transform: `scale(${1 + Math.sin(p * Math.PI) * 0.32})`, opacity: Math.sqrt(p) };
    case 'neonFlicker':
      // Sign flicker: two brief dropouts inside the entrance, then solid.
      if (p < 0.6) {
        const band = Math.round(p * 40) % 10;
        return { opacity: band === 4 || band === 8 ? 0.25 : 1 };
      }
      return {};
    case 'glowPulse':
      return { opacity: 0.55 + p * 0.45, transform: `scale(${0.94 + Math.sin(p * Math.PI) * 0.14 + p * 0.06})` };
    case 'cascade':
      // Letters stagger via cascadeLetters(); as a whole-word fallback do a soft rise.
      return { transform: `translateY(${(1 - p) * 0.3}em)`, opacity: p };
    case 'none':
      return {};
    case 'pop':
    default:
      // Slight overshoot then settle, the classic caption "pop".
      return { transform: `scale(${1 + Math.sin(p * Math.PI) * 0.18})` };
  }
}

/** Ease-out cubic on the active word's entrance progress. */
/** Cinematic letterbox bar height as fraction of frame (0.08–0.14). */
export function letterboxInset(frame: number, pageStart: number, fps: number): number {
  const local = frame - pageStart;
  const inF = Math.max(2, Math.round(fps * 0.35));
  if (local < 0) return 0;
  if (local < inF) {
    const t = local / inF;
    // smoothstep
    const s = t * t * (3 - 2 * t);
    return 0.1 * s;
  }
  return 0.1;
}

/** If text is a plain integer/decimal, lerp 0→value by progress. */
export function tickUpDisplay(text: string, progress: number): string {
  const raw = text.replace(/[,\s]/g, '');
  if (!/^-?\d+(\.\d+)?%?$/.test(raw.replace('%', ''))) return text;
  const hasPct = text.includes('%');
  const n = parseFloat(raw.replace('%', ''));
  if (!Number.isFinite(n)) return text;
  const cur = n * Math.min(1, Math.max(0, progress));
  const decimals = raw.includes('.') ? (raw.split('.')[1] || '').replace('%', '').length : 0;
  const body = decimals > 0 ? cur.toFixed(decimals) : String(Math.round(cur));
  // preserve simple thousand commas for ints
  if (!decimals && Math.abs(n) >= 1000) {
    return body.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (hasPct ? '%' : '');
  }
  return body + (hasPct ? '%' : '');
}

export function entranceProgress(
  frame: number,
  wordFromFrame: number,
  fps: number,
): number {
  const enterFrames = Math.max(1, Math.round(fps * CAPTION_ENTER_SEC));
  const linear = Math.min(1, Math.max(0, (frame - wordFromFrame) / enterFrames));
  return 1 - Math.pow(1 - linear, 3);
}

/**
 * The karaoke progress fill for the active word: an idle-color base with the
 * ACTIVE color clipped over it left-to-right, keyed to the word's own timing.
 * The fill reaching 100% is exactly when the highlight moves on — this is the
 * Submagic/Hormozi sweep, and it can never lag the audio because it reads the
 * same fromFrame/toFrame the highlight does.
 */
function karaokeFillStyle(progress: number): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    clipPath: `inset(0 ${(1 - clamp01(progress)) * 100}% 0 0)`,
  };
}

/**
 * Letter-split the active word for a cascade. Letter `i` enters at
 * `fromFrame + i * staggerFrames` with the standard eased entrance, so the word
 * types itself in left to right. Letters are DERIVED from the word — never
 * stored — so a re-transcribe or retime can't orphan them.
 */
function CascadeWord({
  text,
  base,
  frame,
  fromFrame,
  staggerFrames,
  fps,
}: {
  text: string;
  base: React.CSSProperties;
  frame: number;
  fromFrame: number;
  staggerFrames: number;
  fps: number;
}) {
  const letters = Array.from(text);
  return (
    <>
      {letters.map((ch, i) => {
        const e = entranceProgress(frame, fromFrame + i * Math.max(1, staggerFrames), fps);
        return (
          <span key={i} style={{ ...base, display: 'inline-block', opacity: e }}>
            {ch}
          </span>
        );
      })}
    </>
  );
}

/**
 * A word mark's ambient + persistent fx, composed onto its style object.
 *
 * Same rule as everything in this file: frame math, never a CSS clock. The
 * ambient eases in over the word's first ~0.2s so it never pops; underline and
 * marker are NOT here — they render as real spans inside the word (a gradient
 * needs the glyph clip, a marker needs a layer behind the text), see the main
 * return below. The cascade branch owns its letters, so it skips these.
 */
function applyWordMarkExtras(
  style: React.CSSProperties,
  mark: CaptionWordMark | undefined,
  frame: number,
  fromFrame: number,
  fps: number,
  fallbackColor: string,
): void {
  if (!mark) return;
  const tSec = frame / fps;
  const ease = clamp01((frame - fromFrame) / Math.max(1, Math.round(fps * 0.2)));
  const amount = Math.max(0.2, Math.min(3, mark.fxAmount ?? 1));
  const density = Math.max(0.2, Math.min(3, mark.fxDensity ?? 1));
  // A per-word FONT — the family is in plan.fonts, so it is actually loaded.
  if (mark.font) {
    const serif = mark.font === 'Georgia' || mark.font === 'Playfair Display';
    const mono = mark.font === 'Courier Prime';
    style.fontFamily = `"${mark.font}", ${
      mono ? '"Courier New", monospace' : serif ? 'Georgia, serif' : 'Inter, system-ui, sans-serif'
    }`;
  }
  if (mark.ambient === 'float') {
    const bob = Math.sin(tSec * Math.PI * 1.2) * 0.1 * ease;
    style.transform = `${(style.transform as string) ?? ''} translateY(${bob.toFixed(3)}em)`.trim();
  } else if (mark.ambient === 'wiggle') {
    const sway = Math.sin(tSec * Math.PI * 2.2) * 2.4 * ease;
    style.transform = `${(style.transform as string) ?? ''} rotate(${sway.toFixed(2)}deg)`.trim();
  }
  const fxColor = mark.fxColor ?? fallbackColor;
  switch (mark.fx) {
    case 'glow': {
      const r = (7 + 9 * (0.5 + 0.5 * Math.sin(tSec * Math.PI * 2.4))) * amount;
      // Density stacks halo layers (a single 2px rim at density 1).
      const layers = Math.max(1, Math.round(density * 2));
      const shadows = [`0 0 ${r.toFixed(1)}px ${fxColor}`];
      for (let i = 1; i <= layers; i += 1) {
        shadows.push(`0 0 ${(r * (1 + i * 0.8)).toFixed(1)}px ${fxColor}${i === layers ? '55' : '88'}`);
      }
      shadows.push(`0 0 2px ${fxColor}`);
      style.textShadow = shadows.join(', ');
      break;
    }
    case 'gradient': {
      style.backgroundImage = `linear-gradient(92deg, ${fxColor}, ${mark.fxColor2 ?? '#ffffff'} 130%)`;
      style.backgroundClip = 'text';
      (style as Record<string, unknown>).WebkitBackgroundClip = 'text';
      (style as Record<string, unknown>).WebkitTextFillColor = 'transparent';
      style.color = 'transparent';
      style.display = 'inline-block';
      if (style.textShadow) {
        (style as Record<string, unknown>)['--caption-grad-shadow'] = style.textShadow;
        delete style.textShadow;
      } else {
        (style as Record<string, unknown>)['--caption-grad-shadow'] =
          '0 2px 8px rgba(0,0,0,0.55)';
      }
      delete style.filter;
      // Stroke outside a clipped fill reads as a hard black halo — drop it.
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }
    case 'shine': {
      // A light band sweeping across the glyphs, over the word's own color.
      const baseC = (style.color as string) || '#ffffff';
      // Density packs more sweeps into the same cycle (period shrinks).
      const span = 200 / density;
      const pos = ((tSec * 70) % span) - span / 4;
      const band = 14 * amount;
      const light = mark.fxColor2 ?? '#ffffff';
      style.backgroundImage = `linear-gradient(105deg, ${baseC} ${pos.toFixed(1)}%, ${light} ${(pos + band).toFixed(1)}%, ${baseC} ${(pos + band * 2).toFixed(1)}%)`;
      style.backgroundClip = 'text';
      (style as Record<string, unknown>).WebkitBackgroundClip = 'text';
      (style as Record<string, unknown>).WebkitTextFillColor = 'transparent';
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }
          if (!(style as Record<string, unknown>)['--caption-grad-shadow']) {
        (style as Record<string, unknown>)['--caption-grad-shadow'] =
          '0 2px 8px rgba(0,0,0,0.5)';
      }
      delete style.filter;
      delete style.textShadow;
case 'pulse': {
      const s = 1 + 0.1 * amount * (0.5 + 0.5 * Math.sin(tSec * Math.PI * 3 * density));
      style.transform = `${(style.transform as string) ?? ''} scale(${s.toFixed(3)})`.trim();
      break;
    }
    case 'tilt':
      style.transform = `${(style.transform as string) ?? ''} rotate(${(-8 * amount).toFixed(1)}deg)`.trim();
      break;
    case 'outline':
      (style as Record<string, unknown>).WebkitTextStroke = `${Math.max(1, amount).toFixed(1)}px ${fxColor}`;
      (style as Record<string, unknown>).paintOrder = 'stroke fill';
      break;
    case 'blink': {
      style.opacity = (0.55 + 0.45 * Math.sin(tSec * Math.PI * 3 * density)).toFixed(3);
      break;
    }
    case 'jelly': {
      const sx = 1 + 0.08 * amount * Math.sin(tSec * Math.PI * 2.6 * density);
      const sy = 1 - 0.08 * amount * Math.sin(tSec * Math.PI * 2.6 * density);
      style.transform = `${(style.transform as string) ?? ''} scale(${sx.toFixed(3)},${sy.toFixed(3)})`.trim();
      break;
    }
    default:
      break; // underline/marker/strike render as spans inside the word
  }
}

/** The grow-in progress for a word's underline/marker span (0→1 over ~0.28s). */
function wordSpanGrow(frame: number, fromFrame: number, fps: number): number {
  return clamp01((frame - fromFrame) / Math.max(1, Math.round(fps * 0.28)));
}

/**
 * The caption block for one frame.
 *
 * Geometry lives here and ONLY here: the stage-width divisor, the 86% block
 * width, the centred bottom anchor and the row gap all decide where text wraps
 * and sits, and all four have to be identical in preview and export or the block
 * lands somewhere else in the MP4.
 */

/**
 * Gradient glyphs: paint a solid shadow layer UNDER a clipped gradient fill.
 * Single-node background-clip:text + filter/text-shadow still silhouettes in
 * Chromium/Remotion — dual layer is the only reliable fix.
 */
function renderGradientWord(
  text: string,
  style: React.CSSProperties,
  emoji: string,
  tail: string,
): React.ReactNode {
  const shadow = String(
    (style as Record<string, unknown>)['--caption-grad-shadow'] ??
      style.textShadow ??
      '',
  );
  const hasGrad = !!(style as Record<string, unknown>)['backgroundImage'];
  if (!hasGrad || !shadow) {
    return (
      <>
        {text}
        {emoji ? <span className="emoji-burst">{emoji}</span> : null}
        {tail}
      </>
    );
  }
  // Dual layer: solid shadow under clipped gradient fill (Chromium-safe).
  const shell: React.CSSProperties = {
    display: 'inline-block',
    position: 'relative',
    transform: style.transform,
    opacity: style.opacity,
  };
  const under: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    color: '#000',
    textShadow: shadow,
    WebkitTextFillColor: '#000',
    pointerEvents: 'none',
    userSelect: 'none',
    font: 'inherit',
    letterSpacing: 'inherit',
    whiteSpace: 'pre-wrap',
  };
  const fill: React.CSSProperties = {
    ...style,
    position: 'relative',
    transform: undefined,
    opacity: undefined,
    filter: undefined,
    textShadow: undefined,
  };
  delete (fill as Record<string, unknown>)['--caption-grad-shadow'];
  return (
    <span style={shell}>
      <span aria-hidden style={under}>
        {text}
      </span>
      <span style={fill}>{text}</span>
      {emoji ? <span className="emoji-burst">{emoji}</span> : null}
      {tail}
    </span>
  );
}

/** When the active word belongs to a stack card, return that card's word window. */
function resolveCardWindow(
  words: readonly CaptionWord[],
  activeIdx: number,
): { from: number; to: number; mode: 'build' | 'page'; rows: number; wordsPerRow: number; anim?: string } | null {
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
    anim: m.anim,
  };
}

function cardRows(
  cardFrom: number,
  cardTo: number,
  activeIdx: number,
  wordsPerRow: number,
  rows: number,
): { from: number; to: number }[] {
  const perRow = Math.max(1, Math.round(wordsPerRow));
  const rowCount = Math.max(1, Math.round(rows));
  const local = Math.max(0, activeIdx - cardFrom);
  const pageSize = perRow * rowCount;
  const pageFrom = cardFrom + Math.floor(local / pageSize) * pageSize;
  const out: { from: number; to: number }[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const from = pageFrom + r * perRow;
    if (from >= cardTo) break;
    out.push({ from, to: Math.min(cardTo, from + perRow) });
  }
  return out.length ? out : [{ from: cardFrom, to: cardTo }];
}

export const CaptionLayerFrame: React.FC<{ plan: CaptionPlanLike; frame: number }> = ({
  plan,
  frame,
}) => {
  const { words, captionStyle: def, captionLayout: layout, powerWords } = plan;
  const freePlaceEdit = !!(plan as { freePlaceEdit?: boolean }).freePlaceEdit;
  if (!words.length) return null;
  // Master off + mute ranges (project clock).
  {
    const sec = frame / Math.max(1, plan.fps);
    const ov = (plan as { captionOverrides?: import('../captions').CaptionOverrides })
      .captionOverrides;
    if (!isCaptionVisibleAt(sec, ov ?? null)) return null;
  }

  const holdFrames = Math.round(plan.fps * CAPTION_HOLD_SEC);

  // Let the closing word settle, then clear — see activeWordIndex.
  const activeIdx = activeWordIndex(words, frame, holdFrames);
  if (activeIdx < 0) return null;

  const css = captionCssFor(def);
  const rows = captionRows(words.length, activeIdx, layout.wordsPerRow, layout.rows);
  const defAnim = (def as { anim?: string }).anim ?? 'pop';
  const stackMode =
    ((plan as { captionOverrides?: { stackMode?: string } }).captionOverrides
      ?.stackMode as string) ||
    'page';
  const isBuildStack = stackMode === 'build';
  const cardWin = resolveCardWindow(words, activeIdx);
  const activeWord = words[activeIdx];

  // sizePx is authored against the 360px editor stage, so scale it to the real
  // frame width. (The ASS path does the same with an explicit 1080/360.)
  const fontSize = (layout.sizePx / CAPTION_STAGE_W) * plan.width;

  // ---- BLOCK ambience, both frame-derived ----------------------------------
  const blockFx = def.blockFx ?? [];
  const blockStyle: React.CSSProperties = {};
  {
    // Float + wiggle compose: both can be on. Settings from def.motion.
    const mot = (def as CaptionStyleDef).motion;
    const tSec = frame / plan.fps;
    let ty = 0;
    let rot = 0;
    // Full-block float/wiggle. When motion.syncToWords, phase is locked to the
    // caption PAGE start (spoken window) so the bob/sway feels cued to speech —
    // still one solid block, never per-word.
    {
      const syncMotion = !!(def as CaptionStyleDef).motion?.syncToWords;
      const pageFromM = rows[0]?.from ?? 0;
      const pageStartM = words[pageFromM]?.fromFrame ?? activeWord.fromFrame;
      const tMotion = syncMotion
        ? Math.max(0, (frame - pageStartM) / plan.fps)
        : tSec;
      if (blockFx.includes('float')) {
        const period = mot?.floatPeriodSec ?? FLOAT_PERIOD_SEC;
        const amp = mot?.floatAmpEm ?? 0.12;
        ty += Math.sin(tMotion * ((2 * Math.PI) / period)) * amp;
      }
      if (blockFx.includes('wiggle')) {
        const wPer = mot?.wigglePeriodSec ?? 0.9;
        const deg = mot?.wiggleDeg ?? 1.4;
        rot += Math.sin(tMotion * ((2 * Math.PI) / wPer)) * deg;
        ty += Math.sin(tMotion * ((2 * Math.PI) / (wPer * 2))) * 0.06;
      }
    }
    const parts = ['translateX(-50%)'];
    if (rot !== 0) parts.push(`rotate(${rot.toFixed(2)}deg)`);
    if (ty !== 0) parts.push(`translateY(${ty.toFixed(3)}em)`);
    if (parts.length > 1) blockStyle.transform = parts.join(' ');
    // Camera punch-in: brief scale overshoot when the page starts speaking.
    
    // Waveform bounce: bob amplitude from optional plan.audioPeaks, else gentle sine.
    if (blockFx.includes('waveBounce')) {
      const peaks = (plan as { audioPeaks?: number[] }).audioPeaks;
      let amp = 0.06;
      if (peaks && peaks.length > 0) {
        const tSec = frame / Math.max(1, plan.fps);
        // peaks cover full composition duration roughly
        const durFrames = (plan as unknown as { durationFrames?: number }).durationFrames;
        const totalSec = Math.max(1, typeof durFrames === 'number' && durFrames > 0
          ? durFrames / plan.fps
          : peaks.length / 30);
        const u = Math.min(0.999, Math.max(0, tSec / totalSec));
        const pi = Math.floor(u * peaks.length);
        amp = 0.04 + (peaks[pi] ?? 0) * 0.14;
      } else {
        amp = 0.05 + 0.03 * Math.abs(Math.sin(frame * 0.21));
      }
      const y = Math.sin(frame * 0.35) * amp;
      const prev = (blockStyle.transform as string) || 'translateX(-50%)';
      blockStyle.transform = `${prev} translateY(${y.toFixed(3)}em)`.trim();
    }
if (blockFx.includes('punchIn')) {
      const pageFromP = rows[0]?.from ?? 0;
      const pageStartP = words[pageFromP]?.fromFrame ?? activeWord.fromFrame;
      const local = frame - pageStartP;
      const punchFrames = Math.max(3, Math.round(plan.fps * 0.22));
      if (local >= 0 && local < punchFrames) {
        const t = local / punchFrames;
        // 1.0 → 1.08 → 1.0
        const sc = t < 0.45 ? 1 + t * (0.08 / 0.45) : 1.08 - ((t - 0.45) / 0.55) * 0.08;
        const prev = (blockStyle.transform as string) || 'translateX(-50%)';
        blockStyle.transform = `${prev} scale(${sc.toFixed(3)})`.trim();
      }
    }
    // Spring exit: overshoot scale down as page ends (pairs with ghost or alone).
    if (blockFx.includes('springExit')) {
      const pageFromE = rows[0]?.from ?? 0;
      const pageSizeE = Math.max(1, layout.wordsPerRow * layout.rows);
      const nextStart = words[pageFromE + pageSizeE]?.fromFrame;
      const pageEndE = nextStart ?? words[words.length - 1].toFrame + holdFrames;
      const outFrames = Math.max(3, Math.round(plan.fps * 0.28));
      const remain = pageEndE - frame;
      if (remain >= 0 && remain < outFrames) {
        const t = 1 - remain / outFrames; // 0 at start of exit → 1 at end
        const sc = 1 + Math.sin(t * Math.PI) * 0.12 * (1 - t) - t * 0.15;
        const prev = (blockStyle.transform as string) || 'translateX(-50%)';
        blockStyle.transform = `${prev} scale(${Math.max(0.7, sc).toFixed(3)})`.trim();
        const op = typeof blockStyle.opacity === 'number' ? blockStyle.opacity : 1;
        blockStyle.opacity = op * (1 - t * 0.85);
      }
    }

  }
  if (blockFx.includes('ghostFade')) {
    // FULL BLOCK ghost: entire caption page fades completely ON → HOLD → completely OFF.
    // Timing is glued to the spoken word window for this page (not per-word karaoke).
    const pageFrom = rows[0]?.from ?? 0;
    const pageSize = Math.max(1, layout.wordsPerRow * layout.rows);
    const pageStartFrame = words[pageFrom]?.fromFrame ?? activeWord.fromFrame;
    const nextPageStart = words[pageFrom + pageSize]?.fromFrame;
    const pageEndFrame = nextPageStart ?? words[words.length - 1].toFrame + holdFrames;
    const pageDur = Math.max(1, pageEndFrame - pageStartFrame);
    const ghost = (def as CaptionStyleDef).ghost;
    // Generous defaults so the eye reads a real full-on / full-off (not a blink).
    let inF = Math.max(
      3,
      Math.round(plan.fps * (ghost?.fadeInSec ?? Math.max(GHOST_FADE_IN_SEC, 0.28))),
    );
    let outF = Math.max(
      3,
      Math.round(plan.fps * (ghost?.fadeOutSec ?? Math.max(GHOST_FADE_OUT_SEC, 0.32))),
    );
    // Keep a real hold beat so opacity actually sits at 1.
    const minHold = Math.max(2, Math.round(plan.fps * 0.12));
    if (inF + outF + minHold > pageDur) {
      const budget = Math.max(4, pageDur - minHold);
      const total = inF + outF;
      inF = Math.max(3, Math.round((budget * inF) / total));
      outF = Math.max(3, budget - inF);
    }
    const ease = (ghost?.ease ?? 'smooth') as 'linear' | 'smooth';
    const driftEm = ghost?.driftEm ?? (ease === 'smooth' ? 0.12 : 0);
    // Always full-block envelope (unitIndex 0, no stagger).
    const opacity = ghostUnitOpacity(
      frame,
      pageStartFrame,
      pageEndFrame,
      0,
      inF,
      outF,
      0,
      ease,
    );
    blockStyle.opacity = opacity;
    if (driftEm > 0) {
      const df = ghostDriftFactor(
        frame,
        pageStartFrame,
        pageEndFrame,
        0,
        inF,
        outF,
        0,
      );
      const dy = (df * driftEm).toFixed(3);
      const prev = (blockStyle.transform as string) || 'translateX(-50%)';
      blockStyle.transform = `${prev} translateY(${dy}em)`.trim();
    }
    // Stash page bounds for motion phase-lock (float/wiggle sync to speech page).
    (blockStyle as Record<string, unknown>).__ghost = {
      pageStartFrame,
      pageEndFrame,
      inF,
      outF,
      staggerMode: 'block' as const,
      staggerFrames: 0,
      pageFrom,
      ease,
      driftEm,
      syncToWords: false,
    };
    (blockStyle as Record<string, unknown>).__pageStartFrame = pageStartFrame;
  }

  
  // Free-place stack card: every word with xPct/yPct is painted at absolute
  // frame coords instead of flowing inside the caption box. This is the
  // MILLIONAIRES composition mode — drag on the stage writes mark.xPct/yPct.
  const freePlaceCard =
    !!cardWin &&
    words
      .slice(cardWin.from, cardWin.to)
      .some(
        (w) =>
          w.mark &&
          typeof w.mark.xPct === 'number' &&
          typeof w.mark.yPct === 'number',
      );
  if (freePlaceCard && cardWin) {
    const visible = words
      .slice(cardWin.from, cardWin.to)
      .map((w, i) => ({ w, idx: cardWin.from + i }))
      .filter(({ w, idx }) => {
        if (w.mark?.hidden) return false;
        // Edit mode: every free-placed word in the card is visible so you can
        // drag/scale the full composition without scrubbing to each word.
        if (freePlaceEdit) return true;
        if (isBuildStack && frame < w.fromFrame) return false;
        if (!isBuildStack) return true;
        return frame >= w.fromFrame || idx <= activeIdx;
      });
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          fontSize,
        }}
      >
        {visible.map(({ w, idx }) => {
          const isActive = idx === activeIdx;
          const power = isPowerWord(w.text, powerWords as string[]);
          const mark = w.mark;
          const x = typeof mark?.xPct === 'number' ? mark.xPct : layout.xPct;
          const y =
            typeof mark?.yPct === 'number' ? mark.yPct : layout.positionPct;
          const base: React.CSSProperties = {
            ...(isActive || power ? css.active : css.word),
            position: 'absolute',
            left: `${x}%`,
            bottom: `${y}%`,
            transform: 'translate(-50%, 50%)',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          };
          if (mark?.color) {
            base.color = mark.color;
            delete (base as Record<string, unknown>)['backgroundImage'];
            delete (base as Record<string, unknown>)['WebkitBackgroundClip'];
            delete (base as Record<string, unknown>)['backgroundClip'];
            (base as Record<string, unknown>)['WebkitTextFillColor'] = undefined;
          }
          if (mark?.scale && mark.scale !== 1) {
            const sc = mark.scale;
            base.transform = `translate(-50%, 50%) scale(${sc})`;
            base.transformOrigin = 'center center';
          }
          // Reuse the same word renderer path by cloning the normal branch
          // via a minimal span — entrance anims still apply through wordMotion
          // when present on the normal path; free-place keeps paint simple +
          // correct so drag placement always matches the MP4.
          const text = w.text;
          return (
            <span key={idx} style={base}>
              {text}
            </span>
          );
        })}
      </div>
    );
  }

return (
    <div
      style={{
        position: 'absolute',
        left: `${layout.xPct}%`,
        bottom: `${layout.positionPct}%`,
        transform: 'translateX(-50%)',
        width: '86%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.15em',
        fontSize,
        // Captions sit at z 10: a media cue with style.z 'above' (20) paints
        // OVER the text, the house default (no z) stays UNDER it. A layer,
        // not a position. Intermediates carry no z, so the comparison is global.
        zIndex: 10,
        ...blockStyle,
      }}
    >
      {rows.map((row, rowIdx) => (
        <p key={`${row.from}-${rowIdx}`} style={{ ...css.line, fontSize: 'inherit' }}>
          {words.slice(row.from, row.to).map((w, i) => {
            const idx = row.from + i;
            const isActive = idx === activeIdx;
            const power = isPowerWord(w.text, powerWords as string[]);
            const mark = w.mark;
            if (mark?.hidden) {
              return null;
            }

            // Base style: active look for the spoken/power word, idle look
            // otherwise. A marked word carries its color even when idle.
            const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
            };
            const stackBuildHide = isBuildStack && frame < w.fromFrame;
            if (stackBuildHide) {
              base.opacity = 0;
            }
            
            if (mark?.color) {
              base.color = mark.color;
              // A marked color replaces any gradient fill (gradient wins color
              // by design; the mark is more specific than the preset).
              delete (base as Record<string, unknown>)['backgroundImage'];
              delete (base as Record<string, unknown>)['WebkitTextFillColor'];
              delete (base as Record<string, unknown>)['backgroundClip'];
              delete (base as Record<string, unknown>)['WebkitBackgroundClip'];
            } else if (
              def.gradientShift &&
              (base as Record<string, unknown>)['backgroundImage']
            ) {
              // Living gradient: slow frame-driven drift (no CSS animation clock).
              const tSec = frame / plan.fps;
              const x = ((tSec * 22) % 100).toFixed(1);
              const y = ((tSec * 13) % 100).toFixed(1);
              (base as Record<string, unknown>)['backgroundPosition'] = `${x}% ${y}%`;
              if (!(base as Record<string, unknown>)['backgroundSize']) {
                (base as Record<string, unknown>)['backgroundSize'] = '200% 200%';
              }
            }

            // Ghost stagger: word-level fade (letter handled below when rendering).
            const text = def.upper ? w.text.toUpperCase() : w.text;

            const wordAnim = mark?.anim ?? defAnim;
            const wordEnterT = isActive
              ? entranceProgress(frame, w.fromFrame, plan.fps)
              : 1;

            // Compose the transform: entrance anim + optional mark scale.
            const style: React.CSSProperties = { ...base };
            if (isBuildStack && isActive && !style.transform) {
              style.transform = 'scale(1.35)';
              style.transformOrigin = 'center center';
              style.zIndex = 2;
            }
            const isCascade =
              isActive && (wordAnim === 'cascade' || (mark?.stagger ?? 0) > 0);
            const useFill = isActive && def.karaokeFill && !isCascade;
            if (isActive && !useFill && !isCascade && wordAnim) {
              const entrance = entranceStyle(wordAnim, wordEnterT);
              Object.assign(style, entrance);
              if (mark?.scale) {
                style.transform = `${(style.transform as string) ?? ''} scale(${mark.scale})`.trim();
              }
            } else if (!isActive && mark?.scale) {
              style.transform = `${(style.transform as string) ?? ''} scale(${mark.scale})`.trim();
            }
            // Ambient + persistent fx ride on top of the entrance, any state.
            applyWordMarkExtras(style, mark, frame, w.fromFrame, plan.fps, css.active.color as string);

            const emoji =
              (isActive || power) && def.emoji && emojiFor(w.text)
                ? ` ${emojiFor(w.text)}`
                : '';
            const tail = i < row.to - row.from - 1 ? ' ' : '';

            if (isCascade) {
              const staggerSec =
                (mark?.stagger ?? 0) > 0 ? (mark?.stagger as number) : CASCADE_STAGGER_SEC;
              return (
                <span key={`${idx}-${w.text}`} style={base}>
                  <CascadeWord
                    text={text}
                    base={{}}
                    frame={frame}
                    fromFrame={w.fromFrame}
                    staggerFrames={Math.round(plan.fps * staggerSec)}
                    fps={plan.fps}
                  />
                  {emoji ? (
                  <span
                    className="emoji-burst"
                    style={{
                      display: 'inline-block',
                      transform: isActive && power
                        ? `scale(${(1 + Math.sin(Math.min(1, Math.max(0, (frame - w.fromFrame) / Math.max(1, plan.fps * 0.25))) * Math.PI) * 0.45).toFixed(3)})`
                        : undefined,
                    }}
                  >
                    {emoji}
                  </span>
                ) : null}
                  {tail}
                </span>
              );
            }

            if (useFill) {
              // The progress fill: idle base + active fill clipped by the word's
              // own progress. The overlay carries the active color (or the mark's).
              const progress = clamp01(
                (frame - w.fromFrame) / Math.max(1, w.toFrame - w.fromFrame),
              );
              applyWordMarkExtras(base, mark, frame, w.fromFrame, plan.fps, css.active.color as string);
              return (
                <span key={`${idx}-${w.text}`} style={base}>
                  <span style={{ color: css.word.color as string }}>{text}</span>
                  <span
                    style={{
                      ...karaokeFillStyle(progress),
                      color: mark?.color ?? (css.active.color as string),
                    }}
                  >
                    {text}
                  </span>
                  {emoji ? (
                  <span
                    className="emoji-burst"
                    style={{
                      display: 'inline-block',
                      transform: isActive && power
                        ? `scale(${(1 + Math.sin(Math.min(1, Math.max(0, (frame - w.fromFrame) / Math.max(1, plan.fps * 0.25))) * Math.PI) * 0.45).toFixed(3)})`
                        : undefined,
                    }}
                  >
                    {emoji}
                  </span>
                ) : null}
                  {tail}
                </span>
              );
            }

            // Dual-layer gradient/shine (no silhouette).
            // Chromium/Remotion often paints background-clip:text as a solid
            // silhouette when filter/text-shadow sit on the same node. Split:
            // shadow layer (solid color + text-shadow) under a clipped fill.
            {
              const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];
              if (isGradFill) {
                return (
                  <span key={`${idx}-${w.text}`} style={{ display: 'inline-block', position: 'relative' }}>
                    {renderGradientWord(text, style, emoji, tail)}
                  </span>
                );
              }
            }

            return (
              <span key={`${idx}-${w.text}`} style={style}>
                {def.highlightMode === 'boxGrow' && isActive ? (
                  <span
                    aria-hidden
                    className="boxGrowBg"
                    style={{
                      position: 'absolute',
                      inset: '-0.08em -0.18em',
                      background: def.activeBg ?? 'rgba(255,255,255,0.2)',
                      borderRadius: '0.2em',
                      zIndex: -1,
                      transformOrigin: 'center center',
                      transform: `scaleX(${wordSpanGrow(frame, w.fromFrame, plan.fps).toFixed(3)})`,
                    }}
                  />
                ) : null}
                {mark?.fx === 'marker' ? (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: '-0.04em -0.14em',
                      background: mark.fxColor ?? (css.active.color as string),
                      opacity: Math.min(0.85, 0.34 * Math.max(0.2, Math.min(3, mark.fxAmount ?? 1))),
                      zIndex: -1,
                      borderRadius: '0.14em',
                      transformOrigin: 'left center',
                      transform: `scaleX(${wordSpanGrow(frame, w.fromFrame, plan.fps).toFixed(3)})`,
                    }}
                  />
                ) : null}
                {text}
                {emoji ? (
                  <span
                    className="emoji-burst"
                    style={{
                      display: 'inline-block',
                      transform: isActive && power
                        ? `scale(${(1 + Math.sin(Math.min(1, Math.max(0, (frame - w.fromFrame) / Math.max(1, plan.fps * 0.25))) * Math.PI) * 0.45).toFixed(3)})`
                        : undefined,
                    }}
                  >
                    {emoji}
                  </span>
                ) : null}
                {tail}
                {mark?.fx === 'underline' ? (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: '-0.04em',
                      right: '-0.04em',
                      bottom: '-0.10em',
                      height: `${(0.09 * Math.max(0.2, Math.min(3, mark.fxAmount ?? 1))).toFixed(2)}em`,
                      borderRadius: '0.06em',
                      background: mark.fxColor ?? (css.active.color as string),
                      boxShadow: `0 0 0.12em ${mark.fxColor ?? (css.active.color as string)}`,
                      transformOrigin: 'left center',
                      transform: `scaleX(${wordSpanGrow(frame, w.fromFrame, plan.fps).toFixed(3)})`,
                    }}
                  />
                ) : null}
                {mark?.fx === 'strike' ? (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: '-0.04em',
                      right: '-0.04em',
                      top: '52%',
                      height: `${(0.09 * Math.max(0.2, Math.min(3, mark.fxAmount ?? 1))).toFixed(2)}em`,
                      borderRadius: '0.06em',
                      background: mark.fxColor ?? (css.active.color as string),
                      transformOrigin: 'left center',
                      transform: `scaleX(${wordSpanGrow(frame, w.fromFrame, plan.fps).toFixed(3)})`,
                    }}
                  />
                ) : null}
                {emoji ? (
                  <span
                    className="emoji-burst"
                    style={{
                      display: 'inline-block',
                      transform: isActive && power
                        ? `scale(${(1 + Math.sin(Math.min(1, Math.max(0, (frame - w.fromFrame) / Math.max(1, plan.fps * 0.25))) * Math.PI) * 0.45).toFixed(3)})`
                        : undefined,
                    }}
                  >
                    {emoji}
                  </span>
                ) : null}
                {tail}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
};
