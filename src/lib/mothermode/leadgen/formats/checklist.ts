import type { LeadMagnetFormatSpec } from '../types';

/**
 * Checklist. Grouped checklist items with a short intro per group.
 * Uses the `checklist` DocBlock.kind (rendered via kit.ts checklist builder).
 * TODO: owner framework — replace with the owner's checklist style if given.
 */
export const checklist: LeadMagnetFormatSpec = {
  label: 'Checklist',
  hint: 'Grouped, tickable items with a short intro per group.',
  skeleton: `CHECKLIST SKELETON
- Intro: what completing this checklist guarantees.
- 3 to 6 groups. Each group is one section with:
  - A short lead line framing why this group matters.
  - A checklist block: concrete, tickable items the reader can verify done.
- CTA: the next step once the list is fully checked.

Items are outcomes or verifiable actions, not vague intentions.`,
  styleNote: `Action-first. Each item starts with a verb and describes a done
state you could point at. Keep intros to one or two sentences.`,
};
