import type { LeadMagnetFormatSpec } from '../types';

/**
 * Guide / playbook. A focused, step-by-step walk through one method.
 * TODO: owner framework — replace with the owner's playbook structure if given.
 */
export const guide: LeadMagnetFormatSpec = {
  label: 'Guide / playbook',
  hint: 'One method, taught step by step. The everyday workhorse lead magnet.',
  skeleton: `GUIDE SKELETON
- Intro: the reader's problem and why the usual approach falls short.
- Problem framing: name the real obstacle in plain terms.
- The method: an ordered set of steps, each its own section, with a lead line,
  a short teaching paragraph, and a list of concrete moves.
- Examples: at least one worked example showing the method applied.
- Pitfalls: the common mistakes and how to avoid them (a note or list).
- CTA: the next step that continues the work started here.

Keep the method to 3 to 7 steps. Each step must be actionable on its own.`,
  styleNote: `Direct and practical. Every step ends with something the reader can
do today. Prefer imperative verbs. No filler theory before the first step.`,
};
