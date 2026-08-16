'use client';

/**
 * CaptionDragLayer — the ONE transform surface for caption placement + size.
 *
 * Why this component exists: caption dragging used to be inline JSX inside the
 * legacy <video> preview branch. When the Remotion preview branch was added
 * (previewMode === 'remotion'), it rendered <RemotionPreview> and nothing else,
 * so the drag handle silently vanished on the very preview that is supposed to
 * be pixel-identical to the render. Nothing "broke" — the feature was simply
 * never wired into the second branch.
 *
 * That is the same failure mode as the vendored captions.ts drift: one behaviour,
 * two copies, only one maintained. So placement lives here ONCE and both preview
 * branches mount it. A third preview surface gets it by mounting this too.
 *
 * Why an overlay box rather than dragging the text itself: in the Remotion
 * branch the caption is painted inside the Player's own DOM, which we do not own
 * and must not reach into. The box is positioned with the SAME percentages the
 * caption layer uses (left = xPct, bottom = yPct, translateX(-50%)), so it sits
 * exactly over the caption in both branches.
 *
 * Coordinates are percentages of the FRAME, bottom-anchored on Y, matching
 * CaptionOverrides.{xPct,positionPct} — the values buildRenderPlan() reads. The
 * preview therefore moves the same number the MP4 will use.
 *
 * The four corner handles drive `sizePx`, the same override the size slider
 * writes, clamped with the range EXPORTED from captions.ts rather than numbers
 * re-typed here. Copying that range would recreate, in miniature, the bug that
 * made the renderer ignore 37 of 41 caption presets.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  CAPTION_SIZE_MAX,
  CAPTION_SIZE_MIN,
} from '@/lib/mothermode/reel/captions';
import { CAPTION_STAGE_W } from '@/lib/mothermode/reel/render/captionLayer';

/** Clamps keep the block on-frame; 92 on Y leaves room for the caption's height. */
const X_MIN = 2;
const X_MAX = 98;
const Y_MIN = 0;
const Y_MAX = 92;

/**
 * Pixels of corner drag per 1px of caption size.
 *
 * Corner resize is diagonal, so raw pointer distance would make text explode:
 * a 200px drag across a 360-wide stage would blow through the entire 8–200
 * range. 4:1 keeps the full range reachable while still feeling direct.
 */
const RESIZE_DAMPING = 4;

/** Nudge step for arrow keys (percent of frame) — Shift takes bigger bites. */
const NUDGE_PCT = 1;
const NUDGE_PCT_COARSE = 5;

/** Snap to these X/Y positions when the drag lands within SNAP_TOL of them. */
const SNAP_XS = [25, 50, 75];
const SNAP_TOL = 1.5;

/**
 * The caption block's width as a fraction of the frame, and its line height.
 *
 * These mirror `captionLayer.tsx`: it centres an 86%-wide block and sets
 * lineHeight 1.15. The box has to use the SAME numbers or the outline drifts
 * away from the text it is supposed to be wrapping — which is exactly what the
 * fixed `px-6 py-4` padding did: the text scaled, the box didn't.
 */
const BLOCK_W_FRAC = 0.86;
const LINE_HEIGHT = 1.15;

const clamp = (n: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, n)));

/** Snap a value to a nearby guide, so "centred" is actually centred, not 49. */
function snap(n: number, guides: number[]): number {
  for (const g of guides) if (Math.abs(n - g) <= SNAP_TOL) return g;
  return n;
}

type Corner = 'nw' | 'ne' | 'sw' | 'se';

export default function CaptionDragLayer({
  xPct,
  yPct,
  sizePx,
  rows = 1,
  onMove,
  onCommit,
  onResize,
  onResizeCommit,
  hint = 'drag to move · corners resize',
}: {
  /** Horizontal centre of the caption block, 0–100 across the frame. */
  xPct: number;
  /** Distance from the frame's BOTTOM edge, 0–100. */
  yPct: number;
  /**
   * Current caption size (captionOverrides.sizePx, authored against the 360px
   * stage). Optional so callers that only want move still typecheck; the corner
   * handles only render when this AND onResize are supplied.
   */
  sizePx?: number;
  /** How many caption ROWS show at once — the box is that many lines tall. */
  rows?: number;
  /** Fires every pointermove — keep this LOCAL state only (no network per frame). */
  onMove: (xPct: number, yPct: number) => void;
  /** Fires once on pointerup — this is the one that persists. */
  onCommit: (xPct: number, yPct: number) => void;
  /** Live size during a corner drag (local state only, same contract as onMove). */
  onResize?: (sizePx: number) => void;
  /** Final size on pointerup — the one that persists. */
  onResizeCommit?: (sizePx: number) => void;
  hint?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Mirrors the latest drag position so pointerup commits the final value rather
  // than the stale prop from the render that started the drag.
  const lastRef = useRef({ x: xPct, y: yPct });
  const lastSizeRef = useRef(sizePx ?? 0);
  // Purely cosmetic: shows the guides and the size readout only while dragging,
  // so the box stays out of the way when you are just watching playback.
  const [active, setActive] = useState<null | 'move' | Corner>(null);
  /**
   * The frame's CSS width, measured. The box needs it to convert the authored
   * `sizePx` (which is against a 360px stage) into on-screen pixels, the same
   * way the caption layer does — otherwise the outline can't track the text.
   */
  const [frameW, setFrameW] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth));
    ro.observe(el);
    setFrameW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const canResize = typeof sizePx === 'number' && !!onResize;

  // The same scale the caption layer applies: sizePx / CAPTION_STAGE_W * width.
  const scaledFont = frameW > 0 && typeof sizePx === 'number'
    ? (sizePx / CAPTION_STAGE_W) * frameW
    : 0;
  // Box geometry that TRACKS the text: as wide as the caption block, as tall as
  // the rows it wraps to. Falls back to the old fixed padding until measured.
  const boxW = frameW > 0 ? frameW * BLOCK_W_FRAC : undefined;
  const boxH = scaledFont > 0 ? Math.max(24, scaledFont * LINE_HEIGHT * Math.max(1, rows)) : undefined;

  function startMove(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation(); // never let the Player treat this as click-to-play
    const puck = e.currentTarget;
    const frame = frameRef.current;
    if (!frame) return;

    const frame0 = frameRef.current;
    const r0check = frame0?.getBoundingClientRect();
    // Bail on an unmeasured frame — the drag math divides by r.width/height, and a
    // 0-size frame makes every computed % garbage (the caption teleports off-screen).
    if (!r0check || r0check.width < 4 || r0check.height < 4) return;

    puck.setPointerCapture(e.pointerId);
    lastRef.current = { x: xPct, y: yPct };
    setActive('move');
    // Track whether the pointer actually MOVED. A bare click must NOT commit —
    // otherwise a single click on the box re-writes the position (and a stale
    // grab offset can teleport the caption off-screen, which reads as "the text
    // vanished when I clicked it").
    let moved = false;

    /**
     * Grab OFFSET, not absolute pointer position.
     *
     * This used to set the caption's centre to wherever the pointer was, so the
     * block jumped under your cursor the instant you pressed — you could not
     * nudge, only re-place. Recording where inside the box you grabbed makes the
     * box travel WITH the pointer, which is what "drag" means everywhere else.
     */
    const r0 = frame.getBoundingClientRect();
    const grabX = e.clientX - (r0.left + (xPct / 100) * r0.width);
    const grabY = e.clientY - (r0.top + (1 - yPct / 100) * r0.height);

    const move = (ev: PointerEvent) => {
      const r = frame.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = clamp(snap(((ev.clientX - grabX - r.left) / r.width) * 100, SNAP_XS), X_MIN, X_MAX);
      // Bottom-anchored: invert, because y grows downward in client space.
      const ny = clamp(100 - ((ev.clientY - grabY - r.top) / r.height) * 100, Y_MIN, Y_MAX);
      // Only count it as a drag once the pointer travelled a real distance —
      // a bare click must not move the caption.
      if (Math.abs(nx - xPct) > 0.5 || Math.abs(ny - yPct) > 0.5) moved = true;
      lastRef.current = { x: nx, y: ny };
      onMove(nx, ny);
    };

    const end = () => {
      puck.removeEventListener('pointermove', move);
      puck.removeEventListener('pointerup', end);
      puck.removeEventListener('pointercancel', end);
      setActive(null);
      // A bare click (no real movement) is NOT a drag — don't commit, or a single
      // click on the box re-writes the position and the caption teleports/vanishes.
      if (moved) onCommit(lastRef.current.x, lastRef.current.y);
    };

    puck.addEventListener('pointermove', move);
    puck.addEventListener('pointerup', end);
    // Without this a cancelled gesture would strand the listeners AND never persist.
    puck.addEventListener('pointercancel', end);
  }

  function startResize(corner: Corner) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canResize || !onResize) return;
      e.preventDefault();
      // Stop this reaching the move handler underneath, or the caption would
      // teleport while you resize.
      e.stopPropagation();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);

      const startSize = sizePx as number;
      const startX = e.clientX;
      const startY = e.clientY;
      lastSizeRef.current = startSize;
      setActive(corner);

      const move = (ev: PointerEvent) => {
        // Outward from the block's centre grows; inward shrinks. The signs make
        // every corner feel the same: drag away from the middle = bigger.
        const dx = (ev.clientX - startX) * (corner === 'ne' || corner === 'se' ? 1 : -1);
        const dy = (ev.clientY - startY) * (corner === 'sw' || corner === 'se' ? 1 : -1);
        // Average the two axes so a diagonal drag doesn't double-count.
        const delta = (dx + dy) / 2 / RESIZE_DAMPING;
        const next = clamp(startSize + delta, CAPTION_SIZE_MIN, CAPTION_SIZE_MAX);
        lastSizeRef.current = next;
        onResize(next);
      };

      const end = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        setActive(null);
        onResizeCommit?.(lastSizeRef.current);
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
    else if (e.key === 'ArrowUp') ny += step; // bottom-anchored: up = more
    else if (e.key === 'ArrowDown') ny -= step;
    else return;
    e.preventDefault();
    e.stopPropagation();
    const cx = clamp(nx, X_MIN, X_MAX);
    const cy = clamp(ny, Y_MIN, Y_MAX);
    onMove(cx, cy);
    // Keyboard has no pointerup, so each keypress is its own commit.
    onCommit(cx, cy);
  }

  const dragging = active !== null;
  const handleClass =
    'pointer-events-auto absolute h-3 w-3 rounded-sm border border-brass/90 bg-noir/80 opacity-0 transition-opacity group-hover:opacity-100';

  return (
    // inset-0 makes this element exactly the frame, so getBoundingClientRect() is
    // the caption's coordinate space. pointer-events-none keeps the Player's own
    // controls clickable everywhere except the box itself.
    <div ref={frameRef} className="pointer-events-none absolute inset-0 z-30">
      {/* Centre guide, only while dragging — this is how you land on 50 on purpose. */}
      {dragging && Math.abs(xPct - 50) < 0.01 ? (
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-brass/50" />
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-label="Drag to move the captions, or use the corner handles to resize. Arrow keys nudge."
        title={hint}
        onPointerDown={startMove}
        onKeyDown={onKeyDown}
        className={`group pointer-events-auto absolute flex cursor-move select-none items-center justify-center rounded-md border border-dashed transition-colors focus:outline-none focus-visible:border-brass ${
          boxW == null ? 'px-6 py-4' : ''
        } ${
          dragging ? 'border-brass/70 bg-brass/10' : 'border-transparent hover:border-brass/70 hover:bg-brass/10'
        }`}
        style={{
          left: `${xPct}%`,
          bottom: `${yPct}%`,
          transform: 'translateX(-50%)',
          width: boxW,
          height: boxH,
        }}
      >
        <span
          className={`pointer-events-none whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide transition-colors ${
            dragging ? 'text-brass/90' : 'text-brass/0 group-hover:text-brass/90'
          }`}
        >
          {canResize && dragging && active !== 'move' ? `${Math.round(sizePx as number)}px` : hint}
        </span>

        {/* Corner handles. Only rendered when the caller wired resize, so a
            move-only mount does not grow dead affordances. */}
        {canResize ? (
          <>
            <div
              onPointerDown={startResize('nw')}
              className={`${handleClass} -left-1.5 -top-1.5 cursor-nwse-resize`}
              aria-hidden
            />
            <div
              onPointerDown={startResize('ne')}
              className={`${handleClass} -right-1.5 -top-1.5 cursor-nesw-resize`}
              aria-hidden
            />
            <div
              onPointerDown={startResize('sw')}
              className={`${handleClass} -bottom-1.5 -left-1.5 cursor-nesw-resize`}
              aria-hidden
            />
            <div
              onPointerDown={startResize('se')}
              className={`${handleClass} -bottom-1.5 -right-1.5 cursor-nwse-resize`}
              aria-hidden
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
