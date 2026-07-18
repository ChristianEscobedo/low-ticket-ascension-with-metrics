/**
 * Text-on-image overlay recipes + canvas burn-in for stories, reels, and feed
 * stills. Pure layout helpers are unit-testable; render runs in the browser.
 */
import { PLATFORM_SIZE_PRESETS } from './platformSizes';
import type { ContentPiece } from './types';
import { reviewHooks, type PieceReview } from './review';

/** Vertical band for the text block. */
export type OverlayVAlign = 'top' | 'middle' | 'bottom';
/** Horizontal alignment inside the safe area. */
export type OverlayHAlign = 'left' | 'center' | 'right';
export type OverlaySize = 's' | 'm' | 'l' | 'xl';
export type OverlayWeight = 'regular' | 'bold';
export type OverlayColor = 'white' | 'bone' | 'ink' | 'brass';

export type OverlayFontId = 'sans' | 'serif' | 'mono';
export type OverlayStyleId =
  | 'shadow'
  | 'pill'
  | 'scrim'
  | 'brass-line';

/** Editable recipe stored on the piece review (re-openable). */
export interface ImageOverlay {
  text: string;
  /** Optional smaller second line. */
  sub?: string;
  fontId: OverlayFontId;
  styleId: OverlayStyleId;
  size: OverlaySize;
  weight: OverlayWeight;
  color: OverlayColor;
  vAlign: OverlayVAlign;
  hAlign: OverlayHAlign;
  /** Gallery image used as the base when last rendered. */
  baseImage?: string;
  /** Last burned-in PNG (data URL or hosted). */
  renderedUrl?: string;
  updatedAt?: string;
}

export interface OverlayFontOption {
  id: OverlayFontId;
  label: string;
  /** CSS / canvas font-family stack (must be available in the browser). */
  family: string;
}

export interface OverlayStyleOption {
  id: OverlayStyleId;
  label: string;
  hint: string;
}

export const OVERLAY_FONTS: OverlayFontOption[] = [
  {
    id: 'sans',
    label: 'Sans',
    family:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: 'serif',
    label: 'Serif',
    family: 'ui-serif, Georgia, "Times New Roman", Times, serif',
  },
  {
    id: 'mono',
    label: 'Mono',
    family:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },
];

export const OVERLAY_STYLES: OverlayStyleOption[] = [
  {
    id: 'shadow',
    label: 'Shadow',
    hint: 'Bold type with soft drop shadow',
  },
  {
    id: 'pill',
    label: 'Pill',
    hint: 'Bone rounded box behind the lines',
  },
  {
    id: 'scrim',
    label: 'Scrim',
    hint: 'Dark gradient band for readability',
  },
  {
    id: 'brass-line',
    label: 'Brass line',
    hint: 'Accent rule under the primary line',
  },
];

export const OVERLAY_SIZES: { id: OverlaySize; label: string }[] = [
  { id: 's', label: 'S' },
  { id: 'm', label: 'M' },
  { id: 'l', label: 'L' },
  { id: 'xl', label: 'XL' },
];

export const OVERLAY_COLORS: { id: OverlayColor; label: string; hex: string }[] =
  [
    { id: 'white', label: 'White', hex: '#FFFFFF' },
    { id: 'bone', label: 'Bone', hex: '#F4F0E8' },
    { id: 'ink', label: 'Ink', hex: '#1C1917' },
    { id: 'brass', label: 'Brass', hex: '#B08D57' },
  ];

/** Fraction of frame height used as primary font size. */
const SIZE_FRAC: Record<OverlaySize, number> = {
  s: 0.035,
  m: 0.048,
  l: 0.062,
  xl: 0.078,
};

const SAFE = 0.06; // 6% padding from edges

export function defaultOverlay(partial?: Partial<ImageOverlay>): ImageOverlay {
  return {
    text: '',
    sub: '',
    fontId: 'sans',
    styleId: 'shadow',
    size: 'l',
    weight: 'bold',
    color: 'white',
    vAlign: 'bottom',
    hAlign: 'center',
    ...partial,
  };
}

export function getOverlayFont(id: OverlayFontId): OverlayFontOption {
  return OVERLAY_FONTS.find((f) => f.id === id) ?? OVERLAY_FONTS[0];
}

export function getOverlayColor(id: OverlayColor): string {
  return OVERLAY_COLORS.find((c) => c.id === id)?.hex ?? '#FFFFFF';
}

/** Pixel size for the piece format (export canvas). */
export function canvasSizeForFormat(format?: string): {
  width: number;
  height: number;
} {
  switch (format) {
    case 'story':
    case 'reel':
    case 'video':
    case 'idea':
    case 'short':
      return { width: 1080, height: 1920 };
    case 'pin':
      return { width: 1000, height: 1500 };
    case 'blog':
    case 'article':
    case 'answer':
    case 'thread':
      return { width: 1600, height: 900 };
    case 'carousel':
      return { width: 1080, height: 1080 };
    case 'feed':
    default: {
      const p = PLATFORM_SIZE_PRESETS.find((x) => x.id === 'ig-feed-45');
      return p
        ? { width: p.width, height: p.height }
        : { width: 1080, height: 1350 };
    }
  }
}

/**
 * Prefill overlay text from the piece + review: active hook, first slide text,
 * or first production-script / catalog onScreen line.
 */
export function suggestOverlayText(
  piece: ContentPiece,
  review: PieceReview,
): { text: string; sub: string } {
  const edited = reviewHooks(review.edits);
  const hook =
    (edited.length > 0
      ? edited[review.edits?.hookIndex ?? 0] ?? edited[0]
      : '') ||
    piece.hooks?.[0] ||
    piece.hook ||
    '';

  const slide = piece.slides?.[0];
  const beatOn =
    review.videoScript?.beats?.find((b) => b.onScreen?.trim())?.onScreen ||
    piece.script?.find((b) => b.onScreen?.trim())?.onScreen ||
    '';

  if (['story', 'carousel', 'idea'].includes(piece.format) && slide?.text) {
    return {
      text: slide.text.trim(),
      sub: (slide.sub ?? '').trim(),
    };
  }
  if (['reel', 'video', 'short'].includes(piece.format) && beatOn) {
    return { text: beatOn.trim(), sub: '' };
  }
  if (hook.trim()) return { text: hook.trim(), sub: '' };
  if (beatOn.trim()) return { text: beatOn.trim(), sub: '' };
  if (slide?.text) {
    return { text: slide.text.trim(), sub: (slide.sub ?? '').trim() };
  }
  return { text: '', sub: '' };
}

/** Word-wrap text to a max width using canvas measureText. */
export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const words = raw.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      // Hard-break very long tokens
      if (ctx.measureText(w).width > maxWidth) {
        let chunk = '';
        for (const ch of w) {
          const t = chunk + ch;
          if (ctx.measureText(t).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else chunk = t;
        }
        cur = chunk;
      } else {
        cur = w;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface OverlayLayout {
  width: number;
  height: number;
  pad: number;
  maxTextWidth: number;
  primaryPx: number;
  subPx: number;
  lineHeight: number;
  subLineHeight: number;
  textX: number;
  blockTop: number;
  primaryLines: string[];
  subLines: string[];
  blockHeight: number;
  align: CanvasTextAlign;
}

/** Compute text block geometry for a canvas size + overlay recipe. */
export function layoutOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: ImageOverlay,
  width: number,
  height: number,
): OverlayLayout {
  const pad = Math.round(Math.min(width, height) * SAFE);
  const maxTextWidth = width - pad * 2;
  const primaryPx = Math.max(18, Math.round(height * SIZE_FRAC[overlay.size]));
  const subPx = Math.max(14, Math.round(primaryPx * 0.55));
  const lineHeight = Math.round(primaryPx * 1.2);
  const subLineHeight = Math.round(subPx * 1.25);
  const font = getOverlayFont(overlay.fontId);
  const weight = overlay.weight === 'bold' ? '700' : '400';

  ctx.font = `${weight} ${primaryPx}px ${font.family}`;
  const primaryLines = wrapLines(ctx, overlay.text || '', maxTextWidth);
  ctx.font = `400 ${subPx}px ${font.family}`;
  const subLines = wrapLines(ctx, overlay.sub || '', maxTextWidth);

  const gap = primaryLines.length && subLines.length ? Math.round(primaryPx * 0.35) : 0;
  const blockHeight =
    primaryLines.length * lineHeight +
    gap +
    subLines.length * subLineHeight +
    (overlay.styleId === 'pill' ? Math.round(primaryPx * 0.7) : 0) +
    (overlay.styleId === 'brass-line' && primaryLines.length
      ? Math.round(primaryPx * 0.45)
      : 0);

  let blockTop: number;
  if (overlay.vAlign === 'top') blockTop = pad;
  else if (overlay.vAlign === 'middle')
    blockTop = Math.round((height - blockHeight) / 2);
  else blockTop = height - pad - blockHeight;

  const align: CanvasTextAlign =
    overlay.hAlign === 'left'
      ? 'left'
      : overlay.hAlign === 'right'
        ? 'right'
        : 'center';
  const textX =
    align === 'left' ? pad : align === 'right' ? width - pad : width / 2;

  return {
    width,
    height,
    pad,
    maxTextWidth,
    primaryPx,
    subPx,
    lineHeight,
    subLineHeight,
    textX,
    blockTop,
    primaryLines,
    subLines,
    blockHeight,
    align,
  };
}

/** Draw image cover-fit into the canvas. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  width: number,
  height: number,
  iw: number,
  ih: number,
): void {
  const scale = Math.max(width / iw, height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Could not load base image for overlay'));
    img.src = src;
  });
}

/**
 * Burn overlay text onto a base image. Returns a PNG data URL.
 * Browser-only (uses document canvas + Image).
 */
export async function renderOverlayToDataUrl(args: {
  baseImage: string;
  overlay: ImageOverlay;
  width: number;
  height: number;
}): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Overlay render requires a browser');
  }
  const { baseImage, overlay, width, height } = args;
  if (!baseImage?.trim()) throw new Error('Pick a base image first');
  if (!overlay.text?.trim() && !overlay.sub?.trim()) {
    throw new Error('Add overlay text first');
  }

  const img = await loadImage(baseImage);
  if (typeof document.fonts?.ready?.then === 'function') {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);
  drawImageCover(
    ctx,
    img,
    width,
    height,
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
  );

  const layout = layoutOverlay(ctx, overlay, width, height);
  const font = getOverlayFont(overlay.fontId);
  const weight = overlay.weight === 'bold' ? '700' : '400';
  const fill = getOverlayColor(overlay.color);
  const pillPadX = Math.round(layout.primaryPx * 0.55);
  const pillPadY = Math.round(layout.primaryPx * 0.35);

  // Scrim band behind text
  if (overlay.styleId === 'scrim') {
    const bandPad = Math.round(layout.primaryPx * 0.8);
    const top = Math.max(0, layout.blockTop - bandPad);
    const bot = Math.min(
      height,
      layout.blockTop + layout.blockHeight + bandPad,
    );
    const grd = ctx.createLinearGradient(0, top, 0, bot);
    if (overlay.vAlign === 'top') {
      grd.addColorStop(0, 'rgba(0,0,0,0.72)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
    } else if (overlay.vAlign === 'middle') {
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.5, 'rgba(0,0,0,0.65)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.75)');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, top, width, bot - top);
  }

  // Pill background
  if (overlay.styleId === 'pill' && (layout.primaryLines.length || layout.subLines.length)) {
    ctx.font = `${weight} ${layout.primaryPx}px ${font.family}`;
    let maxW = 0;
    for (const line of layout.primaryLines) {
      maxW = Math.max(maxW, ctx.measureText(line).width);
    }
    ctx.font = `400 ${layout.subPx}px ${font.family}`;
    for (const line of layout.subLines) {
      maxW = Math.max(maxW, ctx.measureText(line).width);
    }
    const boxW = maxW + pillPadX * 2;
    const boxH = layout.blockHeight;
    let boxX =
      layout.align === 'left'
        ? layout.pad
        : layout.align === 'right'
          ? width - layout.pad - boxW
          : (width - boxW) / 2;
    const boxY = layout.blockTop;
    const r = Math.min(24, Math.round(layout.primaryPx * 0.45));
    ctx.fillStyle = 'rgba(244, 240, 232, 0.92)';
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, r);
    ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, r);
    ctx.arcTo(boxX, boxY + boxH, boxX, boxY, r);
    ctx.arcTo(boxX, boxY, boxX + boxW, boxY, r);
    ctx.closePath();
    ctx.fill();
  }

  ctx.textAlign = layout.align;
  ctx.textBaseline = 'top';

  let y = layout.blockTop + (overlay.styleId === 'pill' ? pillPadY : 0);

  // Primary lines
  ctx.font = `${weight} ${layout.primaryPx}px ${font.family}`;
  ctx.fillStyle =
    overlay.styleId === 'pill' && overlay.color === 'white'
      ? '#1C1917'
      : fill;

  if (overlay.styleId === 'shadow') {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.round(layout.primaryPx * 0.35);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(layout.primaryPx * 0.08);
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  for (const line of layout.primaryLines) {
    ctx.fillText(line, layout.textX, y);
    y += layout.lineHeight;
  }

  // Brass accent under primary
  if (overlay.styleId === 'brass-line' && layout.primaryLines.length) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    const ruleW = Math.min(layout.maxTextWidth * 0.35, layout.primaryPx * 4);
    const ruleH = Math.max(3, Math.round(layout.primaryPx * 0.08));
    const ruleY = y + Math.round(layout.primaryPx * 0.08);
    let ruleX =
      layout.align === 'left'
        ? layout.textX
        : layout.align === 'right'
          ? layout.textX - ruleW
          : layout.textX - ruleW / 2;
    ctx.fillStyle = '#B08D57';
    ctx.fillRect(ruleX, ruleY, ruleW, ruleH);
    y = ruleY + ruleH + Math.round(layout.primaryPx * 0.2);
  } else if (layout.subLines.length) {
    y += Math.round(layout.primaryPx * 0.2);
  }

  // Sub lines
  if (layout.subLines.length) {
    ctx.shadowColor =
      overlay.styleId === 'shadow' ? 'rgba(0,0,0,0.45)' : 'transparent';
    ctx.shadowBlur =
      overlay.styleId === 'shadow' ? Math.round(layout.subPx * 0.3) : 0;
    ctx.font = `400 ${layout.subPx}px ${font.family}`;
    ctx.fillStyle =
      overlay.styleId === 'pill'
        ? 'rgba(28, 25, 23, 0.75)'
        : overlay.color === 'white'
          ? 'rgba(255,255,255,0.88)'
          : fill;
    for (const line of layout.subLines) {
      ctx.fillText(line, layout.textX, y);
      y += layout.subLineHeight;
    }
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  return canvas.toDataURL('image/png');
}
