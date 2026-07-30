/**
 * Facebook color-block posts: the native big-text-on-color surface. Helpers
 * resolve a piece's ColorBlockStyle against the brand swatches, scale the type
 * the way FB does (smaller as the text lengthens), and render a shareable
 * square image for schedulers that cannot post the native text-only unit.
 */
import {
  COLOR_BLOCK_SWATCHES,
  COLOR_BLOCK_MAX_CHARS,
  DEFAULT_COLOR_BLOCK_SWATCH,
  type ColorBlockSwatch,
} from './constants';
import type { ColorBlockStyle, ContentPiece } from './types';

/** The swatch matching a piece/explicit style, falling back to the default. */
export function resolveColorBlockSwatch(
  style?: ColorBlockStyle,
): ColorBlockSwatch {
  if (!style) {
    return (
      COLOR_BLOCK_SWATCHES.find((s) => s.id === DEFAULT_COLOR_BLOCK_SWATCH) ??
      COLOR_BLOCK_SWATCHES[0]
    );
  }
  const byBg = COLOR_BLOCK_SWATCHES.find((s) => s.bg === style.bg);
  if (byBg) return { ...byBg, gradient: style.gradient ?? byBg.gradient };
  return {
    id: 'custom',
    label: 'Custom',
    bg: style.bg,
    gradient: style.gradient,
    text: '#FFFFFF',
  };
}

/**
 * The active color-block style for a piece: explicit `colorBlock` wins, else
 * the default swatch so every color-block piece still previews on-brand.
 */
export function colorBlockStyleFor(piece: ContentPiece): ColorBlockStyle {
  if (piece.colorBlock?.bg) return piece.colorBlock;
  const swatch = COLOR_BLOCK_SWATCHES.find(
    (s) => s.id === DEFAULT_COLOR_BLOCK_SWATCH,
  );
  return { bg: swatch?.bg ?? '#532B3C', gradient: swatch?.gradient };
}

/** CSS background (solid or linear-gradient) for the preview surface. */
export function colorBlockBackground(style?: ColorBlockStyle): string {
  const swatch = resolveColorBlockSwatch(style);
  const stops = swatch.gradient && swatch.gradient.length >= 2
    ? swatch.gradient
    : [swatch.bg, swatch.bg];
  return `linear-gradient(160deg, ${stops.join(', ')})`;
}

/** Text color that stays legible on the resolved background. */
export function colorBlockTextColor(style?: ColorBlockStyle): string {
  return resolveColorBlockSwatch(style).text;
}

/**
 * Native-FB-style font scale: full size at short lengths, stepping down as the
 * text approaches the 130-char ceiling so the block never overflows.
 */
export function colorBlockFontScale(text: string, style?: ColorBlockStyle): number {
  const explicit = style?.fontScale;
  const base = typeof explicit === 'number' && explicit > 0 ? explicit : 1;
  const len = text.trim().length;
  let step = 1;
  if (len > 100) step = 0.72;
  else if (len > 70) step = 0.82;
  else if (len > 45) step = 0.92;
  return Math.max(0.6, Math.min(1.4, base * step));
}

/** True when the text is short enough for the native big-text surface. */
export function fitsColorBlock(text: string): boolean {
  return text.trim().length <= COLOR_BLOCK_MAX_CHARS;
}

/**
 * Render a color-block post to a square PNG data URL (for schedulers / export).
 * Browser-only: uses an offscreen canvas.
 */
export async function renderColorBlockToDataUrl(args: {
  text: string;
  style?: ColorBlockStyle;
  size?: number;
}): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Color block render requires a browser');
  }
  const { text, style, size = 1080 } = args;
  const swatch = resolveColorBlockSwatch(style);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // Background (solid or gradient).
  const stops =
    swatch.gradient && swatch.gradient.length >= 2
      ? swatch.gradient
      : [swatch.bg, swatch.bg];
  const grad = ctx.createLinearGradient(0, 0, size, size);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (typeof document.fonts?.ready?.then === 'function') {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  // Big centered bold text, scaled like the native surface.
  const scale = colorBlockFontScale(text, style);
  const fontPx = Math.round(size * 0.11 * scale);
  const pad = Math.round(size * 0.12);
  const maxW = size - pad * 2;
  ctx.font = `700 ${fontPx}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = swatch.text;

  // Word-wrap to the padded width.
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);

  const lineH = Math.round(fontPx * 1.22);
  const blockH = lines.length * lineH;
  let y = size / 2 - blockH / 2 + lineH / 2;
  for (const line of lines) {
    ctx.fillText(line, size / 2, y);
    y += lineH;
  }

  return canvas.toDataURL('image/png');
}
