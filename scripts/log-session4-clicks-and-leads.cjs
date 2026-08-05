#!/usr/bin/env node
/**
 * Append the session-4 record to the content-hub handoff.
 *
 * Written as a file rather than an inline `node -e` because the section is long
 * enough that quoting it through PowerShell mangles it, and a mangled append to
 * a handoff doc is worse than no append: the next session reads it as fact.
 *
 * Idempotent — re-running it won't duplicate the section, so it's safe to retry
 * after an interrupted run.
 */
const fs = require('fs');

const PATH = 'docs/CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md';
const MARKER = '## Session 4 — the last three client components';

const SECTION = `
${MARKER}

### Built

**1. Per-post clicks in \`PieceLinkPanel\`.** A Clicks / Opt-ins / Purchases strip
on each hub piece, keyed by piece id — \`utm_content\` *is* the piece id, so no
join had to be invented. It renders only once a link exists: three zeros sitting
next to "create a tracked link" reads as a bug rather than as an accurate absence
of history.

Clicks and opt-ins are separate reads, so one can show a real number while the
other shows \`n/a\`, and \`n/a\` is never collapsed into \`0\`. "The planner
migration isn't applied" and "this post got no clicks" are opposite facts that an
admin acts on differently, and only one of them is a reason to stop posting. When
clicks >= 5 and opt-ins are 0 the panel says so in words: that pair means the hook
works and the page it lands on doesn't, which is the most actionable signal the
system produces. The floor of 5 keeps a single link-preview hit from accusing a
brand-new post of failing.

**2. Lead-magnet picker** in the same panel. Destination is a three-way
discriminator — sales funnel / lead magnet / custom URL — not one merged funnel
dropdown, because the two funnel types don't share a step vocabulary:
\`checkout\` and \`upsell1\` don't exist on an opt-in funnel, and \`oto\` and
\`thank-you\` don't exist on a sales funnel. A merged list would happily offer a
step the chosen destination lacks and mint a link that 404s in production only.
Switching kind resets the step to \`optin\`, the one name both vocabularies share.

**3. \`AddLeadCard\` on the Lead Pipeline tab.** It posts \`createLead\`, never
\`upsertLead\`: the pipeline table's \`lead_id\` is a foreign key into funnel
leads, so handed a fresh id \`upsertLead\` fails the constraint — the lead has to
be captured first. Funnel is required because leads are unique per (funnel_id,
email). \`utm_content\` is optional and labelled "leave it blank unless you know",
because a guessed value is worse than an empty one: it is indistinguishable from a
tracked click and quietly inflates one post's credit. Deal value takes dollars and
stores cents, rounding *after* the multiply so 29.99 lands on 2999 rather than
2998. Follow-up dates post at noon local, matching \`AddPlanCard\`, so UTC
conversion can't render every task as due a day early. When the server reports
\`isNew: false\` the UI says "already existed on this funnel — moved onto the
board" instead of "created", so nobody goes looking for a second card.

Both new forms prepend the returned record instead of reloading, which keeps an
in-flight optimistic drag from being dropped. \`AddLeadCard\` merges the email and
name in from the form because the pipeline record doesn't carry them — they live on
the leads table — and without that the new card would render as a bare uuid until
the next full load.

### The "2 failing tests" line in this document was environment-specific

Full run this session: **39 failed / 722 passed** across 6 files. 37 of the 39 are
one cause — \`Error: supabaseUrl is required\` — in \`create-payment-intent\`,
\`webhooks\`, \`receipt\` and \`receipt-template\`, which read Supabase env at
import time; this shell had no env loaded. The remaining two are the already
documented \`compliance-pass\` and \`review-logic\` assertion failures. None of the
six files import anything this session touched. Typecheck is clean.

\`scripts/summarize-test-failures.cjs\` was added to collapse a run log into
per-file failure counts, because after a change the only question that matters is
whether the failure *set* grew, and that was buried in ~300 lines of stacks. It
decodes UTF-16 as well as UTF-8: PowerShell's \`>\` writes UTF-16LE, and read as
UTF-8 every regex silently matches nothing — which looks exactly like "no
failures" instead of "unreadable file".

### Remaining

Nothing left from the original four asks. The open items are the ones this document
already records as blocked on other systems: resources still aren't valid tracked
destinations, and auto-detect still has nothing to read.
`;

const current = fs.readFileSync(PATH, 'utf8');
if (current.includes(MARKER)) {
  console.log('Session 4 section already present — nothing appended.');
  process.exit(0);
}
fs.appendFileSync(PATH, SECTION);
console.log(
  `Appended ${SECTION.length} chars. Doc is now ${
    fs.readFileSync(PATH, 'utf8').split(/\r?\n/).length
  } lines.`,
);
