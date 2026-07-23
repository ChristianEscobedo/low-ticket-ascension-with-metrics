/**
 * Owner framework: DM scripts.
 *
 * Authoritative guidance the generator injects for the `dmScript` section. It
 * encodes TWO proven owner scripts and tells the model which one to build based
 * on the community goal:
 *
 *   1. THE DM-VSL  — for goals that SELL (low-ticket offer, masterclass/webinar
 *      seat, checkout). Power Opener -> soft opt-in on the lead magnet -> DM-VSL
 *      video -> this/that -> knowledge gap -> link / next step.
 *   2. EXCUSE TO OUTREACH — for goals that BOOK (strategy call, discovery call).
 *      A genuine, about-them opener off real engagement -> value -> qualify ->
 *      reframe -> soft CTA to a short call.
 *
 * The model fills every bracket from the intake (avatar, result, mechanism,
 * lead magnet, offer, price, goal). Output maps to dmScript.stages[] where each
 * stage is { key, label, message } and message may contain the numbered lines /
 * follow-ups for that stage.
 *
 * Source: DM-VSL-DMscript.txt and Excuse-to-outreach-scripts.txt (owner's live
 * scripts).
 */

export const DM_SCRIPTS_FRAMEWORK = `
DM SCRIPT FRAMEWORK (authoritative — follow the matching script exactly).

Pick ONE spine based on the community GOAL from the intake:
- If the goal SELLS something (low-ticket offer, masterclass/webinar seat, a
  checkout/purchase): build the DM-VSL SPINE.
- If the goal BOOKS a conversation (strategy call, discovery call): build the
  EXCUSE-TO-OUTREACH SPINE.
Fill every [bracket] with specifics from the intake. Never leave a bracket and
never print the bracket label itself.

=== DM-VSL SPINE (goal: make the sale) =========================================
Frame: Power Opener -> Engage Lead -> DM-VSL -> Sale/Next step. Direct but not
intrusive. Give real value first to disarm the guard, then guide to the offer.

Stage 1 "opener" (Power Opener + steal the frame):
  Greet by name, answer/return the pleasantry briefly, then offer the lead
  magnet as a gift to new friends:
  "I always give new friends access to my [lead magnet name]. It will help you
  [main result it delivers]. If you want it just reply YES here so I know it is
  ok to send the link." (Note to send a relevant image of the resource.)

Stage 2 "follow_up" (two gentle nudges, one day apart):
  Nudge 1: "Would you like me to send it over, [Name]?"
  Nudge 2: "I was asking because this is part of my process that helps with
  [result or desire]." Then drop the DM-VSL (a 1 to 3 minute video that says why
  they got it, the result of the next step, why to move now, and a clear CTA).

Stage 3 "deliver" (they said yes / thumbs up):
  "Sure thing." then send the link (the [offer / checkout / masterclass signup]).

Stage 4 "this_or_that" (12 to 24 hours later, re-open):
  "Quick question. Are you [this] or [that]?" (a real either/or about their
  situation, e.g. growing or just starting). Wait for the reply.

Stage 5 "knowledge_gap" (go direct, non-intrusive):
  "Here is why I asked. We are looking for [specific person] who is [specific
  situation] to get [specific result from the DM-VSL] by [unexpected solution].
  Would that be worth a chat for you?"

Stage 6 "close" (move to the offer / booking):
  If yes: "Here is the breakdown, watch it and I will check in tomorrow to
  answer any questions. Sound good?" then send the link or booking link. If no,
  simply ask why not, no pressure.

=== EXCUSE-TO-OUTREACH SPINE (goal: book a call) ===============================
Frame: find a real excuse to reach out, make it about THEM, deliver value, then
soft-CTA to a short call. Always ask permission before advice.

Stage 1 "opener" (about them, off real engagement):
  Reference a genuine detail (they engaged your post, made a cool post, a comment
  that resonated): "Hi [Name], thanks for engaging on [post]. Looks like we are
  on a similar mission. How have things been for you lately?" (Keep it warm and
  specific, never templated.)

Stage 2 "qualify" (find the knowledge gap and micro-result):
  "We do a similar thing, we [knowledge gap]. Are you [question about the gap]?"
  then "Are you currently getting more than [micro result]?" Acknowledge and
  mirror their answer.

Stage 3 "value" (give first):
  "I just did a quick training on [result of the knowledge gap]. Want me to send
  it over?" If yes, deliver the link/resource right away. If no, leave the door
  open kindly.

Stage 4 "diagnose" (specific + congruent):
  "Are you currently at more or less than [specific result/pain] in [time
  frame]?" Agree with their answer, then ask "What has been your biggest
  struggle?" or "What is your next goal?"

Stage 5 "reframe" (permission-based, then reframe + cost of inaction):
  Ask permission: "Mind if I weigh in on this?" Then: "I see [common belief]
  often. Sounds like the reason you are [problem] is you are [not] doing
  [knowledge gap]. That is why most [people] end up [cost of doing nothing]."

Stage 6 "cta" (soft booking):
  "Here is what I am thinking. Let us book a short 15 minute call. I can answer
  your questions about [free training] and get you into momentum on the next
  step. Make sense?" If yes, drop the booking link. If they resist, ask the real
  reason and offer another way to help, never push.

VOICE: calm authority, specific, about them, no hype, periods over exclamation
points, no em or en dashes. Short lines that read naturally in a chat window.
`.trim();
