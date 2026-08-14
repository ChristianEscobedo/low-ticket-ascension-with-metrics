'use client';

/**
 * WordDragLayer — free-place editor for stack-card words.
 *
 * Hit targets sit ON the real Remotion glyphs (invisible boxes). No placeholder
 * labels. Selected word gets a thin outline + corner scale handle. Right-click
 * opens a compact style menu (anim / color / scale presets).
 *
 * Axes match the caption box: xPct = centre 0–100, yPct = from BOTTOM 0–100.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { ReelWord } from '@/lib/mothermode/reel/types';
import { CAPTION_ANIMS, type CaptionAnim } from '@/lib/mothermode/reel/captions';

export type WordPlace = {
  index: number;
  xPct: number;
  yPct: number;
  label: string;
  /** Current mark.scale (1 = default). */
  scale?: number;
  anim?: string;
  color?: string;
};

type MenuState = {
  index: number;
  clientX: number;
  clientY: number;
} | null;

const QUICK_ANIMS: { id: CaptionAnim | ''; label: string }[] = [
  { id: '', label: 'None' },
  { id: 'pop', label: 'Pop' },
  { id: 'slam', label: 'Slam' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'fade', label: 'Fade' },
  { id: 'riseUp', label: 'Rise' },
  { id: 'springPop', label: 'Spring' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'typewriter', label: 'Type' },
  { id: 'zoomSnap', label: 'Zoom' },
];

// Prefer the short list; fall back if CAPTION_ANIMS is missing an id.
const ANIM_MENU = QUICK_ANIMS.filter(
  (a) => !a.id || (CAPTION_ANIMS as string[]).includes(a.id),
);

const SCALE_PRESETS = [
  { v: 0.75, label: 'S' },
  { v: 1, label: 'M' },
  { v: 1.35, label: 'L' },
  { v: 1.8, label: 'XL' },
];

const COLOR_PRESETS = [
  { c: '', label: 'Default' },
  { c: '#FFFFFF', label: 'White' },
  { c: '#F5C542', label: 'Brass' },
  { c: '#FF3B5C', label: 'Hot' },
  { c: '#3BFF9A', label: 'Mint' },
  { c: '#5B8CFF', label: 'Blue' },
];

export default function WordDragLayer({
  words,
  selectedIndex,
  onSelect,
  onMove,
  onCommit,
  onScale,
  onScaleCommit,
  onStyle,
}: {
  words: WordPlace[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMove: (index: number, xPct: number, yPct: number) => void;
  onCommit: (index: number, xPct: number, yPct: number) => void;
  onScale?: (index: number, scale: number) => void;
  onScaleCommit?: (index: number, scale: number) => void;
  /** Apply mark fields (anim / color / scale preset). */
  onStyle?: (
    index: number,
    partial: { anim?: string; color?: string; scale?: number },
  ) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<{ index: number; x: number; y: number } | null>(null);
  const lastScaleRef = useRef<{ index: number; scale: number } | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [dragging, setDragging] = useState(false);

  const clientToPct = useCallback((clientX: number, clientY: number) => {
    const el = frameRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / Math.max(1, r.width)) * 100;
    const y = (1 - (clientY - r.top) / Math.max(1, r.height)) * 100;
    return {
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y)),
    };
  }, []);

  // Close menu on outside click / Escape
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-word-ctx-menu]')) return;
      setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [menu]);

  const startDrag = (index: number, e: React.PointerEvent) => {
    if (e.button === 2) return; // right-click = menu only
    e.preventDefault();
    e.stopPropagation();
    setMenu(null);
    onSelect(index);
    setDragging(true);
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
      setDragging(false);
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

  const startScale = (
    index: number,
    startScale: number,
    e: React.PointerEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu(null);
    onSelect(index);
    if (!onScale || !onScaleCommit) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    lastScaleRef.current = { index, scale: startScale };

    const onMoveEv = (ev: PointerEvent) => {
      // Drag out/down-right = bigger. ~120px → +1.0 scale.
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const delta = (dx + dy) / 120;
      const next = Math.max(0.4, Math.min(3.5, startScale + delta));
      const rounded = Math.round(next * 100) / 100;
      lastScaleRef.current = { index, scale: rounded };
      onScale(index, rounded);
    };
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMoveEv);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      const last = lastScaleRef.current;
      if (last && last.index === index) {
        onScaleCommit(index, last.scale);
      }
      lastScaleRef.current = null;
    };
    el.addEventListener('pointermove', onMoveEv);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  const openMenu = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(index);
    setMenu({ index, clientX: e.clientX, clientY: e.clientY });
  };

  if (!words.length) return null;

  const selected = words.find((w) => w.index === selectedIndex) ?? null;

  return (
    <div
      ref={frameRef}
      className="pointer-events-none absolute inset-0 z-30"
      data-word-drag-layer
    >
      {words.map((w) => {
        const isSel = selectedIndex === w.index;
        const sc = w.scale && w.scale > 0 ? w.scale : 1;
        // Hit box sized roughly to a caption word; scales with mark.scale.
        const baseW = Math.max(48, Math.min(160, 14 + w.label.length * 11));
        const baseH = 36;
        const boxW = baseW * sc;
        const boxH = baseH * sc;

        return (
          <div
            key={w.index}
            className="pointer-events-auto absolute"
            style={{
              left: `${w.xPct}%`,
              bottom: `${w.yPct}%`,
              width: boxW,
              height: boxH,
              transform: 'translate(-50%, 50%)',
              cursor: dragging && isSel ? 'grabbing' : 'grab',
            }}
            onPointerDown={(e) => startDrag(w.index, e)}
            onContextMenu={(e) => openMenu(w.index, e)}
            title={`"${w.label}" — drag to place · corner scales · right-click styles`}
          >
            {/* Invisible hit surface — real glyphs paint underneath in Remotion */}
            <div
              className={clsx(
                'absolute inset-0 rounded-sm',
                isSel
                  ? 'ring-2 ring-brass/80 ring-offset-0 bg-brass/[0.06]'
                  : 'hover:ring-1 hover:ring-white/35 hover:bg-white/[0.03]',
              )}
            />
            {/* Selection chrome only — no duplicate text */}
            {isSel && (
              <>
                <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-brass">
                  {w.label}
                  {sc !== 1 ? ` · ${sc.toFixed(2)}×` : ''}
                </div>
                {/* Scale handle — bottom-right corner */}
                {(onScale || onScaleCommit) && (
                  <button
                    type="button"
                    aria-label="Scale word"
                    onPointerDown={(e) => startScale(w.index, sc, e)}
                    className={clsx(
                      'absolute -bottom-1.5 -right-1.5 z-10 h-3.5 w-3.5',
                      'rounded-sm border border-brass bg-ink shadow',
                      'cursor-nwse-resize hover:bg-brass/30',
                    )}
                    title="Drag to scale"
                  />
                )}
              </>
            )}
          </div>
        );
      })}

      {!dragging && (
        <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/55 px-2 py-0.5 text-[8px] text-white/45">
          drag word · corner scales · right-click style
        </div>
      )}

      {menu && selected && menu.index === selected.index && onStyle && (
        <div
          data-word-ctx-menu
          className="pointer-events-auto fixed z-50 min-w-[168px] rounded-lg border border-white/15 bg-ink/95 p-1.5 shadow-xl backdrop-blur"
          style={{
            left: Math.min(menu.clientX, window.innerWidth - 200),
            top: Math.min(menu.clientY, window.innerHeight - 320),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-1 truncate px-1.5 text-[9px] font-semibold uppercase tracking-wide text-brass/90">
            {selected.label}
          </div>

          <div className="mb-0.5 px-1.5 text-[8px] uppercase tracking-wide text-white/35">
            Entrance
          </div>
          <div className="mb-1.5 grid max-h-28 grid-cols-2 gap-0.5 overflow-y-auto">
            {ANIM_MENU.map((a) => {
              const active = (selected.anim || '') === (a.id || '');
              return (
                <button
                  key={a.label}
                  type="button"
                  className={clsx(
                    'rounded px-1.5 py-1 text-left text-[10px]',
                    active
                      ? 'bg-brass/25 text-brass'
                      : 'text-white/75 hover:bg-white/10',
                  )}
                  onClick={() => {
                    onStyle(menu.index, { anim: a.id || undefined });
                    setMenu(null);
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>

          <div className="mb-0.5 px-1.5 text-[8px] uppercase tracking-wide text-white/35">
            Scale
          </div>
          <div className="mb-1.5 flex gap-0.5 px-1">
            {SCALE_PRESETS.map((s) => {
              const sc = selected.scale && selected.scale > 0 ? selected.scale : 1;
              const active = Math.abs(sc - s.v) < 0.05;
              return (
                <button
                  key={s.label}
                  type="button"
                  className={clsx(
                    'flex-1 rounded py-1 text-[10px] font-semibold',
                    active
                      ? 'bg-brass/25 text-brass'
                      : 'text-white/75 hover:bg-white/10',
                  )}
                  onClick={() => {
                    onStyle(menu.index, { scale: s.v });
                    setMenu(null);
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="mb-0.5 px-1.5 text-[8px] uppercase tracking-wide text-white/35">
            Color
          </div>
          <div className="flex flex-wrap gap-1 px-1 pb-0.5">
            {COLOR_PRESETS.map((c) => {
              const active =
                (selected.color || '').toLowerCase() === c.c.toLowerCase() ||
                (!selected.color && !c.c);
              return (
                <button
                  key={c.label}
                  type="button"
                  title={c.label}
                  className={clsx(
                    'h-5 w-5 rounded-full border',
                    active ? 'border-brass ring-1 ring-brass/60' : 'border-white/25',
                  )}
                  style={{
                    background: c.c || 'linear-gradient(135deg,#444,#222)',
                  }}
                  onClick={() => {
                    onStyle(menu.index, {
                      color: c.c || undefined,
                    });
                    // Clearing color: pass empty and let parent delete — use ''
                    if (!c.c) onStyle(menu.index, { color: '' });
                    setMenu(null);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Build free-place items from caption words that carry xPct/yPct. */
export function freePlaceWordsFrom(
  all: ReelWord[],
  playheadSec: number,
): WordPlace[] {
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
      scale: w.mark.scale,
      anim: w.mark.anim,
      color: w.mark.color,
    });
  }
  return out;
}
