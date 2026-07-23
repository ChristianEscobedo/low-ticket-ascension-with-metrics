/**
 * Reel Director: the layered prompt composer for the Seedance render pipeline.
 * Pure and testable (no network). It assembles the final per-clip Seedance
 * prompt from the master cinematic meta prompt, the Brand Bible, the Film Bible,
 * the storyboard board, and the optional audio layers — in a fixed priority
 * order where the storyboard always wins conflicts.
 *
 * Layer order (System Prompt -> Brand Bible -> Storyboard Rules -> Scene Data
 * -> Audio Layer -> Output). See SEEDANCE_VIDEO_PIPELINE_TASK.md.
 */
import type { StoryboardBoard, ReelWrapper } from './review';
import { filmBibleToPromptBlock, type FilmBible } from './filmBible';

/**
 * A structured, swappable brand-injection block. The same cinematic engine
 * serves any brand by swapping this — nothing else changes.
 */
export interface BrandBible {
  /** Brand name / label. */
  name: string;
  /** Overall visual style ("editorial, lived-in, natural light"). */
  visualStyle: string;
  /** Color language ("warm neutrals, muted, no neon"). */
  colorPalette: string;
  /** The single emotion the brand wants to evoke. */
  emotion: string;
  /** Camera language ("handheld, close, patient"). */
  cameraLanguage: string;
  /** Extra do-not lines specific to the brand, folded into negatives. */
  negatives?: string[];
}

/**
 * The versioned cinematic-director system prompt. Storyboard is the source of
 * truth; the model expands stills into motion without inventing new geometry.
 */
export const MASTER_VIDEO_META_PROMPT = [
  'You are a cinematic film director generating a single continuous video clip from a storyboard contact-sheet frame.',
  'The storyboard frame is the source of truth: match its composition, subjects, wardrobe, props, and framing exactly. Do not invent new characters, locations, or geometry.',
  'Your job is to expand the still into motion: add believable micro-movement, breathing, subtle camera drift, and the one primary action described. Nothing teleports; nothing morphs.',
  'Hold identity, wardrobe, and world continuity constant with the Film Bible. No identity drift between clips.',
  'Realism first: natural light, real skin texture, physically plausible motion and physics. No plastic skin, no waxy faces, no uncanny smoothing.',
  'Respect the brand visual language for palette, mood, and camera, but never at the cost of the storyboard composition.',
  'One clip = one continuous shot unless the scene notes explicitly call for a cut.',
].join(' ');

/** Negatives that always ride along on every clip, brand negatives appended. */
export const NEGATIVE_PROMPT = [
  'no borders',
  'no split screen',
  'no panels or grid',
  'no on-screen text or captions or watermark',
  'no logos',
  'no plastic or waxy skin',
  'no identity drift',
  'no morphing or warping',
  'no extra limbs or fingers',
  'no sudden scene cuts',
  'no cartoon or 3d render look',
  'no oversaturation or neon',
].join(', ');

/** One audio-treatment preset for a finished reel. */
export interface ReelWrapperPreset {
  id: ReelWrapper;
  label: string;
  /** Whether narration is layered on the reel. */
  voice: boolean;
  /** Whether music is layered on the reel. */
  music: boolean;
  /** A one-line description of the treatment for the UI. */
  description: string;
}

/** The four audio wrappers a finished reel can carry. */
export const REEL_WRAPPERS: Record<ReelWrapper, ReelWrapperPreset> = {
  silent: {
    id: 'silent',
    label: 'Silent',
    voice: false,
    music: false,
    description: 'No audio. Ambient-only, text-optional silent reel.',
  },
  music: {
    id: 'music',
    label: '+ Music',
    voice: false,
    music: true,
    description: 'Scored with music direction, no narration.',
  },
  voice: {
    id: 'voice',
    label: '+ Voice',
    voice: true,
    music: false,
    description: 'Narrated with ElevenLabs voiceover, no music bed.',
  },
  'voice+music': {
    id: 'voice+music',
    label: '+ Voice + Music',
    voice: true,
    music: true,
    description: 'Narration over a scored music bed.',
  },
};

/** Ordered list of wrappers for pickers. */
export const REEL_WRAPPER_LIST: ReelWrapperPreset[] = [
  REEL_WRAPPERS.silent,
  REEL_WRAPPERS.music,
  REEL_WRAPPERS.voice,
  REEL_WRAPPERS['voice+music'],
];

/** Render the Brand Bible as a compact injection block. */
export function brandBibleToPromptBlock(brand: BrandBible): string {
  const bits = [
    brand.name ? `Brand "${brand.name}".` : '',
    brand.visualStyle ? `Visual style: ${brand.visualStyle}.` : '',
    brand.colorPalette ? `Color language: ${brand.colorPalette}.` : '',
    brand.emotion ? `Emotion to evoke: ${brand.emotion}.` : '',
    brand.cameraLanguage ? `Camera language: ${brand.cameraLanguage}.` : '',
  ].filter(Boolean);
  return bits.length ? `BRAND BIBLE:\n${bits.join(' ')}` : '';
}

function cleanStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Arguments for composing one clip's final Seedance prompt. */
export interface BuildSeedancePromptArgs {
  /** Master meta prompt override. Defaults to MASTER_VIDEO_META_PROMPT. */
  meta?: string;
  /** Swappable brand injection block. */
  brandBible?: BrandBible;
  /** Accumulated continuity. */
  filmBible?: FilmBible;
  /** The board this clip renders. Its prompt is the source of truth. */
  board: StoryboardBoard;
  /** 1-based panel/frame index within the board, for shot targeting. */
  frame?: number;
  /** Narration script or pacing note (voice wrappers). */
  voice?: string;
  /** Music direction (music wrappers). */
  music?: string;
  /** Explicit camera direction from the Shot Director, overriding defaults. */
  camera?: string;
  /** Audio treatment; gates whether voice/music sections are included. */
  wrapper?: ReelWrapper;
}

/**
 * Compose the final per-clip Seedance prompt in strict priority order:
 * Master -> Film Bible -> Storyboard (source of truth) -> Brand -> Voice ->
 * Scene Notes -> Camera -> Music -> Negatives. The storyboard block is placed
 * ahead of the brand block and explicitly flagged as authoritative so any
 * conflict resolves in the storyboard's favor. The NEGATIVE_PROMPT is always
 * present, with brand negatives appended.
 */
export function buildSeedancePrompt(args: BuildSeedancePromptArgs): string {
  const wrapper = args.wrapper ? REEL_WRAPPERS[args.wrapper] : undefined;
  const includeVoice = wrapper ? wrapper.voice : true;
  const includeMusic = wrapper ? wrapper.music : true;

  const sections: string[] = [];

  // 1. System / master meta prompt.
  sections.push(cleanStr(args.meta) || MASTER_VIDEO_META_PROMPT);

  // 2. Film Bible continuity.
  if (args.filmBible) {
    const block = filmBibleToPromptBlock(args.filmBible);
    if (block) sections.push(block);
  }

  // 3. Storyboard — the source of truth. Placed before brand and flagged so it
  //    wins any conflict with brand/scene/camera direction below.
  const board = args.board;
  const storyLines: string[] = [
    'STORYBOARD (source of truth — this wins any conflict below):',
  ];
  if (cleanStr(board.title)) storyLines.push(`Board: ${board.title}.`);
  if (typeof args.frame === 'number' && args.frame > 0) {
    storyLines.push(`Render panel ${args.frame} of the contact sheet as the clip.`);
  }
  const imagePrompt = cleanStr(board.imagePrompt);
  if (imagePrompt) storyLines.push(`Frame composition: ${imagePrompt}`);
  if (board.scenes?.length) {
    storyLines.push(`Beats: ${board.scenes.filter(Boolean).join(' | ')}`);
  }
  sections.push(storyLines.join('\n'));

  // 4. Brand Bible.
  if (args.brandBible) {
    const block = brandBibleToPromptBlock(args.brandBible);
    if (block) sections.push(block);
  }

  // 5. Voice layer.
  if (includeVoice && cleanStr(args.voice)) {
    sections.push(`NARRATION (pacing/timing only, do not render as on-screen text):\n${cleanStr(args.voice)}`);
  }

  // 6. Scene notes (board production block / b-roll notes).
  const sceneNotes = [cleanStr(board.videoPrompt), cleanStr(board.brollNotes)]
    .filter(Boolean)
    .join('\n');
  if (sceneNotes) sections.push(`SCENE NOTES:\n${sceneNotes}`);

  // 7. Camera direction.
  if (cleanStr(args.camera)) {
    sections.push(`CAMERA:\n${cleanStr(args.camera)}`);
  }

  // 8. Music layer.
  if (includeMusic && cleanStr(args.music)) {
    sections.push(`MUSIC DIRECTION (for scoring, not visible):\n${cleanStr(args.music)}`);
  }

  // 9. Negatives — always present, brand negatives appended.
  const negatives = args.brandBible?.negatives?.length
    ? `${NEGATIVE_PROMPT}, ${args.brandBible.negatives.map(cleanStr).filter(Boolean).join(', ')}`
    : NEGATIVE_PROMPT;
  sections.push(`NEGATIVE: ${negatives}`);

  return sections.join('\n\n');
}
