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
