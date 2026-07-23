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
  /** Hosted URL of this beat's per-section ElevenLabs voiceover clip. */
  voiceoverAudio?: string;
  /** Actual spoken length of this beat's clip, in seconds (from alignment). */
  voiceoverDurationSec?: number;
}

/**
 * A generated ElevenLabs voiceover for a script. `combined` is one track for
 * the whole script (with per-beat time marks resolved from the alignment so the
 * UI can show where each beat lands and flag drift); `sections` means each beat
 * carries its own clip on `VideoScriptBeat.voiceoverAudio` instead.
 */
export interface VideoScriptVoiceover {
  /** Hosted URL of the combined mp3 track (combined mode only). */
  audioUrl?: string;
  /** Total spoken length of the track, in seconds. */
  durationSec: number;
  /** Which generation path produced this voiceover. */
  mode: 'combined' | 'sections';
  /** Per-beat time windows within the combined track (combined mode only). */
  beatMarks?: Array<{ index: number; startSec: number; endSec: number }>;
  /** ElevenLabs voice id used, for reference / regeneration. */
  voiceId?: string;
  /** ElevenLabs model id used, for reference. */
  model?: string;
  /** ISO timestamp of generation. */
  generatedAt?: string;
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
  /** Generated ElevenLabs voiceover (combined track). Per-section clips live on
   *  each beat's `voiceoverAudio` instead. */
  voiceover?: VideoScriptVoiceover;
}




/**
 * One thumbnail concept for a YouTube piece: a short concept label, a full
 * image-generation prompt, an optional big on-thumbnail text idea, and the
 * rendered/hosted image once generated.
 */
export interface YouTubeThumbnail {
  /** Short internal label for this concept, e.g. "Shocked reaction + big number". */
  concept: string;
  /** Full landscape (16:9) image-generation prompt. */
  prompt: string;
  /** Big, bold on-thumbnail text idea (3-5 words), if any. */
  overlayText?: string;
  /** Rendered/hosted thumbnail image (hosted URL), when generated. */
  imageUrl?: string;
}

/** One chapter marker in a long-form video description (YouTube chapters). */
export interface YouTubeChapter {
  /** Chapter start, in seconds from 0. The first chapter must be 0. */
  startSec: number;
  /** Short chapter title. */
  title: string;
}

/**
 * The full YouTube publishing kit for a piece: A/B title options, an
 * SEO-optimized description (with an intro, body, and CTA), search tags,
 * chapter markers, and thumbnail concepts. Persisted on the piece review so it
 * exports alongside the rest of the content.
 */
export interface YouTubeKit {
  /** A/B title options (most compelling first). */
  titles: string[];
  /** Index of the active/primary title within `titles`. Defaults to 0. */
  titleIndex?: number;
  /** SEO description body (multi-paragraph; chapters are appended on export). */
  description: string;
  /** Search tags / keywords. */
  tags: string[];
  /** Chapter markers for a long-form video. */
  chapters?: YouTubeChapter[];
  /** Thumbnail concepts (prompt + optional render). */
  thumbnails?: YouTubeThumbnail[];
  /** The model that wrote the kit, for reference. */
  model?: string;
  /** ISO timestamp of generation. */
  generatedAt?: string;
}

/** Narrative arc vs object-led cutaway boards. */
export type StoryboardMode = 'narrative' | 'broll';


/**
 * How many connected contact sheets to plan. 1–4 for the manual post-driven
 * flow; script-driven packs may reach 6 (one board per 15s clip of a 90s
 * script).
 */
export type StoryboardCount = 1 | 2 | 3 | 4 | 5 | 6;


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
  /**
   * Script-driven clip window this board renders (one video generation).
   * Present only for storyboards built from a video script; omitted for the
   * manual post-driven flow. All optional → existing packs unchanged.
   */
  startSec?: number;
  /** Clip window end in seconds (exclusive). */
  endSec?: number;
  /** Clip window length in seconds (endSec - startSec), i.e. 15 or 18. */
  segmentDuration?: number;
  /** Hosted URL of the rendered contact-sheet image, when generated. */
  imageUrl?: string;
  /** Final Seedance prompt used to render this board's clip (Reel Director). */
  seedancePrompt?: string;
  /** MUAPI task id for an in-flight/last render of this board's clip. */
  videoTaskId?: string;
  /** Render lifecycle for this board's Seedance clip. */
  videoStatus?: 'idle' | 'rendering' | 'done' | 'failed';
  /** Hosted (re-hosted to Supabase) URL of this board's rendered clip. */
  videoUrl?: string;
}

/**
 * A story arc produced by the Reel Director's Story Agent from a single idea.
 * Drives exactly four storyboard chapters; the app asks for a story, never for
 * scene prompts.
 */
export interface ReelStory {
  /** Story title. */
  title: string;
  /** The single core emotion the reel should land. */
  coreEmotion: string;
  /** Opening hook line / concept. */
  hook: string;
  /** Narrative arc beats (Beginning, Conflict, Escalation, Breakthrough, Payoff). */
  arc: string[];
  /** Closing call to action. */
  cta: string;
  /** Exactly four storyboard chapters (purpose/emotion/visual goal/transition). */
  chapters: ReelStoryChapter[];
  /** The model that wrote the story, for reference. */
  model?: string;
  /** ISO timestamp of generation. */
  generatedAt?: string;
}

/** One of the four storyboard chapters within a {@link ReelStory}. */
export interface ReelStoryChapter {
  /** 1-based chapter index (1..4). */
  index: number;
  /** What this chapter accomplishes in the arc. */
  purpose: string;
  /** The emotional state at this chapter. */
  emotionalState: string;
  /** The visual goal for this chapter's storyboard. */
  visualGoal: string;
  /** How this chapter transitions into the next. */
  transition: string;
}

/** Audio treatment preset for a finished reel. */
export type ReelWrapper = 'silent' | 'music' | 'voice' | 'voice+music';

/** Assembly lifecycle for the final stitched reel. */
export type ReelCutStatus = 'idle' | 'assembling' | 'done' | 'failed';

/**
 * A finished reel: the storyboard board clips stitched together in order with an
 * optional voiceover laid over the top (no captions in this round). Additive —
 * older reviews simply omit it, and the assembler only lights up once every
 * board carries a rendered Seedance clip.
 */
export interface ReelCut {
  /** Public (re-hosted to Supabase) URL of the assembled reel MP4. */
  videoUrl?: string;
  /** Audio treatment applied to this cut. */
  wrapper: ReelWrapper;
  /** Board indices in the exact order they were stitched. */
  boardOrder: number[];
  /** Total runtime in seconds (sum of the source clip durations). */
  durationSec?: number;
  /** Voiceover track laid over the cut, for voice wrappers (hosted URL). */
  voiceoverUrl?: string;
  /** Assembly lifecycle. */
  status: ReelCutStatus;
  /** fal request id for an in-flight/last assembly. */
  taskId?: string;
  /** Provider/host error message when status is 'failed'. */
  error?: string;
  /** ISO timestamp of the finished assembly. */
  generatedAt?: string;
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
  customHex?: string;
  vAlign: string;
  hAlign: string;
  /** Freeform top-left of text block (0–1 of frame). */
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
  /** false = hide overlay type (image already has text). Default true. */
  enabled?: boolean;
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
  /** Ordered multi-slide pack for carousel / story / idea (plan + renders). */
  framePack?: import('./framePack').FramePack;
  /** YouTube publishing kit: titles, SEO description, tags, chapters, thumbnails. */
  youtube?: YouTubeKit;
  /** The final assembled reel (board clips stitched in order + voiceover). */
  reel?: ReelCut;
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
  const hasFramePack =
    !!r.framePack &&
    Array.isArray(r.framePack.frames) &&
    r.framePack.frames.length > 0;
  const hasYouTube =
    !!r.youtube &&
    ((Array.isArray(r.youtube.titles) && r.youtube.titles.some(hasText)) ||
      hasText(r.youtube.description) ||
      (Array.isArray(r.youtube.tags) && r.youtube.tags.some(hasText)) ||
      (Array.isArray(r.youtube.thumbnails) &&
        r.youtube.thumbnails.length > 0) ||
      (Array.isArray(r.youtube.chapters) && r.youtube.chapters.length > 0));
  const hasReel =
    !!r.reel &&
    (hasText(r.reel.videoUrl) || r.reel.status === 'assembling');
  return (
    reviewImages(r).length === 0 &&
    !r.notes &&
    !hasEdits &&
    !hasMetrics &&
    !hasVideo &&
    !hasScript &&
    !hasStoryboard &&
    !hasCompliance &&
    !hasOverlay &&
    !hasFramePack &&
    !hasYouTube &&
    !hasReel
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
  if (images.length === 0) {
    return { ...rest, images: undefined, imageIndex: undefined };
  }
  const idx = clampIndex(imageIndex, images.length);
  // Keep legacy `image` mirrored to the active frame so older surfaces
  // (ContentCard thumbnail) stay in sync without reading the gallery.
  return { ...rest, images, imageIndex: idx, image: images[idx] };
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

/**
 * Attach a combined-track voiceover to the piece's script. Returns prev
 * unchanged when there is no script to attach it to (a voiceover always belongs
 * to a script). Pure: returns a new object.
 */
export function withVoiceover(
  prev: PieceReview,
  voiceover: VideoScriptVoiceover,
): PieceReview {
  if (!prev.videoScript) return prev;
  return { ...prev, videoScript: { ...prev.videoScript, voiceover } };
}

/**
 * Drop the combined-track voiceover from the script, leaving per-beat clips and
 * everything else intact. Pure. Returns prev unchanged when there is no script.
 */
export function withoutVoiceover(prev: PieceReview): PieceReview {
  if (!prev.videoScript) return prev;
  const { voiceover: _v, ...script } = prev.videoScript;
  return { ...prev, videoScript: script };
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

/** Set the piece's multi-frame pack (carousel/story/idea). Pure. */
export function withFramePack(
  prev: PieceReview,
  pack: import('./framePack').FramePack,
): PieceReview {
  return { ...prev, framePack: pack };
}

/** Drop the frame pack, keeping everything else. Pure. */
export function withoutFramePack(prev: PieceReview): PieceReview {
  const { framePack: _f, ...rest } = prev;
  return rest;
}

/** Set the piece's YouTube publishing kit. Pure. */
export function withYouTubeKit(
  prev: PieceReview,
  kit: YouTubeKit,
): PieceReview {
  return { ...prev, youtube: kit };
}

/**
 * Merge a partial patch into the piece's YouTube kit (e.g. after rendering one
 * thumbnail or editing the description), preserving the rest. Returns prev
 * unchanged when there is no kit to patch. Pure.
 */
export function patchYouTubeKit(
  prev: PieceReview,
  patch: Partial<YouTubeKit>,
): PieceReview {
  if (!prev.youtube) return prev;
  return { ...prev, youtube: { ...prev.youtube, ...patch } };
}

/** Drop the YouTube kit, keeping everything else. Pure. */
export function withoutYouTubeKit(prev: PieceReview): PieceReview {
  const { youtube: _y, ...rest } = prev;
  return rest;
}

/** Set (or replace) the piece's assembled reel cut. Pure. */
export function withReelCut(prev: PieceReview, reel: ReelCut): PieceReview {
  return { ...prev, reel };
}

/**
 * Merge a partial patch into the reel cut (e.g. flip status to 'assembling',
 * then stash the hosted videoUrl on success), seeding a minimal idle cut when
 * none exists. Pure: returns a new object.
 */
export function patchReelCut(
  prev: PieceReview,
  patch: Partial<ReelCut>,
): PieceReview {
  const base: ReelCut = prev.reel ?? {
    wrapper: 'silent',
    boardOrder: [],
    status: 'idle',
  };
  return { ...prev, reel: { ...base, ...patch } };
}

/** Drop the assembled reel cut, keeping everything else. Pure. */
export function withoutReelCut(prev: PieceReview): PieceReview {
  const { reel: _r, ...rest } = prev;
  return rest;
}


/** Render a chapter list as a YouTube-ready timestamp block ("0:00 Intro"). */
export function chaptersToText(chapters: YouTubeChapter[] | undefined): string {
  if (!chapters?.length) return '';
  return chapters
    .slice()
    .sort((a, b) => a.startSec - b.startSec)
    .map((c) => {
      const s = Math.max(0, Math.round(c.startSec));
      const m = Math.floor(s / 60);
      const sec = String(s % 60).padStart(2, '0');
      const h = Math.floor(m / 60);
      const stamp =
        h > 0
          ? `${h}:${String(m % 60).padStart(2, '0')}:${sec}`
          : `${m}:${sec}`;
      return `${stamp} ${c.title}`.trim();
    })
    .join('\n');
}

/** The full description text a creator pastes into YouTube: body + chapters. */
export function youtubeDescriptionText(kit: YouTubeKit | undefined): string {
  if (!kit) return '';
  const parts: string[] = [];
  if (kit.description?.trim()) parts.push(kit.description.trim());
  const chapters = chaptersToText(kit.chapters);
  if (chapters) parts.push(`Chapters:\n${chapters}`);
  return parts.join('\n\n');
}




