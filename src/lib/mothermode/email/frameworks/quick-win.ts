import type { EmailFrameworkSpec } from '../types';

/** Quick win: one tip, one action, one CTA. Scannable and fast. */
export const quickWin: EmailFrameworkSpec = {
  label: 'Quick win',
  structure: `QUICK WIN STRUCTURE
- One tip the reader can use in the next five minutes.
- One action step spelled out plainly.
- One CTA that points to the resource for the next win.`,
  lengthTarget: 'short',
  styleNote: `Fast and scannable. No preamble. Get to the tip in the first line and
keep the whole email skimmable on a phone.`,
};
