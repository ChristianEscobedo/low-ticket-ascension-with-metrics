/**
 * MotherMode brand constants. The fixed parts of the brand that every offer
 * page shares: name, taglines, founder, palette, and the localStorage keys the
 * funnel owns. Per-offer copy lives in the offer catalog (./offers).
 *
 * Voice rules enforced across all copy: no em dashes, no NO-list words
 * (thrive, mama, empower, journey, girlboss, etc.). See design-guide.txt.
 */

export const BRAND = {
  name: 'MotherMode',
  brandLine: 'Motherhood, Redesigned.',
  conversionLine: 'Reclaim more.',
  categoryLine: 'The OS for modern motherhood.',
  movementLine: 'A movement of mothers who refuse to disappear.',
  generationalLine: 'So our daughters will not have to.',
} as const;

export const FOUNDER = {
  name: 'Loni Brown',
  role: 'Founder of MotherMode',
  personalLine: 'Doing motherhood differently.',
  // Kept generic per the design guide's children-privacy rule.
  bio: [
    'I built MotherMode because I have two daughters. 8 and 5. If they choose motherhood someday, I refuse to hand them the version I inherited.',
    'I am not a productivity coach. I am a mother who got tired of running an operating system written for a woman who does not exist. So I redesigned it. This is the work, made portable.',
  ],
} as const;

/** Editorial Warm palette. Tailwind classes cover most usage; these hexes are
 *  for the rare inline-style moments (gradients, dotted textures). */
export const PALETTE = {
  bone: '#F5F1EB',
  ink: '#1A1816',
  mode: '#532B3C',
  modeDeep: '#3D1F2D',
  mushroom: '#B0A091',
  brass: '#A88B5C',
  inkBlack: '#0A0A0A',
} as const;

/** localStorage keys this funnel owns. */
export const STORAGE = {
  ref: 'mothermode_ref',
  timer: 'mothermode_timer',
  purchases: 'mothermode_purchases',
  onboarding: 'mothermode_onboarding_done',
  contentReview: 'mothermode_content_review',
} as const;

/** Route roots. Front-end offers live at /mothermode/[slug]. */
export const ROUTES = {
  offerBase: '/mothermode',
  checkout: '/mothermode/checkout',
} as const;
