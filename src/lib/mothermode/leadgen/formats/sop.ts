import type { LeadMagnetFormatSpec } from '../types';

/**
 * SOP (standard operating procedure). Precise, repeatable, role-aware.
 * TODO: owner framework — replace with the owner's SOP template if given.
 */
export const sop: LeadMagnetFormatSpec = {
  label: 'SOP (standard operating procedure)',
  hint: 'A precise, repeatable procedure. Purpose, roles, numbered steps.',
  skeleton: `SOP SKELETON
- Purpose: what this procedure guarantees when followed.
- Scope: where it applies and where it does not.
- Roles: who does what (a list).
- Procedure: numbered steps, each its own section, with the action, the expected
  result, and any checkpoint to confirm before moving on.
- Checkpoints: a checklist block the operator ticks as they go.
- Definitions: any terms that must mean exactly one thing (a list).
- CTA: the next step (adopt, delegate, or level up the system).

Steps must be unambiguous. Anyone qualified should get the same result.`,
  styleNote: `Neutral, exact, operational. No persuasion inside the steps. Use
imperative verbs and name the expected output of each step.`,
};
