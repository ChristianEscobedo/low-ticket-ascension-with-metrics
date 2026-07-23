import type { EmailFrameworkSpec } from '../types';

/** Case study / proof: before, intervention, after, "you can too". */
export const caseStudy: EmailFrameworkSpec = {
  label: 'Case study / proof',
  structure: `CASE STUDY STRUCTURE
- Before: the starting situation, with the reader's own struggle in it.
- Intervention: what changed and the specific mechanism behind it.
- After: the concrete result, stated plainly and honestly.
- "You can too": bridge to the reader, then one clear CTA.`,
  lengthTarget: 'medium',
  styleNote: `Specific and honest. Use real detail over superlatives. No income or
outcome guarantees; describe what happened, not what is promised.`,
};
