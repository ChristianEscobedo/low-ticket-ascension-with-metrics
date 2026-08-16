'use client';

/**
 * WordDragLayer — free-place editor for stack-card words.
 *
 * Hit targets sit ON the real Remotion glyphs (invisible boxes). Selected word
 * gets a thin outline + corner scale handle. Right-click opens a style menu:
 * entrance, scale, color, FX (incl. gradient), ambient, font, clear/hide.
 *
 * Axes match the caption box: xPct = centre 0–100, yPct = from BOTTOM 0–100.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { ReelWord, ReelWordFx, ReelWordMark } from '@/lib/mothermode/reel/types';
import { WORD_FONTS, WORD_FX, captionLineLayout } from '@/lib/mothermode/reel/types';
import { CAPTION_ANIMS, type CaptionAnim } from '@/lib/mothermode/reel/captions';

/** Snap to center axes when within threshold (percent). */
function snapPct(x: number, y: number, thr = 1.5): { x: number; y: number } {
  /* center-snap */
  return {
    x: Math.abs(x - 50) <= thr ? 50 : x,
    y: Math.abs(y - 50) <= thr ? 50 : y,
  };
}

export type WordPlace = {
  index: number;
  xPct: number;
  yPct: number;
  label: string;
  scale?: number;
  anim?: string;
  color?: string;
  fx?: ReelWordFx;
  fxColor?: string;
  fxColor2?: string;
  ambient?: 'float' | 'wiggle';
  font?: string;
  hidden?: boolean;
  /** True when the word carries real xPct/yPct marks (vs an estimated slot). */
  placed?: boolean;
  /** True when the word renders UNDER the subject cutout layer. */
  behind?: boolean;
};

/** Partial mark fields the context menu can write. */
export type WordStylePatch = Partial<
  Pick<
    ReelWordMark,
    | 'anim'
    | 'color'
    | 'scale'
    | 'fx'
    | 'fxColor'
    | 'fxColor2'
    | 'ambient'
    | 'font'
    | 'hidden'
  >
> & {
  /** Explicit clear of all style fields (keeps x/y/card). */
  clearStyle?: boolean;
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
  { id: 'blurIn', label: 'Blur' },
  { id: 'elastic', label: 'Elastic' },
  { id: 'neonPulse', label: 'Neon' },
  { id: 'dropIn', label: 'Drop' },
  { id: 'tilt3d', label: 'Tilt3D' },
  { id: 'outlineFill', label: 'Outline' },
];

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
  { c: '#C084FC', label: 'Violet' },
  { c: '#FB923C', label: 'Orange' },
];

const FX_MENU_ALL: { id: ReelWordFx | ''; label: string }[] = [
  { id: '', label: 'None' },
  { id: 'glow', label: 'Glow' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'shine', label: 'Shine' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'underline', label: 'Underline' },
  { id: 'marker', label: 'Marker' },
  { id: 'tilt', label: 'Tilt' },
  { id: 'outline', label: 'Outline' },
  { id: 'strike', label: 'Strike' },
  { id: 'blink', label: 'Blink' },
  { id: 'jelly', label: 'Jelly' },
];
const FX_MENU = FX_MENU_ALL.filter(
  (f): f is { id: ReelWordFx | ''; label: string } =>
    !f.id || (WORD_FX as readonly string[]).includes(f.id),
);

/** One-click gradient looks: sets fx=gradient + fxColor/fxColor2. */
const GRADIENT_PRESETS: {
  label: string;
  a: string;
  b: string;
}[] = [
  { label: 'Gold', a: '#F5C542', b: '#FFF3C4' },
  { label: 'Fire', a: '#FF3B5C', b: '#FB923C' },
  { label: 'Ocean', a: '#5B8CFF', b: '#3BFF9A' },
  { label: 'Violet', a: '#C084FC', b: '#5B8CFF' },
  { label: 'Sunset', a: '#FB923C', b: '#FF3B5C' },
  { label: 'Ice', a: '#E0F2FE', b: '#5B8CFF' },
  { label: 'Neon', a: '#3BFF9A', b: '#C084FC' },
  { label: 'Mono', a: '#FFFFFF', b: '#94A3B8' },
];

const AMBIENT_MENU: { id: '' | 'float' | 'wiggle'; label: string }[] = [
  { id: '', label: 'Still' },
  { id: 'float', label: 'Float' },
  { id: 'wiggle', label: 'Wiggle' },
];

const FONT_MENU: { id: string; label: string }[] = [
  { id: '', label: 'Default' },
  ...WORD_FONTS.map((f) => ({ id: f, label: f.replace(' Display', '').replace(' Mono One', '') })),
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
  onRemovePlace,
  onToggleBehind,
  mapGlyphIndex,
}: {
  words: WordPlace[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMove: (index: number, xPct: number, yPct: number) => void;
  onCommit: (index: number, xPct: number, yPct: number) => void;
  onScale?: (index: number, scale: number) => void;
  onScaleCommit?: (index: number, scale: number) => void;
  onStyle?: (index: number, partial: WordStylePatch) => void;
  /** Drop the word's x/y placement (it flows back into the caption row). */
  onRemovePlace?: (index: number) => void;
  /**
   * Toggle the behind-the-subject z for the word. The measured glyph centre
   * rides along so an un-placed word can be pinned where it sits first.
   */
  onToggleBehind?: (index: number, xPct: number, yPct: number) => void;
  /**
   * Maps the clip's own captions index → the painted glyph's
   * `data-caption-word` index. The Remotion preview numbers words in the
   * TIMELINE-MERGED plan list (all clips concatenated, trim-cut words dropped);
   * the editor numbers per-clip. Without this the hit boxes land on the WRONG
   * glyphs on a multi-clip or trimmed reel — "highlighting words that aren't on
   * screen and you can't select the ones that are". The Edit stage numbers
   * per-clip, so it leaves this unset (identity).
   */
  mapGlyphIndex?: (clipIndex: number) => number;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<{ index: number; x: number; y: number } | null>(null);
  const lastScaleRef = useRef<{ index: number; scale: number } | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [dragging, setDragging] = useState(false);
  const [glyphBox, setGlyphBox] = useState<
    Record<number, { left: number; top: number; width: number; height: number }>
  >({});

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

  const startDrag = (index: number, e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu(null);
    onSelect(index);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const originX = e.clientX;
    const originY = e.clientY;
    let armed = false;
    lastRef.current = null;

    const onMoveEv = (ev: PointerEvent) => {
      const dx = ev.clientX - originX;
      const dy = ev.clientY - originY;
      if (!armed) {
        if (dx * dx + dy * dy < 25) return; // 5px — click ≠ move
        armed = true;
        setDragging(true);
      }
      const p = clientToPct(ev.clientX, ev.clientY);
      lastRef.current = { index, x: p.x, y: p.y };
      const snapped = snapPct(p.x, p.y);
      onMove(index, snapped.x, snapped.y);
    };
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMoveEv);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      setDragging(false);
      const last = lastRef.current;
      // Only commit if the user actually dragged. A click must not invent x/y.
      if (armed && last && last.index === index) {
        const snapped = snapPct(last.x, last.y);
        onCommit(index, snapped.x, snapped.y);
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

  const apply = (index: number, partial: WordStylePatch) => {
    onStyle?.(index, partial);
    setMenu(null);
  };

  const selected = words.find((w) => w.index === selectedIndex) ?? null;


  /* hug painted glyphs — never guess a box from captionLineLayout */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const root = frame.parentElement;
    if (!root) return;
    const measure = () => {
      const next: Record<number, { left: number; top: number; width: number; height: number }> = {};
      const fr = frame.getBoundingClientRect();
      for (const w of words) {
        // Look the glyph up by the PAINTED index (plan index on the Remotion
        // surface via mapGlyphIndex, the per-clip index on the Edit stage).
        const glyphIdx = mapGlyphIndex ? mapGlyphIndex(w.index) : w.index;
        const el = root.querySelector(
          `[data-caption-word="${glyphIdx}"]`,
        ) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // Skip a zero-size glyph — a word mid-swap (or an fx word's empty
        // shell) measures 0×0, and a 0×0 box is ungrabbable.
        if (r.width < 1 || r.height < 1) continue;
        next[w.index] = {
          left: ((r.left - fr.left) / Math.max(1, fr.width)) * 100,
          top: ((r.top - fr.top) / Math.max(1, fr.height)) * 100,
          width: (r.width / Math.max(1, fr.width)) * 100,
          height: (r.height / Math.max(1, fr.height)) * 100,
        };
      }
      setGlyphBox(next);
    };
    measure();
    // The Remotion Player re-renders the frame ASYNC after a seek. Measuring
    // only synchronously read the PRE-seek glyphs (or nothing), so after moving
    // the playhead the boxes vanished — "it's no longer selectable". Re-measure
    // on the next frame AND after a beat, once the Player has painted.
    const raf = requestAnimationFrame(measure);
    const t = window.setTimeout(measure, 120);
    // Re-measure when the player RESIZES (gene-strip toggle, window resize,
    // aspect change). The boxes are %-of-frame, so a resized frame leaves them
    // stale — "the player got smaller and the scale box outline stopped working".
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measure())
        : null;
    if (ro) ro.observe(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      ro?.disconnect();
    };
  }, [words, selectedIndex, mapGlyphIndex]);

  /* arrow-nudge */
  useEffect(() => {
    if (selectedIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step = e.shiftKey ? 2.5 : 0.5; // % of frame
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = step; // bottom-% grows upward
      else if (e.key === 'ArrowDown') dy = -step;
      else return;
      e.preventDefault();
      const w = words.find((x) => x.index === selectedIndex);
      if (!w) return;
      const xPct = Math.max(2, Math.min(98, w.xPct + dx));
      const yPct = Math.max(2, Math.min(98, w.yPct + dy));
      (() => { const _s = snapPct(xPct, yPct); onMove(selectedIndex, _s.x, _s.y); })();
      (() => { const _s = snapPct(xPct, yPct); onCommit(selectedIndex, _s.x, _s.y); })();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex, words, onMove, onCommit]);

  // Hooks all ran above — only THEN may we bail (an early return before the
  // effects changed the hook count between renders and React threw).
  if (!words.length) return null;

  return (
    <div
      ref={frameRef}
      className="pointer-events-none absolute inset-0 z-30"
      data-word-drag-layer
    >
      {selectedIndex != null && (
        <>
          <div
            data-center-guide
            className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px bg-brass/40"
            style={{ transform: 'translateX(-0.5px)' }}
          />
          <div
            data-center-guide
            className="pointer-events-none absolute top-1/2 left-0 right-0 h-px bg-brass/25"
            style={{ transform: 'translateY(-0.5px)' }}
          />
        </>
      )}

      {words.map((w) => {
        const isSel = selectedIndex === w.index;
        const sc = w.scale && w.scale > 0 ? w.scale : 1;
        // The hit box is ALWAYS rendered — never gated on a freshly-measured
        // glyph. The old `if (!g) return null` is why words vanished: any word
        // whose glyph wasn't painted THIS frame (off the on-screen page, mid
        // remount, mid page-flip) lost its box and became ungrabbable — "words
        // disappear", "hard to grab", "better when I click all" (all paints
        // every glyph, so every word boxed). Now: the measured glyph is the
        // precise position when we have it; the word's own xPct/yPct (its mark
        // or its estimated slot) is the always-correct fallback. A placed word
        // is exactly where its mark says — no measuring needed, ever.
        const g = glyphBox[w.index];
        // The hit box is the measured glyph PADDED — a short word ("a", "I")
        // measures a sliver, and a sliver is ungrabbable. Pad ~1.2% of frame
        // each side and floor the box at 6% × 5% so every word is a real target.
        const PAD_X = 1.2;
        const PAD_Y = 1.0;
        const boxStyle: React.CSSProperties = g
          ? {
              left: `${g.left - PAD_X}%`,
              top: `${g.top - PAD_Y}%`,
              width: `${Math.max(g.width + PAD_X * 2, 6)}%`,
              height: `${Math.max(g.height + PAD_Y * 2, 5)}%`,
              transform: 'none',
            }
          : {
              left: `${w.xPct}%`,
              bottom: `${w.yPct}%`,
              width: Math.max(72, Math.min(220, 28 + w.label.length * 14)) * sc,
              height: 52 * sc,
              transform: 'translate(-50%, 50%)',
            };

        return (
          <div
            key={w.index}
            data-glyph-hit={g ? '1' : '0'}
            className="pointer-events-auto absolute"
            style={{
              ...boxStyle,
              cursor: dragging && isSel ? 'grabbing' : 'grab',
              opacity: w.hidden ? 0.35 : 1,
            }}
            onPointerDown={(e) => startDrag(w.index, e)}
            onContextMenu={(e) => openMenu(w.index, e)}
            title={`"${w.label}" — drag · corner scales · right-click styles`}
          >
            <div
              className={clsx(
                'absolute inset-0 rounded-sm',
                isSel
                  ? 'ring-2 ring-brass ring-offset-0 bg-brass/10'
                  : 'hover:bg-white/[0.04]',
              )}
            />
            {isSel && (
              <>
                <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-brass">
                  {w.label}
                  {sc !== 1 ? ` · ${sc.toFixed(2)}×` : ''}
                  {w.fx ? ` · ${w.fx}` : ''}
                </div>
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
          drag · corner scales · right-click style
        </div>
      )}

      {menu && selected && menu.index === selected.index && onStyle && (
        <WordContextMenu
          clientX={menu.clientX}
          clientY={menu.clientY}
          selected={selected}
          onApply={(p) => apply(menu.index, p)}
          onClose={() => setMenu(null)}
          onRemovePlace={
            selected.placed && onRemovePlace
              ? () => {
                  onRemovePlace(menu.index);
                  setMenu(null);
                }
              : undefined
          }
          onToggleBehind={
            onToggleBehind
              ? () => {
                  // Pin an un-placed word where it sits (the measured glyph
                  // centre) so "behind" never teleports it across the frame.
                  const g = glyphBox[menu.index];
                  const cx = g ? g.left + g.width / 2 : selected.xPct;
                  const cy = g ? 100 - (g.top + g.height / 2) : selected.yPct;
                  onToggleBehind(menu.index, cx, cy);
                  setMenu(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/**
 * The word context menu — right-click a caption word to reach it.
 *
 * Mounted in TWO places: inside the WordDragLayer in Edit mode (right-click a
 * hit box), and at the page level in Preview mode (right-click the caption
 * glyph itself — the layer's data-caption-word span). The place actions
 * (Free-place / Remove placement / Behind the subject) render only when the
 * caller wires them; the style sections are the full per-word editor.
 */
export function WordContextMenu({
  clientX,
  clientY,
  selected,
  onApply,
  onClose,
  onFreePlace,
  onRemovePlace,
  onToggleBehind,
}: {
  clientX: number;
  clientY: number;
  selected: WordPlace;
  onApply: (partial: WordStylePatch) => void;
  onClose: () => void;
  /** Shown when the word is NOT placed yet: pin it where it sits + edit it. */
  onFreePlace?: () => void;
  /** Shown when the word IS placed: drop the x/y — it flows back into the row. */
  onRemovePlace?: () => void;
  /** Toggle the behind-the-subject z for this word. */
  onToggleBehind?: () => void;
}) {
  // Close on Escape / any outside press. The menu owns this — it used to live
  // in the drag layer, which meant no menu could open without the layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-word-ctx-menu]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const apply = (partial: WordStylePatch) => {
    onApply(partial);
    onClose();
  };

  return (
    <div
      data-word-ctx-menu
      className="pointer-events-auto fixed z-50 max-h-[min(480px,78vh)] w-[260px] overflow-y-auto rounded-xl border border-white/12 bg-ink/95 p-2 shadow-2xl shadow-black/50 ring-1 ring-white/5 backdrop-blur-md"
      style={{
        left: Math.min(clientX, (typeof window !== 'undefined' ? window.innerWidth : 800) - 220),
        top: Math.min(clientY, (typeof window !== 'undefined' ? window.innerHeight : 600) - 360),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 truncate border-b border-white/8 px-2 pb-1.5 text-[10px] font-semibold tracking-wide text-brass">
        {selected.label}
      </div>

      {/* Place actions — the right-click reach for free-place + behind. */}
      {(onFreePlace || onRemovePlace || onToggleBehind) && (
        <div className="mb-1.5 flex flex-col gap-0.5 border-b border-white/8 pb-1.5">
          {!selected.placed && onFreePlace && (
            <button
              type="button"
              className="rounded px-1.5 py-1 text-left text-[10px] font-semibold text-brass hover:bg-brass/10"
              onClick={onFreePlace}
            >
              Free-place this word
            </button>
          )}
          {selected.placed && onRemovePlace && (
            <button
              type="button"
              className="rounded px-1.5 py-1 text-left text-[10px] font-semibold text-brass hover:bg-brass/10"
              onClick={onRemovePlace}
            >
              Remove placement (back to the row)
            </button>
          )}
          {onToggleBehind && (
            <button
              type="button"
              className="rounded px-1.5 py-1 text-left text-[10px] font-semibold text-brass hover:bg-brass/10"
              onClick={onToggleBehind}
            >
              {selected.behind ? 'Bring in front of the subject' : 'Behind the subject'}
            </button>
          )}
        </div>
      )}

      {/* Entrance */}
      <Section label="Entrance">
        <div className="grid max-h-24 grid-cols-2 gap-0.5 overflow-y-auto">
          {ANIM_MENU.map((a) => {
            const active = (selected.anim || '') === (a.id || '');
            return (
              <Chip
                key={a.label}
                active={active}
                onClick={() => apply({ anim: a.id || undefined })}
              >
                {a.label}
              </Chip>
            );
          })}
        </div>
      </Section>

      {/* Scale */}
      <Section label="Scale">
        <div className="flex gap-0.5 px-0.5">
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
                onClick={() => apply({ scale: s.v })}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Color */}
      <Section label="Color">
        <div className="flex flex-wrap gap-1 px-1">
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
                  active
                    ? 'border-brass ring-1 ring-brass/60'
                    : 'border-white/25',
                )}
                style={{
                  background: c.c || 'linear-gradient(135deg,#444,#222)',
                }}
                onClick={() => apply({ color: c.c || undefined })}
              />
            );
          })}
        </div>
      </Section>

      {/* FX */}
      <Section label="Effect">
        <div className="grid max-h-24 grid-cols-2 gap-0.5 overflow-y-auto">
          {FX_MENU.map((f) => {
            const active = (selected.fx || '') === (f.id || '');
            return (
              <Chip
                key={f.label}
                active={active}
                onClick={() => {
                  if (!f.id) {
                    apply({
                      fx: undefined,
                      fxColor: undefined,
                      fxColor2: undefined,
                    });
                  } else if (f.id === 'gradient') {
                    // Default gold gradient if none set
                    apply({
                      fx: 'gradient',
                      fxColor: selected.fxColor || '#F5C542',
                      fxColor2: selected.fxColor2 || '#FFF3C4',
                    });
                  } else {
                    apply({ fx: f.id });
                  }
                }}
              >
                {f.label}
              </Chip>
            );
          })}
        </div>
      </Section>

      {/* Gradient presets — always visible so one click applies gradient fill */}
      <Section label="Gradient fill">
        <div className="grid grid-cols-2 gap-0.5">
          {GRADIENT_PRESETS.map((g) => {
            const active =
              selected.fx === 'gradient' &&
              (selected.fxColor || '').toLowerCase() === g.a.toLowerCase() &&
              (selected.fxColor2 || '').toLowerCase() === g.b.toLowerCase();
            return (
              <button
                key={g.label}
                type="button"
                className={clsx(
                  'flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px]',
                  active
                    ? 'bg-brass/25 text-brass'
                    : 'text-white/75 hover:bg-white/10',
                )}
                onClick={() =>
                  apply({
                    fx: 'gradient',
                    fxColor: g.a,
                    fxColor2: g.b,
                  })
                }
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
                  style={{
                    background: `linear-gradient(135deg, ${g.a}, ${g.b})`,
                  }}
                />
                {g.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Ambient */}
      <Section label="Ambient">
        <div className="flex gap-0.5 px-0.5">
          {AMBIENT_MENU.map((a) => {
            const active = (selected.ambient || '') === (a.id || '');
            return (
              <button
                key={a.label}
                type="button"
                className={clsx(
                  'flex-1 rounded py-1 text-[10px] font-semibold',
                  active
                    ? 'bg-brass/25 text-brass'
                    : 'text-white/75 hover:bg-white/10',
                )}
                onClick={() =>
                  apply({
                    ambient: a.id || undefined,
                  })
                }
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Font */}
      <Section label="Font">
        <div className="grid max-h-20 grid-cols-2 gap-0.5 overflow-y-auto">
          {FONT_MENU.map((f) => {
            const active = (selected.font || '') === (f.id || '');
            return (
              <Chip
                key={f.id || 'def'}
                active={active}
                onClick={() => apply({ font: f.id || undefined })}
              >
                <span style={f.id ? { fontFamily: f.id } : undefined}>
                  {f.label}
                </span>
              </Chip>
            );
          })}
        </div>
      </Section>

      {/* Actions */}
      <div className="mt-1 flex flex-col gap-0.5 border-t border-white/10 pt-1">
        <button
          type="button"
          className="rounded px-1.5 py-1 text-left text-[10px] text-white/70 hover:bg-white/10"
          onClick={() => apply({ clearStyle: true })}
        >
          Clear styles
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-1 text-left text-[10px] text-white/70 hover:bg-white/10"
          onClick={() => apply({ hidden: !selected.hidden })}
        >
          {selected.hidden ? 'Unhide word' : 'Hide word'}
        </button>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5">
      <div className="mb-1 px-1.5 text-[9px] font-medium uppercase tracking-wider text-white/40">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={clsx(
        'rounded px-1.5 py-1 text-left text-[10px]',
        active ? 'bg-brass/25 text-brass' : 'text-white/75 hover:bg-white/10',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Build free-place items from caption words that carry xPct/yPct. */
export function freePlaceWordsFrom(
  all: ReelWord[],
  playheadSec: number,
  layout?: { xPct?: number; positionPct?: number; wordsPerRow?: number },
): WordPlace[] {
  // Prefer the card under the playhead; else any freePlace-flagged card.
  let cardId: string | null = null;
  let cardMeta: { wordsPerRow?: number; freePlace?: boolean } | null = null;
  for (let i = 0; i < all.length; i++) {
    const w = all[i];
    if (
      w.mark?.card?.id &&
      playheadSec >= w.start - 0.05 &&
      playheadSec <= w.end + 0.8
    ) {
      cardId = w.mark.card.id;
      cardMeta = w.mark.card;
      break;
    }
  }
  if (!cardId) {
    for (let i = 0; i < all.length; i++) {
      const w = all[i];
      if (w.mark?.card?.id && w.mark.card.freePlace) {
        cardId = w.mark.card.id;
        cardMeta = w.mark.card;
        break;
      }
    }
  }
  // Mixed free-place: no phrase card. Surface EVERY word so any on-screen word
  // is editable in Edit mode — this used to return only the already-placed
  // ones, so only those were ever grabbable ("only two words on the entire
  // thing I can edit"). Un-placed words get an estimated slot; the drag layer's
  // glyph gate shows a box only for the ones actually painted right now.
  if (!cardId) {
    // Only build the list once at least one word is placed (the Edit toggle's
    // own gate) — before that there's nothing to free-place edit.
    const anyPlaced = all.some(
      (w) => typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number',
    );
    if (!anyPlaced) return [];
    const estimates = captionLineLayout(all.length, {
      wordsPerRow: layout?.wordsPerRow ?? 3,
      baseXPct: layout?.xPct ?? 50,
      baseYPct: layout?.positionPct ?? 12,
    });
    return all.map((w, i) => {
      const placed =
        typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number';
      const est = estimates[i] ?? { xPct: 50, yPct: 12 };
      return {
        index: i,
        xPct: placed ? (w.mark!.xPct as number) : est.xPct,
        yPct: placed ? (w.mark!.yPct as number) : est.yPct,
        label: w.word,
        scale: w.mark?.scale,
        anim: w.mark?.anim,
        color: w.mark?.color,
        fx: w.mark?.fx,
        fxColor: w.mark?.fxColor,
        fxColor2: w.mark?.fxColor2,
        ambient: w.mark?.ambient,
        font: w.mark?.font,
        hidden: w.mark?.hidden,
        placed,
        behind: w.mark?.behind === true,
      };
    });
  }

  // Collect card word indexes in order
  const idxs: number[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i].mark?.card?.id === cardId) idxs.push(i);
  }
  if (!idxs.length) return [];

  // Only show drag UI when freePlace is on OR some word already has coords
  const editable =
    cardMeta?.freePlace === true ||
    idxs.some(
      (i) =>
        typeof all[i].mark?.xPct === 'number' &&
        typeof all[i].mark?.yPct === 'number',
    );
  if (!editable) return [];

  const estimates = captionLineLayout(idxs.length, {
    wordsPerRow:
      cardMeta?.wordsPerRow ??
      layout?.wordsPerRow ??
      Math.min(4, idxs.length),
    baseXPct: layout?.xPct ?? 50,
    baseYPct: layout?.positionPct ?? 12,
  });

  const out: WordPlace[] = [];
  idxs.forEach((i, li) => {
    const w = all[i];
    const est = estimates[li] ?? { xPct: 50, yPct: 12 };
    const xPct =
      typeof w.mark?.xPct === 'number' ? w.mark.xPct : est.xPct;
    const yPct =
      typeof w.mark?.yPct === 'number' ? w.mark.yPct : est.yPct;
    out.push({
      index: i,
      xPct,
      yPct,
      label: w.word,
      scale: w.mark?.scale,
      anim: w.mark?.anim,
      color: w.mark?.color,
      fx: w.mark?.fx,
      fxColor: w.mark?.fxColor,
      fxColor2: w.mark?.fxColor2,
      ambient: w.mark?.ambient,
      font: w.mark?.font,
      hidden: w.mark?.hidden,
      placed:
        typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number',
      behind: w.mark?.behind === true,
    });
  });
  return out;
}
