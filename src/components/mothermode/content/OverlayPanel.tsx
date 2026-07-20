'use client';

/**
 * Text-on-image overlay compose rail for Image Studio (v2).
 * Freeform drag on preview, double-click to edit, richer type + styles,
 * then burn-in PNG to gallery.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Type, Sparkles, Download, Move, Check, Eye, EyeOff } from 'lucide-react';
import {
  OVERLAY_COLORS,
  OVERLAY_FONTS,
  OVERLAY_SIZES,
  OVERLAY_STYLES,
  OVERLAY_TRANSFORMS,
  OVERLAY_WEIGHTS,
  applyOverlayTransform,
  canvasSizeForFormat,
  defaultOverlay,
  freeformCssTransform,
  getOverlayColor,
  getOverlayFont,
  getOverlayWeightCss,
  overlayPrimaryPx,
  overlaySubPx,
  renderOverlayToDataUrl,
  snapPosition,
  suggestOverlayText,
  toStoredOverlay,
  type ContentPiece,
  type ImageOverlay,
  type OverlayColor,
  type OverlayFontId,
  type OverlayHAlign,
  type OverlaySize,
  type OverlayStyleId,
  type OverlayTransform,
  type OverlayVAlign,
  type OverlayWeight,
} from '@/lib/mothermode/content';


import type { PieceReview, StoredImageOverlay } from '@/lib/mothermode/content/review';
import { AiError, Spinner, aiBtnGhost, aiBtnSolid } from './AiControls';
import { aiHostImage } from './aiClient';


/** Match Image Studio crop classes without importing the modal (cycle). */
function formatAspect(format: string): string {
  if (['story', 'reel', 'idea', 'short'].includes(format)) return 'aspect-[9/16]';
  if (format === 'pin') return 'aspect-[2/3]';
  if (['blog', 'article', 'answer'].includes(format)) return 'aspect-[16/9]';
  return 'aspect-square';
}

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const chipBase =
  'rounded-full border px-2.5 py-1 text-[11px] transition-colors';
const chipOn = 'border-mode/40 bg-mode/10 font-semibold text-mode';
const chipOff = 'border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink/80';

const FONT_IDS = new Set(OVERLAY_FONTS.map((f) => f.id));
const STYLE_IDS = new Set(OVERLAY_STYLES.map((s) => s.id));
const SIZE_IDS = new Set(OVERLAY_SIZES.map((s) => s.id));
const WEIGHT_IDS = new Set(OVERLAY_WEIGHTS.map((w) => w.id));
const COLOR_IDS = new Set(OVERLAY_COLORS.map((c) => c.id));

function asOverlay(raw: StoredImageOverlay | undefined): ImageOverlay {
  if (!raw) return defaultOverlay();
  const fontId = (FONT_IDS.has(raw.fontId as OverlayFontId)
    ? raw.fontId
    : 'sans') as OverlayFontId;
  const styleId = (STYLE_IDS.has(raw.styleId as OverlayStyleId)
    ? raw.styleId
    : 'shadow') as OverlayStyleId;
  const size = (SIZE_IDS.has(raw.size as OverlaySize)
    ? raw.size
    : 'l') as OverlaySize;
  let weight = raw.weight as OverlayWeight;
  if (weight === ('regular' as OverlayWeight) || weight === 'medium' || weight === 'bold' || weight === 'black') {
    /* ok */
  } else if (String(raw.weight) === '400') weight = 'regular';
  else weight = WEIGHT_IDS.has(weight) ? weight : 'bold';

  const color = (COLOR_IDS.has(raw.color as OverlayColor)
    ? raw.color
    : 'white') as OverlayColor;

  return defaultOverlay({
    text: raw.text ?? '',
    sub: raw.sub ?? '',
    fontId,
    styleId,
    size,
    weight,
    color,
    customHex: raw.customHex,
    vAlign: (raw.vAlign as OverlayVAlign) || 'bottom',
    hAlign: (raw.hAlign as OverlayHAlign) || 'center',
    x: typeof raw.x === 'number' ? raw.x : undefined,
    y: typeof raw.y === 'number' ? raw.y : undefined,
    fontScale: typeof raw.fontScale === 'number' ? raw.fontScale : 1,
    tracking: typeof raw.tracking === 'number' ? raw.tracking : 0,
    leading: typeof raw.leading === 'number' ? raw.leading : 1.2,
    maxWidthPct: typeof raw.maxWidthPct === 'number' ? raw.maxWidthPct : 0.88,
    transform: (raw.transform as OverlayTransform) || 'none',
    shadowStrength:
      typeof raw.shadowStrength === 'number' ? raw.shadowStrength : 0.55,
    bgOpacity: typeof raw.bgOpacity === 'number' ? raw.bgOpacity : 0.92,
    textOpacity: typeof raw.textOpacity === 'number' ? raw.textOpacity : 1,
    enabled: raw.enabled !== false,
    baseImage: raw.baseImage,
    renderedUrl: raw.renderedUrl,
    updatedAt: raw.updatedAt,
  });
}


const POSITIONS: { v: OverlayVAlign; h: OverlayHAlign; label: string }[] = [
  { v: 'top', h: 'left', label: '↖' },
  { v: 'top', h: 'center', label: '↑' },
  { v: 'top', h: 'right', label: '↗' },
  { v: 'middle', h: 'left', label: '←' },
  { v: 'middle', h: 'center', label: '·' },
  { v: 'middle', h: 'right', label: '→' },
  { v: 'bottom', h: 'left', label: '↙' },
  { v: 'bottom', h: 'center', label: '↓' },
  { v: 'bottom', h: 'right', label: '↘' },
];

type EditField = 'text' | 'sub' | null;

export const OverlayPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  images: string[];
  activeImage?: string | null;
  seed: string | null;
  onSeedChange: (url: string | null) => void;
  onAddImages: (urls: string[]) => void;
  onReviewChange?: (next: PieceReview) => void;
}> = ({
  piece,
  review,
  images,
  activeImage,
  seed,
  onSeedChange,
  onAddImages,
  onReviewChange,
}) => {
  const [overlay, setOverlay] = useState<ImageOverlay>(() =>
    asOverlay(review.overlay),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [selected, setSelected] = useState(true);
  const [editing, setEditing] = useState<EditField>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
/** Active pointer gesture: move block, or resize font/width via handles. */
  type Gesture =
    | {
        kind: 'move';
        pointerId: number;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        moved: boolean;
      }
    | {
        kind: 'resize';
        mode: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w';
        pointerId: number;
        startX: number;
        startY: number;
        origScale: number;
        origMaxW: number;
      };
  const dragRef = useRef<Gesture | null>(null);
  const rafRef = useRef(0);
  const blockElRef = useRef<HTMLDivElement | null>(null);



  const base =
    seed || activeImage || images[0] || overlay.baseImage || null;
  const aspect = formatAspect(piece.format);
  const exportSize = useMemo(
    () => canvasSizeForFormat(piece.format),
    [piece.format],
  );
  const font = getOverlayFont(overlay.fontId);

  // Hydrate from saved recipe when piece/review changes; prefill text if empty.
  useEffect(() => {
    const saved = asOverlay(review.overlay);
    if (saved.text.trim() || saved.sub?.trim()) {
      setOverlay(saved);
      if (saved.baseImage) onSeedChange(saved.baseImage);
      return;
    }
    const sug = suggestOverlayText(piece, review);
    setOverlay(
      defaultOverlay({
        ...saved,
        text: sug.text,
        sub: sug.sub,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id]);

  // Default seed to active gallery image when opening Text tab.
  useEffect(() => {
    if (!seed && (activeImage || images[0])) {
      onSeedChange(activeImage || images[0] || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImage, images.length]);

  const patch = useCallback((p: Partial<ImageOverlay>) => {
    setOverlay((o) => ({ ...o, ...p }));
    setError(null);
  }, []);

  function prefill() {
    const sug = suggestOverlayText(piece, review);
    patch({ text: sug.text, sub: sug.sub });
  }

  /** Persist recipe only — never spread full review (avoids clobbering gallery). */
  function persistRecipe(next: ImageOverlay) {
    if (!onReviewChange) return;
    onReviewChange({
      overlay: toStoredOverlay(next) as StoredImageOverlay,
    } as PieceReview);
  }

  /**
   * Save: burn text onto base, host PNG, append to gallery as active image,
   * and store the editable recipe. Live preview already shows the compose.
   */
  async function save() {
    if (!base) {
      setError('Pick a base image from the gallery first');
      return;
    }
    // Overlay off: keep the base image as-is (no double type when image already has text).
    if (overlay.enabled === false) {
      const next: ImageOverlay = {
        ...overlay,
        enabled: false,
        baseImage: base,
        updatedAt: new Date().toISOString(),
      };
      setOverlay(next);
      persistRecipe(next);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      return;
    }
    if (!overlay.text.trim() && !overlay.sub?.trim()) {
      setError('Add primary or sub text');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await renderOverlayToDataUrl({
        baseImage: base,
        overlay,
        width: exportSize.width,
        height: exportSize.height,
      });
      let finalUrl = dataUrl;
      try {
        finalUrl = await aiHostImage(dataUrl);
      } catch {
        /* keep data URL if host fails */
      }
      const next: ImageOverlay = {
        ...overlay,
        enabled: true,
        baseImage: base,
        renderedUrl: finalUrl,
        updatedAt: new Date().toISOString(),
      };
      setOverlay(next);
      onAddImages([finalUrl]);
      persistRecipe(next);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }



  const fillHex = getOverlayColor(overlay);
  const boxed = overlay.styleId === 'pill' || overlay.styleId === 'box';
  const forceInkOnBox =
    boxed &&
    (overlay.color === 'white' ||
      overlay.color === 'soft-white' ||
      overlay.color === 'bone');
  const previewColor = forceInkOnBox ? '#1C1917' : fillHex;

  const displayPrimary = applyOverlayTransform(
    overlay.text || '',
    overlay.transform,
  );
  const displaySub = applyOverlayTransform(overlay.sub || '', overlay.transform);

  const hasFreeform =
    typeof overlay.x === 'number' && typeof overlay.y === 'number';

  const overlayOn = overlay.enabled !== false;

  // Measure live preview height so CSS type scales like the export canvas.
  const [previewH, setPreviewH] = useState(0);
  useEffect(() => {
    const el = previewRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height ?? 0;
      setPreviewH(h);
    });
    ro.observe(el);
    setPreviewH(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [aspect, base]);

  // CSS placement: freeform % or flex snap.
  // Font size is proportional to preview height using the same fraction as
  // canvas burn-in (overlayPrimaryPx), so editor ≈ saved PNG.
  const blockStyle: React.CSSProperties = useMemo(() => {
    const maxW = `${Math.round((overlay.maxWidthPct ?? 0.88) * 100)}%`;
    const weightNum = Number(getOverlayWeightCss(overlay.weight));
    const frameH = previewH > 8 ? previewH : exportSize.height * 0.22;
    const primaryPx = overlayPrimaryPx(
      frameH,
      overlay.size,
      overlay.fontScale ?? 1,
    );
    const subPx = overlaySubPx(primaryPx);
    const tracking = `${overlay.tracking ?? 0}em`;
    const leading = overlay.leading ?? 1.2;
    const ss = overlay.shadowStrength ?? 0.55;
    const textShadow =
      overlay.styleId === 'shadow'
        ? `0 ${Math.max(1, Math.round(primaryPx * 0.08 * ss))}px ${Math.max(2, Math.round(primaryPx * 0.35 * ss))}px rgba(0,0,0,${0.55 * ss})`
        : overlay.styleId === 'glow'
          ? `0 0 ${Math.max(4, Math.round(primaryPx * 0.55 * ss))}px ${fillHex}`
          : overlay.styleId === 'outline'
            ? '0 0 0 2px rgba(0,0,0,0.85)'
            : undefined;
    const padX = boxed ? Math.round(primaryPx * 0.55) : undefined;
    const padY = boxed ? Math.round(primaryPx * 0.35) : undefined;

    const common: React.CSSProperties = {
      maxWidth: maxW,
      textAlign: overlay.hAlign,
      fontFamily: font.family,
      fontWeight: weightNum,
      color: previewColor,
      opacity: overlay.textOpacity ?? 1,
      letterSpacing: tracking,
      lineHeight: leading,
      textShadow,
      background:
        boxed
          ? `rgba(244, 240, 232, ${overlay.bgOpacity ?? 0.92})`
          : undefined,
      borderRadius:
        overlay.styleId === 'pill'
          ? Math.min(24, Math.round(primaryPx * 0.45))
          : overlay.styleId === 'box'
            ? Math.min(8, Math.round(primaryPx * 0.12))
            : undefined,
      padding: boxed
        ? `${padY}px ${padX}px`
        : overlay.styleId === 'bar'
          ? `0 0 0 ${Math.round(primaryPx * 0.45)}px`
          : undefined,
      borderLeft:
        overlay.styleId === 'bar'
          ? `${Math.max(2, Math.round(primaryPx * 0.12))}px solid #B08D57`
          : undefined,
      cursor: editing ? 'text' : 'grab',
      userSelect: editing ? 'text' : 'none',
      outline: selected ? '1px dashed rgba(255,255,255,0.55)' : undefined,
      outlineOffset: 4,
      fontSize: primaryPx,
      // Stash sub size for TextBlock via CSS variable
      ['--overlay-sub-px' as string]: `${subPx}px`,
      WebkitTextStroke:
        overlay.styleId === 'outline'
          ? `${Math.max(1, Math.round(primaryPx * 0.08))}px rgba(0,0,0,0.85)`
          : undefined,
    };

if (hasFreeform) {
      return {
        ...common,
        position: 'absolute' as const,
        left: `${(overlay.x as number) * 100}%`,
        top: `${(overlay.y as number) * 100}%`,
        // Anchor point (x,y) + h/v align — same model as canvas layoutOverlay
        transform: freeformCssTransform(overlay.hAlign, overlay.vAlign),
      };
    }
    return common;
  }, [
    overlay,
    font.family,
    fillHex,
    previewColor,
    boxed,
    hasFreeform,
    selected,
    editing,
    previewH,
    exportSize.height,
  ]);



const seedFreeform = () => {
    const o = overlayRef.current;
    const snap = snapPosition(o.vAlign, o.hAlign);
    const curX = typeof o.x === 'number' ? o.x : snap.x;
    const curY = typeof o.y === 'number' ? o.y : snap.y;
    if (typeof o.x !== 'number' || typeof o.y !== 'number') {
      setOverlay((prev) => ({ ...prev, x: curX, y: curY }));
    }
    return { curX, curY };
  };

  const onPointerDownBlock = (e: React.PointerEvent) => {
    if (editing) return;
    // Don't start move when interacting with inputs/handles (handles stopPropagation).
    if ((e.target as HTMLElement)?.closest?.('[data-overlay-handle]')) return;
    if ((e.target as HTMLElement)?.closest?.('textarea,input')) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(true);
    const { curX, curY } = seedFreeform();
    dragRef.current = {
      kind: 'move',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: curX,
      origY: curY,
      moved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerDownResize = (
    e: React.PointerEvent,
    mode: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w',
  ) => {
    if (editing) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(true);
    seedFreeform();
    const o = overlayRef.current;
    dragRef.current = {
      kind: 'resize',
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origScale: o.fontScale ?? 1,
      origMaxW: o.maxWidthPct ?? 0.88,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMoveBlock = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    if (d.kind === 'move') {
      const dx = (e.clientX - d.startX) / rect.width;
      const dy = (e.clientY - d.startY) / rect.height;
      if (!d.moved && Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) return;
      d.moved = true;
      const nx = Math.min(0.9, Math.max(0.02, d.origX + dx));
      const ny = Math.min(0.9, Math.max(0.02, d.origY + dy));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setOverlay((prev) =>
          prev.x === nx && prev.y === ny ? prev : { ...prev, x: nx, y: ny },
        );
      });
      return;
    }

    // Resize: corners → fontScale; left/right edges → maxWidthPct
    const dxPx = e.clientX - d.startX;
    const dyPx = e.clientY - d.startY;
    if (d.mode === 'e' || d.mode === 'w') {
      // Width: drag outward grows maxWidthPct
      const sign = d.mode === 'e' ? 1 : -1;
      const delta = (sign * dxPx) / rect.width;
      const next = Math.min(0.94, Math.max(0.4, d.origMaxW + delta));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setOverlay((prev) =>
          prev.maxWidthPct === next ? prev : { ...prev, maxWidthPct: next },
        );
      });
      return;
    }
    // Corner: average of outward growth in x/y → font scale
    const sx =
      d.mode === 'se' || d.mode === 'ne' ? 1 : -1;
    const sy =
      d.mode === 'se' || d.mode === 'sw' ? 1 : -1;
    // ~120px drag ≈ +0.4 scale at typical preview size
    const delta =
      ((sx * dxPx) / rect.width + (sy * dyPx) / rect.height) * 0.55;
    const next = Math.min(1.4, Math.max(0.7, d.origScale + delta));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setOverlay((prev) =>
        prev.fontScale === next ? prev : { ...prev, fontScale: next },
      );
    });
  };

  const onPointerUpBlock = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };



// Arrow-key nudge / scale when selected (not while typing)
  useEffect(() => {
    if (!selected || editing) return;
    const onKey = (ev: KeyboardEvent) => {
      if (
        ev.target instanceof HTMLInputElement ||
        ev.target instanceof HTMLTextAreaElement ||
        (ev.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      const step = ev.shiftKey ? 0.04 : 0.01;
      const snap = snapPosition(overlay.vAlign, overlay.hAlign);
      const x = typeof overlay.x === 'number' ? overlay.x : snap.x;
      const y = typeof overlay.y === 'number' ? overlay.y : snap.y;

      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        patch({ x: Math.max(0.02, x - step), y });
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        patch({ x: Math.min(0.92, x + step), y });
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        patch({ x, y: Math.max(0.02, y - step) });
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        patch({ x, y: Math.min(0.92, y + step) });
      } else if (ev.key === '=' || ev.key === '+') {
        ev.preventDefault();
        patch({
          fontScale: Math.min(1.4, (overlay.fontScale ?? 1) + 0.05),
        });
      } else if (ev.key === '-' || ev.key === '_') {
        ev.preventDefault();
        patch({
          fontScale: Math.max(0.7, (overlay.fontScale ?? 1) - 0.05),
        });
      } else if (ev.key === 'Enter' || ev.key === 'F2') {
        ev.preventDefault();
        setEditing('text');
      } else if (ev.key === 'Escape') {
        setEditing(null);
        setSelected(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selected,
    editing,
    overlay.x,
    overlay.y,
    overlay.hAlign,
    overlay.vAlign,
    overlay.fontScale,
    patch,
  ]);


  const snapTo = (v: OverlayVAlign, h: OverlayHAlign) => {
    const s = snapPosition(v, h);
    patch({ ...s });
  };

return (
    <div className="flex flex-col gap-3">
      {/*
        Sticky compose surface: stays visible while font/style controls scroll
        in the Image Studio left rail.
      */}
      <div className="sticky top-0 z-20 -mx-1 space-y-2 border-b border-ink/10 bg-bone/95 px-1 pb-2 pt-0.5 backdrop-blur-md">
        <div>
          <span className={labelCls}>Base image</span>
          {images.length === 0 ? (
            <p className="mt-1.5 text-xs text-ink/50">
              Generate or upload an image first, then come back to Text.
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {images.slice(0, 8).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSeedChange(src)}
                  className={`h-10 w-10 overflow-hidden rounded-lg border-2 ${
                    base === src ? 'border-mode' : 'border-ink/15'
                  }`}
                  title={`Use image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>Preview · drag to move</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = { ...overlay, enabled: !overlayOn };
                setOverlay(next);
                persistRecipe(next);
              }}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                overlayOn
                  ? 'border-mode/40 bg-mode/10 text-mode'
                  : 'border-ink/20 bg-ink/5 text-ink/55'
              }`}
              title={
                overlayOn
                  ? 'Hide overlay text (image already has type)'
                  : 'Show overlay text'
              }
            >
              {overlayOn ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              {overlayOn ? 'Text on' : 'Text off'}
            </button>
<span className="inline-flex items-center gap-1 text-[10px] text-ink/40">
              <Move className="h-3 w-3" /> drag · handles size · dbl-click type
            </span>

          </div>
        </div>

        <div
          ref={previewRef}
          className={`relative w-full max-h-[min(42vh,360px)] overflow-hidden rounded-xl border border-ink/15 bg-ink ${aspect}`}
          onPointerDown={() => {
            if (!editing) setSelected(false);
          }}
        >

          {base ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={base}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-bone/40">
              No base image
            </div>
          )}
          {overlayOn && overlay.styleId === 'scrim' && (

            <div
              className="pointer-events-none absolute inset-x-0"
              style={{
                top:
                  hasFreeform && (overlay.y as number) < 0.35
                    ? 0
                    : hasFreeform && (overlay.y as number) > 0.55
                      ? undefined
                      : hasFreeform
                        ? '30%'
                        : overlay.vAlign === 'middle'
                          ? '30%'
                          : overlay.vAlign === 'top'
                            ? 0
                            : undefined,
                bottom:
                  hasFreeform && (overlay.y as number) > 0.55
                    ? 0
                    : !hasFreeform && overlay.vAlign === 'bottom'
                      ? 0
                      : undefined,
                height: '38%',
                background:
                  (hasFreeform ? (overlay.y as number) < 0.35 : overlay.vAlign === 'top')
                    ? 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)'
                    : (hasFreeform ? (overlay.y as number) > 0.55 : overlay.vAlign === 'bottom')
                      ? 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)'
                      : 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.65), transparent)',
              }}
            />
          )}

          {/* Snap layout wrapper when not freeform */}
          {overlayOn ? (
            !hasFreeform ? (
              <div
                className="absolute inset-0 flex p-[6%]"
                style={{
                  alignItems:
                    overlay.vAlign === 'top'
                      ? 'flex-start'
                      : overlay.vAlign === 'middle'
                        ? 'center'
                        : 'flex-end',
                  justifyContent:
                    overlay.hAlign === 'left'
                      ? 'flex-start'
                      : overlay.hAlign === 'right'
                        ? 'flex-end'
                        : 'center',
                }}
              >
<TextBlock
                  style={blockStyle}
                  overlay={overlay}
                  displayPrimary={displayPrimary}
                  displaySub={displaySub}
                  previewColor={previewColor}
                  editing={editing}
                  selected={selected}
                  setEditing={setEditing}
                  patch={patch}
                  onPointerDown={onPointerDownBlock}
                  onPointerMove={onPointerMoveBlock}
                  onPointerUp={onPointerUpBlock}
                  onPointerDownResize={onPointerDownResize}
                />
              </div>
            ) : (
              <TextBlock
                style={blockStyle}
                overlay={overlay}
                displayPrimary={displayPrimary}
                displaySub={displaySub}
                previewColor={previewColor}
                editing={editing}
                selected={selected}
                setEditing={setEditing}
                patch={patch}
                onPointerDown={onPointerDownBlock}
                onPointerMove={onPointerMoveBlock}
                onPointerUp={onPointerUpBlock}
                onPointerDownResize={onPointerDownResize}
              />
            )

          ) : (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-bone/80">
                Overlay text off — image type only
              </span>
            </div>
          )}
</div>
<p className="text-[10px] text-ink/40">
          Export {exportSize.width}×{exportSize.height}
          {hasFreeform
            ? ` · ${Math.round((overlay.x as number) * 100)}%, ${Math.round((overlay.y as number) * 100)}%`
            : ' · snap'}
          {overlayOn
            ? ` · ${Math.round((overlay.fontScale ?? 1) * 100)}% type · ${Math.round((overlay.maxWidthPct ?? 0.88) * 100)}% wide · Enter edit · ± size`
            : ' · text hidden'}
        </p>

      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>Primary text</span>

          <button
            type="button"
            onClick={prefill}
            className="inline-flex items-center gap-1 text-[11px] text-mode hover:underline"
          >
            <Sparkles className="h-3 w-3" /> Prefill
          </button>
        </div>
        <textarea
          rows={3}
          value={overlay.text}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder="On-screen line…"
          className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
        />
      </div>

      <div>
        <span className={labelCls}>Sub text (optional)</span>
        <input
          type="text"
          value={overlay.sub ?? ''}
          onChange={(e) => patch({ sub: e.target.value })}
          placeholder="Smaller second line"
          className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
        />
      </div>

      <div>
        <span className={labelCls}>Font</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OVERLAY_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => patch({ fontId: f.id })}
              className={`${chipBase} ${overlay.fontId === f.id ? chipOn : chipOff}`}
              style={{ fontFamily: f.family }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Weight</span>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {OVERLAY_WEIGHTS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => patch({ weight: w.id })}
              className={`${chipBase} ${overlay.weight === w.id ? chipOn : chipOff}`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>Size</span>
          <span className="text-[10px] text-ink/40">
            scale {Math.round((overlay.fontScale ?? 1) * 100)}%
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OVERLAY_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => patch({ size: s.id })}
              className={`${chipBase} ${overlay.size === s.id ? chipOn : chipOff}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={70}
          max={140}
          step={5}
          value={Math.round((overlay.fontScale ?? 1) * 100)}
          onChange={(e) =>
            patch({ fontScale: Number(e.target.value) / 100 })
          }
          className="mt-2 w-full accent-[var(--mode,#B08D57)]"
        />
      </div>

      <div>
        <span className={labelCls}>Style</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OVERLAY_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => patch({ styleId: s.id })}
              title={s.hint}
              className={`${chipBase} ${overlay.styleId === s.id ? chipOn : chipOff}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {(overlay.styleId === 'shadow' || overlay.styleId === 'glow') && (
        <div>
          <div className="flex items-center justify-between">
            <span className={labelCls}>Shadow / glow strength</span>
            <span className="text-[10px] text-ink/40">
              {Math.round((overlay.shadowStrength ?? 0.55) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((overlay.shadowStrength ?? 0.55) * 100)}
            onChange={(e) =>
              patch({ shadowStrength: Number(e.target.value) / 100 })
            }
            className="mt-1.5 w-full accent-[var(--mode,#B08D57)]"
          />
        </div>
      )}

      {(overlay.styleId === 'pill' || overlay.styleId === 'box') && (
        <div>
          <div className="flex items-center justify-between">
            <span className={labelCls}>Background opacity</span>
            <span className="text-[10px] text-ink/40">
              {Math.round((overlay.bgOpacity ?? 0.92) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round((overlay.bgOpacity ?? 0.92) * 100)}
            onChange={(e) =>
              patch({ bgOpacity: Number(e.target.value) / 100 })
            }
            className="mt-1.5 w-full accent-[var(--mode,#B08D57)]"
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <span className={labelCls}>Text opacity</span>
          <span className="text-[10px] text-ink/40">
            {Math.round((overlay.textOpacity ?? 1) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round((overlay.textOpacity ?? 1) * 100)}
          onChange={(e) =>
            patch({ textOpacity: Number(e.target.value) / 100 })
          }
          className="mt-1.5 w-full accent-[var(--mode,#B08D57)]"
        />
      </div>

      <div>
        <span className={labelCls}>Color</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {OVERLAY_COLORS.filter((c) => c.id !== 'custom').map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => patch({ color: c.id })}
              title={c.label}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                overlay.color === c.id
                  ? 'border-mode scale-110'
                  : 'border-ink/20 hover:border-ink/40'
              }`}
              style={{ background: c.hex }}
            />
          ))}
          <label
            className={`relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 ${
              overlay.color === 'custom'
                ? 'border-mode scale-110'
                : 'border-ink/20'
            }`}
            style={{
              background:
                overlay.color === 'custom' && overlay.customHex
                  ? overlay.customHex
                  : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            }}
            title="Any color"
          >
            <input
              type="color"
              value={
                /^#([0-9a-fA-F]{6})$/.test(overlay.customHex || fillHex)
                  ? (overlay.customHex || fillHex)
                  : '#FFFFFF'
              }
              onChange={(e) =>
                patch({ color: 'custom', customHex: e.target.value })
              }
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={
              overlay.color === 'custom'
                ? overlay.customHex || ''
                : fillHex
            }
            onChange={(e) => {
              const v = e.target.value.trim();
              patch({ color: 'custom', customHex: v });
            }}
            placeholder="#RRGGBB"
            className="w-28 rounded-lg border border-ink/15 bg-white/70 px-2 py-1.5 font-mono text-xs text-ink focus:border-mode focus:outline-none"
          />
          <span className="text-[10px] text-ink/40">
            presets or any hex / picker
          </span>
        </div>
      </div>


      <div>
        <span className={labelCls}>Transform</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OVERLAY_TRANSFORMS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => patch({ transform: t.id })}
              className={`${chipBase} ${
                (overlay.transform || 'none') === t.id ? chipOn : chipOff
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <div className="flex items-center justify-between">
            <span className={labelCls}>Tracking</span>
            <span className="text-[10px] text-ink/40">
              {(overlay.tracking ?? 0).toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={-5}
            max={20}
            value={Math.round((overlay.tracking ?? 0) * 100)}
            onChange={(e) =>
              patch({ tracking: Number(e.target.value) / 100 })
            }
            className="mt-1.5 w-full accent-[var(--mode,#B08D57)]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className={labelCls}>Leading</span>
            <span className="text-[10px] text-ink/40">
              {(overlay.leading ?? 1.2).toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={160}
            value={Math.round((overlay.leading ?? 1.2) * 100)}
            onChange={(e) =>
              patch({ leading: Number(e.target.value) / 100 })
            }
            className="mt-1.5 w-full accent-[var(--mode,#B08D57)]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className={labelCls}>Max width</span>
            <span className="text-[10px] text-ink/40">
              {Math.round((overlay.maxWidthPct ?? 0.88) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={40}
            max={94}
            value={Math.round((overlay.maxWidthPct ?? 0.88) * 100)}
            onChange={(e) =>
              patch({ maxWidthPct: Number(e.target.value) / 100 })
            }
            className="mt-1.5 w-full accent-[var(--mode,#B08D57)]"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>Snap position</span>
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as OverlayHAlign[]).map((h) => (
              <button
                key={h}
                type="button"
                title={`Align ${h}`}
                onClick={() => patch({ hAlign: h })}
                className={`${chipBase} ${overlay.hAlign === h ? chipOn : chipOff}`}
              >
                {h === 'left' ? '⫷' : h === 'right' ? '⫸' : '☰'}
              </button>
            ))}
          </div>
        </div>
<div className="mt-1.5 grid grid-cols-3 gap-1">
          {POSITIONS.map((p) => {
            const snap = snapPosition(p.v, p.h);
            const on = hasFreeform
              ? Math.abs((overlay.x as number) - snap.x) < 0.02 &&
                Math.abs((overlay.y as number) - snap.y) < 0.02 &&
                overlay.vAlign === p.v &&
                overlay.hAlign === p.h
              : overlay.vAlign === p.v && overlay.hAlign === p.h;
            return (

              <button
                key={`${p.v}-${p.h}`}
                type="button"
                onClick={() => snapTo(p.v, p.h)}
                className={`rounded-md border py-1.5 text-sm ${
                  on
                    ? 'border-mode bg-mode/10 font-semibold text-mode'
                    : 'border-ink/15 text-ink/55 hover:border-ink/30'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy || !base}
        className={`${aiBtnSolid} justify-center`}
      >
        {busy ? (
          <Spinner />
        ) : savedFlash ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Type className="h-3.5 w-3.5" />
        )}
        {busy
          ? 'Saving…'
          : savedFlash
            ? overlayOn
              ? 'Saved to gallery'
              : 'Recipe saved'
            : overlayOn
              ? 'Save'
              : 'Save recipe (no burn)'}
      </button>
      {overlay.renderedUrl ? (
        <a
          href={overlay.renderedUrl}
          download="overlay.png"
          className={`${aiBtnGhost} justify-center`}
        >
          <Download className="h-3.5 w-3.5" /> Download last save
        </a>
      ) : null}
      <p className="-mt-1 text-[11px] text-ink/40">
        {overlayOn
          ? 'Preview type size matches export. Save burns text into a PNG and adds it to the gallery.'
          : 'Text is off — use when the image already has type. Save keeps the recipe without burning.'}
      </p>

      <AiError message={error} />

    </div>
  );
};

const HANDLE_BASE =
  'absolute z-10 h-2.5 w-2.5 rounded-sm border border-white bg-mode shadow-sm touch-none';

const TextBlock: React.FC<{
  style: React.CSSProperties;
  overlay: ImageOverlay;
  displayPrimary: string;
  displaySub: string;
  previewColor: string;
  editing: EditField;
  selected: boolean;
  setEditing: (f: EditField) => void;
  patch: (p: Partial<ImageOverlay>) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerDownResize: (
    e: React.PointerEvent,
    mode: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w',
  ) => void;
}> = ({
  style,
  overlay,
  displayPrimary,
  displaySub,
  previewColor,
  editing,
  selected,
  setEditing,
  patch,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerDownResize,
}) => {
  const primaryRef = useRef<HTMLTextAreaElement>(null);
  const subRef = useRef<HTMLInputElement>(null);

  // Focus + select all when entering edit mode (true in-place edit).
  useEffect(() => {
    if (editing === 'text' && primaryRef.current) {
      const el = primaryRef.current;
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* ignore */
      }
    }
    if (editing === 'sub' && subRef.current) {
      subRef.current.focus();
      subRef.current.select();
    }
  }, [editing]);

  // Auto-grow primary textarea height to match content.
  useEffect(() => {
    const el = primaryRef.current;
    if (!el || editing !== 'text') return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  }, [editing, overlay.text, style.fontSize]);

  const showHandles = selected && !editing;

  return (
    <div
      role="group"
      aria-label="Overlay text — drag to move, handles to resize, double-click to edit"
      className="relative max-w-full touch-none"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing('text');
      }}
    >
      {editing === 'text' ? (
        <textarea
          ref={primaryRef}
          rows={1}
          value={overlay.text}
          onChange={(e) => patch({ text: e.target.value })}
          onBlur={(e) => {
            // Keep editing if focus moved to sub field
            const next = e.relatedTarget as HTMLElement | null;
            if (next?.dataset?.overlayField === 'sub') return;
            setEditing(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(null);
            }
            // Cmd/Ctrl+Enter commits
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              setEditing(null);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          data-overlay-field="text"
          spellCheck
          className="w-full resize-none border-0 bg-transparent p-0 text-inherit caret-white outline-none ring-0"
          style={{
            font: 'inherit',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            fontFamily: 'inherit',
            color: 'inherit',
            letterSpacing: 'inherit',
            lineHeight: 'inherit',
            textAlign: 'inherit',
            textShadow: 'inherit',
            WebkitTextStroke: 'inherit',
            overflow: 'hidden',
            minHeight: '1.2em',
          }}
          placeholder="Type overlay…"
        />
      ) : displayPrimary ? (
        <div
          className="cursor-text whitespace-pre-wrap break-words leading-[inherit]"
          onClick={(e) => {
            // Single click when already selected → edit (Figma-like)
            if (selected) {
              e.stopPropagation();
              setEditing('text');
            }
          }}
        >
          {displayPrimary}
        </div>
      ) : (
        <div
          className="cursor-text text-[11px] opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            setEditing('text');
          }}
        >
          Click to type…
        </div>
      )}
      {overlay.styleId === 'brass-line' && (displayPrimary || editing) ? (
        <div
          className="mt-1 h-0.5 w-10 rounded-full"
          style={{
            background: '#B08D57',
            marginLeft:
              overlay.hAlign === 'left'
                ? 0
                : overlay.hAlign === 'right'
                  ? 'auto'
                  : 'auto',
            marginRight:
              overlay.hAlign === 'right'
                ? 0
                : overlay.hAlign === 'left'
                  ? 'auto'
                  : 'auto',
          }}
        />
      ) : null}
      {editing === 'sub' ? (
        <input
          ref={subRef}
          value={overlay.sub ?? ''}
          onChange={(e) => patch({ sub: e.target.value })}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape' || e.key === 'Enter') {
              e.preventDefault();
              setEditing(null);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          data-overlay-field="sub"
          className="mt-1 w-full border-0 bg-transparent p-0 outline-none"
          style={{
            font: 'inherit',
            fontSize: 'var(--overlay-sub-px, 0.55em)',
            fontWeight: 400,
            color: 'inherit',
            textAlign: 'inherit',
            letterSpacing: 'inherit',
            lineHeight: Math.max(1.15, overlay.leading ?? 1.2),
          }}
          placeholder="Sub line…"
        />
      ) : displaySub || selected ? (
        <div
          className={`mt-1 break-words ${displaySub ? 'opacity-90' : 'opacity-40'}`}
          style={{
            fontSize: 'var(--overlay-sub-px, 0.55em)',
            fontWeight: 400,
            lineHeight: Math.max(1.15, overlay.leading ?? 1.2),
            color:
              overlay.styleId === 'pill' || overlay.styleId === 'box'
                ? 'rgba(28,25,23,0.75)'
                : previewColor,
            cursor: 'text',
            minHeight: '1em',
          }}
          onClick={(e) => {
            if (selected) {
              e.stopPropagation();
              setEditing('sub');
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing('sub');
          }}
        >
          {displaySub || (selected ? 'Add sub…' : null)}
        </div>
      ) : null}

      {/* Resize handles — corners = type size, sides = max width */}
      {showHandles ? (
        <>
          {(
            [
              { m: 'nw' as const, cls: '-left-1 -top-1 cursor-nwse-resize' },
              { m: 'ne' as const, cls: '-right-1 -top-1 cursor-nesw-resize' },
              { m: 'sw' as const, cls: '-left-1 -bottom-1 cursor-nesw-resize' },
              { m: 'se' as const, cls: '-right-1 -bottom-1 cursor-nwse-resize' },
            ] as const
          ).map(({ m, cls }) => (
            <span
              key={m}
              data-overlay-handle={m}
              title="Drag to resize type"
              className={`${HANDLE_BASE} ${cls}`}
              onPointerDown={(e) => onPointerDownResize(e, m)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          ))}
          {(
            [
              {
                m: 'w' as const,
                cls: '-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize',
              },
              {
                m: 'e' as const,
                cls: '-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize',
              },
            ] as const
          ).map(({ m, cls }) => (
            <span
              key={m}
              data-overlay-handle={m}
              title="Drag to change text width"
              className={`${HANDLE_BASE} ${cls}`}
              onPointerDown={(e) => onPointerDownResize(e, m)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          ))}
        </>
      ) : null}
    </div>
  );
};


