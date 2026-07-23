/**
 * High Ticket owner frameworks (D.I.M.E. method + 7 A's), aggregated.
 *
 * Each constant is authoritative guidance the generator injects for one kit
 * section. `frameworkForSection` returns the block for a given section so the
 * generator (openai-highticket) and per-section regeneration stay in sync with
 * the KitSection union. Sourced from the DIME workbook
 * (supabase/migrations/dime-method-high-ticket.txt).
 */
import type { KitSection } from '../types';

export const BASICS_FRAMEWORK = `BASICS — WHO YOU HELP + THE PROBLEMS YOU SOLVE

Before extracting the offer, map the foundation.

Who is the person you help?
- Gender(s): who specifically buys this.
- Age range: e.g. 40-60.
- Labels / beliefs: identity markers and beliefs, e.g. "believes in self-development, has plateaued in business, wants the big picture."

What are the problems you solve? For each problem capture three columns:
- Problem: the thing they are stuck on.
- Cost: what it costs them — money ($2k-$50k/mo), time, lost family/self time, stress, putting out fires instead of managing.
- Result: what they gain once solved — confidence, less overwhelm, clear next steps, focus on revenue-generating activities, healthy cash flow.

Rules:
- Be concrete and specific to the niche. Use their language.
- 3-5 problem rows is plenty. These seed the 7 A's and the DIME pillars.`;

export const SEVEN_AS_FRAMEWORK = `THE 7 A'S — CONTRARIAN COPY / OFFER EXTRACTION

Goal: create cognitive dissonance (introduce a new belief that conflicts with their current one) so the ONLY comfortable way forward is to change behavior (buy/act). Cover all 7 or the offer has gaps. Answer the mapped questions in each element:

Attention — the surface-level problems that grab attention.
  Q1: What are the biggest surface-level problems? (how do I get more leads/exposure/reach more people?)

Acknowledge — acknowledge all their problems in their own words.
  Q2: Who suffers it most?
  Q3: What are people currently doing to try to fix it? (ads, cold calling, referrals, networking, etc.)

Agitate — introduce the REAL problem + your mechanism (this creates the dissonance).
  Q4: What is the real reason behind this problem, and your mechanism to solve it?

Authority — prove you can deliver (or they'll seek outside sources).
  Q5: What tangible proof do you have? (results, market proof, competitor stories)
  Q6: What certainty do you have about the results? (guarantee)
  Q7: What is the sophistication level of the problem/prospect? (problem-aware, solution-aware, etc.)
  Q8: How long will it take to get results?

Angst — the cost of doing nothing (or it won't matter enough).
  Q9: What is the physical/emotional cost of doing nothing, and how does it look/feel? (stress, mistakes, lost family time, feeling like a failure)

Ambiguity — the exact steps (or they'll doubt it works for them).
  Q10: What are the 4-5 obstacles the customer must overcome to fix the problem? These become the DIME pillars.

Appeal — price + add-ons that make it a no-brainer (create immediate action).
  Price: what can you price this at?
  Add-ons: what additional features/benefits make the decision easy? (lead nurturing, conversion expertise, positioning, etc.)

Write each element as a tight paragraph in the coach's voice. When all 7 are filled, the messaging is "bullet proof" and can be reused across scripts, pages, posts, and ads.`;

export const OFFER_FRAMEWORK = `THE EXTRACTED OFFER — SUPER "I HELP" STATEMENT + STACK

Extract the core of the offer by pulling from the 7 A's worksheet.

Super "I help" statement (fill the blanks):
"I help [customer] solve the problem of [physical pain] by fixing [real problems] using [real solution/mechanism] in [time].
Doing this, [customer] can stop/avoid [cost of doing nothing] and achieve [physical desire] without [obstacle]."

Example:
"I help real estate agents solve the problem of stagnant business growth by fixing their listing system and messaging using our Structured A.I. combined with expert-level real estate coaching in under 12 weeks. Doing this, agents can avoid wasting time and opportunity — costing them thousands per month — without needing to cold call or rely on referrals."

Also produce:
- Program name: 3-5 on-voice options + one recommended pick. Premium, outcome-oriented, not gimmicky.
- Price / price band: from Appeal (e.g. 10k-20k).
- Payment options: pay-in-full and/or split.
- Guarantee / certainty: the risk reversal (from Authority Q6).
- Appeal add-ons: the no-brainer bonuses/features (from Appeal).
- Positioning: who it's for and who it's NOT for (frame it so the prospect sees THEY get the better deal at a premium price).`;

export const PROBLEMS_FRAMEWORK = `D.I.M.E. PROBLEM PILLARS — THE 3-4 PROBLEMS YOU SOLVE

Take the 4-5 obstacles from Ambiguity and turn each into a problem pillar the prospect must accept to trust you as the authority. Use 3-4 pillars. Each pillar has four parts:

Title: e.g. "#1 Problem — Finding the real reason you're stuck at $25k/mo".

Problem: name the real problem (the root cause, the thing to get clear on, the thing they must reject, or what makes results stick). Not the surface symptom.

Angst: the "Where most [avatar] go wrong is thinking [false belief]..." scenario. Show the common enemy and what happens if it isn't solved. Make the cost vivid (a metaphor is welcome — "like having a golden ticket to a luxury cruise but choosing to row a boat instead").

Solution: "We map out [X] so that you never have to deal with [problem] ever again. This is the missing piece most [avatar] that are trying to [desire] completely overlook — and it all starts here."

Implementation: "Finally, we action this out together by:" then 5 concrete numbered steps that lead to the pillar's outcome.

The pillars should build logically toward the transformation and set up an easy YES on the enrollment call.`;

export const OFFER_SCRIPT_FRAMEWORK = `THE OFFER SCRIPT — ENROLLMENT-CALL PRESENTATION

Assemble the DIME pillars into a spoken presentation. Produce ONE script pillar per problem, in order. This is a problem-solution presentation, not a hard-sell script — the prospect should clearly see they are getting the better deal.

For each pillar:
- Label: "SCRIPT | PILLAR ONE", "SCRIPT | PILLAR TWO", etc.
- Body (spoken, first-person "we", conversational):
  1. Open: "The [first/next/last] problem we need to address is [problem]..." and why it matters.
  2. Agitate: "Where most [avatar] go wrong is thinking [false belief]..." — the common enemy and the cost of not solving it.
  3. Solution: "We map out [X] so that you never have to deal with [problem] ever again. This is the missing piece most [avatar] overlook, and it all starts here."
  4. Implementation: "Finally, we action this out together by:" + the 5 steps.
  5. Close each pillar with: "Does that make sense?"

Keep the voice warm, certain, and consultative. The cumulative effect of the pillars is that the prospect trusts you as the authority who will solve the deep problems they've been trying to solve.`;

const BY_SECTION: Record<KitSection, string> = {
  basics: BASICS_FRAMEWORK,
  sevenAs: SEVEN_AS_FRAMEWORK,
  offer: OFFER_FRAMEWORK,
  problems: PROBLEMS_FRAMEWORK,
  offerScript: OFFER_SCRIPT_FRAMEWORK,
};

/** The authoritative framework block for a single section. */
export function frameworkForSection(section: KitSection): string {
  return BY_SECTION[section];
}

/** Concatenate the frameworks for the given sections (in order). */
export function frameworksFor(sections: KitSection[]): string {
  return sections
    .map((s) => `--- ${s} ---\n${frameworkForSection(s)}`)
    .join('\n\n');
}
