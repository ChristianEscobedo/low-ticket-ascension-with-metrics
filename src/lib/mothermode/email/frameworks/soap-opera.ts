import type { EmailFrameworkSpec } from '../types';

/**
 * Soap opera. Serialized, open-loop storytelling that pulls the reader from one
 * email into the next.
 */
export const soapOpera: EmailFrameworkSpec = {
  label: 'Soap opera',
  structure: `SOAP OPERA STRUCTURE
- Open loop: start mid-tension with a hook that raises a question.
- Backstory: give just enough context to make the tension land.
- Drama / turning point: the moment things shift.
- Epiphany: the realization that reframes the reader's situation.
- One clear CTA tied to that realization.
- Cliffhanger: tease what the next email answers so the reader waits for it.`,
  lengthTarget: 'medium',
  styleNote: `Conversational and personal. One idea per paragraph. The cliffhanger
must feel earned, not gimmicky. Never resolve everything in one email.`,
};
