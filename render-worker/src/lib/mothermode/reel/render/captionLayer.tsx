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

/** One caption word, timed in TIMELINE frames. */
export interface CaptionWord {
  text: string;
  fromFrame: number;
  toFrame: number;
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

/**
 * The active word's entrance as plain style values for a given progress `e`
 * (0 = just spoken, 1 = settled).
 *
 * Deliberately NOT a CSS `animation`: renderMedia screenshots one discrete frame
 * at a time and the CSS animation clock does not advance between screenshots, so
 * a keyframe animation renders frozen at its first frame for the whole video.
 * That is why burned captions had no motion while the preview looked fine.
 */
export function entranceStyle(anim: string, e: number): React.CSSProperties {
  switch (anim) {
    case 'fade':
      return { opacity: e };
    case 'slide':
      return { transform: `translateY(${(1 - e) * 0.35}em)`, opacity: e };
    case 'flip':
      return { transform: `perspective(600px) rotateX(${(1 - e) * -90}deg)`, opacity: e };
    case 'spin':
      return { transform: `rotate(${(1 - e) * -25}deg) scale(${0.7 + e * 0.3})`, opacity: e };
    case 'none':
      return {};
    case 'pop':
    default:
      // Slight overshoot then settle, the classic caption "pop".
      return { transform: `scale(${1 + Math.sin(e * Math.PI) * 0.18})` };
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

  // Let the closing word settle, then clear — see activeWordIndex.
  const activeIdx = activeWordIndex(
    words,
    frame,
    Math.round(plan.fps * CAPTION_HOLD_SEC),
  );
  if (activeIdx < 0) return null;

  const css = captionCssFor(def);
  const rows = captionRows(words.length, activeIdx, layout.wordsPerRow, layout.rows);
  const anim = (def as { anim?: string }).anim ?? 'pop';
  const enterT = entranceProgress(frame, words[activeIdx].fromFrame, plan.fps);

  // sizePx is authored against the 360px editor stage, so scale it to the real
  // frame width. (The ASS path does the same with an explicit 1080/360.)
  const fontSize = (layout.sizePx / CAPTION_STAGE_W) * plan.width;

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
      }}
    >
      {rows.map((row, rowIdx) => (
        <p key={`${row.from}-${rowIdx}`} style={{ ...css.line, fontSize: 'inherit' }}>
          {words.slice(row.from, row.to).map((w, i) => {
            const idx = row.from + i;
            const isActive = idx === activeIdx;
            const power = isPowerWord(w.text, powerWords as string[]);
            const base = isActive || power ? css.active : css.word;
            const style: React.CSSProperties = {
              ...base,
              display: 'inline-block',
              ...(isActive ? entranceStyle(anim, enterT) : {}),
            };
            return (
              <span key={`${idx}-${w.text}`} style={style}>
                {def.upper ? w.text.toUpperCase() : w.text}
                {isActive && def.emoji && emojiFor(w.text) ? ` ${emojiFor(w.text)}` : ''}
                {i < row.to - row.from - 1 ? ' ' : ''}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
};
