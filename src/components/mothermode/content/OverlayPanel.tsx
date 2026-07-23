'use client';

/**
 * Text-on-image overlay compose rail for Image Studio (v2).
 * Freeform drag on preview, double-click to edit, richer type + styles,
 * then burn-in PNG to gallery.
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { aiHostImage, aiTextVariations, type AiTextVariation } from './aiClient';


import { downloadUrl } from '@/utils/mothermode/download';


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
  // Primary-text "Variations": plain-text alternatives of overlay.text, shown as
  // clickable chips. This never touches the image — clicking a chip only loads
  // that text into the editor.
  const [varItems, setVarItems] = useState<AiTextVariation[]>([]);

  const [varCount, setVarCount] = useState(3);
  const [varBusy, setVarBusy] = useState(false);
  const [varError, setVarError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  /** The draggable text block DOM node (for measuring + clamping on-frame). */
  const blockRef = useRef<HTMLDivElement>(null);
  /**
   * Block half-size as a fraction of the frame (hw = half width, hh = half
   * height). Updated after every render so drag + auto-repair can keep the
   * center anchor inside [hw, 1-hw] × [hh, 1-hh] — i.e. fully on-canvas.
   */
  const blockFracRef = useRef({ hw: 0.1, hh: 0.05 });
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
        el: HTMLElement | null;
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
  /** Skip next click→edit if the last gesture was a real drag. */
  const suppressEditClickRef = useRef(false);




  const base =
    seed || activeImage || images[0] || overlay.baseImage || null;
  const exportSize = useMemo(

    () => canvasSizeForFormat(piece.format),
    [piece.format],
  );
  const font = getOverlayFont(overlay.fontId);

  // Hydrate from saved recipe when piece/review changes; prefill text if empty.
  // Always seed freeform x/y so the editor never jumps layout on first grab.
  useEffect(() => {
    const saved = asOverlay(review.overlay);
    const withXY = (o: ImageOverlay): ImageOverlay => {
      if (typeof o.x === 'number' && typeof o.y === 'number') return o;
      const s = snapPosition(o.vAlign, o.hAlign);
      return { ...o, x: s.x, y: s.y };
    };
    if (saved.text.trim() || saved.sub?.trim()) {
      setOverlay(withXY(saved));
      if (saved.baseImage) onSeedChange(saved.baseImage);
      return;
    }
    const sug = suggestOverlayText(piece, review);
    setOverlay(
      withXY(
        defaultOverlay({
          ...saved,
          text: sug.text,
          sub: sug.sub,
        }),
      ),
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

  /**
   * Rewrite the current editor `overlay.text` into `varCount` plain-text
   * alternatives, shown as clickable chips. This is text-only — it never
   * renders or touches the image. Clicking a chip loads it into the editor.
   */
  async function makeVariations() {
    const text = overlay.text.trim();
    if (!text) {
      setVarError('Add primary text first');
      return;
    }
    setVarBusy(true);
    setVarError(null);
    try {
      const items = await aiTextVariations({
        text,
        // Rewrite the current sub line to pair with each new primary.
        sub: overlay.sub?.trim() || undefined,
        count: varCount,
        context: {
          theme: piece.theme,
          tone: piece.tone,
          platform: piece.platform,
          format: piece.format,
        },
        // Steer away from what's already on screen and any prior set.
        avoid: [text, ...varItems.map((v) => v.text)],
      });

      setVarItems(items);
    } catch (e) {
      setVarError(e instanceof Error ? e.message : 'Could not make variations');
    } finally {
      setVarBusy(false);
    }
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

  // Fit preview box to exact export aspect inside the rail (fixes type looking
  // wider than burn-in when CSS aspect + max-height broke the ratio).
  // useLayoutEffect so the first paint already has the final size — no
  // full-width fallback → measured shrink on mount.
  const shellRef = useRef<HTMLDivElement>(null);
  const [previewBox, setPreviewBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const fit = () => {
      const maxW = shell.clientWidth;
      const maxH = Math.min(
        typeof window !== 'undefined' ? window.innerHeight * 0.42 : 360,
        360,
      );
      if (maxW < 8) return;
      const ar = exportSize.width / exportSize.height;
      let w = maxW;
      let h = w / ar;
      if (h > maxH) {
        h = maxH;
        w = h * ar;
      }
      setPreviewBox((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5
          ? prev
          : { w, h },
      );
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(shell);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [exportSize.width, exportSize.height, base]);


  const previewH = previewBox.h;
  const previewW = previewBox.w;

  // Only paint text after the preview frame is measured so font/width never
  // jump from a fallback → real size on first mount.
  const frameReady = previewW > 8 && previewH > 8;

  /**
   * After every render, measure the block vs. the frame and:
   *  1. cache its half-size (fraction of frame) for drag clamping, and
   *  2. auto-repair the center anchor if the block is hanging off any edge
   *     (e.g. an old saved recipe, or a long line at a left/right snap).
   * This is the real fix for "drops off in the corner and won't move" — CSS
   * alone can't clamp a center-anchored box without knowing its size.
   */
  useLayoutEffect(() => {
    if (!frameReady || editing) return;
    const frame = previewRef.current;
    const block = blockRef.current;
    if (!frame || !block) return;
    const fr = frame.getBoundingClientRect();
    const br = block.getBoundingClientRect();
    if (fr.width < 1 || fr.height < 1) return;

    const hw = Math.min(0.49, br.width / 2 / fr.width);
    const hh = Math.min(0.49, br.height / 2 / fr.height);
    blockFracRef.current = { hw, hh };

    // Don't fight an active drag.
    if (dragRef.current) return;

    const snap = snapPosition(overlayRef.current.vAlign, overlayRef.current.hAlign);
    const curX =
      typeof overlayRef.current.x === 'number' ? overlayRef.current.x : snap.x;
    const curY =
      typeof overlayRef.current.y === 'number' ? overlayRef.current.y : snap.y;

    // Allowed center range so the whole block stays on-frame.
    const minX = hw;
    const maxX = 1 - hw;
    const minY = hh;
    const maxY = 1 - hh;
    const clampedX = maxX >= minX ? Math.min(maxX, Math.max(minX, curX)) : 0.5;
    const clampedY = maxY >= minY ? Math.min(maxY, Math.max(minY, curY)) : 0.5;

    if (
      Math.abs(clampedX - curX) > 0.002 ||
      Math.abs(clampedY - curY) > 0.002 ||
      typeof overlayRef.current.x !== 'number' ||
      typeof overlayRef.current.y !== 'number'
    ) {
      setOverlay((prev) => ({ ...prev, x: clampedX, y: clampedY }));
    }
  }, [
    frameReady,
    editing,
    previewW,
    previewH,
    overlay.x,
    overlay.y,
    overlay.text,
    overlay.sub,
    overlay.size,
    overlay.fontScale,
    overlay.maxWidthPct,
    overlay.styleId,
    overlay.hAlign,
    overlay.vAlign,
  ]);


  // Always freeform in the editor so grab never jumps layout/size (snap buttons
  // write x/y). Width is % of frame (stable across re-renders). Font scales
  // from measured frame height — same ratio as canvas burn-in.
  const blockStyle: React.CSSProperties = useMemo(() => {
    const maxWPct = overlay.maxWidthPct ?? 0.88;
    const weightNum = Number(getOverlayWeightCss(overlay.weight));
    // Scale export font into preview space (identical ratio to canvas).
    const exportPrimary = overlayPrimaryPx(
      exportSize.height,
      overlay.size,
      overlay.fontScale ?? 1,
    );
    const scale = frameReady ? previewH / exportSize.height : 0;
    const primaryPx = Math.max(8, exportPrimary * scale);
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

// x/y are always the block CENTER. Never let vAlign shift via translate —
    // that parked bottom-aligned text above the frame after drag/remount.
    const snap = snapPosition(overlay.vAlign, overlay.hAlign);
    const ax = typeof overlay.x === 'number' ? overlay.x : snap.x;
    const ay = typeof overlay.y === 'number' ? overlay.y : snap.y;

    return {
      position: 'absolute' as const,
      left: `${ax * 100}%`,
      top: `${ay * 100}%`,
      transform: freeformCssTransform(),

      // Hug the text (matches canvas content-width) so translate(-50%) centers
      // the *actual* box — a fixed 88% width only fit when x was exactly 50%
      // and shoved left/right positions off-canvas.
      width: 'max-content',
      maxWidth: `${maxWPct * 100}%`,
      boxSizing: 'border-box' as const,

      whiteSpace: 'pre-wrap' as const,
      overflowWrap: 'break-word' as const,
      wordBreak: 'break-word' as const,
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
      userSelect: editing ? ('text' as const) : ('none' as const),
      outline: selected ? '1px dashed rgba(255,255,255,0.55)' : undefined,
      outlineOffset: 4,
      fontSize: primaryPx,
      ['--overlay-sub-px' as string]: `${subPx}px`,
      WebkitTextStroke:
        overlay.styleId === 'outline'
          ? `${Math.max(1, Math.round(primaryPx * 0.08))}px rgba(0,0,0,0.85)`
          : undefined,
    };
  }, [
    overlay.x,
    overlay.y,
    overlay.vAlign,
    overlay.hAlign,
    overlay.maxWidthPct,
    overlay.size,
    overlay.fontScale,
    overlay.weight,
    overlay.styleId,
    overlay.tracking,
    overlay.leading,
    overlay.shadowStrength,
    overlay.bgOpacity,
    overlay.textOpacity,
    font.family,
    fillHex,
    previewColor,
    boxed,
    selected,
    editing,
    frameReady,
    previewH,
    exportSize.height,
  ]);






/** Resolve current freeform anchor (always absolute in editor). */
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



  /**
   * Canva-smooth drag:
   * - Move: live DOM left/top during pointermove (no React re-render thrash),
   *   commit x/y once on pointerup. Never touches fontScale.
   * - Resize: only from handle pointers; corners = type size, edges = width.
   * Window-level listeners so tracking stays smooth if the cursor leaves the block.
   */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const frame = previewRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      if (d.kind === 'move') {
        const dxPx = e.clientX - d.startX;
        const dyPx = e.clientY - d.startY;
        // 3px threshold before treating as drag (keeps click-to-edit clean)
        if (!d.moved && Math.hypot(dxPx, dyPx) < 3) return;
        d.moved = true;
        suppressEditClickRef.current = true;
        // Clamp the CENTER anchor by the measured half-size so the whole block
        // stays on-frame (never lets it slip off into a corner).
        const { hw, hh } = blockFracRef.current;
        const minX = Math.min(0.5, hw);
        const maxX = Math.max(0.5, 1 - hw);
        const minY = Math.min(0.5, hh);
        const maxY = Math.max(0.5, 1 - hh);
        const nx = Math.min(maxX, Math.max(minX, d.origX + dxPx / rect.width));
        const ny = Math.min(maxY, Math.max(minY, d.origY + dyPx / rect.height));

        // Live paint via DOM — no setState until release
        if (d.el) {
          d.el.style.left = `${nx * 100}%`;
          d.el.style.top = `${ny * 100}%`;
        }
        // Stash latest for commit
        (d as { lastX?: number; lastY?: number }).lastX = nx;
        (d as { lastX?: number; lastY?: number }).lastY = ny;
        return;
      }

      // Resize only — never runs on body drag
      const dxPx = e.clientX - d.startX;
      const dyPx = e.clientY - d.startY;
      if (d.mode === 'e' || d.mode === 'w') {
        const sign = d.mode === 'e' ? 1 : -1;
        const next = Math.min(
          0.94,
          Math.max(0.4, d.origMaxW + (sign * dxPx) / rect.width),
        );
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setOverlay((prev) =>
            prev.maxWidthPct === next ? prev : { ...prev, maxWidthPct: next },
          );
        });
        return;
      }
      const sx = d.mode === 'se' || d.mode === 'ne' ? 1 : -1;
      const sy = d.mode === 'se' || d.mode === 'sw' ? 1 : -1;
      // Diagonal drag distance → scale (gentle, Canva-like)
      const delta =
        ((sx * dxPx) / Math.max(rect.width, 1) +
          (sy * dyPx) / Math.max(rect.height, 1)) *
        0.45;
      const next = Math.min(1.4, Math.max(0.7, d.origScale + delta));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setOverlay((prev) =>
          prev.fontScale === next ? prev : { ...prev, fontScale: next },
        );
      });
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (d.kind === 'move' && d.moved) {
        const last = d as {
          lastX?: number;
          lastY?: number;
          origX: number;
          origY: number;
        };
        const nx = last.lastX ?? d.origX;
        const ny = last.lastY ?? d.origY;
        // Commit to state and let React own left/top from blockStyle.
        // IMPORTANT: do NOT imperatively clear el.style.left/top here — React's
        // vDOM still thinks it set them, so after clearing it sees "no change"
        // and never re-applies, leaving the block with position:absolute but no
        // left/top → it collapses to the top-left corner and can't be dragged
        // back out. The committed x/y below already match the live DOM values,
        // so there's no snap to hide.
        setOverlay((prev) => ({ ...prev, x: nx, y: ny }));
      }

      // Move never touches width/font — nothing else to clear.

      dragRef.current = null;

      // Allow click-to-edit again after a tick
      window.setTimeout(() => {
        suppressEditClickRef.current = false;
      }, 0);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const onPointerDownBlock = (e: React.PointerEvent) => {
    if (editing) return;
    if ((e.target as HTMLElement)?.closest?.('[data-overlay-handle]')) return;
    if ((e.target as HTMLElement)?.closest?.('textarea,input')) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(true);
    const el = e.currentTarget as HTMLElement;
    const { curX, curY } = seedFreeform();
    // Move only mutates left/top. Never freeze width/font — that caused the
    // shrink-on-grab / expand-on-release jumps.
    dragRef.current = {
      kind: 'move',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: curX,
      origY: curY,
      moved: false,
      el,
    };

    try {
      el.setPointerCapture(e.pointerId);
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

  // No-op stubs kept so TextBlock props stay stable (window listeners own move/up).
  const onPointerMoveBlock = (_e: React.PointerEvent) => {};
  const onPointerUpBlock = (_e: React.PointerEvent) => {};




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

        {/* Shell measures available width; inner frame is exact export aspect. */}
        <div ref={shellRef} className="flex w-full justify-center">
          <div
            ref={previewRef}
            className="relative overflow-hidden rounded-xl border border-ink/15 bg-ink"
            style={
              frameReady
                ? {
                    width: previewW,
                    height: previewH,
                    flexShrink: 0,
                  }
                : {
                    // Invisible placeholder until layout measure — never paint
                    // at a different width than the final frame.
                    width: '100%',
                    aspectRatio: `${exportSize.width} / ${exportSize.height}`,
                    maxHeight: 'min(42vh, 360px)',
                    visibility: 'hidden' as const,
                  }
            }


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
                    (typeof overlay.y === 'number'
                      ? (overlay.y as number)
                      : overlay.vAlign === 'top'
                        ? 0
                        : overlay.vAlign === 'middle'
                          ? 0.5
                          : 1) < 0.35
                      ? 0
                      : (typeof overlay.y === 'number'
                            ? (overlay.y as number)
                            : 1) > 0.55
                        ? undefined
                        : '30%',
                  bottom:
                    (typeof overlay.y === 'number'
                      ? (overlay.y as number)
                      : overlay.vAlign === 'bottom'
                        ? 1
                        : 0) > 0.55
                      ? 0
                      : undefined,
                  height: '38%',
                  background:
                    (typeof overlay.y === 'number'
                      ? (overlay.y as number) < 0.35
                      : overlay.vAlign === 'top')
                      ? 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)'
                      : (typeof overlay.y === 'number'
                            ? (overlay.y as number) > 0.55
                            : overlay.vAlign === 'bottom')
                        ? 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)'
                        : 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.65), transparent)',
                }}
              />
            )}

            {/* Wait for measured frame so type never paints at fallback size. */}
            {overlayOn && frameReady ? (
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
                suppressEditClickRef={suppressEditClickRef}
                containerRef={blockRef}
                onPointerDown={onPointerDownBlock}

                onPointerMove={onPointerMoveBlock}
                onPointerUp={onPointerUpBlock}
                onPointerDownResize={onPointerDownResize}
              />
            ) : !overlayOn ? (

              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-bone/80">
                  Overlay text off — image type only
                </span>
              </div>
            ) : null}

          </div>
        </div>
        <p className="text-[10px] text-ink/40">
          Export {exportSize.width}×{exportSize.height}
          {typeof overlay.x === 'number' && typeof overlay.y === 'number'
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

        {/* Text-only AI variations of the Primary text (never touches image). */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void makeVariations()}
            disabled={varBusy || !overlay.text.trim()}
            className={`${aiBtnGhost} px-2.5 py-1 text-[11px]`}
            title="Rewrite the primary text into alternatives (text only)"
          >
            {varBusy ? <Spinner /> : <Sparkles className="h-3 w-3" />}
            {varItems.length ? 'Regenerate' : 'Variations'}
          </button>
          <div className="inline-flex overflow-hidden rounded-full border border-ink/15">
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setVarCount(n)}
                className={`px-2 py-1 text-[11px] transition-colors ${
                  varCount === n
                    ? 'bg-mode/10 font-semibold text-mode'
                    : 'text-ink/55 hover:text-ink/80'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <AiError message={varError} />
        {varItems.length ? (
          <div className="mt-1.5 flex flex-col gap-1">
            {varItems.map((v, i) => (
              <button
                key={i}
                type="button"
                // Load both lines: primary always, sub only when the model
                // returned one (keeps the current sub otherwise).
                onClick={() =>
                  patch(v.sub ? { text: v.text, sub: v.sub } : { text: v.text })
                }
                title="Load this variation into the editor"
                className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                  overlay.text.trim() === v.text.trim()
                    ? 'border-mode/40 bg-mode/10 text-mode'
                    : 'border-ink/15 text-ink/70 hover:border-ink/30 hover:bg-ink/5'
                }`}
              >
                <span className="block">{v.text}</span>
                {v.sub ? (
                  <span className="mt-0.5 block text-[10px] text-ink/45">
                    {v.sub}
                  </span>
                ) : null}
              </button>
            ))}

          </div>
        ) : null}
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
        <button
          type="button"
          onClick={() =>
            void downloadUrl(overlay.renderedUrl as string, 'overlay.png')
          }
          className={`${aiBtnGhost} justify-center`}
        >
          <Download className="h-3.5 w-3.5" /> Download last save
        </button>
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
  suppressEditClickRef: React.MutableRefObject<boolean>;
  containerRef: React.RefObject<HTMLDivElement>;
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
  suppressEditClickRef,
  containerRef,
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
      ref={containerRef}
      role="group"
      aria-label="Overlay text — drag to move, handles to resize, double-click to edit"
      className="relative touch-none"
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
            // After a real drag, ignore the trailing click so we don't enter edit.
            if (suppressEditClickRef.current) return;
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
            if (suppressEditClickRef.current) return;
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


