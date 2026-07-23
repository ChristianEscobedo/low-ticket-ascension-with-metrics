import type { LeadMagnetFormatSpec } from '../types';

/**
 * Template / fill-in. Instructions plus reusable fill-in blocks the buyer edits.
 * Uses the `template` DocBlock.kind for labeled placeholder blocks.
 * TODO: owner framework — replace with the owner's template style if given.
 */
export const template: LeadMagnetFormatSpec = {
  label: 'Template / fill-in',
  hint: 'Reusable fill-in blocks with instructions the buyer customizes.',
  skeleton: `TEMPLATE SKELETON
- Intro: what the template produces and how to use it.
- How to use: a short numbered list of instructions.
- The template blocks: 3 to 8 sections, each a labeled fill-in the buyer edits.
  Use the "template" block kind for the reusable fill-in copy, with clear
  [PLACEHOLDER] markers the buyer swaps for their own details, and a short
  instruction line above each block explaining what to put there.
- CTA: the next step once the template is filled in and in use.

Every template block must be genuinely reusable, not a one-off example.`,
  styleNote: `Practical and copy-ready. Placeholders in [BRACKETS] and ALL CAPS.
Instruction lines are short and specific about what goes in each blank.`,
};
