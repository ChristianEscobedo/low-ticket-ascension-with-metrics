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
import { Type, Sparkles, Download, Move, Check } from 'lucide-react';
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
  getOverlayColor,
  getOverlayFont,
  getOverlayWeightCss,
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
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const rafRef = useRef(0);


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

  // CSS placement: freeform % or flex snap
  const blockStyle: React.CSSProperties = useMemo(() => {
    const maxW = `${Math.round((overlay.maxWidthPct ?? 0.88) * 100)}%`;
    const weightNum = Number(getOverlayWeightCss(overlay.weight));
    const scale = overlay.fontScale ?? 1;
    const basePx =
      overlay.size === 's'
        ? 11
        : overlay.size === 'm'
          ? 13
          : overlay.size === 'xl'
            ? 17
            : 15;
    const fontSize = Math.round(basePx * scale);
    const tracking = `${overlay.tracking ?? 0}em`;
    const leading = overlay.leading ?? 1.2;
    const textShadow =
      overlay.styleId === 'shadow'
        ? `0 ${Math.round(2 * (overlay.shadowStrength ?? 0.55))}px ${Math.round(8 * (overlay.shadowStrength ?? 0.55))}px rgba(0,0,0,${0.55 * (overlay.shadowStrength ?? 0.55)})`
        : overlay.styleId === 'glow'
          ? `0 0 ${Math.round(12 * (overlay.shadowStrength ?? 0.55))}px ${fillHex}`
          : overlay.styleId === 'outline'
            ? '0 0 0 2px rgba(0,0,0,0.85)'
            : undefined;

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
        overlay.styleId === 'pill' ? 12 : overlay.styleId === 'box' ? 4 : undefined,
      padding: boxed ? '10px 14px' : overlay.styleId === 'bar' ? '0 0 0 10px' : undefined,
      borderLeft:
        overlay.styleId === 'bar' ? '3px solid #B08D57' : undefined,
      cursor: editing ? 'text' : 'grab',
      userSelect: editing ? 'text' : 'none',
      outline: selected ? '1px dashed rgba(255,255,255,0.55)' : undefined,
      outlineOffset: 4,
      fontSize,
      WebkitTextStroke:
        overlay.styleId === 'outline' ? '1px rgba(0,0,0,0.85)' : undefined,
    };

    if (hasFreeform) {
      return {
        ...common,
        position: 'absolute' as const,
        left: `${(overlay.x as number) * 100}%`,
        top: `${(overlay.y as number) * 100}%`,
        transform: 'translate(0, 0)',
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
  ]);

  const onPointerDownBlock = (e: React.PointerEvent) => {
    if (editing) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(true);
    const o = overlayRef.current;
    const curX =
      typeof o.x === 'number'
        ? o.x
        : o.hAlign === 'left'
          ? 0.06
          : o.hAlign === 'right'
            ? 0.55
            : 0.2;
    const curY =
      typeof o.y === 'number'
        ? o.y
        : o.vAlign === 'top'
          ? 0.06
          : o.vAlign === 'middle'
            ? 0.4
            : 0.72;
    // Seed freeform immediately so first drag frame is absolute-positioned
    if (typeof o.x !== 'number' || typeof o.y !== 'number') {
      setOverlay((prev) => ({ ...prev, x: curX, y: curY }));
    }
    dragRef.current = {
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

  const onPointerMoveBlock = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    if (!d.moved && Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) return;
    d.moved = true;
    const nx = Math.min(0.9, Math.max(0.02, d.origX + dx));
    const ny = Math.min(0.9, Math.max(0.02, d.origY + dy));
    // rAF-throttle so React doesn't thrash mid-drag
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setOverlay((prev) =>
        prev.x === nx && prev.y === ny ? prev : { ...prev, x: nx, y: ny },
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


  // Arrow-key nudge when selected
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
      const x =
        typeof overlay.x === 'number'
          ? overlay.x
          : overlay.hAlign === 'left'
            ? 0.06
            : overlay.hAlign === 'right'
              ? 0.55
              : 0.2;
      const y =
        typeof overlay.y === 'number'
          ? overlay.y
          : overlay.vAlign === 'top'
            ? 0.06
            : overlay.vAlign === 'middle'
              ? 0.4
              : 0.72;
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
      } else if (ev.key === 'Escape') {
        setEditing(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, editing, overlay.x, overlay.y, overlay.hAlign, overlay.vAlign, patch]);

  const snapTo = (v: OverlayVAlign, h: OverlayHAlign) => {
    const s = snapPosition(v, h);
    patch({ ...s });
  };

  return (
    <div className="flex flex-col gap-3">
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
                className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${
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

      {/* Interactive preview first — primary surface for move/edit */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>Preview · drag to move</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-ink/40">
            <Move className="h-3 w-3" /> double-click text to edit
          </span>
        </div>
        <div
          ref={previewRef}
          className={`relative mt-1.5 w-full overflow-hidden rounded-xl border border-ink/15 bg-ink ${aspect}`}
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
          {overlay.styleId === 'scrim' && (
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
          {!hasFreeform ? (
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
                setEditing={setEditing}
                patch={patch}
                onPointerDown={onPointerDownBlock}
                onPointerMove={onPointerMoveBlock}
                onPointerUp={onPointerUpBlock}
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
              setEditing={setEditing}
              patch={patch}
              onPointerDown={onPointerDownBlock}
              onPointerMove={onPointerMoveBlock}
              onPointerUp={onPointerUpBlock}
            />
          )}
        </div>
        <p className="mt-1 text-[10px] text-ink/40">
          Export {exportSize.width}×{exportSize.height}
          {hasFreeform
            ? ` · pos ${Math.round((overlay.x as number) * 100)}%, ${Math.round((overlay.y as number) * 100)}%`
            : ' · snap layout'}
          {' · '}arrows nudge · Shift = larger step
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
            const on =
              !hasFreeform &&
              overlay.vAlign === p.v &&
              overlay.hAlign === p.h;
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
        {busy ? 'Saving…' : savedFlash ? 'Saved to gallery' : 'Save'}
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
        Preview is live on the image. Save burns the text into a PNG, adds it
        to the gallery, and keeps the recipe editable.
      </p>
      <AiError message={error} />

    </div>
  );
};

const TextBlock: React.FC<{
  style: React.CSSProperties;
  overlay: ImageOverlay;
  displayPrimary: string;
  displaySub: string;
  previewColor: string;
  editing: EditField;
  setEditing: (f: EditField) => void;
  patch: (p: Partial<ImageOverlay>) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}> = ({
  style,
  overlay,
  displayPrimary,
  displaySub,
  previewColor,
  editing,
  setEditing,
  patch,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  return (
    <div
      role="group"
      aria-label="Overlay text — drag to move, double-click to edit"
      className="max-w-full touch-none"
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
          autoFocus
          rows={Math.min(4, Math.max(2, (overlay.text || '').split('\n').length))}
          value={overlay.text}
          onChange={(e) => patch({ text: e.target.value })}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(null);
            }
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full resize-none rounded border border-white/40 bg-black/40 p-1 text-inherit outline-none"
          style={{
            font: 'inherit',
            color: 'inherit',
            letterSpacing: 'inherit',
            lineHeight: 'inherit',
            textAlign: 'inherit',
          }}
        />
      ) : displayPrimary ? (
        <div className="whitespace-pre-wrap break-words leading-[inherit]">
          {displayPrimary}
        </div>
      ) : (
        <div className="text-[11px] opacity-50">Double-click to type…</div>
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
          autoFocus
          value={overlay.sub ?? ''}
          onChange={(e) => patch({ sub: e.target.value })}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
              e.preventDefault();
              setEditing(null);
            }
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-1 w-full rounded border border-white/40 bg-black/40 p-1 text-[0.75em] outline-none"
          style={{ font: 'inherit', color: 'inherit', textAlign: 'inherit' }}
        />
      ) : displaySub ? (
        <div
          className="mt-1 break-words opacity-90"
          style={{
            fontSize: '0.72em',
            fontWeight: 400,
            color:
              overlay.styleId === 'pill' || overlay.styleId === 'box'
                ? 'rgba(28,25,23,0.75)'
                : previewColor,
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing('sub');
          }}
        >
          {displaySub}
        </div>
      ) : null}
    </div>
  );
};
