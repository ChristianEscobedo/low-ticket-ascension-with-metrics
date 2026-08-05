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

/** Ghost-fade duration for a page of rows (in and out). */
export const GHOST_FADE_SEC = 0.15;

/** One float bob period, seconds. */
export const FLOAT_PERIOD_SEC = 1.8;

/** Default per-letter delay for the cascade anim, seconds. */
export const CASCADE_STAGGER_SEC = 0.035;

/**
 * A per-word style mark (the "this word does its own thing" slot).
 *
 * Structural on purpose: it mirrors `ReelWord.mark` from the app's types.ts,
 * which this file must not import (the worker doesn't vendor types.ts). Keep
 * the two shapes in sync — `shiftWords` in plan.ts copies the mark across
 * verbatim, and `normalizeReelWords` in types.ts is what validates it.
 */
export interface CaptionWordMark {
  /** Entrance anim for THIS word instead of the preset's. */
  anim?: string;
  /** Color override — the word carries it even when idle. */
  color?: string;
  /** Extra scale multiplier for THIS word (the "shout" beat). */
  scale?: number;
  /** Per-letter cascade delay in seconds for THIS word. */
  stagger?: number;
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
 * The caption block for one frame.
 *
 * Geometry lives here and ONLY here: the stage-width divisor, the 86% block
 * width, the centred bottom anchor and the row gap all decide where text wraps
 * and sits, and all four have to be identical in preview and export or the block
 * lands somewhere else in the MP4.
 */
export const CaptionLayerFrame: React.FC<{ plan: CaptionPlanLike; frame: number }> = ({
  plan,
  frame,
}) => {
  const { words, captionStyle: def, captionLayout: layout, powerWords } = plan;
  if (!words.length) return null;

  const holdFrames = Math.round(plan.fps * CAPTION_HOLD_SEC);

  // Let the closing word settle, then clear — see activeWordIndex.
  const activeIdx = activeWordIndex(words, frame, holdFrames);
  if (activeIdx < 0) return null;

  const css = captionCssFor(def);
  const rows = captionRows(words.length, activeIdx, layout.wordsPerRow, layout.rows);
  const defAnim = (def as { anim?: string }).anim ?? 'pop';
  const activeWord = words[activeIdx];

  // sizePx is authored against the 360px editor stage, so scale it to the real
  // frame width. (The ASS path does the same with an explicit 1080/360.)
  const fontSize = (layout.sizePx / CAPTION_STAGE_W) * plan.width;

  // ---- BLOCK ambience, both frame-derived ----------------------------------
  const blockFx = def.blockFx ?? [];
  const blockStyle: React.CSSProperties = {};
  if (blockFx.includes('float')) {
    // A gentle bob — the period is the frame clock, so it loops identically in
    // the MP4. It composes with the centred anchor via transform chaining.
    const bob = Math.sin((frame / plan.fps) * ((2 * Math.PI) / FLOAT_PERIOD_SEC)) * 0.12;
    blockStyle.transform = `translateX(-50%) translateY(${bob.toFixed(3)}em)`;
  }
  if (blockFx.includes('ghostFade')) {
    // Each PAGE of rows fades in on arrival and out before the flip. The page
    // boundaries come from the same word window captionRows uses, so the fade
    // is glued to the words — nothing keyed on a row index to drift.
    const pageFrom = rows[0]?.from ?? 0;
    const pageSize = Math.max(1, layout.wordsPerRow * layout.rows);
    const pageStartFrame = words[pageFrom]?.fromFrame ?? activeWord.fromFrame;
    const nextPageStart = words[pageFrom + pageSize]?.fromFrame;
    const pageEndFrame = nextPageStart ?? words[words.length - 1].toFrame + holdFrames;
    const fadeFrames = Math.max(2, Math.round(plan.fps * GHOST_FADE_SEC));
    const fadeIn = clamp01((frame - pageStartFrame) / fadeFrames);
    const fadeOut = clamp01((pageEndFrame - frame) / fadeFrames);
    blockStyle.opacity = Math.min(fadeIn, fadeOut);
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

            // Base style: active look for the spoken/power word, idle look
            // otherwise. A marked word carries its color even when idle.
            const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
            };
            if (mark?.color) {
              base.color = mark.color;
              // A marked color replaces any gradient fill (gradient wins color
              // by design; the mark is more specific than the preset).
              delete (base as Record<string, unknown>)['backgroundImage'];
              delete (base as Record<string, unknown>)['WebkitTextFillColor'];
            }

            const text = def.upper ? w.text.toUpperCase() : w.text;
            const wordAnim = mark?.anim ?? defAnim;
            const wordEnterT = isActive
              ? entranceProgress(frame, w.fromFrame, plan.fps)
              : 1;

            // Compose the transform: entrance anim + optional mark scale.
            const style: React.CSSProperties = { ...base };
            const isCascade =
              isActive && (wordAnim === 'cascade' || (mark?.stagger ?? 0) > 0);
            const useFill = isActive && def.karaokeFill && !isCascade;
            if (isActive && !useFill && !isCascade) {
              const entrance = entranceStyle(wordAnim, wordEnterT);
              Object.assign(style, entrance);
              if (mark?.scale) {
                style.transform = `${(style.transform as string) ?? ''} scale(${mark.scale})`.trim();
              }
            } else if (!isActive && mark?.scale) {
              style.transform = `${(style.transform as string) ?? ''} scale(${mark.scale})`.trim();
            }

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
                  {emoji}
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
                  {emoji}
                  {tail}
                </span>
              );
            }

            return (
              <span key={`${idx}-${w.text}`} style={style}>
                {text}
                {emoji}
                {tail}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
};
