'use client';

/**
 * CaptionDragLayer — the ONE drag surface for caption placement.
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
 * Why an overlay puck rather than dragging the text itself: in the Remotion
 * branch the caption is painted inside the Player's own DOM, which we do not own
 * and must not reach into. The puck is positioned with the SAME percentages the
 * caption layer uses (left = xPct, bottom = yPct, translateX(-50%)), so it sits
 * exactly over the caption in both branches.
 *
 * Coordinates are percentages of the FRAME, bottom-anchored on Y, matching
 * CaptionOverrides.{xPct,positionPct} — the values buildRenderPlan() reads. The
 * preview therefore moves the same number the MP4 will use.
 */
import React, { useRef } from 'react';

/** Clamps keep the block on-frame; 92 on Y leaves room for the caption's height. */
const X_MIN = 2;
const X_MAX = 98;
const Y_MIN = 0;
const Y_MAX = 92;

const clamp = (n: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, n)));

export default function CaptionDragLayer({
  xPct,
  yPct,
  onMove,
  onCommit,
  hint = 'drag to move captions',
}: {
  /** Horizontal centre of the caption block, 0–100 across the frame. */
  xPct: number;
  /** Distance from the frame's BOTTOM edge, 0–100. */
  yPct: number;
  /** Fires every pointermove — keep this LOCAL state only (no network per frame). */
  onMove: (xPct: number, yPct: number) => void;
  /** Fires once on pointerup — this is the one that persists. */
  onCommit: (xPct: number, yPct: number) => void;
  hint?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Mirrors the latest drag position so pointerup commits the final value rather
  // than the stale prop from the render that started the drag.
  const lastRef = useRef({ x: xPct, y: yPct });

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation(); // never let the Player treat this as click-to-play
    const puck = e.currentTarget;
    const frame = frameRef.current;
    if (!frame) return;

    puck.setPointerCapture(e.pointerId);
    lastRef.current = { x: xPct, y: yPct };

    const move = (ev: PointerEvent) => {
      const r = frame.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = clamp(((ev.clientX - r.left) / r.width) * 100, X_MIN, X_MAX);
      // Bottom-anchored: invert, because y grows downward in client space.
      const ny = clamp(100 - ((ev.clientY - r.top) / r.height) * 100, Y_MIN, Y_MAX);
      lastRef.current = { x: nx, y: ny };
      onMove(nx, ny);
    };

    const end = () => {
      puck.removeEventListener('pointermove', move);
      puck.removeEventListener('pointerup', end);
      puck.removeEventListener('pointercancel', end);
      onCommit(lastRef.current.x, lastRef.current.y);
    };

    puck.addEventListener('pointermove', move);
    puck.addEventListener('pointerup', end);
    // Without this a cancelled gesture would strand the listeners AND never persist.
    puck.addEventListener('pointercancel', end);
  }

  return (
    // inset-0 makes this element exactly the frame, so getBoundingClientRect() is
    // the caption's coordinate space. pointer-events-none keeps the Player's own
    // controls clickable everywhere except the puck itself.
    <div ref={frameRef} className="pointer-events-none absolute inset-0 z-30">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag to move the captions"
        title={hint}
        onPointerDown={startDrag}
        className="group pointer-events-auto absolute cursor-move select-none rounded-md border border-dashed border-transparent px-6 py-4 transition-colors hover:border-brass/70 hover:bg-brass/10"
        style={{ left: `${xPct}%`, bottom: `${yPct}%`, transform: 'translateX(-50%)' }}
      >
        <span className="pointer-events-none whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-brass/0 transition-colors group-hover:text-brass/90">
          {hint}
        </span>
      </div>
    </div>
  );
}
