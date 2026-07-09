/**
 * Shared constants for the MotherMode content hub: where every CTA points, and
 * the human labels for each platform, format, kind, and tone register.
 */
import type {
  ContentFormat,
  ContentKind,
  ContentPlatform,
  ToneRegister,
} from './types';
import { ROUTES } from '../brand';

/** Every CTA routes back to the $7 front-end offer unless a piece overrides it. */
export const CONTENT_OFFER_URL = `${ROUTES.offerBase}/brain-dump-system`;

/** Core hashtag set. Trim or extend per piece; never spammy. */
export const CORE_HASHTAGS = [
  'MotherMode',
  'MotherhoodRedesigned',
  'MentalLoad',
  'InvisibleLabor',
];

/**
 * Shared art-direction suffix for every image prompt, kept lean so the scene and
 * the hook do the work. Append after the specific scene.
 */
export const IMAGE_STYLE =
  'Shot on 35mm, soft natural window light, shallow depth of field, fine film grain. Warm bone, deep aubergine, and aged brass tones. Authentic and lived-in, no faces unless noted. Photorealistic, editorial magazine quality, no on-image text, no logos.';

/**
 * Compose a scroll-stopping, hook-anchored image prompt from a scene seed. The
 * hook leads, so the viewer feels it before reading, and the story is told
 * through objects and atmosphere rather than illustrated literally. As the hook
 * variant changes on a card, the prompt changes with it.
 */
export function buildImagePrompt(scene: string, hook: string): string {
  return `Scroll-stopping editorial documentary photograph, engineered to trigger one instant gut reaction. Before a word is read, the viewer should feel this: "${hook}". ${scene}`;
}

/**
 * One-tap edit instructions for the Image Studio Edit tab. Each inject is
 * appended to the freeform prompt so the seed stays the base composition.
 */
export interface ImageEditPreset {
  id: string;
  label: string;
  /** Short instruction block appended when the chip is ticked. */
  inject: string;
}

/** Max reference images sent with a seed edit (character, logo, product, etc.). */
export const MAX_EDIT_REFERENCES = 4;

/** Preset prompt injections for seed-based image edits. */
export const IMAGE_EDIT_PRESETS: ImageEditPreset[] = [
  {
    id: 'colors',
    label: 'Change colors',
    inject:
      'Adjust the color palette of the seed image while keeping composition, subjects, and lighting direction. Prefer warm bone, deep aubergine, and aged brass tones unless the prompt specifies otherwise.',
  },
  {
    id: 'character',
    label: 'Add character',
    inject:
      'Using the seed as the base composition, integrate the person or character from the attached reference image(s) naturally into the scene. Match lighting, perspective, scale, and color grade. Keep faces soft or out of frame unless the prompt asks otherwise.',
  },
  {
    id: 'context',
    label: 'Change context',
    inject:
      'Keep the main subject and framing from the seed, but change the narrative context and surrounding story so the image reads as a different moment or situation.',
  },
  {
    id: 'environment',
    label: 'Change environment',
    inject:
      'Keep the primary subject from the seed, but place them in a new environment or setting. Match light direction and photographic style so the composite feels seamless.',
  },
  {
    id: 'text',
    label: 'Change text',
    inject:
      'Edit, replace, or add any on-image text as described in the prompt. Keep typography legible and consistent with an editorial brand look. If no text is requested, leave lettering alone.',
  },
  {
    id: 'lighting',
    label: 'Adjust lighting',
    inject:
      'Restage the lighting of the seed image (time of day, softness, direction, warmth) while preserving composition and subjects.',
  },
  {
    id: 'restyle',
    label: 'Restyle',
    inject:
      'Keep the same composition and subjects as the seed, but restyle the photographic treatment (grain, contrast, palette, lens feel) to match the prompt and brand art direction.',
  },
  {
    id: 'remove',
    label: 'Remove object',
    inject:
      'Remove the object or element described in the prompt from the seed image. Fill the area naturally so the edit is seamless and the rest of the scene is unchanged.',
  },
  {
    id: 'logo',
    label: 'Add logo',
    inject:
      'Incorporate the logo or mark from the attached reference image(s) into the seed scene as described. Place it tastefully, keep edges clean, and do not invent a different logo.',
  },
];

export const PLATFORM_LABEL: Record<ContentPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  email: 'Email',
  pinterest: 'Pinterest',
  blog: 'Blog',
  aeo: 'AEO',
};

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  feed: 'Feed post',
  carousel: 'Carousel',
  story: 'Story',
  reel: 'Reel',
  thread: 'Thread',
  article: 'Article',
  video: 'Video',
  email: 'Email',
  pin: 'Pin',
  idea: 'Idea pin',
  blog: 'Blog post',
  answer: 'Answer page',
};

export const KIND_LABEL: Record<ContentKind, string> = {
  organic: 'Organic',
  ad: 'Ad',
};

/** The native formats worth offering per platform, so combos stay valid. Shared
 *  by the Generate drawer and the Amplify cross-platform picker. */
export const PLATFORM_FORMATS: Record<ContentPlatform, ContentFormat[]> = {
  facebook: ['feed', 'carousel', 'story', 'reel'],
  instagram: ['feed', 'carousel', 'story', 'reel'],
  x: ['feed', 'thread', 'article'],
  tiktok: ['video'],
  email: ['email'],
  pinterest: ['pin', 'idea'],
  blog: ['blog'],
  aeo: ['answer'],
};

export const TONE_LABEL: Record<ToneRegister, string> = {
  wedge: 'The Wedge',
  confidante: 'The Confidante',
  authority: 'The Authority',
  movement: 'The Movement',
  system: 'The System',
};

