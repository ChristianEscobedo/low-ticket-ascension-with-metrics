'use client';

/**
 * WordDragLayer — free-place handles for stack-card words on the preview.
 *
 * Mirrors CaptionDragLayer's contract: live onMove (local), commit on pointerup
 * (persist). Coordinates are frame % with the same axes as the caption box
 * (x = centre, y = from bottom) so the Remotion layer and this overlay agree.
 */
import { useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import type { ReelWord } from '@/lib/mothermode/reel/types';

export type WordPlace = { index: number; xPct: number; yPct: number; label: string };

export default function WordDragLayer({
  words,
  selectedIndex,
  onSelect,
  onMove,
  onCommit,
}: {
  /** Words currently free-placed (already filtered to the active card). */
  words: WordPlace[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMove: (index: number, xPct: number, yPct: number) => void;
  onCommit: (index: number, xPct: number, yPct: number) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<{ index: number; x: number; y: number } | null>(null);

  const clientToPct = useCallback((clientX: number, clientY: number) => {
    const el = frameRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / Math.max(1, r.width)) * 100;
    // y from BOTTOM
    const y = (1 - (clientY - r.top) / Math.max(1, r.height)) * 100;
    return {
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y)),
    };
  }, []);

  const startDrag = (index: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(index);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const { x, y } = clientToPct(e.clientX, e.clientY);
    lastRef.current = { index, x, y };
    onMove(index, x, y);

    const onMoveEv = (ev: PointerEvent) => {
      const p = clientToPct(ev.clientX, ev.clientY);
      lastRef.current = { index, x: p.x, y: p.y };
      onMove(index, p.x, p.y);
    };
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMoveEv);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      const last = lastRef.current;
      if (last && last.index === index) {
        onCommit(index, last.x, last.y);
      }
      lastRef.current = null;
    };
    el.addEventListener('pointermove', onMoveEv);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  if (!words.length) return null;

  return (
    <div
      ref={frameRef}
      className="pointer-events-none absolute inset-0 z-30"
      data-word-drag-layer
    >
      {words.map((w) => {
        const selected = selectedIndex === w.index;
        return (
          <button
            key={w.index}
            type="button"
            onPointerDown={(e) => startDrag(w.index, e)}
            className={clsx(
              'pointer-events-auto absolute -translate-x-1/2 translate-y-1/2',
              'rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              'cursor-grab active:cursor-grabbing select-none',
              selected
                ? 'border-brass bg-brass/20 text-brass shadow-[0_0_0_1px_rgba(212,175,55,0.5)]'
                : 'border-white/30 bg-black/50 text-white/90 hover:border-brass/60',
            )}
            style={{
              left: `${w.xPct}%`,
              bottom: `${w.yPct}%`,
            }}
            title={`Drag "${w.label}" · ${w.xPct.toFixed(0)}%, ${w.yPct.toFixed(0)}%`}
          >
            {w.label}
          </button>
        );
      })}
      <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 text-[8px] text-white/50">
        drag words to place · click selects for FX
      </div>
    </div>
  );
}

/** Build drag handles from caption words that carry free-place coords. */
export function freePlaceWordsFrom(
  all: ReelWord[],
  playheadSec: number,
): WordPlace[] {
  // Prefer the card under the playhead; else any free-placed words.
  let cardId: string | null = null;
  for (let i = 0; i < all.length; i++) {
    const w = all[i];
    if (
      w.mark?.card?.id &&
      playheadSec >= w.start - 0.05 &&
      playheadSec <= w.end + 0.8
    ) {
      cardId = w.mark.card.id;
      break;
    }
  }
  const out: WordPlace[] = [];
  for (let i = 0; i < all.length; i++) {
    const w = all[i];
    if (w.mark?.hidden) continue;
    if (typeof w.mark?.xPct !== 'number' || typeof w.mark?.yPct !== 'number') {
      continue;
    }
    if (cardId && w.mark?.card?.id !== cardId) continue;
    out.push({
      index: i,
      xPct: w.mark.xPct,
      yPct: w.mark.yPct,
      label: w.word,
    });
  }
  return out;
}
