import type { EmailFrameworkSpec } from '../types';

/** Founder note: a plain, personal, direct note from the founder. */
export const founderNote: EmailFrameworkSpec = {
  label: 'Founder note',
  structure: `FOUNDER NOTE STRUCTURE
- Open like a personal message, not a broadcast.
- Say the one honest thing the founder wants the reader to know.
- Make the ask plainly, then one clear CTA. Sign off as the founder.`,
  lengthTarget: 'short/medium',
  styleNote: `Plain, warm, unpolished-on-purpose. First person. No marketing gloss.
It should read like a real note from a real person.`,
};
