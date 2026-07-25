/**
 * Appends this session's records to the two relevant port docs.
 *
 * Append-only and idempotent: each block is keyed by a marker string, and the
 * script is a no-op for any doc that already contains its marker. Nothing is
 * rewritten, so prior sessions' entries cannot be clobbered.
 *
 *   node scripts/log-funnel-brief-port.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const BRIEF_MARKER = '## FunnelBrief module (Task B, step 1)';
const BRIEF_BLOCK = `
${BRIEF_MARKER}

**Status: landed but unwired.** \`src/lib/mothermode/sales/funnelBrief.ts\` exists
and \`tsc --noEmit\` exits 0, but nothing imports it and it is deliberately *not*
re-exported from \`src/lib/mothermode/sales/index.ts\`. It changes no behavior yet.

The brief is the single upstream source of truth that per-page copy, image
prompts and scripts are all meant to read from, so that the six identity fields
(\`brandLine\`, \`conversionLine\`, \`generationalLine\`, \`categoryLine\`,
\`founderName\`, \`founderRole\`) plus \`footer.brandLine\`/\`footer.disclaimer\` stop
drifting per page.

| Export | Purpose |
| --- | --- |
| \`FunnelBrief\` + 6 sub-interfaces | identity / audience / promise / voice / visual / offer |
| \`blankFunnelBrief()\` | all-empty brief, \`version: 1\`, \`source: 'derived'\` |
| \`normalizeFunnelBrief(raw)\` | unknown → \`FunnelBrief\`, defensive, mirrors \`normalizeSalesFooter\` |
| \`funnelBriefOfferFromStack(stack)\` | denormalizes \`OfferStack\`; enabled upsells only, sorted by \`slot\` |
| \`funnelBriefFromIntake(intake, opts)\` | derives only what \`SalesAiIntake\` actually knows |
| \`formatFunnelBriefForPrompt(brief)\` | prompt block; omits empty fields |
| \`funnelBriefGaps(brief)\` / \`isFunnelBriefComplete(brief)\` | dotted paths of what is still empty |

### Field provenance

Verified against the real files, not inferred from field names:

- \`SalesAiIntake\` (\`sales/aiIntake.ts\`): \`niche\`, \`audience\`, \`pain\`,
  \`magnetName\`, \`magnetPromise\`, \`leadGenSlug\`, \`offerName\`, \`offerPrice\`,
  \`upsell1..4\`, \`toneNotes\`, \`offerStack\`.
- \`OfferStack\`: \`frontEnd { name, price, originalPrice, promise, deliverables[] }\`,
  \`bonuses[]\`, \`bumps[]\`, \`upsells[]\` (each \`slot\`, \`enabled\`, \`name\`).

The intake carries **no** brand identity. \`identity\` therefore derives empty and
\`funnelBriefFromIntake\` takes \`brandName\` as an explicit opt rather than
inventing one — an invented-but-plausible founder name is the exact failure
\`scripts/audit-ai-fill-coverage.cjs\` exists to catch.

### Decisions

1. Empty fields are **omitted** from the prompt rather than rendered as
   \`(not set)\`. A model shown \`founderName: (not set)\` will fill it in.
2. \`funnelBriefGaps\` returns dotted paths, so completeness is machine-assertable
   by the coverage audit instead of eyeballed.

### Remaining

- No unit test. \`tests/lib/sales-offer-stack.test.ts\` is the pattern; cover
  \`funnelBriefOfferFromStack\` upsell filter/sort and \`normalizeFunnelBrief\` on
  garbage input.
- Persist (\`brief jsonb\` + migration + \`sales/store.ts\` mapper + admin write
  path), then a gap-filling \`brief\` AI mode, then consume in the per-page
  prompts. Ordered detail in \`docs/FUNNEL_BRIEF_HANDOFF.md\`.
`;

const GRID_MARKER = '## Grid field collision (Offer / Emails / PageTabs)';
const GRID_BLOCK = `
${GRID_MARKER}

Selects and buttons overran their columns on these tabs. Root cause was **grid
items defaulting to \`min-width: auto\`**, which prevents a track from shrinking
below its content. \`ui.tsx\` already documents \`min-w-0\` as load-bearing for the
inputs themselves, but the bare \`<div>\` wrapping each \`<select>\` and the
\`<div className="flex items-end">\` button wrappers never received it, so those
tracks could not compress.

\`scripts/fix-grid-item-minwidth.cjs\` applies \`min-w-0\` across 4 files, reverts
an earlier incorrect \`h-[38px]\` attempt, and rewrites the \`selectClass\` comment
so the misdiagnosis is recorded rather than reading as intentional. Idempotent;
\`tsc --noEmit\` exits 0.

**Note for anyone touching these grids:** adding a wrapper element around a grid
child reintroduces the bug unless the wrapper also carries \`min-w-0\`.
`;

/** Append `block` to `relPath` unless `marker` is already present. */
function appendOnce(relPath, marker, block) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.log(`SKIP (missing)   ${relPath}`);
    return;
  }
  const current = fs.readFileSync(abs, 'utf8');
  if (current.includes(marker)) {
    console.log(`SKIP (present)   ${relPath}`);
    return;
  }
  const sep = current.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(abs, current + sep + block.trimStart(), 'utf8');
  console.log(`APPENDED         ${relPath}`);
}

appendOnce('docs/SALES_FUNNEL_AI_BUILDER_PORT.md', BRIEF_MARKER, BRIEF_BLOCK);
appendOnce(
  'docs/SALES_FUNNEL_EDITOR_REFACTOR_SYSTEM_PORT.md',
  GRID_MARKER,
  GRID_BLOCK,
);
