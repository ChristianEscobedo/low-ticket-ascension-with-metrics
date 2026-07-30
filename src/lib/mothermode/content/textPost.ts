/**
 * Text overlay posts: the native viral big-text-on-screen surface seen on
 * reels, TikTok slides, stories, and feed posts. Like the FB color-block, the
 * visual renders natively (no image model) — helpers resolve the style against
 * the brand swatches, scale the type so the line always fits, and render a
 * shareable PNG (vertical 9:16 or square 1:1) for schedulers and export.
 */
import {
  COLOR_BLOCK_SWATCHES,
  DEFAULT_TWEET_HANDLE,
  TEXT_POST_MAX_CHARS,
} from './constants';
import { resolveColorBlockSwatch } from './colorBlock';
import type { ContentPiece, ContentPlatform, TextPostStyle } from './types';

/** The swatch id textposts default to: the dark viral look. */
export const DEFAULT_TEXT_POST_SWATCH = 'charcoal';

/** The surface aspect for a platform: vertical on TikTok, square elsewhere. */
export function defaultTextPostAspect(
  platform?: ContentPlatform,
): '9:16' | '1:1' {
  return platform === 'tiktok' ? '9:16' : '1:1';
}

/**
 * The active textpost style for a piece: explicit `textPost` wins, else the
 * default dark swatch with the platform-derived aspect so every textpost still
 * previews on-brand.
 */
export function textPostStyleFor(piece: ContentPiece): TextPostStyle {
  const base: Partial<TextPostStyle> = piece.textPost ?? {};
  const swatch =
    COLOR_BLOCK_SWATCHES.find((s) => s.id === DEFAULT_TEXT_POST_SWATCH) ??
    COLOR_BLOCK_SWATCHES[0];
  return {
    bg: base.bg ?? swatch.bg,
    gradient: base.gradient ?? swatch.gradient,
    fontScale: base.fontScale,
    aspect: base.aspect ?? defaultTextPostAspect(piece.platform),
    showHandle: base.showHandle ?? true,
    align: base.align ?? 'center',
  };
}

/** CSS background (solid or linear-gradient) for the preview surface. */
export function textPostBackground(style?: TextPostStyle): string {
  const swatch = resolveColorBlockSwatch(style);
  const stops =
    swatch.gradient && swatch.gradient.length >= 2
      ? swatch.gradient
      : [swatch.bg, swatch.bg];
  return `linear-gradient(160deg, ${stops.join(', ')})`;
}

/** Text color that stays legible on the resolved background. */
export function textPostTextColor(style?: TextPostStyle): string {
  return resolveColorBlockSwatch(style).text;
}

/**
 * Auto font scale for the big line: full size when short, stepping down as the
 * text approaches the 220-char ceiling so the block never overflows.
 */
export function textPostFontScale(text: string, style?: TextPostStyle): number {
  const explicit = style?.fontScale;
  const base = typeof explicit === 'number' && explicit > 0 ? explicit : 1;
  const len = text.trim().length;
  let step = 1;
  if (len > 160) step = 0.68;
  else if (len > 110) step = 0.78;
  else if (len > 60) step = 0.9;
  return Math.max(0.55, Math.min(1.4, base * step));
}

/** True when the line is short enough to stay a thumb-stopping overlay. */
export function fitsTextPost(text: string): boolean {
  return text.trim().length <= TEXT_POST_MAX_CHARS;
}

/** Pixel dimensions for a textpost aspect at render size. */
export function textPostDimensions(aspect: '9:16' | '1:1'): {
  width: number;
  height: number;
} {
  return aspect === '9:16'
    ? { width: 1080, height: 1920 }
    : { width: 1080, height: 1080 };
}

/**
 * Render a textpost to a PNG data URL (for schedulers / export). Browser-only:
 * uses an offscreen canvas.
 */
export async function renderTextPostToDataUrl(args: {
  text: string;
  style?: TextPostStyle;
  /** Fallback handle when the style doesn't disable the watermark. */
  handle?: string;
}): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Textpost render requires a browser');
  }
  const { text } = args;
  const style: TextPostStyle = args.style ?? {
    bg: '#1C1917',
    aspect: '1:1',
    showHandle: true,
    align: 'center',
  };
  const { width, height } = textPostDimensions(style.aspect ?? '1:1');
  const swatch = resolveColorBlockSwatch(style);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // Background (solid or gradient).
  const stops =
    swatch.gradient && swatch.gradient.length >= 2
      ? swatch.gradient
      : [swatch.bg, swatch.bg];
  const grad = ctx.createLinearGradient(0, 0, width, height);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (typeof document.fonts?.ready?.then === 'function') {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  // Big bold text, auto-scaled like the native surface.
  const scale = textPostFontScale(text, style);
  const fontPx = Math.round(width * 0.085 * scale);
  const pad = Math.round(width * 0.09);
  const maxW = width - pad * 2;
  const align = style.align ?? 'center';
  ctx.font = `800 ${fontPx}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  ctx.textAlign = align;
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

  const lineH = Math.round(fontPx * 1.24);
  const blockH = lines.length * lineH;
  let y = height / 2 - blockH / 2 + lineH / 2;
  const x = align === 'center' ? width / 2 : pad;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineH;
  }

  // Small @handle watermark, bottom-center.
  if (style.showHandle !== false) {
    ctx.font = `600 ${Math.round(width * 0.026)}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.72;
    ctx.fillText(args.handle ?? DEFAULT_TWEET_HANDLE, width / 2, height - Math.round(height * 0.05));
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL('image/png');
}
