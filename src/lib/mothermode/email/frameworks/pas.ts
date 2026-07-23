import type { EmailFrameworkSpec } from '../types';

/** PAS: Problem, Agitate, Solve. The direct-response workhorse. */
export const pas: EmailFrameworkSpec = {
  label: 'PAS',
  structure: `PAS STRUCTURE
- Problem: name the specific problem the reader feels right now.
- Agitate: make the cost of leaving it unsolved concrete and vivid.
- Solve: present the resource as the path out, then one clear CTA.`,
  lengthTarget: 'short/medium',
  styleNote: `Tight and specific. Agitate with real consequences, not fear-mongering.
The solve arrives fast and the CTA is unmistakable.`,
};
