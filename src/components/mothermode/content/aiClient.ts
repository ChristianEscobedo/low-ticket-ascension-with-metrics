/**
 * Browser-side wrappers for the content hub AI endpoint (/api/mothermode/ai).
 * Each throws a readable Error on failure so the calling control can surface the
 * message inline. The route is admin-gated, so these only succeed for admins.
 */
import type { ContentPiece } from '@/lib/mothermode/content/types';
import type {
  AmplifyTextDimension,
  Perspective,
  Sophistication,
} from '@/lib/mothermode/content/amplify';

/** One part of a multi-part Refine run sent to the server. */
export interface AmplifyPartRequest {
  dimension: AmplifyTextDimension;
  count: number;
  /** Existing items this part should avoid repeating. */
  avoid?: string[];
}

/** The piece context passed to a rewrite so the copy stays on-brief. */
export interface AiContext {
  theme?: string;
  tone?: string;
  platform?: string;
  format?: string;
}

async function postAi(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Drop empty Auto model so the server uses its key-aware default path.
  // Sending model:"" is treated as a string and can confuse override logic.
  const body: Record<string, unknown> = { ...payload };
  if (typeof body.model === 'string' && !body.model.trim()) {
    delete body.model;
  }
  const res = await fetch('/api/mothermode/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok !== true) {
    const msg =
      typeof json.error === 'string' ? json.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}


/** Generate a post image, returning a hosted public URL (the server uploads the
 *  render to Storage so it is renderable and GoHighLevel-postable; it falls back
 *  to a data URL only if hosting is unavailable). An optional model id overrides
 *  the server default; omit it (or pass empty) for Auto. */
export async function aiGenerateImage(
  prompt: string,
  format?: string,
  model?: string,
): Promise<string> {
  const json = await postAi({ action: 'image', prompt, format, model });
  if (typeof json.image !== 'string') throw new Error('No image was returned');
  return json.image;
}

/**
 * Edit a seed image (optionally with reference images for character/logo/etc.)
 * and return a hosted public URL. Seed and references may be data URLs or
 * public http(s) URLs; the server resolves them.
 */
export async function aiEditImage(args: {
  prompt: string;
  seed: string;
  references?: string[];
  format?: string;
  model?: string;
}): Promise<string> {
  const json = await postAi({ action: 'imageEdit', ...args });
  if (typeof json.image !== 'string') throw new Error('No image was returned');
  return json.image;
}


/**
 * Stage one of the image pipeline: turn a version's hook (with optional
 * theme/format context and guides) into N distinct photographic scene prompts.
 * Each returned scene is fed to aiGenerateImage to render and host an image.
 */
export async function aiImagePrompts(args: {
  count: number;
  hook: string;
  guides?: string;
  avoid?: string[];
  context?: AiContext;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<string[]> {
  const json = await postAi({ action: 'imagePrompts', ...args });
  if (!Array.isArray(json.prompts)) throw new Error('No image prompts were returned');
  return json.prompts as string[];
}

/** Rewrite or A/B-variant a single copy field, returning the new text. */
export async function aiRewriteText(args: {
  field: 'hook' | 'caption' | 'body';
  text: string;
  instructions?: string;
  variant?: boolean;
  context?: AiContext;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<string> {
  const json = await postAi({ action: 'rewrite', ...args });
  if (typeof json.text !== 'string') throw new Error('No text was returned');
  return json.text;
}

/** Multiply one piece into a list of hooks, angles, CTAs, or body versions. */
export async function aiAmplify(args: {
  dimension: AmplifyTextDimension;
  count: number;
  source: ContentPiece;
  perspective?: Perspective;
  sophistication?: Sophistication;
  guides?: string;
  context?: AiContext;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<string[]> {
  const json = await postAi({ action: 'amplify', ...args });
  if (!Array.isArray(json.items)) throw new Error('No variants were returned');
  return json.items as string[];
}

/**
 * Multiply one piece across several parts in one run (hooks and CTAs and so on),
 * each with its own count, returning a per-part map of variants. Parts not
 * requested are simply absent, so the caller keeps (locks) the rest of the piece.
 */
export async function aiAmplifyParts(args: {
  parts: AmplifyPartRequest[];
  source: ContentPiece;
  perspective?: Perspective;
  sophistication?: Sophistication;
  guides?: string;
  context?: AiContext;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<Partial<Record<AmplifyTextDimension, string[]>>> {
  const json = await postAi({ action: 'amplifyParts', ...args });
  if (!json.parts || typeof json.parts !== 'object')
    throw new Error('No variants were returned');
  return json.parts as Partial<Record<AmplifyTextDimension, string[]>>;
}

/** One second-by-second beat returned by a video-script run. */
export interface AiVideoScriptBeat {
  startSec: number;
  endSec: number;
  shot?: string;
  onScreen?: string;
  voiceover: string;
  action?: string;
  broll?: string;
  brollPrompt?: string;
}

/**
 * Generate a full second-by-second production script for a reel/video piece.
 * Beats cover 0..totalSeconds with no gaps, with exact voiceover and optional
 * b-roll prompts ready to render.
 */
export async function aiGenerateVideoScript(args: {
  piece: {
    hook: string;
    hooks?: string[];
    caption?: string;
    body?: string[];
    script?: ContentPiece['script'];
    theme: string;
    tone: string;
    platform: string;
    format: string;
  };
  durationSec: number;
  guides?: string;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<{
  beats: AiVideoScriptBeat[];
  totalSeconds: number;
  model?: string;
}> {
  const json = await postAi({ action: 'videoScript', ...args });
  if (!Array.isArray(json.beats) || json.beats.length === 0) {
    throw new Error('No script was returned');
  }
  return {
    beats: json.beats as AiVideoScriptBeat[],
    totalSeconds:
      typeof json.totalSeconds === 'number'
        ? json.totalSeconds
        : args.durationSec,
    model: typeof json.model === 'string' ? json.model : undefined,
  };
}

/** One board returned by a storyboard plan run. */
export interface AiStoryboardBoard {
  index: number;
  title: string;
  scenes: string[];
  imagePrompt: string;
  videoPrompt?: string;
  lookbackSummary: string;
  brollNotes?: string;
}

/**
 * Plan 1–4 connected cinematic storyboard contact sheets for a piece.
 * Board N continues from board N-1 via lookback summaries.
 */
export async function aiGenerateStoryboardPlan(args: {
  piece: {
    hook: string;
    hooks?: string[];
    caption?: string;
    body?: string[];
    script?: ContentPiece['script'];
    theme: string;
    tone: string;
    platform: string;
    format: string;
    brollSeeds?: string[];
  };
  boardCount: number;
  mode: 'narrative' | 'broll';
  guides?: string;
  hasCharacterRef?: boolean;
  hasReferenceImages?: boolean;
  model?: string;
}): Promise<{
  boards: AiStoryboardBoard[];
  boardCount: number;
  mode: 'narrative' | 'broll';
  model?: string;
}> {
  const json = await postAi({ action: 'storyboardPlan', ...args });
  if (!Array.isArray(json.boards) || json.boards.length === 0) {
    throw new Error('No storyboard was returned');
  }
  return {
    boards: json.boards as AiStoryboardBoard[],
    boardCount:
      typeof json.boardCount === 'number' ? json.boardCount : args.boardCount,
    mode: json.mode === 'broll' ? 'broll' : 'narrative',
    model: typeof json.model === 'string' ? json.model : undefined,
  };
}

/** One frame in a carousel/story pack from a variation brief. */
export interface AiVariationFrame {
  index: number;
  role: string;
  prompt: string;
}

/**
 * Convert a creative brief into a master image prompt, alt prompts, and
 * optional multi-frame pack for carousel/story.
 */
export async function aiVariationBrief(args: {
  brief: string;
  platform?: string;
  format?: string;
  hook?: string;
  theme?: string;
  tone?: string;
  altCount?: number;
  frameCount?: number;
  guides?: string;
  model?: string;
}): Promise<{
  masterPrompt: string;
  altPrompts: string[];
  frames: AiVariationFrame[];
  model?: string;
}> {
  const json = await postAi({ action: 'variationBrief', ...args });
  if (typeof json.masterPrompt !== 'string' || !json.masterPrompt.trim()) {
    throw new Error('No master prompt was returned');
  }
  return {
    masterPrompt: json.masterPrompt,
    altPrompts: Array.isArray(json.altPrompts)
      ? (json.altPrompts as string[]).filter((s) => typeof s === 'string')
      : [],
    frames: Array.isArray(json.frames)
      ? (json.frames as AiVariationFrame[])
      : [],
    model: typeof json.model === 'string' ? json.model : undefined,
  };
}

export interface AiVariationPlanItem {
  id: string;
  dimension: string;
  label: string;
  editPrompt: string;
}

/** Plan edit instructions across selected creative-test dimensions. */
export async function aiVariationPlan(args: {
  dimensions: string[];
  perDimension?: number;
  seedDescription?: string;
  platform?: string;
  format?: string;
  hook?: string;
  theme?: string;
  guides?: string;
  model?: string;
}): Promise<{ items: AiVariationPlanItem[]; model?: string }> {
  const json = await postAi({ action: 'variationPlan', ...args });
  if (!Array.isArray(json.items) || json.items.length === 0) {
    throw new Error('No variation plan was returned');
  }
  return {
    items: json.items as AiVariationPlanItem[],
    model: typeof json.model === 'string' ? json.model : undefined,
  };
}

/**
 * Smart-resize one image to exact platform sizes via fal-ai/smart-resize.
 * Accepts data URLs (server hosts first) or public http(s) URLs.
 */
export async function aiSmartResize(args: {
  imageUrl: string;
  targetSizes: string[];
  prompt?: string;
  numImagesPerSize?: number;
  resolution?: '1K' | '2K' | '4K';
  outputFormat?: 'jpeg' | 'png' | 'webp';
  safetyTolerance?: '1' | '2' | '3' | '4' | '5' | '6';
  seed?: number | null;
  syncMode?: boolean;
}): Promise<{
  images: string[];
  description?: string;
  results?: unknown;
  sourceUrl?: string;
}> {
  const json = await postAi({
    action: 'smartResize',
    image_url: args.imageUrl,
    target_sizes: args.targetSizes,
    prompt: args.prompt,
    num_images_per_size: args.numImagesPerSize,
    resolution: args.resolution,
    output_format: args.outputFormat,
    safety_tolerance: args.safetyTolerance,
    seed: args.seed,
    sync_mode: args.syncMode,
  });
  if (!Array.isArray(json.images) || json.images.length === 0) {
    throw new Error('No resized images were returned');
  }
  return {
    images: (json.images as string[]).filter((s) => typeof s === 'string'),
    description:
      typeof json.description === 'string' ? json.description : undefined,
    results: json.results,
    sourceUrl: typeof json.sourceUrl === 'string' ? json.sourceUrl : undefined,
  };
}



