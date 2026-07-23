import type { LeadMagnetFormatSpec } from '../types';

/**
 * Worksheet. Prompts plus fillable slots the reader works through.
 * Uses `template` blocks for fillable slots (a live interactive widget can be
 * layered later where one exists).
 * TODO: owner framework — replace with the owner's worksheet style if given.
 */
export const worksheet: LeadMagnetFormatSpec = {
  label: 'Worksheet',
  hint: 'Prompts and fillable slots the reader completes to get a result.',
  skeleton: `WORKSHEET SKELETON
- Intro: the outcome the reader builds by working through the sheet.
- 3 to 7 prompt sections. Each section is one prompt with:
  - A lead line posing the question or reflection.
  - A short paragraph on how to answer it well (what a good answer looks like).
  - A "template" block with a labeled [ YOUR ANSWER ] slot to fill in.
- CTA: the next step once the worksheet is complete.

Prompts should sequence into a finished artifact by the last slot.`,
  styleNote: `Reflective but concrete. Each prompt earns its slot by moving the
reader toward the final result. Model what a strong answer contains.`,
};
