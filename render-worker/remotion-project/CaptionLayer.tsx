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
  captionAnimCss,
  captionAnimKeyframes,
  captionCssFor,
  captionRows,
  emojiFor,
  isPowerWord,
} from '../src/lib/mothermode/reel/captions';
import type { RenderPlan } from '../src/lib/mothermode/reel/render/plan';

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

export const CaptionLayer: React.FC<{ plan: RenderPlan }> = ({ plan }) => {
  const frame = useCurrentFrame();
  const { words, captionStyle: def, captionLayout: layout, powerWords } = plan;
  if (!words.length) return null;

  const activeIdx = activeWordIndex(words, frame);
  if (activeIdx < 0) return null;

  const css = captionCssFor(def);
  const rows = captionRows(words.length, activeIdx, layout.wordsPerRow, layout.rows);
  const anim = def.anim ?? 'pop';
  const keyframes = captionAnimKeyframes(anim);

  // Font size is authored against the 1080-wide preview canvas, so scale it to
  // the real frame — otherwise captions render tiny in a 1080×1920 export.
  const fontSize = (layout.sizePx / 390) * plan.width;

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
      {keyframes ? <style>{keyframes}</style> : null}
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
              ...(isActive && anim ? { animation: captionAnimCss(anim) } : {}),
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
