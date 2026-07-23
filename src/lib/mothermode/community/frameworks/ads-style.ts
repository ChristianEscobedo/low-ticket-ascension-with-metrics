/**
 * Owner framework: ads content style (drive cold/warm traffic to JOIN the group).
 *
 * Authoritative guidance the generator injects for the `ad` section. Built on
 * the owner's "welcome pack" ad messaging: lead with a specific, desirable free
 * resource, stack what is inside the group, and CTA to join. The concept must
 * point people at the community, and the offer/CTA must match the community
 * GOAL from the intake (join to grab the lead magnet, then ascend to the low
 * ticket offer / masterclass / booked call).
 *
 * Output maps to ad = { concept, primaryText, headline, description,
 * imagePrompt }. Fill every specific from the intake; never print bracket
 * labels. headline <= 40 chars, description <= 30 chars.
 *
 * Source: lead-form-ads-setup.txt (welcome pack lead-form copy) + the owner's
 * ad-messaging-for-welcome-pack style.
 */

export const ADS_STYLE_FRAMEWORK = `
ADS CONTENT STYLE (authoritative — the "welcome pack" angle).

Goal of the ad: get the right person to JOIN the community to claim a specific
free resource, then continue toward the community GOAL (lead magnet -> low
ticket offer / masterclass / webinar / booked call).

concept (angle): one sentence. Lead with the free value the [lead magnet] gives
and who it is for. Make the promise concrete and believable, tied to [result].

primaryText (the ad body): open with a pattern-interrupt hook aimed at [avatar]
and [pain]. Then present the free [lead magnet] as the reason to join. Stack 3
to 4 checkmark benefits of what is inside the group, each specific and outcome
led, for example:
  ✅ [tool / training / SOP] to [specific result]
  ✅ [templates / resources] we use to [specific result]
  ✅ an engaged community of [avatar]
  ✅ BONUS: [welcome pack asset] to [specific result]
Close with a clear CTA that matches the goal: "Join the free group below to get
[lead magnet]" (or book / register, per the goal). No hype, no income claims.

headline (<= 40 chars): the free-value promise, plain. e.g. "Free [lead magnet]
inside the group".

description (<= 30 chars): the micro CTA. e.g. "Join to get instant access".

imagePrompt: describe a clean, on-brand ad creative that shows the [lead magnet]
/ welcome pack (a mockup, cover, or the result it delivers). No baked-in logos,
no dense text in the image. Leave room for a short overlay headline.

VOICE: calm authority, specific, benefit-led, periods over exclamation points,
no em or en dashes, no false scarcity, no earnings/medical claims.
`.trim();
