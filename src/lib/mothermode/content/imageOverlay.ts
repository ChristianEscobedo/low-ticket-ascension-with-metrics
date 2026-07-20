/**
 * Text-on-image overlay recipes + canvas burn-in for stories, reels, and feed
 * stills. Pure layout helpers are unit-testable; render runs in the browser.
 *
 * v2: freeform x/y, fontScale, tracking, leading, maxWidthPct, transform,
 * custom hex, expanded fonts/weights/styles, shadow/bg opacity toggles.
 */
import { PLATFORM_SIZE_PRESETS } from './platformSizes';
import type { ContentPiece } from './types';
import {
  clampIndex,
  reviewHooks,
  reviewImages,
  type PieceReview,
} from './review';

/** Vertical band for the text block (snap presets + scrim direction). */
export type OverlayVAlign = 'top' | 'middle' | 'bottom';
/** Horizontal alignment of glyphs inside the text block. */
export type OverlayHAlign = 'left' | 'center' | 'right';
export type OverlaySize = 's' | 'm' | 'l' | 'xl';
export type OverlayWeight = 'regular' | 'medium' | 'bold' | 'black';
/** Named swatches; use customHex when color === 'custom'. */
export type OverlayColor =
  | 'white'
  | 'soft-white'
  | 'bone'
  | 'ink'
  | 'charcoal'
  | 'brass'
  | 'rose'
  | 'sage'
  | 'custom';

export type OverlayFontId =
  | 'sans'
  | 'serif'
  | 'mono'
  | 'display'
  | 'condensed'
  | 'rounded';

export type OverlayStyleId =
  | 'none'
  | 'shadow'
  | 'pill'
  | 'box'
  | 'scrim'
  | 'brass-line'
  | 'outline'
  | 'bar'
  | 'glow';

export type OverlayTransform = 'none' | 'uppercase' | 'lowercase';

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
  /** When color is custom, #RRGGBB. */
  customHex?: string;
  vAlign: OverlayVAlign;
  hAlign: OverlayHAlign;
/**
   * Freeform anchor of the text block as 0–1 of frame (not top-left).
   * Placement uses hAlign/vAlign as the anchor side:
   * center+middle → point is the block center; left+top → point is top-left; etc.
   * When set, overrides snap band placement (align still affects glyph alignment).
   */
  x?: number;
  y?: number;

  /** Multiplier on size tier font (0.7–1.4). */
  fontScale?: number;
  /** Letter-spacing as em fraction (−0.05–0.2). */
  tracking?: number;
  /** Line-height multiplier (1.0–1.6). */
  leading?: number;
  /** Max text block width as fraction of frame (0.4–0.94). */
  maxWidthPct?: number;
  transform?: OverlayTransform;
  /** Drop shadow strength 0–1 (also used by glow). */
  shadowStrength?: number;
  /** Background fill opacity for pill/box (0–1). */
  bgOpacity?: number;
  /** Overall text fill opacity (0–1). */
  textOpacity?: number;
  /**
   * When false, live preview hides the type block and Save will not burn text
   * (use when the base image already has type baked in). Default true.
   */
  enabled?: boolean;
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
    id: 'display',
    label: 'Display',
    family:
      'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif',
  },
  {
    id: 'condensed',
    label: 'Condensed',
    family:
      '"Arial Narrow", "Helvetica Condensed", "Roboto Condensed", Impact, Haettenschweiler, sans-serif',
  },
  {
    id: 'rounded',
    label: 'Rounded',
    family:
      '"Segoe UI Rounded", "SF Pro Rounded", "Nunito", "Varela Round", ui-rounded, system-ui, sans-serif',
  },
  {
    id: 'mono',
    label: 'Mono',
    family:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },
];

export const OVERLAY_STYLES: OverlayStyleOption[] = [
  { id: 'none', label: 'None', hint: 'Flat type, no effect' },
  {
    id: 'shadow',
    label: 'Shadow',
    hint: 'Soft drop shadow under glyphs',
  },
  {
    id: 'glow',
    label: 'Glow',
    hint: 'Soft light halo around type',
  },
  {
    id: 'outline',
    label: 'Outline',
    hint: 'Stroked glyphs for busy backgrounds',
  },
  {
    id: 'pill',
    label: 'Pill',
    hint: 'Rounded bone box behind the lines',
  },
  {
    id: 'box',
    label: 'Box',
    hint: 'Solid rectangle behind the block',
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
  {
    id: 'bar',
    label: 'Bar',
    hint: 'Solid left accent bar',
  },
];

export const OVERLAY_SIZES: { id: OverlaySize; label: string }[] = [
  { id: 's', label: 'S' },
  { id: 'm', label: 'M' },
  { id: 'l', label: 'L' },
  { id: 'xl', label: 'XL' },
];

export const OVERLAY_WEIGHTS: { id: OverlayWeight; label: string; css: string }[] =
  [
    { id: 'regular', label: 'Regular', css: '400' },
    { id: 'medium', label: 'Medium', css: '500' },
    { id: 'bold', label: 'Bold', css: '700' },
    { id: 'black', label: 'Black', css: '900' },
  ];

export const OVERLAY_COLORS: {
  id: OverlayColor;
  label: string;
  hex: string;
}[] = [
  { id: 'white', label: 'White', hex: '#FFFFFF' },
  { id: 'soft-white', label: 'Soft', hex: '#F5F5F4' },
  { id: 'bone', label: 'Bone', hex: '#F4F0E8' },
  { id: 'ink', label: 'Ink', hex: '#1C1917' },
  { id: 'charcoal', label: 'Charcoal', hex: '#44403C' },
  { id: 'brass', label: 'Brass', hex: '#B08D57' },
  { id: 'rose', label: 'Rose', hex: '#E8B4B8' },
  { id: 'sage', label: 'Sage', hex: '#A3B18A' },
  { id: 'custom', label: 'Custom', hex: '#FFFFFF' },
];

export const OVERLAY_TRANSFORMS: {
  id: OverlayTransform;
  label: string;
}[] = [
  { id: 'none', label: 'Aa' },
  { id: 'uppercase', label: 'AA' },
  { id: 'lowercase', label: 'aa' },
];

/** Fraction of frame height used as primary font size. */
export const OVERLAY_SIZE_FRAC: Record<OverlaySize, number> = {
  s: 0.035,
  m: 0.048,
  l: 0.062,
  xl: 0.078,
};


const SAFE = 0.06; // 6% padding from edges

const WEIGHT_CSS: Record<OverlayWeight, string> = {
  regular: '400',
  medium: '500',
  bold: '700',
  black: '900',
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

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
    fontScale: 1,
    tracking: 0,
    leading: 1.2,
    maxWidthPct: 0.88,
    transform: 'none',
    shadowStrength: 0.55,
    bgOpacity: 0.92,
    textOpacity: 1,
    enabled: true,
    ...partial,
  };
}

/**
 * Primary font size in px for a frame of the given height — shared by canvas
 * burn-in and the live CSS preview so they stay visually matched.
 */
export function overlayPrimaryPx(
  frameHeight: number,
  size: OverlaySize,
  fontScale = 1,
): number {
  const scale = clamp(fontScale, 0.7, 1.4);
  const frac = OVERLAY_SIZE_FRAC[size] ?? OVERLAY_SIZE_FRAC.l;
  return Math.max(14, Math.round(frameHeight * frac * scale));
}

/** Sub line size derived from primary (same ratio as canvas). */
export function overlaySubPx(primaryPx: number): number {
  return Math.max(12, Math.round(primaryPx * 0.55));
}


export function getOverlayFont(id: OverlayFontId): OverlayFontOption {
  return OVERLAY_FONTS.find((f) => f.id === id) ?? OVERLAY_FONTS[0];
}

export function getOverlayWeightCss(w: OverlayWeight): string {
  return WEIGHT_CSS[w] ?? '700';
}

/** Resolve fill hex from named color or customHex. */
export function getOverlayColor(overlay: Pick<ImageOverlay, 'color' | 'customHex'>): string {
  if (overlay.color === 'custom' && overlay.customHex?.trim()) {
    const h = overlay.customHex.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)) return h;
  }
  return OVERLAY_COLORS.find((c) => c.id === overlay.color)?.hex ?? '#FFFFFF';
}

/** Apply text transform for measure + draw. */
export function applyOverlayTransform(
  text: string,
  transform: OverlayTransform | undefined,
): string {
  if (!text) return '';
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  return text;
}

/**
 * Snap preset → normalized freeform anchor coords.
 * x/y are the anchor point (center of frame for center/middle), not block top-left.
 */
export function snapPosition(
  v: OverlayVAlign,
  h: OverlayHAlign,
): { x: number; y: number; vAlign: OverlayVAlign; hAlign: OverlayHAlign } {
  const x = h === 'left' ? SAFE : h === 'right' ? 1 - SAFE : 0.5;
  const y = v === 'top' ? SAFE : v === 'middle' ? 0.5 : 1 - SAFE;
  return { x, y, vAlign: v, hAlign: h };
}

/**
 * CSS translate for freeform anchor so preview matches canvas burn-in.
 * Anchor (x,y) + hAlign/vAlign → same box placement as layoutOverlay.
 */
export function freeformCssTransform(
  hAlign: OverlayHAlign,
  vAlign: OverlayVAlign,
): string {
  const tx =
    hAlign === 'left' ? '0%' : hAlign === 'right' ? '-100%' : '-50%';
  const ty =
    vAlign === 'top' ? '0%' : vAlign === 'bottom' ? '-100%' : '-50%';
  return `translate(${tx}, ${ty})`;
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

  const activeIdx = clampIndex(
    review.imageIndex,
    Math.max(
      reviewImages(review).length,
      piece.slides?.length ?? 0,
      review.framePack?.frames?.length ?? 0,
      1,
    ),
  );
  const packFrame = review.framePack?.frames?.[activeIdx];
  const slide = piece.slides?.[activeIdx] ?? piece.slides?.[0];
  const beatOn =
    review.videoScript?.beats?.find((b) => b.onScreen?.trim())?.onScreen ||
    piece.script?.find((b) => b.onScreen?.trim())?.onScreen ||
    '';

  if (
    ['story', 'carousel', 'idea'].includes(piece.format) &&
    (packFrame?.text?.trim() || slide?.text)
  ) {
    return {
      text: (packFrame?.text ?? slide?.text ?? '').trim(),
      sub: (packFrame?.sub ?? slide?.sub ?? '').trim(),
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
  // Preserve intentional newlines as hard breaks.
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const raw = para.replace(/[ \t]+/g, ' ').trim();
    if (!raw) {
      if (paragraphs.length > 1) lines.push('');
      continue;
    }
    const words = raw.split(' ');
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width <= maxWidth) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
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
  }
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
  blockLeft: number;
  blockWidth: number;
  primaryLines: string[];
  subLines: string[];
  blockHeight: number;
  align: CanvasTextAlign;
  trackingPx: number;
  usesFreeform: boolean;
}

function measureBlockWidth(
  ctx: CanvasRenderingContext2D,
  primaryLines: string[],
  subLines: string[],
  primaryPx: number,
  subPx: number,
  weight: string,
  family: string,
  trackingPx: number,
): number {
  let maxW = 0;
  ctx.font = `${weight} ${primaryPx}px ${family}`;
  for (const line of primaryLines) {
    maxW = Math.max(maxW, ctx.measureText(line).width + trackingPx * Math.max(0, line.length - 1));
  }
  ctx.font = `400 ${subPx}px ${family}`;
  for (const line of subLines) {
    maxW = Math.max(maxW, ctx.measureText(line).width + trackingPx * 0.6 * Math.max(0, line.length - 1));
  }
  return maxW;
}

/** Compute text block geometry for a canvas size + overlay recipe. */
export function layoutOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: ImageOverlay,
  width: number,
  height: number,
): OverlayLayout {
  const pad = Math.round(Math.min(width, height) * SAFE);
  const maxWidthPct = clamp(overlay.maxWidthPct ?? 0.88, 0.4, 0.94);
  const maxTextWidth = Math.round(width * maxWidthPct);
  const primaryPx = overlayPrimaryPx(
    height,
    overlay.size,
    overlay.fontScale ?? 1,
  );
  const subPx = overlaySubPx(primaryPx);

  const leading = clamp(overlay.leading ?? 1.2, 1.0, 1.6);
  const lineHeight = Math.round(primaryPx * leading);
  const subLineHeight = Math.round(subPx * Math.max(1.15, leading));
  const font = getOverlayFont(overlay.fontId);
  const weight = getOverlayWeightCss(overlay.weight);
  const trackingEm = clamp(overlay.tracking ?? 0, -0.05, 0.2);
  const trackingPx = primaryPx * trackingEm;
  const transform = overlay.transform ?? 'none';

  const primarySrc = applyOverlayTransform(overlay.text || '', transform);
  const subSrc = applyOverlayTransform(overlay.sub || '', transform);

  ctx.font = `${weight} ${primaryPx}px ${font.family}`;
  const primaryLines = wrapLines(ctx, primarySrc, maxTextWidth);
  ctx.font = `400 ${subPx}px ${font.family}`;
  const subLines = wrapLines(ctx, subSrc, maxTextWidth);

  const gap =
    primaryLines.length && subLines.length ? Math.round(primaryPx * 0.35) : 0;
  const styleExtra =
    overlay.styleId === 'pill' || overlay.styleId === 'box'
      ? Math.round(primaryPx * 0.7)
      : overlay.styleId === 'brass-line' && primaryLines.length
        ? Math.round(primaryPx * 0.45)
        : overlay.styleId === 'bar'
          ? Math.round(primaryPx * 0.15)
          : 0;
  const blockHeight =
    primaryLines.length * lineHeight +
    gap +
    subLines.length * subLineHeight +
    styleExtra;

  const contentW = measureBlockWidth(
    ctx,
    primaryLines,
    subLines,
    primaryPx,
    subPx,
    weight,
    font.family,
    trackingPx,
  );
  const boxPadX =
    overlay.styleId === 'pill' || overlay.styleId === 'box'
      ? Math.round(primaryPx * 0.55)
      : overlay.styleId === 'bar'
        ? Math.round(primaryPx * 0.45)
        : 0;
  const blockWidth = Math.min(
    maxTextWidth + boxPadX * 2,
    Math.max(contentW + boxPadX * 2, primaryPx * 2),
  );

  const usesFreeform =
    typeof overlay.x === 'number' &&
    Number.isFinite(overlay.x) &&
    typeof overlay.y === 'number' &&
    Number.isFinite(overlay.y);

  let blockLeft: number;
  let blockTop: number;
  let align: CanvasTextAlign =
    overlay.hAlign === 'left'
      ? 'left'
      : overlay.hAlign === 'right'
        ? 'right'
        : 'center';

if (usesFreeform) {
    // x/y are the anchor point; hAlign/vAlign choose which edge/center sits on it.
    const ax = clamp01(overlay.x as number) * width;
    const ay = clamp01(overlay.y as number) * height;
    if (align === 'left') blockLeft = Math.round(ax);
    else if (align === 'right') blockLeft = Math.round(ax - blockWidth);
    else blockLeft = Math.round(ax - blockWidth / 2);

    if (overlay.vAlign === 'top') blockTop = Math.round(ay);
    else if (overlay.vAlign === 'bottom')
      blockTop = Math.round(ay - blockHeight);
    else blockTop = Math.round(ay - blockHeight / 2);

    // Soft clamp — keep as much of the block on-canvas without shifting anchor bias.
    const minL = pad * 0.15;
    const maxL = width - pad * 0.15 - blockWidth;
    const minT = pad * 0.15;
    const maxT = height - pad * 0.15 - blockHeight;
    if (maxL >= minL) blockLeft = clamp(blockLeft, minL, maxL);
    if (maxT >= minT) blockTop = clamp(blockTop, minT, maxT);
  } else {

    if (overlay.vAlign === 'top') blockTop = pad;
    else if (overlay.vAlign === 'middle')
      blockTop = Math.round((height - blockHeight) / 2);
    else blockTop = height - pad - blockHeight;

    if (align === 'left') blockLeft = pad;
    else if (align === 'right') blockLeft = width - pad - blockWidth;
    else blockLeft = Math.round((width - blockWidth) / 2);
  }

  const textX =
    align === 'left'
      ? blockLeft + boxPadX
      : align === 'right'
        ? blockLeft + blockWidth - boxPadX
        : blockLeft + blockWidth / 2;

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
    blockLeft,
    blockWidth,
    primaryLines,
    subLines,
    blockHeight,
    align,
    trackingPx,
    usesFreeform,
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

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return `rgba(255,255,255,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillTextLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  trackingPx: number,
  align: CanvasTextAlign,
): void {
  if (!trackingPx) {
    ctx.fillText(line, x, y);
    return;
  }
  // Manual tracking
  const chars = line.split('');
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total =
    widths.reduce((a, b) => a + b, 0) +
    trackingPx * Math.max(0, chars.length - 1);
  let cx =
    align === 'left'
      ? x
      : align === 'right'
        ? x - total
        : x - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += widths[i] + trackingPx;
  }
  ctx.textAlign = prev;
}

function strokeTextLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  trackingPx: number,
  align: CanvasTextAlign,
): void {
  if (!trackingPx) {
    ctx.strokeText(line, x, y);
    return;
  }
  const chars = line.split('');
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total =
    widths.reduce((a, b) => a + b, 0) +
    trackingPx * Math.max(0, chars.length - 1);
  let cx =
    align === 'left'
      ? x
      : align === 'right'
        ? x - total
        : x - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.strokeText(chars[i], cx, y);
    cx += widths[i] + trackingPx;
  }
  ctx.textAlign = prev;
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
  const weight = getOverlayWeightCss(overlay.weight);
  const fillHex = getOverlayColor(overlay);
  const textOpacity = clamp(overlay.textOpacity ?? 1, 0.15, 1);
  const bgOpacity = clamp(overlay.bgOpacity ?? 0.92, 0.1, 1);
  const shadowStrength = clamp(overlay.shadowStrength ?? 0.55, 0, 1);
  const pillPadX = Math.round(layout.primaryPx * 0.55);
  const pillPadY = Math.round(layout.primaryPx * 0.35);
  const boxed =
    overlay.styleId === 'pill' || overlay.styleId === 'box';

  // Scrim band behind text
  if (overlay.styleId === 'scrim') {
    const bandPad = Math.round(layout.primaryPx * 0.8);
    const top = Math.max(0, layout.blockTop - bandPad);
    const bot = Math.min(
      height,
      layout.blockTop + layout.blockHeight + bandPad,
    );
    const grd = ctx.createLinearGradient(0, top, 0, bot);
    const bandCenter =
      (layout.blockTop + layout.blockHeight / 2) / height;
    if (bandCenter < 0.35) {
      grd.addColorStop(0, 'rgba(0,0,0,0.72)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
    } else if (bandCenter > 0.65) {
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.75)');
    } else {
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.5, 'rgba(0,0,0,0.65)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, top, width, bot - top);
  }

  // Pill / box background
  if (boxed && (layout.primaryLines.length || layout.subLines.length)) {
    const boxW = layout.blockWidth;
    const boxH = layout.blockHeight;
    const boxX = layout.blockLeft;
    const boxY = layout.blockTop;
    const r =
      overlay.styleId === 'pill'
        ? Math.min(24, Math.round(layout.primaryPx * 0.45))
        : Math.min(8, Math.round(layout.primaryPx * 0.12));
    ctx.fillStyle = hexToRgba('#F4F0E8', bgOpacity);
    roundedRect(ctx, boxX, boxY, boxW, boxH, r);
    ctx.fill();
  }

  // Left accent bar
  if (overlay.styleId === 'bar' && (layout.primaryLines.length || layout.subLines.length)) {
    const barW = Math.max(4, Math.round(layout.primaryPx * 0.12));
    ctx.fillStyle = '#B08D57';
    ctx.fillRect(
      layout.blockLeft,
      layout.blockTop,
      barW,
      layout.blockHeight,
    );
  }

  ctx.textAlign = layout.align;
  ctx.textBaseline = 'top';

  let y = layout.blockTop + (boxed ? pillPadY : 0);
  const forceInkOnBox =
    boxed &&
    (overlay.color === 'white' ||
      overlay.color === 'soft-white' ||
      overlay.color === 'bone');
  const primaryFill = forceInkOnBox ? '#1C1917' : fillHex;
  const useShadow =
    overlay.styleId === 'shadow' ||
    (overlay.styleId !== 'none' &&
      overlay.styleId !== 'outline' &&
      shadowStrength > 0 &&
      overlay.styleId === 'glow');

  // Primary lines
  ctx.font = `${weight} ${layout.primaryPx}px ${font.family}`;
  ctx.fillStyle = hexToRgba(primaryFill, textOpacity);

  if (overlay.styleId === 'shadow' || overlay.styleId === 'glow') {
    const blur =
      overlay.styleId === 'glow'
        ? Math.round(layout.primaryPx * 0.55 * shadowStrength)
        : Math.round(layout.primaryPx * 0.35 * shadowStrength);
    ctx.shadowColor =
      overlay.styleId === 'glow'
        ? hexToRgba(fillHex, 0.65 * shadowStrength)
        : `rgba(0,0,0,${0.55 * shadowStrength})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY =
      overlay.styleId === 'glow'
        ? 0
        : Math.round(layout.primaryPx * 0.08);
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  if (overlay.styleId === 'outline') {
    ctx.lineWidth = Math.max(2, Math.round(layout.primaryPx * 0.08));
    ctx.strokeStyle = hexToRgba('#0a0a0a', Math.min(1, textOpacity + 0.1));
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
  }

  for (const line of layout.primaryLines) {
    if (overlay.styleId === 'outline') {
      strokeTextLine(
        ctx,
        line,
        layout.textX,
        y,
        layout.trackingPx,
        layout.align,
      );
    }
    fillTextLine(
      ctx,
      line,
      layout.textX,
      y,
      layout.trackingPx,
      layout.align,
    );
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
    if (overlay.styleId === 'shadow' || overlay.styleId === 'glow') {
      ctx.shadowColor =
        overlay.styleId === 'glow'
          ? hexToRgba(fillHex, 0.5 * shadowStrength)
          : `rgba(0,0,0,${0.45 * shadowStrength})`;
      ctx.shadowBlur =
        overlay.styleId === 'glow'
          ? Math.round(layout.subPx * 0.45 * shadowStrength)
          : Math.round(layout.subPx * 0.3 * shadowStrength);
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.font = `400 ${layout.subPx}px ${font.family}`;
    const subFill = boxed
      ? 'rgba(28, 25, 23, 0.75)'
      : overlay.color === 'white' || overlay.color === 'soft-white'
        ? hexToRgba(fillHex, textOpacity * 0.88)
        : hexToRgba(fillHex, textOpacity);
    ctx.fillStyle = subFill;
    const subTrack = layout.trackingPx * 0.6;
    for (const line of layout.subLines) {
      if (overlay.styleId === 'outline') {
        ctx.lineWidth = Math.max(1, Math.round(layout.subPx * 0.08));
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        strokeTextLine(ctx, line, layout.textX, y, subTrack, layout.align);
      }
      fillTextLine(ctx, line, layout.textX, y, subTrack, layout.align);
      y += layout.subLineHeight;
    }
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  void useShadow;

  return canvas.toDataURL('image/png');
}

/** Serialize recipe for PieceReview.overlay persistence. */
export function toStoredOverlay(o: ImageOverlay): {
  text: string;
  sub?: string;
  fontId: string;
  styleId: string;
  size: string;
  weight: string;
  color: string;
  customHex?: string;
  vAlign: string;
  hAlign: string;
  x?: number;
  y?: number;
  fontScale?: number;
  tracking?: number;
  leading?: number;
  maxWidthPct?: number;
  transform?: string;
  shadowStrength?: number;
  bgOpacity?: number;
  textOpacity?: number;
  enabled?: boolean;
  baseImage?: string;
  renderedUrl?: string;
  updatedAt?: string;
} {
  return {
    text: o.text,
    sub: o.sub,
    fontId: o.fontId,
    styleId: o.styleId,
    size: o.size,
    weight: o.weight,
    color: o.color,
    customHex: o.customHex,
    vAlign: o.vAlign,
    hAlign: o.hAlign,
    x: o.x,
    y: o.y,
    fontScale: o.fontScale,
    tracking: o.tracking,
    leading: o.leading,
    maxWidthPct: o.maxWidthPct,
    transform: o.transform,
    shadowStrength: o.shadowStrength,
    bgOpacity: o.bgOpacity,
    textOpacity: o.textOpacity,
    enabled: o.enabled !== false,
    baseImage: o.baseImage,
    renderedUrl: o.renderedUrl,
    updatedAt: o.updatedAt,
  };
}


