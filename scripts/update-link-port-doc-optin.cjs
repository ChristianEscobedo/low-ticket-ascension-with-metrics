/**
 * Brings PLANNER_LINK_TRACKING_SYSTEM_PORT.md up to date with the lead-magnet
 * destination work.
 *
 * The port doc is a copy-to-sibling checklist, so an omitted migration here is a
 * broken port in the other codebase — and the "opt-in funnels are not
 * selectable" bullet is now actively wrong, which is worse than missing: it
 * sends the reader to build something that exists.
 */
const fs = require('fs');

const file = 'docs/PLANNER_LINK_TRACKING_SYSTEM_PORT.md';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

if (src.includes('20261006000000')) {
  console.log('already updated — no changes');
  process.exit(0);
}

const edits = [
  // 1. Migration dependency at the top — the first thing a porter reads.
  {
    from: `Depends on \`supabase/migrations/20261005000000_planner_funnel_links_and_utm.sql\`.
Applied, verified with \`node scripts/verify-utm-migration.cjs\`.`,
    to: `Depends on \`supabase/migrations/20261005000000_planner_funnel_links_and_utm.sql\`.
Applied, verified with \`node scripts/verify-utm-migration.cjs\`.

Then \`supabase/migrations/20261006000000_utm_links_optin_destinations.sql\`, which
adds lead-magnet (opt-in funnel) destinations. Ship both or the store selects a
column that does not exist. \`build-migration-bundle.cjs\` picks both up by their
14-digit prefixes; neither needs registering by hand.`,
  },

  // 2. Table description: the column list is how a porter checks their schema.
  {
    from: `  \`click_count\`. Nullable \`plan_id\` / \`funnel_id\` links it to a planner card
  and/or a funnel.`,
    to: `  \`click_count\`. Nullable \`plan_id\` / \`funnel_id\` links it to a planner card
  and/or a funnel. \`optin_funnel_id\` (added 20261006000000) points at a lead
  magnet instead; a CHECK keeps it mutually exclusive with \`funnel_id\`, because
  the two have different step vocabularies and \`funnel_page\` can only mean one
  of them at a time.`,
  },

  // 3. Replace the false bullet with what is actually left: the UI.
  {
    from: `- **Opt-in funnels are not selectable as destinations.**
  \`mothermode_utm_links.funnel_id\` FKs to the sales funnel table, so the drawer
  lists sales funnels only. Opt-in funnels need a pasted URL until the FK is
  widened.`,
    to: `- **Lead magnets are linkable, but only the content hub's API knows it.**
  The schema, store, URL builders and \`createLink\` all handle opt-in funnels
  (\`optin_funnel_id\`, \`optinPageUrl\`, steps \`'' | 'oto' | 'thank-you'\`), and
  \`?format=byPiece\` returns them as a separate \`optinFunnels\` array. What is
  missing is the picker: \`PieceLinkPanel\` and the planner's link drawer still
  offer sales funnels only, and the planner's full GET payload still lists sales
  funnels only. UI + payload gap, not a schema gap.
  Keep the two lists **separate** in any picker you build. Merging them lets an
  admin choose \`checkout\` on a lead magnet, which mints a link to a 404.`,
  },
];

for (const { from } of edits) {
  if (!src.includes(from)) {
    console.error('ANCHOR MISS — nothing written:', JSON.stringify(from.slice(0, 64)));
    process.exit(1);
  }
}
for (const { from, to } of edits) src = src.replace(from, to);

// 4. Record the new library surface in the "What shipped" API area, so a porter
//    copying files knows utm.ts grew exports.
const apiHeading = '### API\n';
if (!src.includes(apiHeading)) {
  console.error('ANCHOR MISS on ### API — partial write, review the file');
  process.exit(1);
}
src = src.replace(
  apiHeading,
  `### Destination URL builders

\`src/lib/mothermode/planner/utm.ts\` — \`FUNNEL_PAGES\` / \`funnelPagePath\` /
\`funnelPageUrl\` for sales funnels, and \`OPTIN_PAGES\` / \`optinPagePath\` /
\`optinPageUrl\` / \`optinPageLabel\` for lead magnets. Both encode the same
irregularity: **step 1 is the funnel index** (\`/funnel/<slug>\`, \`/optin/<slug>\`),
not a named child route. Build these paths anywhere else and they will be wrong
eventually. Covered by \`tests/lib/planner-optin-destinations.test.ts\` (7 tests).

Resources / deliverables are **not** destination candidates: they have no public
route (nothing under \`src/app\` serves one to a cold visitor), so they stay on the
pasted-\`destination_url\` path until such a page exists.

${apiHeading}`,
);

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log('updated', file);
