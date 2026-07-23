import type { EmailFrameworkSpec } from '../types';

/** Listicle: numbered value points, each with a micro-CTA, then a close. */
export const listicle: EmailFrameworkSpec = {
  label: 'Listicle',
  structure: `LISTICLE STRUCTURE
- One-line intro that frames the list and why it matters.
- Numbered points (3 to 7), each a self-contained piece of value.
- A light micro-CTA woven in where it fits naturally.
- Close with one clear primary CTA.`,
  lengthTarget: 'medium',
  styleNote: `Scannable and punchy. Each point earns its number. Front-load the
value in each item so a skimmer still gets the point.`,
};
