'use client';

/**
 * CueDragLayer — the transform surface for a media cue's placement + size.
 * The cue counterpart of CaptionDragLayer, with the same contract:
 *
 *   - an overlay box riding ABOVE the preview (the cue image itself is painted
 *     inside the Player's DOM, which we do not own and must not reach into);
 *   - coordinates are percentages of the FRAME, the SAME numbers MediaCueLayer
 *     reads (left = xPct, top = yPct, width = widthPct — top-anchored, unlike
 *     the bottom-anchored caption block), so the preview moves the number the
 *     MP4 will use;
 *   - pointermove writes LOCAL state only (no network per frame); pointerup
 *     commits once. Arrow keys nudge and commit per press.
 *
 * Differences from the caption puck, all derived from the cue's own model:
 *   - the box is the cue's actual box (top-left anchored, no translateX), so
 *     what you drag is what renders;
 *   - the EAST handles drive `widthPct` (the style field the size slider
 *     writes) — west/north would have to move the anchor too, so they don't
 *     exist here;
 *   - the box's height comes from the image's real aspect (read off the file
 *     once it loads), falling back to a square until then — the model stores
 *     width only, so the box has to measure to wrap the card honestly.
 *
 * It mounts only while a cue's style editor is open (the parent's gate), and
 * it shows even when the playhead is outside the cue's window — it is an
 * editing affordance for where the fly-in will land, not a playback element.
 */
import React, { useEffect, useRef, useState } from 'react';

/** Keep the box on-frame; X is clamped against the live width at drag time. */
const Y_MIN = 0;
const Y_MAX = 90;
const W_MIN = 15;
const W_MAX = 80;

/** Pixels of handle drag per 1% of frame width (matches the size slider's range). */
const RESIZE_DAMPING = 2;

/** Nudge step for arrow keys (percent of frame) — Shift takes bigger bites. */
const NUDGE_PCT = 1;
const NUDGE_PCT_COARSE = 5;

const clamp = (n: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, n)));

export default function CueDragLayer({
  xPct,
  yPct,
  widthPct,
  src,
  word,
  onMove,
  onCommit,
  onResize,
  onResizeCommit,
  onSelect,
}: {
  /** Box top-left, % of frame — the same defaults MediaCueLayer falls back to. */
  xPct: number;
  yPct: number;
  /** Box width, % of frame width. */
  widthPct: number;
  /** The cue's image — used to size the box to the real aspect. */
  src: string;
  /** The trigger word, shown in the box so you know which beat you're placing. */
  word: string;
  /** Fires every pointermove — LOCAL state only (no network per frame). */
  onMove: (xPct: number, yPct: number) => void;
  /** Fires once on pointerup — this is the one that persists. */
  onCommit: (xPct: number, yPct: number) => void;
  /** Live width during a handle drag (local state only, same contract). */
  onResize: (widthPct: number) => void;
  /** Final width on pointerup — the one that persists. */
  onResizeCommit: (widthPct: number) => void;
  /** Fires on grab — selects this cue so the style editor follows the click. */
  onSelect?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef({ x: xPct, y: yPct });
  const lastWRef = useRef(widthPct);
  const [active, setActive] = useState<null | 'move' | 'e' | 'se'>(null);
  const [frameW, setFrameW] = useState(0);
  /** natural height / natural width, once the image has loaded. */
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth));
    ro.observe(el);
    setFrameW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Box height follows the image: widthPct of the frame × the real aspect.
  const boxH = frameW > 0 ? Math.max(24, (widthPct / 100) * frameW * (aspect ?? 1)) : undefined;

  function startMove(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation(); // never let the Player treat this as click-to-play
    onSelect?.(); // clicking the image's box selects it (the style editor follows)
    const puck = e.currentTarget;
    const frame = frameRef.current;
    if (!frame) return;

    puck.setPointerCapture(e.pointerId);
    lastRef.current = { x: xPct, y: yPct };
    setActive('move');

    // Grab OFFSET (where inside the box you pressed), so the box travels WITH
    // the pointer instead of jumping its corner to the cursor.
    const r0 = frame.getBoundingClientRect();
    const grabX = e.clientX - (r0.left + (xPct / 100) * r0.width);
    const grabY = e.clientY - (r0.top + (yPct / 100) * r0.height);

    const move = (ev: PointerEvent) => {
      const r = frame.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // Keep the whole box on-frame: the anchor is the LEFT edge, so the max
      // x is 100 − width. Top-anchored, so y reads straight (no inversion).
      const nx = clamp(((ev.clientX - grabX - r.left) / r.width) * 100, 0, 100 - widthPct);
      const ny = clamp(((ev.clientY - grabY - r.top) / r.height) * 100, Y_MIN, Y_MAX);
      lastRef.current = { x: nx, y: ny };
      onMove(nx, ny);
    };

    const end = () => {
      puck.removeEventListener('pointermove', move);
      puck.removeEventListener('pointerup', end);
      puck.removeEventListener('pointercancel', end);
      setActive(null);
      onCommit(lastRef.current.x, lastRef.current.y);
    };

    puck.addEventListener('pointermove', move);
    puck.addEventListener('pointerup', end);
    puck.addEventListener('pointercancel', end);
  }

  function startResize(edge: 'e' | 'se') {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      // Stop this reaching the move handler underneath, or the cue would
      // teleport while you resize.
      e.stopPropagation();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);

      const startW = widthPct;
      const startX = e.clientX;
      lastWRef.current = startW;
      setActive(edge);

      const move = (ev: PointerEvent) => {
        // East handles: rightward grows, leftward shrinks (the anchor is the
        // left edge, so it stays put and the card scales under your hand).
        const dx = (ev.clientX - startX) / RESIZE_DAMPING;
        const next = clamp(startW + dx, W_MIN, W_MAX);
        lastWRef.current = next;
        onResize(next);
      };

      const end = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        setActive(null);
        onResizeCommit(lastWRef.current);
      };

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    };
  }

  /** Arrow keys nudge; the box is focusable, so this is the precise path. */
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? NUDGE_PCT_COARSE : NUDGE_PCT;
    let nx = xPct;
    let ny = yPct;
    if (e.key === 'ArrowLeft') nx -= step;
    else if (e.key === 'ArrowRight') nx += step;
    else if (e.key === 'ArrowUp') ny -= step; // top-anchored: up = less
    else if (e.key === 'ArrowDown') ny += step;
    else return;
    e.preventDefault();
    e.stopPropagation();
    const cx = clamp(nx, 0, 100 - widthPct);
    const cy = clamp(ny, Y_MIN, Y_MAX);
    onMove(cx, cy);
    // Keyboard has no pointerup, so each keypress is its own commit.
    onCommit(cx, cy);
  }

  const dragging = active !== null;
  const handleClass =
    'pointer-events-auto absolute h-3 w-3 rounded-sm border border-violet-300/90 bg-noir/80 opacity-0 transition-opacity group-hover:opacity-100';

  return (
    // inset-0 makes this element exactly the frame, so getBoundingClientRect()
    // is the cue's coordinate space. pointer-events-none keeps the Player's own
    // controls clickable everywhere except the box itself. z-20 (NOT z-30): the
    // word drag layer rides at z-30, and the cue box must NOT swallow the word
    // hit-areas when both are on screen — "I can't grab the text while the image
    // is showing". The cue's own box is still fully draggable; it just loses the
    // tie to the words, which is the right call (you place words more than cues).
    <div ref={frameRef} className="pointer-events-none absolute inset-0 z-20">
      {/* Measures the real aspect so the box wraps the card, not a guess. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="hidden"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0) setAspect(img.naturalHeight / img.naturalWidth);
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Drag to move this image fly-in, or use the right handles to scale it. Arrow keys nudge."
        title="Where the image flies in — drag to move, right edge scales, arrows nudge"
        onPointerDown={startMove}
        onKeyDown={onKeyDown}
        className={`group pointer-events-auto absolute flex cursor-move select-none items-start justify-center rounded-md border border-dashed transition-colors focus:outline-none focus-visible:border-violet-300 ${
          dragging
            ? 'border-violet-300/70 bg-violet-400/10'
            : 'border-violet-300/50 bg-violet-400/5 hover:border-violet-300/80 hover:bg-violet-400/10'
        }`}
        style={{
          left: `${xPct}%`,
          top: `${yPct}%`,
          width: `${widthPct}%`,
          height: boxH,
        }}
      >
        <span
          className={`pointer-events-none mt-0.5 whitespace-nowrap rounded bg-noir/60 px-1 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
            dragging ? 'text-violet-200/90' : 'text-violet-200/60 group-hover:text-violet-200/90'
          }`}
        >
          {active === 'e' || active === 'se' ? `${Math.round(widthPct)}%` : `cue · “${word}”`}
        </span>

        {/* East handles drive widthPct — the anchor is the left edge. */}
        <div
          onPointerDown={startResize('e')}
          className={`${handleClass} -right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize`}
          aria-hidden
        />
        <div
          onPointerDown={startResize('se')}
          className={`${handleClass} -bottom-1.5 -right-1.5 cursor-nwse-resize`}
          aria-hidden
        />
      </div>
    </div>
  );
}
