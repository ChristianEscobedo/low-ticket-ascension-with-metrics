/**
 * Owner framework: community name + public description.
 *
 * Authoritative guidance the generator injects for the `names` and
 * `description` sections (and the same guidance seeds those keys in the full
 * kit). Swapping this module changes naming / description output without
 * touching generation logic.
 *
 * `names` maps to CommunityKit.nameOptions (5 options) + chosenName (best pick).
 * `description` maps to CommunityKit.description (the public group blurb).
 */

export const NAMES_FRAMEWORK = `
COMMUNITY NAME FRAMEWORK (authoritative).

Goal: names a cold [audience] instantly understands and wants to join, that read
well as a Skool / Facebook / Circle group title. Produce 5 DISTINCT options that
span these angles, then pick the single strongest as chosenName:

1. Outcome name - the result they want. e.g. "[Result] Collective".
2. Identity name - who they become inside. e.g. "The [Aspirational Identity]".
3. Mechanism name - the unexpected way. e.g. "The [Mechanism] Method Group".
4. Movement name - a "we" they belong to. e.g. "[Audience] Who [Do The Thing]".
5. Plain-clarity name - literal and searchable. e.g. "[Niche] for [Audience]".

RULES:
- 2 to 5 words. Say it out loud; it must be easy to say and remember.
- Speak to the [audience] and the [promise], not to the owner's brand ego.
- No hype words (ultimate, secret, guru), no income or results claims, no emojis,
  no trademark risk (avoid famous brand names).
- Title Case. No punctuation except an internal ampersand if truly needed.
- chosenName MUST be one of the 5 nameOptions verbatim.
`.trim();

export const DESCRIPTION_FRAMEWORK = `
COMMUNITY DESCRIPTION FRAMEWORK (authoritative).

Write the public description a cold visitor reads before joining. 2 to 4
sentences, plain and specific, in this order:

1. WHO it is for - name the [audience] so the right person self-selects.
2. THE PROMISE - the [result] they get and the [unexpected way] they get it.
3. WHAT HAPPENS INSIDE - the format (posts, trainings, lives, the freebie) so
   they know what they are joining.
4. THE NEXT STEP - one soft line pointing at the [goal] (book the call, grab the
   [freebie], join the workshop) without hype.

RULES:
- Lead with the person, never the sale. Calm authority.
- No hype, no false scarcity, no income or medical claims.
- Periods over exclamation points. No em or en dashes.
- Match the owner's [tone]. Use the chosen name if provided for consistency.
`.trim();

/** Combined block for the full-kit prompt (both keys generated together). */
export const NAMES_DESCRIPTION_FRAMEWORK = [
  NAMES_FRAMEWORK,
  '',
  DESCRIPTION_FRAMEWORK,
].join('\n');
