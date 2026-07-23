import type { LeadMagnetFormatSpec } from '../types';

/**
 * Swipe file. Categorized copy examples with usage notes.
 * TODO: owner framework — replace with the owner's swipe categories if given.
 */
export const swipefile: LeadMagnetFormatSpec = {
  label: 'Swipe file',
  hint: 'Categorized, copy-and-adapt examples with usage notes.',
  skeleton: `SWIPE FILE SKELETON
- Intro: what the swipes are for and how to adapt them (not copy verbatim).
- 3 to 6 categories. Each category is one section with:
  - A lead line on when to reach for this category.
  - A list or set of "template" blocks holding the swipe copy itself.
  - A short note on how to tailor each swipe to the reader's situation.
- CTA: the next step once the swipes are in rotation.

Every swipe must be usable copy, with [PLACEHOLDERS] where personalization goes.`,
  styleNote: `Copy-ready and specific. Swipes read like real, finished lines with
obvious blanks to personalize. Usage notes are one sentence each.`,
};
