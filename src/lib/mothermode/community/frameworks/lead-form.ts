/**
 * Owner framework: Facebook lead-form setup (drive ad traffic into the group).
 *
 * Authoritative guidance the generator injects for the `leadForm` section. It
 * produces paste-ready copy for a Facebook/Meta lead form whose job is to get
 * the right person to opt in for the free [lead magnet] and then join the group
 * / continue to the community GOAL. Mirrors the owner's "welcome pack" lead-form
 * copy: intro headline + value-stacked description, light pre-qualify question,
 * a completion (thank-you) screen that hands over the resource and sends them to
 * the group, and the button CTA.
 *
 * Output maps to leadForm = { headline, description, questions[],
 * completionHeadline, completionDescription, callToAction, groupUrl }. Fill
 * every specific from the intake; never print bracket labels. Keep copy tight
 * enough to fit Meta lead-form fields.
 *
 * Source: lead-form-ads-setup.txt (owner's live lead-form copy).
 */

export const LEAD_FORM_FRAMEWORK = `
LEAD FORM SETUP FRAMEWORK (authoritative — Meta lead form for the welcome pack).

Produce paste-ready lead-form copy that gets [avatar] to opt in for the free
[lead magnet] and then into the community toward the GOAL.

headline (intro card headline): short and action-forward, e.g. "Click Next to
get access to [lead magnet]".

description (intro card body): "Here is what you get inside [community]:" then a
value stack of 3 to 4 checkmark lines, each specific and outcome-led:
  ✅ [tools / trainings / SOPs] to [specific result]
  ✅ [templates / resources] we use to [specific result]
  ✅ an engaged community of [avatar]
  ✅ BONUS: [welcome pack asset] to [specific result]
End with "Join the group below:" (or the goal-matched line).

questions: 1 to 2 light pre-qualify questions max (optional), plus rely on the
prefilled contact fields (first name, last name, email; phone only if the goal
needs a call). Keep friction low. If no custom question fits, return an empty
list.

completionHeadline (thank-you screen headline): a clear instruction, e.g.
"IMPORTANT: read below and click the button".

completionDescription (thank-you screen body): tell them the [lead magnet] is on
the way to their inbox (check spam), then send them to the next step that
matches the GOAL: join the free group / register for the masterclass / book the
call. Include a link placeholder.

callToAction (button label): plain and matching the goal, e.g. "Get access",
"Join the group", "Register now", or "Book a call".

groupUrl: the community/group link placeholder the owner will paste (e.g.
https://www.facebook.com/groups/your-group).

VOICE: calm authority, specific, benefit-led, periods over exclamation points,
no em or en dashes, no income/medical claims.
`.trim();
