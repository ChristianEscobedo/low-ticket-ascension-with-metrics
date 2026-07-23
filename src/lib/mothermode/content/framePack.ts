/**
 * Multi-frame packs for carousels, stories, and idea pins.
 *
 * A pack is an ordered list of slide jobs (role, copy, image prompt) bound 1:1
 * to gallery images by index. Mode A generates N separate frames with lookback
 * continuity; Mode B (carousel only) generates one strip/board and splits it.
 */
import type { ContentPiece, ContentSlide } from './types';
import { isMultiFrameFormat } from './platformSizes';

/** How the pack was (or will be) produced. */
export type FramePackMode = 'frames' | 'strip';

/** Aspect locked across every slide in the pack. */
export type FramePackAspect = '1:1' | '4:5' | '9:16';

/** Narrative job of one slide in the sequence. */
export type FrameRole =
  | 'cover'
  | 'hook'
  | 'proof'
  | 'reframe'
  | 'cta'
  | 'other';

/**
 * How a slide's on-frame words get onto the image:
 * - `editor`   → the Text-editor copy is overlaid (burned in) on the render;
 *               the model leaves clean space and draws no type. (Default.)
 * - `ai-prompt`→ the AI writes the words directly into the image prompt so the
 *               render bakes the type in; nothing is overlaid afterward.
 */
export type FrameTextSource = 'editor' | 'ai-prompt';

/** Default text source when a frame doesn't specify one. */
export const DEFAULT_FRAME_TEXT_SOURCE: FrameTextSource = 'editor';

/** One planned / rendered frame in a pack. */
export interface FramePackFrame {
  /** 1-based index matching gallery order. */
  index: number;
  role: FrameRole | string;
  /** On-slide headline (for overlay / design). */
  text?: string;
  /** Quieter supporting line. */
  sub?: string;
  /** Shot / layout direction (human-readable). */
  visual?: string;
  /** Full image-model prompt for this frame (or strip panel). */
  prompt?: string;
  /** Where this slide's words come from. Defaults to `editor` (overlay). */
  textSource?: FrameTextSource;
  /** What this frame locked for the next (continuity). */
  lookbackSummary?: string;
  /** Hosted URL once rendered (mirrors gallery[i] when set). */
  imageUrl?: string;
}

/** The effective text source for a frame (never undefined). */
export function frameTextSource(frame: FramePackFrame): FrameTextSource {
  return frame.textSource === 'ai-prompt' ? 'ai-prompt' : 'editor';
}


/** Connected multi-slide pack stored on PieceReview. */
export interface FramePack {
  mode: FramePackMode;
  format: 'carousel' | 'story' | 'idea' | string;
  slideCount: number;
  aspect: FramePackAspect;
  frames: FramePackFrame[];
  /** Unsplit board/strip URL when mode === 'strip'. */
  stripSource?: string;
  /** Shared system notes (margins, palette) from the planner. */
  systemNotes?: string;
  model?: string;
  generatedAt?: string;
  updatedAt?: string;
}

export const MIN_FRAME_PACK = 2;
export const MAX_FRAME_PACK = 10;

/** Default slide counts by format when catalog has no slides. */
export function defaultSlideCount(format?: string): number {
  if (format === 'story' || format === 'idea') return 3;
  if (format === 'carousel') return 5;
  return 3;
}

/** Default aspect for a multi-frame format. */
export function defaultPackAspect(format?: string): FramePackAspect {
  if (format === 'story' || format === 'idea') return '9:16';
  // Carousel: square is the safest cross-platform default.
  return '1:1';
}

/** Clamp a requested slide count into the supported range. */
export function clampSlideCount(n: number): number {
  const v = Math.round(Number(n) || 0);
  if (!Number.isFinite(v)) return MIN_FRAME_PACK;
  return Math.min(MAX_FRAME_PACK, Math.max(MIN_FRAME_PACK, v));
}

/** Preferred target count: catalog slides, else format default. */
export function targetSlideCount(piece: ContentPiece, override?: number): number {
  if (override != null && Number.isFinite(override)) {
    return clampSlideCount(override);
  }
  const fromCatalog = piece.slides?.length ?? 0;
  if (fromCatalog >= MIN_FRAME_PACK) return clampSlideCount(fromCatalog);
  if (fromCatalog === 1) return clampSlideCount(Math.max(3, fromCatalog));
  return clampSlideCount(defaultSlideCount(piece.format));
}

/** Whether this piece should offer the frame-pack UI. */
export function supportsFramePack(format?: string): boolean {
  return isMultiFrameFormat(format);
}

/** Normalize a role string into a known role when possible. */
export function normalizeFrameRole(raw?: string): FrameRole | string {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return 'other';
  if (s === 'cover' || s === 'title' || s === 'opener') return 'cover';
  if (s === 'hook' || s === 'scroll-stop' || s === 'scrollstop') return 'hook';
  if (s === 'proof' || s === 'evidence' || s === 'stack') return 'proof';
  if (s === 'reframe' || s === 'insight' || s === 'truth') return 'reframe';
  if (s === 'cta' || s === 'close' || s === 'permission') return 'cta';
  return s;
}

/** Build seed frames from catalog slides (no AI). */
export function framesFromCatalogSlides(
  slides: ContentSlide[] | undefined,
  count: number,
): FramePackFrame[] {
  const n = clampSlideCount(count);
  const list = slides ?? [];
  const out: FramePackFrame[] = [];
  for (let i = 0; i < n; i++) {
    const s = list[i];
    const role =
      i === 0
        ? 'cover'
        : i === n - 1
          ? 'cta'
          : i === 1
            ? 'hook'
            : 'proof';
    out.push({
      index: i + 1,
      role,
      text: s?.text?.trim() || undefined,
      sub: s?.sub?.trim() || undefined,
      visual: s?.visual?.trim() || undefined,
      prompt: s?.media?.prompt?.trim() || undefined,
    });
  }
  return out;
}

/** Empty pack shell for a piece (plan not run yet). */
export function emptyFramePack(
  piece: ContentPiece,
  opts?: { slideCount?: number; mode?: FramePackMode; aspect?: FramePackAspect },
): FramePack {
  const slideCount = targetSlideCount(piece, opts?.slideCount);
  const mode =
    opts?.mode ??
    (piece.format === 'carousel' ? 'frames' : 'frames');
  return {
    mode,
    format: piece.format,
    slideCount,
    aspect: opts?.aspect ?? defaultPackAspect(piece.format),
    frames: framesFromCatalogSlides(piece.slides, slideCount),
  };
}

/** Merge AI-planned frames onto a pack, renumbering 1..N. */
export function withPlannedFrames(
  pack: FramePack,
  frames: FramePackFrame[],
  meta?: Partial<Pick<FramePack, 'model' | 'systemNotes' | 'mode' | 'aspect'>>,
): FramePack {
  const normalized = frames
    .filter((f) => f && (f.prompt?.trim() || f.text?.trim() || f.visual?.trim()))
    .slice(0, MAX_FRAME_PACK)
    .map((f, i) => ({
      ...f,
      index: i + 1,
      role: normalizeFrameRole(String(f.role)),
      text: f.text?.trim() || undefined,
      sub: f.sub?.trim() || undefined,
      visual: f.visual?.trim() || undefined,
      prompt: f.prompt?.trim() || undefined,
      textSource: f.textSource === 'ai-prompt' ? ('ai-prompt' as const) : undefined,
      lookbackSummary: f.lookbackSummary?.trim() || undefined,
      imageUrl: f.imageUrl?.trim() || undefined,
    }));

  const slideCount = Math.max(
    MIN_FRAME_PACK,
    normalized.length || pack.slideCount,
  );
  return {
    ...pack,
    ...meta,
    slideCount,
    frames:
      normalized.length > 0
        ? normalized
        : framesFromCatalogSlides(undefined, slideCount),
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Patch one frame (e.g. after render). */
export function patchFrame(
  pack: FramePack,
  index1Based: number,
  patch: Partial<FramePackFrame>,
): FramePack {
  const frames = pack.frames.map((f) =>
    f.index === index1Based ? { ...f, ...patch, index: f.index } : f,
  );
  return { ...pack, frames, updatedAt: new Date().toISOString() };
}

/**
 * Apply rendered image URLs onto pack frames by order.
 * urls[i] → frames[i].imageUrl
 */
export function withFrameImages(
  pack: FramePack,
  urls: string[],
): FramePack {
  const frames = pack.frames.map((f, i) => ({
    ...f,
    imageUrl: urls[i]?.trim() || f.imageUrl,
  }));
  return {
    ...pack,
    frames,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * On-frame image-model prompt for a single frame's first render.
 * - `editor` (default): keep the current prompt as-is; the editor copy is burned
 *   in later as an overlay, so we don't ask the model to draw the type.
 * - `ai-prompt`: fold the slide's words into the prompt so the model renders
 *   legible type directly into the image (nothing gets overlaid afterward).
 */
export function frameImagePrompt(frame: FramePackFrame): string {
  const base = (frame.prompt ?? '').trim();
  if (frameTextSource(frame) !== 'ai-prompt') return base;
  const text = (frame.text ?? '').trim();
  const sub = (frame.sub ?? '').trim();
  if (!text && !sub) return base;
  return [
    base,
    text
      ? `Render this headline as clean, legible, well-composed typography directly in the image: "${text}".`
      : '',
    sub ? `Supporting line beneath it: "${sub}".` : '',
    'Keep the lettering on-brand, editorial, and perfectly readable — no gibberish or garbled text.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Text/sub for overlay at a 0-based gallery index. */
export function slideCopyAt(
  piece: ContentPiece,
  pack: FramePack | undefined,
  imageIndex: number,
): { text: string; sub: string } {
  const i = Math.max(0, Math.floor(imageIndex));
  const fromPack = pack?.frames?.[i];
  // AI baked the words into the render for this frame — nothing to overlay.
  if (fromPack && frameTextSource(fromPack) === 'ai-prompt') {
    return { text: '', sub: '' };
  }
  if (fromPack?.text?.trim()) {
    return {
      text: fromPack.text.trim(),
      sub: (fromPack.sub ?? '').trim(),
    };
  }

  const slide = piece.slides?.[i] ?? piece.slides?.[0];
  if (slide?.text?.trim()) {
    return {
      text: slide.text.trim(),
      sub: (slide.sub ?? '').trim(),
    };
  }
  return { text: '', sub: '' };
}

/**
 * Placeholder frame count for previews when gallery is empty but structure
 * is known (catalog slides or planned pack).
 */
export function structuralFrameCount(
  piece: ContentPiece,
  pack?: FramePack | null,
): number {
  if (pack?.frames?.length) return Math.max(1, pack.frames.length);
  if (pack?.slideCount) return Math.max(1, pack.slideCount);
  const slides = piece.slides?.length ?? 0;
  if (slides > 0) return slides;
  if (supportsFramePack(piece.format)) return defaultSlideCount(piece.format);
  return 1;
}

/** Continuity edit instruction when generating frame N from a seed. */
export function continuityEditPrompt(frame: FramePackFrame, pack: FramePack): string {
  const prior = pack.frames
    .filter((f) => f.index < frame.index)
    .map(
      (f) =>
        `Frame ${f.index} (${f.role}): ${f.lookbackSummary || f.visual || f.text || 'established'}`,
    )
    .join('\n');
  return [
    `Continue this ${pack.format} as frame ${frame.index} of ${pack.slideCount} (${pack.aspect}).`,
    'Keep the same visual system: margins, type-safe zone, palette, light direction, and subject identity from the seed.',
    'Only the narrative beat and focal composition change.',
    frame.role ? `This frame's job: ${frame.role}.` : '',
    frame.text
      ? frameTextSource(frame) === 'ai-prompt'
        ? `Render these on-slide words as clean, legible typography in the image: "${frame.text}"`
        : `On-slide words (leave clean negative space for an overlay; render no type): "${frame.text}"`
      : '',
    frame.sub ? `Supporting line: "${frame.sub}"` : '',

    frame.visual ? `Direction: ${frame.visual}` : '',
    frame.prompt ? `Scene prompt: ${frame.prompt}` : '',
    prior ? `Prior frames locked:\n${prior}` : '',
    'No logos. No tiny illegible text. Premium editorial still, lived-in and calm.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Split a strip/board image into N equal panels (horizontal for carousel).
 * Returns data URLs. Browser-only (uses document/canvas).
 */
export async function splitStripImage(
  sourceUrl: string,
  count: number,
  opts?: { direction?: 'horizontal' | 'vertical'; gutterPx?: number },
): Promise<string[]> {
  const n = clampSlideCount(count);
  const direction = opts?.direction ?? 'horizontal';
  const gutter = Math.max(0, Math.round(opts?.gutterPx ?? 0));

  const img = await loadImage(sourceUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Could not read strip dimensions');

  const out: string[] = [];
  if (direction === 'horizontal') {
    const totalGutter = gutter * (n - 1);
    const panelW = Math.floor((w - totalGutter) / n);
    const panelH = h;
    for (let i = 0; i < n; i++) {
      const sx = i * (panelW + gutter);
      out.push(cropToDataUrl(img, sx, 0, panelW, panelH));
    }
  } else {
    const totalGutter = gutter * (n - 1);
    const panelH = Math.floor((h - totalGutter) / n);
    const panelW = w;
    for (let i = 0; i < n; i++) {
      const sy = i * (panelH + gutter);
      out.push(cropToDataUrl(img, 0, sy, panelW, panelH));
    }
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load strip image'));
    img.src = src;
  });
}

function cropToDataUrl(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, sw);
  canvas.height = Math.max(1, sh);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
}

/** Build a single strip prompt from planned frames (Mode B). */
export function buildStripPrompt(pack: FramePack): string {
  const panels = pack.frames
    .map(
      (f) =>
        `Panel ${f.index} (${f.role}): ${f.visual || f.text || f.prompt || 'beat'}. ${
          f.text ? `Headline space for: "${f.text}".` : ''
        }`,
    )
    .join('\n');
  return [
    `Single multi-panel ${pack.format} contact strip, exactly ${pack.slideCount} equal panels side by side, ${pack.aspect} each panel when split.`,
    'Shared visual system across every panel: same margins, type zone, palette, light, and design language. Clear gutters between panels.',
    'Premium editorial, lived-in MotherMode world. No logos. No tiny illegible text.',
    pack.systemNotes?.trim() || '',
    'Panels in order:',
    panels,
  ]
    .filter(Boolean)
    .join('\n\n');
}
