/**
 * Owner framework: community join / qualifying questions.
 *
 * This is authoritative guidance the generator injects into the system prompt.
 * The model fills in the specifics (avatar, result, offer, training name) from
 * the intake; it must NOT invent a different structure. Exactly 3 questions per
 * audience (paid and free), matching the owner's proven pre-sell template.
 *
 * Source: docs/group-questiosn-for-free-group.txt (the owner's live template and
 * real examples). Free groups pre-sell a low-ticket entry offer or masterclass;
 * paid groups qualify toward a strategy call or a (free or paid) workshop/webinar.
 *
 * Keep this as data, not prose in the route, so it can be tuned without touching
 * generation logic.
 */

export const QUALIFYING_QUESTIONS_FRAMEWORK = `
QUALIFYING-QUESTIONS FRAMEWORK (authoritative — follow this structure exactly).

Every community uses a THREE-question join flow. Question 1 segments and diagnoses,
Question 2 captures the email against a named lead magnet, Question 3 pre-frames
the next step (the "yes/no" micro-commitment). Always exactly 3 questions.

Fill every bracket with specifics drawn from the intake (avatar, result,
unexpected way/solution, pains, obstacles, offer, training name, price). Never
leave a bracket unfilled and never output the bracket labels themselves.

--- FREE COMMUNITY (goal: pre-sell a low-ticket entry offer or masterclass) ---

Q1 (multiple choice, required — diagnose the pain):
  Opening frame: "Welcome. This group is for [client avatar] who want to get
  [result] by [unexpected way or solution]. If we can help you solve one
  challenge, what would it be?"
  Provide 3-4 answer options phrased as outcomes:
    - How to get rid of [pain]
    - How to stop [obstacle]
    - How to get [result]
  (Real example option set is a good model: distinct, specific, benefit-led,
  each maps to a segment the owner can follow up on.)

Q2 (written answer / email capture, required — deliver the lead magnet):
  "We put together our clients' favorite training '[name of training]':
  [one-line description of the result it delivers]. What email can we send it to?"
  Make the training name concrete and desirable. Email required to access.

Q3 (multiple choice, required — pre-sell the entry offer):
  "This month we're offering [proven challenge / masterclass / software deal]
  for [price]: [short description of the benefit]. Hands down the fastest way we
  have seen results with our best clients. Would you like to reserve a spot?"
  End with a two-option yes/no where the YES is a gem-led affirmative and the NO
  is a soft opt-out, for example:
    - Yes, reserve my spot
    - No thanks
  Scarcity is allowed when true (e.g. "open to 40 attendees only"). Keep the
  price soft and specific (a real $7 to $497 style number), never hype.

--- PAID COMMUNITY (goal: qualify toward a strategy call or workshop/webinar) ---

Same 3-question spine, but Question 3 books the higher-intent next step instead
of a purchase:

Q1 (multiple choice, required — diagnose the growth problem):
  "Inside we have [what's inside: trainings, tools, systems] that help [avatar]
  fix [common problems]. What is most valuable for your [business/life] right
  now?" Provide 3-4 specific, benefit-led options mapped to segments.

Q2 (written answer / email capture, required — deliver the welcome asset):
  "'[Welcome asset name]': [the exact tool or SOP and the result it delivers].
  What email can we send it to?" Email required to access.

Q3 (multiple choice, required — book the strategy call or workshop/webinar):
  Offer the next step as a reservation: a free strategy call, a paid strategy
  session, or a seat in a (free or paid) workshop/webinar, whichever the intake
  points to. "We're running [strategy call / workshop / webinar]: [short benefit
  and who it's for]. Would you like [to reserve your seat / us to send the
  booking link]?" End with the gem-led yes and soft no:
    - Yes, reserve my spot
    - No thanks

VOICE: calm authority, specific, no hype, periods over exclamation points, no
em or en dashes. Keep each question tight enough to read on a join screen.
`.trim();
