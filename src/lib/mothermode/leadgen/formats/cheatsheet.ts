import type { LeadMagnetFormatSpec } from '../types';

/**
 * Cheat sheet. Tight, scannable, one-page feel.
 * TODO: owner framework — replace with the owner's cheat-sheet layout if given.
 */
export const cheatsheet: LeadMagnetFormatSpec = {
  label: 'Cheat sheet',
  hint: 'Scannable quick reference. Bullets and short blocks, one-page feel.',
  skeleton: `CHEAT SHEET SKELETON
- Intro: one or two lines on what this reference is for and when to grab it.
- 3 to 6 tight sections, each a short heading plus a bullet list of quick,
  reference-grade items (rules, ratios, do/don't, quick steps).
- Optional quick-reference note block for the single most important takeaway.
- CTA: a one-line pointer to the deeper next step.

No long paragraphs. Everything should be skimmable in under a minute.`,
  styleNote: `Terse and high-density. Bullets over paragraphs. Each bullet is a
complete, usable rule the reader can act on without more context.`,
};
