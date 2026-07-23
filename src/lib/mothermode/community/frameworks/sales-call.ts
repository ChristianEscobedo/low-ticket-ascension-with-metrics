/**
 * Owner framework: sales / strategy call script.
 *
 * Authoritative guidance the generator injects for the `salesCallScript`
 * section. Used for paid / both communities whose goal books a strategy call,
 * a workshop, or a webinar close. It carries TWO owner-supplied motions and the
 * generator picks the one that matches the intake goal:
 *
 *   MOTION A "high_ticket" (SOCCTOCCO enrolment) - the default for coaching /
 *     service / high-ticket offers booked from a strategy session. Source:
 *     docs/high-ticket-call-scripts.txt (the SOCCTOCCO Enrolment Framework).
 *   MOTION B "saas_demo" (product demo close) - for a SaaS / software demo call.
 *     Source: docs/demo-salescall-script.txt. STUB below until that script lands;
 *     swap the MOTION B block when the owner supplies it and nothing else changes.
 *
 * Output maps to salesCallScript.phases[] where each phase is
 * { key, label, lines[] } and lines are speakable prompts for that phase. Fill
 * every [bracket] from the intake (avatar, result, mechanism, offer, price,
 * goal). Never print bracket labels.
 */

export const SALES_CALL_FRAMEWORK = `
SALES / STRATEGY CALL FRAMEWORK (authoritative - follow the phase order).

Pick ONE motion based on the brief:
- Use MOTION A "high_ticket" (SOCCTOCCO) when the goal books a strategy /
  discovery / enrolment call for a coaching, service, or high-ticket offer.
  This is the default.
- Use MOTION B "saas_demo" when the goal books a software / product demo and the
  offer is a subscription or tool.

Produce phases as a small set of speakable lines the host can say almost
verbatim. Calm authority, help-first, permission before advice, never pushy.
The call is about "the next step" more than a hard pitch.

===========================================================================
MOTION A - SOCCTOCCO ENROLMENT (high-ticket, default)
===========================================================================
Pre-call framing (do not output as a phase, honor it in the lines): by call
time the prospect should already believe (1) the real problem, (2) this is the
only logical solution, (3) you are the authority, (4) they are ready to commit,
(5) this is an investment not a cost. Every phase should protect those beliefs.

Phase key "set_agenda" (Set the agenda / proof frame):
  Acknowledge these calls get a bad rap and you are here to give value. Ask
  permission for the agenda. "Is there anything specific you want me to cover
  before I jump in?" Then: "This will take about [time]. A big part is seeing if
  and how we can help, and giving you the next steps to implement [result]."

Phase key "one_thing" (One thing / the single real problem):
  Do not interrogate. Find the ONE problem that brought them here.
  "So to start, how can I help? What is the one thing I could show you that would
  move the needle on [result]?" Then dig: "What do you mean by that? Why?" Get to
  the real reason. Capture their exact pain words to reuse later.

Phase key "cost_of_inaction" (Cost of doing nothing, in their numbers):
  Get THEM to put a number on it. "If you put that same time and energy into
  [lever], how much more could you be making each [period]?" Then mirror it back:
  "So you are essentially leaving [amount] on the table each [period]."

Phase key "close_doors" (Close all other doors):
  Have them list and close every other option they were considering.
  "If it is costing you [amount] and you have known this, why has it not been
  solved yet? What have you already tried?" Let them admit each door is closed.

Phase key "timing" (Timing and logistics):
  Read urgency and fit. "How soon are you looking to get something like this
  implemented?" and "Is this a fix-it-now thing, or could you wait and piece it
  together yourself over the next few weeks?" A "now / ASAP" is a strong buy sign.

Phase key "offer" (Break down the offer with inverse benefits):
  Teach 3 to 5 new ways of thinking framed as "the [N] problems you must solve".
  For each, use: the problem, the obvious way people fail, the new idea, how we
  implement it. Tie each back to the cost of doing nothing. Ask "does this make
  sense?" and pause before moving on. Ask if they are taking notes.

Phase key "commitment" (Investment and commitment):
  Surface any lingering questions first: "Anything that stuck out or that you are
  still unsure about?" Address it. Then temp-check: "How do you feel about the
  process? Can you see how it would work for you?" Wait for them to ask how to
  work together, then lay out the investment plainly, including the price
  [price] and the timeline, framed as an investment against the cost of inaction.

Phase key "cta" (Call to action):
  Invite the decision softly and name the mechanics (deposit or full payment).
  "Here is what I would suggest as the next step. How does that sound?"

Phase key "objections" (Objections via the 5 beliefs):
  For every objection: acknowledge ("that makes total sense"), isolate ("is this
  the main thing stopping you?"), dig for the real reason, then address the next
  step that solves it. Proof requests are usually a shit test: "What specifically
  would give you concrete proof this works?" then "Honestly, the only thing that
  builds real certainty is getting you a first win. What would that first tangible
  win be?" Get the specific answer and, if needed, set a follow-up call.

===========================================================================
MOTION B - SAAS DEMO CLOSE (product demo)  [STUB - replace when script lands]
===========================================================================
Until the owner supplies docs/demo-salescall-script.txt, use this safe spine and
keep the SOCCTOCCO posture: help first, permission before showing anything.
Phase key "set_agenda": confirm what they want out of the demo and the time.
Phase key "discovery": find the one workflow / outcome that matters most today.
Phase key "cost_of_inaction": quantify the time or money the current way costs.
Phase key "demo": show ONLY the path to that one outcome, narrated as their use
  case, confirming value after each step ("does that solve [pain]?").
Phase key "pricing": present the plan and price [price] tied to the value shown.
Phase key "cta": invite the start (trial, deposit, or signup) as the next step.
Phase key "objections": acknowledge, isolate, dig, and resolve with a next step.

VOICE: calm authority, plain and specific, questions over claims, periods over
exclamation points, no em or en dashes, no hype or false scarcity, no earnings
guarantees.
`.trim();
