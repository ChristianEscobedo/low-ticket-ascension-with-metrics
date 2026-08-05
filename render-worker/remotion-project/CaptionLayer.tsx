/**
 * The caption layer — the SAME structured style defs the editor previews with,
 * rendered inside Remotion so the burn is identical to the stage.
 *
 * This is the heart of the fix. ASS/ffmpeg could only ever draw "text in a
 * colour"; every modern caption look we ship (per-word scale pops, blur-in,
 * elastic squash, glitch, box-grow highlights, gradient fills, power words) is
 * CSS. Remotion renders real CSS in a real browser, one frame at a time, so we
 * burn the exact look with zero re-implementation.
 */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import {
  captionCssFor,
  captionRows,
  emojiFor,
  isPowerWord,
} from '../src/lib/mothermode/reel/captions';
import type { RenderPlan } from './constants';


/** The index of the word being spoken on this frame, or -1 between words. */
export function activeWordIndex(words: RenderPlan['words'], frame: number): number {
  for (let i = 0; i < words.length; i += 1) {
    if (frame >= words[i].fromFrame && frame < words[i].toFrame) return i;
  }
  // Between words: hold the last word that has started so the line never blinks.
  let last = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].fromFrame <= frame) last = i;
    else break;
  }
  return last;
}

/**
 * The active word's entrance, expressed as plain style values for a given
 * progress `e` (0 = just spoken, 1 = settled).
 *
 * This deliberately does NOT use a CSS `animation`. renderMedia screenshots one
 * discrete frame at a time and the CSS animation clock does not advance between
 * those screenshots, so a keyframe animation renders frozen at its first frame
 * for the whole video — which is exactly why the burned captions had no motion
 * while the editor preview (a real, playing browser) looked fine.
 */
function entranceStyle(anim: string, e: number): React.CSSProperties {
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

/**
 * constants.ts types the plan's caption fields loosely (Record<string, unknown>
 * / unknown) because it mirrors JSON off the wire. Recover the real shapes here
 * from the functions that consume them, so this file type-checks honestly
 * instead of every access being `unknown`.
 */
type CaptionDef = Parameters<typeof captionCssFor>[0];
type CaptionLayoutShape = {
  xPct: number;
  positionPct: number;
  sizePx: number;
  wordsPerRow: number;
  rows: number;
};

export const CaptionLayer: React.FC<{ plan: RenderPlan }> = ({ plan }) => {
  const frame = useCurrentFrame();
  const { words, powerWords } = plan;
  const def = plan.captionStyle as unknown as CaptionDef;
  const layout = plan.captionLayout as unknown as CaptionLayoutShape;
  if (!words.length) return null;

  const activeIdx = activeWordIndex(words, frame);
  if (activeIdx < 0) return null;

  const css = captionCssFor(def);
  const rows = captionRows(words.length, activeIdx, layout.wordsPerRow, layout.rows);
  const anim = (def as { anim?: string }).anim ?? 'pop';

  // How far into the active word's entrance we are, in frames. Driving this off
  // useCurrentFrame() is what makes the motion actually appear in the render.
  const ENTER_SEC = 0.18;
  const enterFrames = Math.max(1, Math.round(plan.fps * ENTER_SEC));
  const since = frame - words[activeIdx].fromFrame;
  const linear = Math.min(1, Math.max(0, since / enterFrames));
  const enterT = 1 - Math.pow(1 - linear, 3); // ease-out cubic

  // sizePx is authored against the 360px-wide editor stage, so scale it to the
  // real frame width. (The ASS path does the same with an explicit 1080/360.)
  // This was dividing by 390, which rendered every caption ~8% too small.
  const STAGE_W = 360;
  const fontSize = (layout.sizePx / STAGE_W) * plan.width;

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
            const power = isPowerWord(w.text, powerWords);
            const base = isActive || power ? css.active : css.word;
            // Re-key the animation on every new word so the entrance replays.
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
