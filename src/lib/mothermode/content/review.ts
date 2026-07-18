/**
 * Review state types and pure helpers for the content hub: the copy edits,
 * reviewer notes, captured metrics, and replacement images a team applies to a
 * piece. This module is storage-agnostic and server-safe. The browser I/O (the
 * Supabase-backed cache that loads and persists these objects) lives in
 * src/components/mothermode/content/reviewClient.ts.
 */

/** Local copy edits, overriding the catalog text in the preview. */
export interface PieceEdits {
  /** Legacy single hook override. Still read; new edits use `hooks`. */
  hook?: string;
  /** Hook variants to A/B, in order. The active one drives the preview. */
  hooks?: string[];
  /** Index of the active hook within `hooks`. Defaults to 0. */
  hookIndex?: number;
  /** Replacement caption line. */
  caption?: string;
  /** Replacement body, newline-separated; the preview splits on blank lines. */
  body?: string;
  /** Paid ad primary text override. */
  adPrimaryText?: string;
  /** Paid ad headline override. */
  adHeadline?: string;
  /** Paid ad description override. */
  adDescription?: string;
  /** Email subject override. */
  emailSubject?: string;
  /** Email preheader override. */
  emailPreheader?: string;
}

/** Last compliance agent / local scorecard snapshot (optional). */
export interface StoredComplianceReport {
  score: number;
  grade: 'pass' | 'review' | 'fail';
  brandScore?: number;
  platformScore?: number;
  claimScore?: number;
  blockCount?: number;
  warnCount?: number;
  noteCount?: number;
  summary?: string;
  platformPack?: string;
  isAd?: boolean;
  scoredAt?: string;
  model?: string;
  /** Compact issue list for re-display without a full re-run. */
  issues?: Array<{
    id: string;
    severity: 'block' | 'warn' | 'note';
    source: string;
    field: string;
    message: string;
    match?: string;
    suggestion?: string;
    fixable?: 'deterministic' | 'ai' | 'manual';
  }>;
}


/**
 * Captured performance for a published piece. Organic and paid fields live
 * together; the metrics panel shows the set that fits the piece kind.
 */
export interface PieceMetrics {
  /** Organic reach / paid impressions. */
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  views?: number;
  /** Paid placements. */
  spend?: number;
  clicks?: number;
  conversions?: number;
}

/**
 * One second-by-second beat in a video production script: exact voiceover,
 * shot direction, and (for cutaway beats) a ready-to-render b-roll prompt and
 * still. Beats are contiguous and cover the full runtime with no gaps.
 */
export interface VideoScriptBeat {
  /** Beat start, in seconds from 0. */
  startSec: number;
  /** Beat end, in seconds. Always > startSec. */
  endSec: number;
  /** Shot direction, e.g. "Talking head, direct to camera" or "B-roll insert". */
  shot?: string;
  /** On-screen text overlay for this beat. */
  onScreen?: string;
  /** The exact words to say during this beat, paced to its length. */
  voiceover: string;
  /** Physical direction: look, gesture, prop, movement. */
  action?: string;
  /** Plain description of the cutaway, present on b-roll beats. */
  broll?: string;
  /** Full AI image-generation scene prompt for the b-roll cutaway. */
  brollPrompt?: string;
  /** A generated or uploaded still for this beat's b-roll (hosted URL). */
  brollImage?: string;
}

/** A full second-by-second shooting script for a reel/video piece. */
export interface VideoScript {
  /** Total runtime in seconds; beats cover 0..totalSeconds with no gaps. */
  totalSeconds: number;
  beats: VideoScriptBeat[];
  /** The model that wrote this script, for reference. */
  model?: string;
  /** ISO timestamp of generation. */
  generatedAt?: string;
}

/** Narrative arc vs object-led cutaway boards. */
export type StoryboardMode = 'narrative' | 'broll';

/** How many connected contact sheets to plan (1–4). */
export type StoryboardCount = 1 | 2 | 3 | 4;

/**
 * One cinematic multi-panel contact sheet in a connected pack. Board N is
 * written with lookback from boards 1..N-1 so the arc continues without reset.
 */
export interface StoryboardBoard {
  /** 1-based index within the pack. */
  index: number;
  /** Short internal title for this board. */
  title: string;
  /** Expanded scene beats / panel ideas for this contact sheet. */
  scenes: string[];
  /**
   * Full image-generation prompt for the multi-panel contact sheet, including
   * the bottom VIDEO PROMPT production section when present.
   */
  imagePrompt: string;
  /** Standalone cinematography / movement / lighting production block. */
  videoPrompt?: string;
  /**
   * What this board locked for continuity (character state, environment,
   * emotional beat). Fed into the next board as lookback.
   */
  lookbackSummary: string;
  /** Extra notes when mode is broll (insert purpose, prop focus). */
  brollNotes?: string;
  /** Hosted URL of the rendered contact-sheet image, when generated. */
  imageUrl?: string;
}

/**
 * A connected pack of 1–4 storyboard contact sheets for a piece, with shared
 * character/product/environment references and lookback continuity.
 */
export interface StoryboardPack {
  boardCount: StoryboardCount;
  mode: StoryboardMode;
  /** Freeform production guides the planner should honor. */
  guides?: string;
  /** Character reference image (data URL or hosted URL). */
  characterRef?: string;
  /** Product, environment, logo, or other reference images. */
  referenceImages?: string[];
  boards: StoryboardBoard[];
  /** Text model that wrote the plan. */
  model?: string;
  /** ISO timestamp of plan generation. */
  generatedAt?: string;
}

/**
 * Text-on-image overlay recipe (editable). Kept structural here so review stays
 * free of canvas imports; full helpers live in imageOverlay.ts.
 */
export interface StoredImageOverlay {
  text: string;
  sub?: string;
  fontId: string;
  styleId: string;
  size: string;
  weight: string;
  color: string;
  vAlign: string;
  hAlign: string;
  baseImage?: string;
  renderedUrl?: string;
  updatedAt?: string;
}

/** Per-piece review state: images, notes, local copy edits, and metrics. */
export interface PieceReview {
  /** Legacy single replacement image as a data URL. Still read; new uploads
   *  and generations go into `images`. */
  image?: string;
  /** Gallery of replacement images: story/carousel frames or A/B variants.
   *  Each is a data URL or absolute http(s) url; the active one shows first. */
  images?: string[];
  /** Index of the active/primary image within `images`. Defaults to 0. */
  imageIndex?: number;
  /** Reviewer notes requesting copy or image changes. */
  notes?: string;
  /** Local copy overrides reflected in the platform preview. */
  edits?: PieceEdits;
  /** Captured performance numbers for this piece. */
  metrics?: PieceMetrics;
  /** Hosted URL of an uploaded final-cut video for this piece. */
  video?: string;
  /** The second-by-second production script for a reel/video piece. */
  videoScript?: VideoScript;
  /** Connected cinematic storyboard pack (1–4 contact sheets). */
  storyboard?: StoryboardPack;
  /** Last compliance scorecard (local + optional AI agent). */
  compliance?: StoredComplianceReport;
  /** Last text-on-image overlay recipe (re-openable in Image Studio). */
  overlay?: StoredImageOverlay;
}





/** True when a string carries visible content. */
function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

/** The replacement images for a piece, preferring the gallery over the legacy
 *  single image. Empty when the reviewer has added none. */
export function reviewImages(r: PieceReview): string[] {
  if (Array.isArray(r.images) && r.images.length > 0)
    return r.images.filter(hasText);
  return hasText(r.image) ? [r.image as string] : [];
}

/** The reviewer's hook variants, preferring the list over the legacy single
 *  hook. Empty when no hook has been edited. */
export function reviewHooks(e: PieceEdits | undefined): string[] {
  if (!e) return [];
  if (Array.isArray(e.hooks) && e.hooks.length > 0) return e.hooks;
  return hasText(e.hook) ? [e.hook as string] : [];
}

/** Clamp an optional index into [0, len). Returns 0 when out of range. */
export function clampIndex(index: number | undefined, len: number): number {
  if (typeof index !== 'number' || !Number.isFinite(index)) return 0;
  if (len <= 0) return 0;
  return index >= 0 && index < len ? Math.floor(index) : 0;
}

/** True when a review carries no images, notes, edits, or metric values. The
 *  store drops empty reviews rather than persisting a row of nothing. */
export function isEmptyReview(r: PieceReview): boolean {
  const e = r.edits ?? {};
  const hasEdits =
    hasText(e.hook) ||
    hasText(e.caption) ||
    hasText(e.body) ||
    hasText(e.adPrimaryText) ||
    hasText(e.adHeadline) ||
    hasText(e.adDescription) ||
    hasText(e.emailSubject) ||
    hasText(e.emailPreheader) ||
    (Array.isArray(e.hooks) && e.hooks.some(hasText));
  const hasMetrics =
    !!r.metrics &&
    Object.values(r.metrics).some((v) => typeof v === 'number');
  const hasVideo = hasText(r.video);
  const hasScript =
    !!r.videoScript &&
    Array.isArray(r.videoScript.beats) &&
    r.videoScript.beats.length > 0;
  const hasStoryboard =
    !!r.storyboard &&
    Array.isArray(r.storyboard.boards) &&
    r.storyboard.boards.length > 0;
  const hasCompliance =
    !!r.compliance && typeof r.compliance.score === 'number';
  const hasOverlay =
    !!r.overlay &&
    (hasText(r.overlay.text) ||
      hasText(r.overlay.sub) ||
      hasText(r.overlay.renderedUrl));
  return (
    reviewImages(r).length === 0 &&
    !r.notes &&
    !hasEdits &&
    !hasMetrics &&
    !hasVideo &&
    !hasScript &&
    !hasStoryboard &&
    !hasCompliance &&
    !hasOverlay
  );
}





/** Merge a partial patch into a review, deep-merging edits and metrics so a
 *  single-field change never clobbers the rest. Pure: returns a new object. */
export function mergeReview(
  prev: PieceReview,
  patch: Partial<PieceReview>,
): PieceReview {
  return {
    ...prev,
    ...patch,
    edits: patch.edits ? { ...prev.edits, ...patch.edits } : prev.edits,
    metrics: patch.metrics ? { ...prev.metrics, ...patch.metrics } : prev.metrics,
  };
}

/**
 * Replace the image gallery on a review and set the active index, dropping the
 * legacy single image so resolution is unambiguous. An empty array clears the
 * gallery. Pure: returns a new object.
 */
export function withImages(
  prev: PieceReview,
  images: string[],
  imageIndex: number,
): PieceReview {
  const { image: _legacy, ...rest } = prev;
  return images.length > 0
    ? { ...rest, images, imageIndex: clampIndex(imageIndex, images.length) }
    : { ...rest, images: undefined, imageIndex: undefined };
}

/** Drop every uploaded/generated image from a review, keeping notes, edits, and
 *  metrics. Clears both the gallery and the legacy single image. Pure. */
export function withoutImages(prev: PieceReview): PieceReview {
  const { image: _img, images: _imgs, imageIndex: _idx, ...rest } = prev;
  return rest;
}

/** Set (or clear, with an empty string) the piece's uploaded final-cut video
 *  URL. Pure: returns a new object. */
export function withVideo(prev: PieceReview, url: string): PieceReview {
  if (!url.trim()) {
    const { video: _v, ...rest } = prev;
    return rest;
  }
  return { ...prev, video: url };
}

/** Drop the uploaded video, keeping everything else. Pure. */
export function withoutVideo(prev: PieceReview): PieceReview {
  const { video: _v, ...rest } = prev;
  return rest;
}

/** Set the piece's second-by-second production script. Pure. */
export function withVideoScript(
  prev: PieceReview,
  script: VideoScript,
): PieceReview {
  return { ...prev, videoScript: script };
}

/** Drop the production script, keeping everything else. Pure. */
export function withoutVideoScript(prev: PieceReview): PieceReview {
  const { videoScript: _s, ...rest } = prev;
  return rest;
}

/** Set the piece's connected storyboard pack. Pure. */
export function withStoryboard(
  prev: PieceReview,
  pack: StoryboardPack,
): PieceReview {
  return { ...prev, storyboard: pack };
}

/** Drop the storyboard pack, keeping everything else. Pure. */
export function withoutStoryboard(prev: PieceReview): PieceReview {
  const { storyboard: _s, ...rest } = prev;
  return rest;
}

/**
 * Patch one board inside a pack (e.g. after rendering a contact sheet). Pure.
 * Returns prev unchanged when the board index is missing.
 */
export function withStoryboardBoard(
  prev: PieceReview,
  boardIndex: number,
  patch: Partial<StoryboardBoard>,
): PieceReview {
  const pack = prev.storyboard;
  if (!pack?.boards?.length) return prev;
  const boards = pack.boards.map((b) =>
    b.index === boardIndex ? { ...b, ...patch } : b,
  );
  return { ...prev, storyboard: { ...pack, boards } };
}




