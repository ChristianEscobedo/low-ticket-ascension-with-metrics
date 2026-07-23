import type { LeadMagnetFormatSpec } from '../types';

/**
 * Course / training. Modules made of lessons. Uses the section.lessons array.
 * TODO: owner framework — replace with the owner's curriculum shape if given.
 */
export const course: LeadMagnetFormatSpec = {
  label: 'Course / training',
  hint: 'Modules broken into lessons. Each lesson teaches then assigns action.',
  skeleton: `COURSE SKELETON
- Intro: the transformation the course delivers and how it is structured.
- 3 to 6 modules. Each module is one section with a lead framing the module goal
  and a set of lessons (use the section's lessons array). Each lesson has:
  - Objective: the one thing the learner can do after it (a lead line).
  - Teaching body: paragraphs and lists that teach the point.
  - Action step: a note block with the exact task to complete.
  - Recap: one or two sentences locking in the lesson.
- CTA: the next step that continues the learning journey into the paid offer.

Lessons build in order. Reference earlier lessons rather than repeating them.`,
  styleNote: `Instructional and encouraging without hype. Every lesson ends in an
action. Keep objectives observable ("you can...", "you will have...").`,
};
