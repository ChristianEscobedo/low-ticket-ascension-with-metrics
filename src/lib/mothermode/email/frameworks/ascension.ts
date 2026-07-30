import type { EmailFrameworkSpec } from '../types';

/** Buyer welcome: the purchase-triggered confirmation that activates. */
export const buyerWelcome: EmailFrameworkSpec = {
  label: 'Buyer welcome',
  structure: `BUYER WELCOME STRUCTURE
- Affirmation: what she just did and why it was the right call, 2-3 warm lines, specific to the product.
- Access: everything she gets, each item with its link, in a short clean list.
- First move: exactly one action sized for tonight (never "explore the member area").
- What happens next: the 2-3 emails coming and why each is worth opening.
- P.S. option: a human answers replies, named plainly.`,
  lengthTarget: 'short/medium',
  styleNote: `Warm and specific, never celebratory theater. No upsell or second offer
anywhere in this email. The first move is one action, sized for tonight.`,
};

/** Ascension bridge: the nurture email that plants the next offer after a win. */
export const ascensionBridge: EmailFrameworkSpec = {
  label: 'Ascension bridge',
  structure: `ASCENSION BRIDGE STRUCTURE
- Celebration: the win she just got, named specifically.
- The reveal: the next problem, stated as the natural consequence of solving the first.
- Why this order: 2-3 lines on why this sequence works, with the receipt or the logic.
- The seed: what exists for exactly this, one calm paragraph, honest price.
- Soft-direct CTA: see if it fits.
- P.S. option: the no-pressure line (it is there when she is ready) plus what free value comes next.`,
  lengthTarget: 'short/medium',
  styleNote: `The seed is planted by the logic, never by urgency. One paragraph on the
offer, no stack, no bonuses theater. Calibration over conversion: say who should wait.`,
};

/** Deep nurture: the long value essay that keeps buyers warm for the next launch. */
export const deepNurture: EmailFrameworkSpec = {
  label: 'Deep nurture',
  structure: `DEEP NURTURE STRUCTURE
- Context: she is weeks in; name what is probably true for her now.
- The next layer: 2-3 advanced moves beyond the basics of what she owns, each with its how.
- The case study: one buyer who runs the advanced layer, with the receipt.
- The gentle bridge: what this layer points to next, one honest line (or end pure value, no CTA).`,
  lengthTarget: 'long',
  styleNote: `Value first by a wide margin; the bridge is one honest line at most.
Teaching the advanced layer of what she already owns raises the value of her
purchase retroactively. Some sends end with no CTA at all; that restraint is the point.`,
};

/** OTO ascend: from the upsell purchase to the offer that completes the stack. */
export const otoAscend: EmailFrameworkSpec = {
  label: 'OTO ascend',
  structure: `OTO ASCEND STRUCTURE
- Recap: what she has now, core plus upgrade, and what it already does for her, 3 lines.
- The gap: the one thing the current stack does not cover, stated precisely, with the moment she will feel it.
- The completion: what exists for exactly that gap, one calm paragraph, with a receipt or case study.
- The math: the honest price and the value framing, 2 lines.
- Direct warm CTA: see if it completes your set.
- P.S. option: the disqualifier, who should skip this, honestly.`,
  lengthTarget: 'short/medium',
  styleNote: `Reads as service, not sales: recap her stack first. The gap must be real
and precisely named. No countdown, no bonuses theater. The disqualifier keeps the
ascension chain trustworthy.`,
};

/** Goal driven: the single-goal ask (book a call, attend the event, reply, join). */
export const goalDriven: EmailFrameworkSpec = {
  label: 'Goal driven',
  structure: `GOAL DRIVEN STRUCTURE
- Situation: describe her exact moment so precisely she feels named, 3-4 lines.
- What happens: the 2-3 things the goal delivers (the call's outcomes, the event's takeaways), concrete.
- The filter: who this is for, and the honest disqualifier, equal space.
- One CTA: the single goal, direct and warm (book, register, reply, join).
- P.S. option: the calm line that kills the last fear (no pitch, replay answer, or proof).`,
  lengthTarget: 'short/medium',
  styleNote: `One goal per email, one link. Demystify the thing being asked: what
happens, how long, what she leaves with. The honest filter does the converting;
calibrate every claim.`,
};

/** P.S. close: the soft body sells nothing; the postscript carries the offer. */
export const psClose: EmailFrameworkSpec = {
  label: 'P.S. close',
  structure: `P.S. CLOSE STRUCTURE
- Soft body: one story, lesson, or validation, complete in 3-5 short paragraphs. No offer, no link.
- Warm signoff.
- P.S.: the offer, 2-3 plain lines: what it is, who it is for, the price, the link.
- P.P.S.: the calibration, a receipt or the honest line about who should skip it.`,
  lengthTarget: 'short/medium',
  styleNote: `The body must be complete and valuable with zero selling; if a link
appears before the P.S., the format collapses. The postscript stays plain and calm,
no hype, no countdown. The P.P.S. is what keeps the P.S. trustworthy.`,
};
