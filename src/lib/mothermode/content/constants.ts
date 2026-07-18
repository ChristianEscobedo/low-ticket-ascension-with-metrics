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

/**
 * Cinematic multi-panel storyboard contact-sheet system prompt. Prepended to

 * every board imagePrompt so renders stay production-grade. Lookback continuity
 * and post-specific scene content are supplied per board by the planner.
 */
export const STORYBOARD_SYSTEM = `Create a cinematic multi-panel storyboard contact sheet featuring the SAME character consistently across every scene. The storyboard must feel like a premium film-production planning board created for directors, cinematographers, and commercial production teams.
The system should intelligently interpret the provided scene ideas and visually expand them into believable cinematic moments with natural continuity.
CORE DIRECTIVE:
Do NOT create generic repeated panels.
Do NOT create symmetrical layouts.
Do NOT make every shot the same angle or composition.
Every panel must feel:
intentionally art directed
visually distinct
emotionally connected
part of the same cinematic world
like frames from a real movie or premium commercial
STYLE:
Ultra realistic cinematic photography
Real-world environments
Film-grade lighting
Natural human imperfections
Commercial-level cinematography
Soft depth of field
Atmospheric realism
Realistic textures and materials
Natural fabric folds and wear
Realistic skin texture
Cinematic color grading
NOT AI-looking
NOT cartoonish
NOT overly polished CGI
CHARACTER CONSISTENCY (STRICT):
The SAME character must appear in every panel with:
identical facial structure
identical hairstyle
identical body proportions
consistent wardrobe logic
believable emotional continuity
Minor natural variations allowed:
expression changes
subtle wardrobe adjustments
lighting changes
realistic movement changes
The character must feel like a real actor captured across multiple moments of a day or sequence.
When a character reference image is attached, match that person exactly across every panel.
When product or environment reference images are attached, integrate them faithfully.
LAYOUT:
Multi-panel storyboard/contact sheet layout
Cinematic production-board aesthetic
Black matte spacing between panels
Clean numbering system
Bold cinematic typography
Slightly asymmetrical composition
Premium studio pitch-board design
Include a bottom "VIDEO PROMPT" production section
SCENE GENERATION RULES:
For each scene:
Expand the idea cinematically
Create realistic environmental storytelling
Add believable actions and props
Use varied camera framing
Use different lens styles naturally
Include environmental depth
Add cinematic lighting motivation
Create visual continuity between scenes
CAMERA VARIETY:
Use a natural mix of:
close-ups
medium shots
wide shots
over-the-shoulder shots
cinematic profile shots
environmental framing
dynamic perspective shots
LIGHTING:
Use realistic motivated lighting:
practical lights
sunlight
neon
lamps
window lighting
atmospheric shadows
cinematic contrast
Prefer warm bone, deep aubergine, and aged brass tones when they fit the scene.
ENVIRONMENT:
The environment should evolve naturally with the scenes while maintaining continuity and realism.
MATERIAL ACCURACY:
Everything must feel physically believable:
fabrics stretch naturally
objects show wear
lighting reacts correctly
skin reflects soft realistic light
environments feel lived in
BOTTOM SECTION:
Generate a cinematic production-style "VIDEO PROMPT FOR THIS STORYBOARD" section describing:
cinematography style
camera movement
lighting approach
emotional pacing
environment continuity
realism notes
transition style
overall visual direction
FINAL RESULT:
The output should feel like:
a Netflix production board
luxury commercial previsualization
cinematic storyboard photography
premium film pitch material
real production planning art
Ultra detailed.
Cinematic realism.
Production-ready fidelity.
High emotional readability.
Consistent character identity across all scenes.`;

/**
 * Compose the full image prompt for one storyboard contact sheet: system craft
 * first, then the board-specific scene expansion from the planner.
 */
export function buildStoryboardImagePrompt(boardPrompt: string): string {
  const body = boardPrompt.trim();
  if (!body) return STORYBOARD_SYSTEM;
  return `${STORYBOARD_SYSTEM}\n\nBOARD-SPECIFIC DIRECTION:\n${body}`;
}

/** Max product/environment refs on a storyboard pack (character is separate). */
export const MAX_STORYBOARD_REFERENCES = 3;

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

