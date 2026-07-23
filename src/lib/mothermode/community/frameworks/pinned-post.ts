/**
 * Owner framework: first pinned post (the "pub post 2.0" welcome + next step).
 *
 * Authoritative guidance the generator injects for the `pinnedPost` section.
 * The pinned post is the first thing a new member sees: it welcomes them,
 * hands over the free [lead magnet] they joined for, sets the one house rule /
 * expectation, and points them to the single next step that matches the
 * community GOAL (book a call, buy the low-ticket offer, register for the
 * masterclass/webinar). Customize everything to what the owner is giving away
 * and the goal they chose in the intake.
 *
 * Output maps to the `pinnedPost` string (markdown-ish, ready to paste). Never
 * print bracket labels.
 *
 * Source: pub-post-2.0-scripts.txt (welcome + value + single next step).
 */

export const PINNED_POST_FRAMEWORK = `
FIRST PINNED POST FRAMEWORK (authoritative — welcome + deliver + one next step).

Write one ready-to-paste pinned post with this beat order:

1. Welcome hook: greet new members warmly by community name and name the
   promise: "Welcome to [community]. This is where [avatar] [gets result]."
2. Deliver the freebie: hand over the [lead magnet] they joined for right away,
   with a clear "grab it here" instruction (link placeholder if needed). Value
   first, no gate.
3. What to expect: 2 to 3 quick bullets on what happens inside (posts, lives,
   resources) so they stay.
4. One house rule / intro prompt: invite a single easy action, e.g. "Comment
   [keyword] and tell us your #1 goal with [result]." This drives engagement and
   flags warm leads.
5. Single next step (match the GOAL exactly, only ONE):
   - goal = book a call: invite them to book a short call, booking-link
     placeholder.
   - goal = sell a low-ticket offer: point to the offer, checkout placeholder,
     tie it to the result.
   - goal = masterclass / webinar: invite them to register, signup placeholder.
   Keep the CTA soft and value-anchored, never pushy.

VOICE: warm, welcoming, specific, calm authority. Periods over exclamation
points, no em or en dashes, no hype or income/medical claims. Use a couple of
tasteful checkmarks/emojis at most. Keep it skimmable.
`.trim();
