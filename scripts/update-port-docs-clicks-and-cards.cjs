#!/usr/bin/env node
/**
 * Bring the port docs up to date with the click-visibility and add-card work.
 *
 * Three docs, three different scopes — deliberately not one combined section in
 * one file. A port doc is read by whoever is rebuilding that specific system, so
 * the click surfaces belong in the link-tracking port, the sheet changes in the
 * content-hub port, and the new planner cards in the planner UI port. Dumping it
 * all in one place would mean the person porting the planner never reads the
 * `n/a`-vs-`0` rule that their own UI depends on.
 *
 * Idempotent: each section is keyed by a marker, so re-running skips what's
 * already there and reports what it skipped.
 */
const fs = require('fs');

const EDITS = [
  {
    path: 'docs/PLANNER_LINK_TRACKING_SYSTEM_PORT.md',
    marker: '## Click visibility: every surface that reads the roll-ups',
    body: `
## Click visibility: every surface that reads the roll-ups

Four surfaces now read click data. They all go through one seam so they cannot
disagree with each other:

| Surface | Keyed by | Shows |
| --- | --- | --- |
| \`/admin\` overview | — | all-time clicks |
| \`/admin/funnel-stats\` | piece id | all-time, 30d, clicks-per-purchase, traffic-by-post table |
| Content hub → piece sheet → **Preview** (\`PieceLinkPanel\`) | piece id | clicks / opt-ins / purchases for that post |
| Content hub → piece sheet → **Metrics** (\`PieceClickMetrics\`) | piece id | same three, plus clicks-per-purchase |

**The seam.** \`getClickRollupsSafe()\` in the lib is the only degradation
wrapper. It exists because the overview and funnel-stats were about to grow two
independent try/catches, and two independent wrappers around the same failure
drift: one starts rendering \`0\` where the other renders \`n/a\`, from the exact
same unapplied migration. On the client, \`pieceMetricValues()\` in
\`PieceClickMetrics.tsx\` plays the same role for the two sheet surfaces.

**The rule that must survive the port.** A failed read renders \`n/a\`; a
successful read with no matching row renders \`0\`. These are opposite facts —
"nothing was measured" versus "this post was measured and got nothing" — and an
admin acts on them in opposite ways. Collapsing the first into the second is the
single most damaging simplification available in this system, because it looks
like data.

Clicks and attribution are **separate reads with separate availability flags**.
One can be accurate while the other has failed, and the UI says so rather than
failing both together.

**Why keyed by piece id and not by funnel.** \`utm_content\` *is* the piece id.
That equality is the entire join — planner link rows, captured lead UTMs, and the
export bridge all find each other through it, with no lookup table. Note that
\`/admin/funnel-stats\` has **no funnel id in scope** (it's built from Stripe
products and page types), which is why its traffic table is per piece; a
\`byFunnelId\` view there would require inventing a join that doesn't exist.
`
  },
  {
    path: 'docs/CONTENT_HUB_FEATURES_PORT.md',
    marker: '## Piece sheet: tracked links and measured results',
    body: `
## Piece sheet: tracked links and measured results

**Preview tab — \`PieceLinkPanel\`.** Mint, view, copy, and read the results of
this piece's tracked link. It lives on Preview because that's the tab you're on
when you decide a post is ready to go out, which is the moment you need its link.
\`utm_content\` is rendered as read-only fact, never as an input: it *is* the piece
id, so a free-text box would eventually be typed into and produce a link that
looks perfect and attributes nothing. Minting refreshes the shared piece→link
cache, so the next CSV export carries the link with no page reload.

Destination is a three-way discriminator — sales funnel / lead magnet / custom
URL. Not one merged dropdown: the two funnel types don't share a step vocabulary
(\`checkout\`/\`upsell1\` don't exist on an opt-in funnel; \`oto\`/\`thank-you\`
don't exist on a sales funnel), so a merged list would offer a step the chosen
destination lacks and mint a link that only 404s in production. Switching kind
resets the step to \`optin\`, the one name both vocabularies share.

The results strip renders **only once a link exists** — before that there is
nothing that could have been clicked, and three zeros beside "create a tracked
link" reads as a bug rather than as an accurate empty history.

**Metrics tab — \`PieceClickMetrics\` above \`MetricsForm\`.** The tab now shows
two kinds of number, and the distinction is load-bearing:

- **Measured** (boxed, captioned "Measured"): clicks, opt-ins, purchases, and
  clicks-per-purchase, counted server-side from the tracked link.
- **Hand-entered** (the existing field grid): likes, views, saves — read off the
  platform and typed in by an admin.

They are visually separated because side by side with no distinction, a typed
\`views\` and a measured \`clicks\` read as equally trustworthy — and the typed one
is the one that silently goes stale the moment somebody stops updating it. The
measured block is placed first for the same reason.

When the roll-up returns 0 **and** no tracked link exists, the block says the
zeros aren't a verdict on the post because nothing was being counted. That line
waits for the link map to actually load, since guessing "no link yet" mid-flight
would send an admin off to mint a duplicate.

**Sheet width: \`max-w-[40rem]\`** (was \`max-w-xl\` = 36rem). Not \`max-w-2xl\`
(42rem): the platform previews are fixed-width phone frames, so past ~40rem the
extra width becomes dead margin around the preview instead of a bigger preview.
40rem is where the Metrics tab fits the measured strip and the hand-entered grid
without the three cells wrapping, which was the reason for widening at all.
`
  },
  {
    path: 'docs/PLANNER_ADMIN_UI_PORT.md',
    marker: '## Creating rows from the UI: AddPlanCard and AddLeadCard',
    body: `
## Creating rows from the UI: AddPlanCard and AddLeadCard

Both boards could previously only display rows created elsewhere. Two small
client components close that.

**\`AddPlanCard\` (Content Board tab)** posts through the existing \`upsertPlan\`
action. The generated piece id is **shown and editable**, because a blank piece id
silently orphans the card from export, UTM tagging, and attribution permanently —
and nothing later in the pipeline can recover it. Dates post at **noon local**, so
UTC conversion can't shift a post a day earlier than the day it was planned for.

**\`AddLeadCard\` (Lead Pipeline tab)** posts \`createLead\`, **never**
\`upsertLead\`: the pipeline table's \`lead_id\` is a foreign key into funnel
leads, so handed a fresh id, upsert fails the constraint — the lead has to be
captured first. Funnel is required, because leads are unique per
(funnel_id, email).

- \`utm_content\` is optional and labelled "leave blank unless you know". A
  guessed value is worse than an empty one: it's indistinguishable from a real
  tracked click and quietly inflates one post's credit.
- Deal value takes **dollars** and stores **cents**, rounding *after* the multiply
  so 29.99 lands on 2999 rather than 2998.
- Follow-up dates post at noon local, matching \`AddPlanCard\`.
- \`isNew: false\` from the server renders as "already existed on this funnel —
  moved onto the board", not "created", so nobody hunts for a second card.

Both forms **prepend the returned record** rather than triggering a full reload,
which keeps an in-flight optimistic drag from being dropped. \`AddLeadCard\` also
merges the email and name in from the form, because the pipeline record doesn't
carry them (they live on the leads table) and without it the new card renders as a
bare uuid until the next full load.
`
  }
];

let wrote = 0;
let skipped = 0;

for (const { path, marker, body } of EDITS) {
  if (!fs.existsSync(path)) {
    console.log(`MISSING  ${path} — skipped, nothing appended`);
    skipped += 1;
    continue;
  }
  const current = fs.readFileSync(path, 'utf8');
  if (current.includes(marker)) {
    console.log(`EXISTS   ${path}`);
    skipped += 1;
    continue;
  }
  // Guarantee exactly one blank line before the new heading regardless of how
  // the previous section ended, so the markdown doesn't fuse two headings.
  const sep = current.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(path, sep + body);
  console.log(`APPENDED ${path}  (+${body.length} chars)`);
  wrote += 1;
}

console.log(`\n${wrote} doc(s) updated, ${skipped} skipped.`);
