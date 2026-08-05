/**
 * Appends the session-3 record to the UTM handoff. Appends rather than rewrites:
 * the doc's existing findings are the reason this session had a plan at all.
 */
const fs = require('fs');

const file = 'docs/CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

const MARK = '## Session 3 — lead magnets became linkable';
if (src.includes(MARK)) {
  console.log('already logged — no changes');
  process.exit(0);
}

src += `
---

${MARK}

Scope of the ask was four items: generalize the UTM destination beyond sales
funnels, auto-detect the destination at generation, and two add-card UIs. This
session did **one** of them end to end — the destination generalization, for lead
magnets — plus the schema and API it needed. The picker UI and the other three
are untouched and honestly unstarted.

### What shipped

| Layer | Change |
|---|---|
| Migration \`20261006000000\` | \`mothermode_utm_links.optin_funnel_id\` (FK → \`mothermode_optin_funnels\`, ON DELETE CASCADE), CHECK \`funnel_id IS NULL OR optin_funnel_id IS NULL\`, unique-combo index rebuilt to include it |
| \`planner/utm.ts\` | \`OPTIN_PAGES\`, \`optinPagePath\`, \`optinPageUrl\`, \`optinPageLabel\` |
| \`planner/links.ts\` | \`optinFunnelId\` through \`LINK_COLUMNS\`, \`UtmLinkRecord\`, mapper, \`listUtmLinks\` filter, \`CreateUtmLinkInput\`, insert row + a both-destinations guard |
| \`api/admin/mothermode-links\` | \`createLink\` resolves an optin step server-side; \`?format=byPiece\` also returns \`optinFunnels\`; 400 on two destinations |
| Tests | \`tests/lib/planner-optin-destinations.test.ts\` — 7 passing |

Typecheck clean. The migration needs no registration: \`build-migration-bundle.cjs\`
globs any \`^\\d{14}\` filename.

### Two decisions worth not re-litigating

**Why \`optin_funnel_id\` and not \`destination_kind\` + \`destination_id\`.** A
polymorphic id cannot carry a foreign key. The table was built with ON DELETE
CASCADE so retiring a funnel retires its links; polymorphic columns trade that
for live \`/go/<code>\` links pointing at deleted funnels, discovered by traffic.
One nullable FK per kind is more columns and less silence. Revisit only if the
kinds stop being countable on one hand.

**Why lead magnet steps are a separate list from sales funnel steps.** The
vocabularies are not interchangeable: \`checkout\`/\`upsell1..4\` vs \`oto\`/\`thank-you\`.
Merging them into one dropdown lets an admin pick a step the destination does not
have, which mints a link to a 404. \`byPiece\` therefore returns \`funnels\` and
\`optinFunnels\` separately, and the UI must key its step list off which one is
selected.

### Finding: resources cannot be tracked destinations yet

Deliberately left out. \`mothermode_resource_entries\` / \`mothermode_deliverables\`
have **no public route** — \`src/app\` has \`/funnel\` and \`/optin\` but nothing that
serves a resource to a cold visitor; they live behind purchase. A resource picker
would mint links that 404. They stay on the \`destination_url\` paste path until a
public resource page exists. That's a product decision, not a missing function.

### Finding: auto-detect has nothing to read

The generator receives **offer context only** (scene, mechanism, old/new way,
outcomes). There is no funnel, lead-magnet, or step context anywhere in
generation, and \`src/lib/mothermode/content\` has zero references to a
destination. "Auto-detect the destination from generation context" cannot be
built against today's inputs. It splits into:

1. **Make it true forward** — a destination picker in the Generate drawer's
   compose step, persisted on the piece. Needs a column on
   \`mothermode_generated_content\` (generation currently ships no migration;
   drafts are client-side until save).
2. **Infer for the existing library** — match caption/CTA text against funnel
   names and surface it as a *suggestion*, never auto-applied. A wrong
   auto-assignment is worse than none: it produces confident bad attribution,
   and nobody audits a field that looks filled in.

### Remaining, in dependency order

1. **\`PieceLinkPanel\` grouped picker** — the only thing between this session's
   work and an admin being able to use it. Destination group (Sales funnels /
   Lead magnets) → step list keyed off the selection → POST \`optinFunnelId\`
   instead of \`funnelId\`. Server side is done and typed; this is UI only.
2. **Planner link table picker** for lead magnets (\`LinkTracking.tsx\`). The full
   GET payload still returns sales funnels only — see the corrected comment
   there; it is a payload gap, not a schema gap.
3. **Add-plan-card / add-lead-card UIs** — \`upsertPlan\` / \`upsertLead\` already
   exist. A new plan card **must** get a real \`pieceId\` or it is invisible to
   attribution forever.
4. **Destination at generation** (1 and 2 above under auto-detect).

### Note on this session

Three tool crashes, all on high-context multi-command shell calls. Everything
survived because each change was a single anchored script with an abort-on-miss
guard, run and verified before the next one. The API patch was verified for
*placement* as well as typecheck (\`scripts/verify-optin-branch-placement.cjs\`):
\`String.replace\` takes the first match, so an injected branch can land in the
wrong handler and still compile. Worth keeping that habit for anything inserted
by anchor.
`;

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log('logged session 3 to', file);
