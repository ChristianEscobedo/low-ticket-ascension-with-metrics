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
import type {
  YouTubeChapter,
  YouTubeThumbnail,
} from '@/lib/mothermode/content/review';

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

/** Endpoint for the dedicated ElevenLabs voiceover route (own runtime). */
const VOICEOVER_ENDPOINT = '/api/mothermode/content/voiceover';

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


/**
 * Host a client-produced data URL (overlay burn-in, file upload) in Storage and
 * return a public http(s) URL. Pass-through if already hosted. Falls back to the
 * original data URL when hosting is unavailable.
 */
export async function aiHostImage(dataUrl: string): Promise<string> {
  if (!dataUrl?.trim()) throw new Error('No image to host');
  if (/^https?:\/\//i.test(dataUrl.trim())) return dataUrl.trim();
  const json = await postAi({ action: 'hostImage', dataUrl });
  if (typeof json.image !== 'string') throw new Error('Hosting returned no URL');
  return json.image;
}

/**
 * Host a client-produced video data URL in Storage and return a public http(s)
 * URL. Pass-through if already hosted. Used by the funnel media studio.
 */
export async function aiHostVideo(dataUrl: string): Promise<string> {
  if (!dataUrl?.trim()) throw new Error('No video to host');
  if (/^https?:\/\//i.test(dataUrl.trim())) return dataUrl.trim();
  const json = await postAi({ action: 'hostVideo', dataUrl });
  if (typeof json.video === 'string') return json.video;
  throw new Error('Hosting returned no video URL');
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
  /** Optional image-bank recipe id: every scene executes that framework. */
  imageFramework?: string;
  /** Filled custom inputs for the picked image recipe, keyed by field id. */
  recipeInputs?: Record<string, string>;
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
  /** Optional prompt-bank framework id: restructure the text to execute it. */
  framework?: string;
  /** Filled custom inputs for the picked framework, keyed by field id. */
  recipeInputs?: Record<string, string>;
}): Promise<string> {
  const json = await postAi({ action: 'rewrite', ...args });
  if (typeof json.text !== 'string') throw new Error('No text was returned');
  return json.text;
}

/** One text variation: a primary line plus its matching sub / second line. */
export interface AiTextVariation {
  text: string;
  sub: string;
}

/**
 * Rewrite one piece of plain editor text into N alternative variations, each
 * carrying its own matching sub line, returned as `AiTextVariation[]`. This is
 * text-only output (used by the overlay Primary-text "Variations" control) — it
 * never touches an image. Tolerant of the older bare-string response shape.
 */
export async function aiTextVariations(args: {
  text: string;
  /** The current sub line, rewritten to pair with each variation. */
  sub?: string;
  count: number;
  instructions?: string;
  context?: AiContext;
  /** Existing variations to avoid repeating. */
  avoid?: string[];
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<AiTextVariation[]> {
  const json = await postAi({ action: 'text-variations', ...args });
  if (!Array.isArray(json.items)) {
    throw new Error('No variations were returned');
  }
  const out: AiTextVariation[] = [];
  for (const item of json.items as unknown[]) {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ text: item, sub: '' });
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const text = typeof o.text === 'string' ? o.text : '';
      const sub = typeof o.sub === 'string' ? o.sub : '';
      if (text.trim()) out.push({ text, sub });
    }
  }
  return out;
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
  /** Optional prompt-bank framework id: shape every variant through it. */
  framework?: string;
  /** Filled custom inputs for the picked framework, keyed by field id. */
  recipeInputs?: Record<string, string>;
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
  /** Optional prompt-bank framework id, applied to every part of the run. */
  framework?: string;
  /** Filled custom inputs for the picked framework, keyed by field id. */
  recipeInputs?: Record<string, string>;
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
  /** Clip window this board renders (script-driven packs only). */
  startSec?: number;
  endSec?: number;
  segmentDuration?: number;
}

/**
 * One clip-sized script window fed to the planner as a single board, when a
 * storyboard is generated from a video script (one board per 15s/18s clip).
 */
export interface AiStoryboardSegment {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  beats: Array<{
    shot?: string;
    onScreen?: string;
    voiceover: string;
    action?: string;
    broll?: string;
    brollPrompt?: string;
  }>;
}

/**
 * Plan 1–6 connected cinematic storyboard contact sheets for a piece.
 * Board N continues from board N-1 via lookback summaries. When `segments` are
 * supplied with sourceMode 'script', each board maps to one clip window.
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
  /** 'script' switches the planner to one-board-per-segment. Default 'post'. */
  sourceMode?: 'post' | 'script';
  /** Clip windows, one per board, when sourceMode is 'script'. */
  segments?: AiStoryboardSegment[];
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

/** One frame from a dedicated frame-pack plan. */
export interface AiFramePackFrame {
  index: number;
  role: string;
  text?: string;
  sub?: string;
  visual?: string;
  prompt: string;
  lookbackSummary: string;
}

/**
 * Plan an ordered multi-slide pack for carousel / story / idea.
 */
export async function aiGenerateFramePackPlan(args: {
  piece: {
    hook: string;
    hooks?: string[];
    caption?: string;
    body?: string[];
    theme: string;
    tone: string;
    platform: string;
    format: string;
    slides?: Array<{ text?: string; sub?: string; visual?: string }>;
  };
  slideCount: number;
  mode: 'frames' | 'strip';
  aspect?: '1:1' | '4:5' | '9:16';
  guides?: string;
  model?: string;
}): Promise<{
  frames: AiFramePackFrame[];
  systemNotes?: string;
  slideCount: number;
  mode: 'frames' | 'strip';
  aspect?: string;
  model?: string;
}> {
  const json = await postAi({ action: 'framePackPlan', ...args });
  if (!Array.isArray(json.frames) || json.frames.length === 0) {
    throw new Error('No frame pack was returned');
  }
  return {
    frames: json.frames as AiFramePackFrame[],
    systemNotes:
      typeof json.systemNotes === 'string' ? json.systemNotes : undefined,
    slideCount:
      typeof json.slideCount === 'number' ? json.slideCount : args.slideCount,
    mode: json.mode === 'strip' ? 'strip' : 'frames',
    aspect: typeof json.aspect === 'string' ? json.aspect : args.aspect,
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
  /** Optional image-bank recipe id: master, alts, and frames execute it. */
  imageFramework?: string;
  /** Filled custom inputs for the picked image recipe, keyed by field id. */
  recipeInputs?: Record<string, string>;
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

/** Payload for compliance agent score/fix. */
export interface AiCompliancePiece {
  hook?: string;
  hooks?: string[];
  caption?: string;
  body?: string[];
  cta?: string;
  title?: string;
  theme?: string;
  tone?: string;
  platform: string;
  format: string;
  kind: string;
  adPrimaryText?: string;
  adHeadline?: string;
  adDescription?: string;
  emailSubject?: string;
  emailPreheader?: string;
}

export interface AiComplianceIssue {
  id: string;
  severity: 'block' | 'warn' | 'note';
  source: string;
  field: string;
  message: string;
  match?: string;
  suggestion?: string;
  fixable?: 'deterministic' | 'ai' | 'manual';
}

export interface AiComplianceScorecard {
  score: number;
  grade: 'pass' | 'review' | 'fail';
  brandScore: number;
  platformScore: number;
  claimScore: number;
  blockCount: number;
  warnCount: number;
  noteCount: number;
  issues: AiComplianceIssue[];
  summary: string;
  platformPack: string;
  isAd: boolean;
  scoredAt?: string;
  model?: string;
}

/** Run the AI compliance scorer (brand + platform policy). */
export async function aiComplianceScore(args: {
  piece: AiCompliancePiece;
  model?: string;
}): Promise<AiComplianceScorecard> {
  const json = await postAi({ action: 'complianceScore', ...args });
  if (typeof json.score !== 'number') {
    throw new Error('No compliance score was returned');
  }
  return {
    score: json.score as number,
    grade: (json.grade as AiComplianceScorecard['grade']) || 'review',
    brandScore: Number(json.brandScore) || 0,
    platformScore: Number(json.platformScore) || 0,
    claimScore: Number(json.claimScore) || 0,
    blockCount: Number(json.blockCount) || 0,
    warnCount: Number(json.warnCount) || 0,
    noteCount: Number(json.noteCount) || 0,
    issues: Array.isArray(json.issues)
      ? (json.issues as AiComplianceIssue[])
      : [],
    summary: typeof json.summary === 'string' ? json.summary : '',
    platformPack:
      typeof json.platformPack === 'string' ? json.platformPack : 'general',
    isAd: json.isAd === true,
    scoredAt: typeof json.scoredAt === 'string' ? json.scoredAt : undefined,
    model: typeof json.model === 'string' ? json.model : undefined,
  };
}

/** AI rewrite of non-compliant fields into an edits patch. */
export async function aiComplianceFix(args: {
  piece: AiCompliancePiece;
  issues?: AiComplianceIssue[];
  model?: string;
}): Promise<{
  patch: {
    hooks?: string[];
    caption?: string;
    body?: string;
    adPrimaryText?: string;
    adHeadline?: string;
    adDescription?: string;
    emailSubject?: string;
    emailPreheader?: string;
  };
  changelog: string[];
  model?: string;
}> {
  const json = await postAi({ action: 'complianceFix', ...args });
  if (!json.patch || typeof json.patch !== 'object') {
    throw new Error('No compliance fix was returned');
  }
  const p = json.patch as Record<string, unknown>;
  return {
    patch: {
      hooks: Array.isArray(p.hooks)
        ? p.hooks.filter((h): h is string => typeof h === 'string')
        : undefined,
      caption: typeof p.caption === 'string' ? p.caption : undefined,
      body: typeof p.body === 'string' ? p.body : undefined,
      adPrimaryText:
        typeof p.adPrimaryText === 'string' ? p.adPrimaryText : undefined,
      adHeadline: typeof p.adHeadline === 'string' ? p.adHeadline : undefined,
      adDescription:
        typeof p.adDescription === 'string' ? p.adDescription : undefined,
      emailSubject:
        typeof p.emailSubject === 'string' ? p.emailSubject : undefined,
      emailPreheader:
        typeof p.emailPreheader === 'string' ? p.emailPreheader : undefined,
    },
    changelog: Array.isArray(json.changelog)
      ? (json.changelog as unknown[]).filter(
          (c): c is string => typeof c === 'string',
        )
      : [],
    model: typeof json.model === 'string' ? json.model : undefined,
  };
}

/**
 * Generate a full YouTube publishing kit for a piece: A/B title options, an SEO
 * description, search tags, chapter markers (only when the runtime is long
 * enough), and thumbnail concepts (a 16:9 image prompt plus a big overlay-text
 * idea). Thumbnails are concepts here; render one with aiGenerateImage, then
 * stitch the URL back into the kit's thumbnail.
 */
export async function aiGenerateYouTubeKit(args: {
  piece: {
    hook: string;
    hooks?: string[];
    caption?: string;
    body?: string[];
    /** VO lines from an existing script, to inform chapter timing. */
    script?: string[];
    theme: string;
    tone: string;
  };
  durationSec?: number;
  titleCount?: number;
  thumbnailCount?: number;
  guides?: string;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<{
  titles: string[];
  description: string;
  tags: string[];
  chapters: YouTubeChapter[];
  thumbnails: YouTubeThumbnail[];
  model?: string;
}> {
  const json = await postAi({ action: 'youtubeKit', ...args });
  const titles = Array.isArray(json.titles)
    ? (json.titles as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  const description = typeof json.description === 'string' ? json.description : '';
  if (titles.length === 0 && !description.trim()) {
    throw new Error('No YouTube kit was returned');
  }
  return {
    titles,
    description,
    tags: Array.isArray(json.tags)
      ? (json.tags as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
    chapters: Array.isArray(json.chapters)
      ? (json.chapters as YouTubeChapter[])
      : [],
    thumbnails: Array.isArray(json.thumbnails)
      ? (json.thumbnails as YouTubeThumbnail[])
      : [],
    model: typeof json.model === 'string' ? json.model : undefined,
  };
}

/** One beat of an AI Clone script, with its voice programming attached. */
export interface AiCloneScriptBeat {
  line: string;
  kind: 'avatar' | 'broll';
  shot: 'close' | 'medium' | 'wide';
  durationSec: number;
  pace: 'slow' | 'natural' | 'fast';
  energy: 'low' | 'medium' | 'high';
  emphasis: string[];
  pauseAfterWord: number;
  brollPrompt?: string;
}

/**
 * Write the clone script (Clone tab, step 2): one spoken line per beat on the
 * honest 5/10/15s grid, each carrying its voice direction. Throws a readable
 * Error on failure so the panel can surface it inline.
 */
/** AI Clone step 1 — the "AI fill": a loose sentence becomes the clone's fields. */
export interface AiCloneAutofill {
  name: string;
  description: string;
  wardrobe: string;
  backdrop: string;
  lighting: string;
  lens: string;
}

export async function aiCloneAutofill(description: string): Promise<AiCloneAutofill> {
  const json = await postAi({ action: 'cloneAutofill', description });
  const a = json.autofill as Partial<AiCloneAutofill> | undefined;
  if (!a || typeof a.description !== 'string' || !a.description.trim()) {
    throw new Error('The autofill came back empty — try again');
  }
  const txt = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    name: txt(a.name),
    description: a.description,
    wardrobe: txt(a.wardrobe),
    backdrop: txt(a.backdrop),
    lighting: txt(a.lighting),
    lens: txt(a.lens),
  };
}

/** The run card's hook generator: written hooks across the registry families. */
export async function aiCloneHooks(args: {
  topic: string;
  count?: number;
  awareness?: string;
  eightyPercent?: string;
}): Promise<{ hooks: string[]; visuals: Record<string, string> }> {
  const json = await postAi({ action: 'cloneHooks', ...args });
  return {
    hooks: Array.isArray(json.hooks) ? (json.hooks as string[]) : [],
    visuals: (json.visuals as Record<string, string>) ?? {},
  };
}

export async function aiGenerateCloneScript(args: {
  topic: string;
  /** The 80% block, the hook family id, the CTA target id, a bank framework id. */
  eightyPercent?: string;
  hookFamily?: string;
  ctaTarget?: string;
  framework?: string;
  typeLabel: string;
  frameworkLabel: string;
  frameworkBeats: string[];
  beatSec: number;
  beatCount: number;
  persona: string;
  lookBible: string;
  guides?: string;
  model?: string;
  /** Grounding: an offer / lead magnet slug, and/or free-text owner notes. */
  context?: { offerSlug?: string; optinSlug?: string; notes?: string };
}): Promise<{ beats: AiCloneScriptBeat[]; model?: string; contextLabel?: string }> {
  const json = await postAi({ action: 'cloneScript', ...args });
  if (!Array.isArray(json.beats) || json.beats.length === 0) {
    throw new Error('No script was returned');
  }
  return {
    beats: json.beats as AiCloneScriptBeat[],
    model: typeof json.model === 'string' ? json.model : undefined,
    contextLabel: typeof json.contextLabel === 'string' ? json.contextLabel : undefined,
  };
}

/**
 * THE PRODUCER — a brief + a style preset becomes the Production Plan
 * (the whole pipeline, scoped by the AI, editable before anything spends).
 */
export async function aiProductionPlan(args: {
  brief: string;
  styleLabel: string;
  styleVideoType: string;
  styleCaption: string;
  persona: string;
  hasSheet: boolean;
  hasVoice: boolean;
  grounding?: string;
  model?: string;
}): Promise<Record<string, unknown>> {
  const json = await postAi({ action: 'producerPlan', ...args });
  if (!json.plan || typeof json.plan !== 'object') {
    throw new Error('No plan was returned');
  }
  return json.plan as Record<string, unknown>;
}

/** A selectable ElevenLabs voice for the voiceover picker. */
export interface AiVoice {
  id: string;
  name: string;
}

/**
 * List the account's ElevenLabs voices for the picker. Returns an empty array
 * (never throws) when the integration is unconfigured or the request fails, so
 * the UI can quietly fall back to a manual voice-ID field.
 */
export async function aiListVoices(): Promise<AiVoice[]> {
  try {
    const res = await fetch(VOICEOVER_ENDPOINT, { method: 'GET' });
    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok || json.ok !== true || !Array.isArray(json.voices)) return [];
    return (json.voices as unknown[])
      .map((v) => {
        const o = (v ?? {}) as Record<string, unknown>;
        return {
          id: typeof o.id === 'string' ? o.id : '',
          name: typeof o.name === 'string' ? o.name : '',
        };
      })
      .filter((v) => v.id !== '');
  } catch {
    return [];
  }
}

/** Per-beat time mark within a combined voiceover track. */
export interface AiVoiceoverBeatMark {
  index: number;
  startSec: number;
  endSec: number;
}

/** One per-section voiceover clip (sections mode). */
export interface AiVoiceoverClip {
  index: number;
  url: string;
  durationSec: number;
}

/** Result of a voiceover generation run (shape depends on mode). */
export interface AiVoiceoverResult {
  mode: 'combined' | 'sections';
  /** Combined track URL (combined mode). */
  audioUrl?: string;
  /** Total spoken length in seconds (combined mode). */
  durationSec?: number;
  /** Per-beat marks within the combined track (combined mode). */
  beatMarks?: AiVoiceoverBeatMark[];
  /** Per-section clips (sections mode). */
  clips?: AiVoiceoverClip[];
  voiceId?: string;
  model?: string;
  generatedAt?: string;
}

/**
 * Generate ElevenLabs voiceover for a script's beats via the dedicated
 * voiceover route. In `combined` mode it returns a single hosted track plus
 * per-beat time marks; in `sections` mode it returns one hosted clip per beat
 * with its exact duration. Throws a readable Error (e.g. "ElevenLabs is not
 * configured") so the panel can surface it inline.
 */
export async function aiGenerateVoiceover(args: {
  mode: 'combined' | 'sections';
  beats: Array<{ index: number; text: string }>;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}): Promise<AiVoiceoverResult> {
  const res = await fetch(VOICEOVER_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok !== true) {
    const msg =
      typeof json.error === 'string'
        ? json.error
        : `Voiceover request failed (${res.status})`;
    throw new Error(msg);
  }
  return {
    mode: json.mode === 'sections' ? 'sections' : 'combined',
    audioUrl: typeof json.audioUrl === 'string' ? json.audioUrl : undefined,
    durationSec:
      typeof json.durationSec === 'number' ? json.durationSec : undefined,
    beatMarks: Array.isArray(json.beatMarks)
      ? (json.beatMarks as AiVoiceoverBeatMark[])
      : undefined,
    clips: Array.isArray(json.clips)
      ? (json.clips as AiVoiceoverClip[])
      : undefined,
    voiceId: typeof json.voiceId === 'string' ? json.voiceId : undefined,
    model: typeof json.model === 'string' ? json.model : undefined,
    generatedAt:
      typeof json.generatedAt === 'string' ? json.generatedAt : undefined,
  };
}





