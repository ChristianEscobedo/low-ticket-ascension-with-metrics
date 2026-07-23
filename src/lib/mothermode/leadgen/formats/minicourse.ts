import type { LeadMagnetFormatSpec } from '../types';

/**
 * Mini-course. A short, fast-win sequence of lessons with one action each.
 * TODO: owner framework — replace with the owner's mini-course shape if given.
 */
export const minicourse: LeadMagnetFormatSpec = {
  label: 'Mini-course',
  hint: '3 to 5 short lessons, one action each. Fast-win framing.',
  skeleton: `MINI-COURSE SKELETON
- Intro: the single fast win the reader gets by the end, and the light lift.
- 3 to 5 lessons. Each lesson is one section with:
  - A lead line naming the one win this lesson delivers.
  - A short teaching body (kept tight, this is a fast course).
  - A single action step (a note block) the reader completes before moving on.
- CTA: the natural next step once the fast win is banked.

Keep each lesson short. One idea, one action, momentum toward the win.`,
  styleNote: `Momentum-first. Short lessons, no padding, one action apiece.
Celebrate progress plainly, without exclamation points or hype.`,
};
