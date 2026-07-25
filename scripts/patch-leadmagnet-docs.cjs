/** Append the Phase 4 lead-magnet section to the AI builder port doc. Idempotent. */
const fs = require('fs');
const path = require('path');

const DOC = path.join(__dirname, '..', 'docs', 'SALES_FUNNEL_AI_BUILDER_PORT.md');
let md = fs.readFileSync(DOC, 'utf8');

if (md.includes('## Lead magnet linking')) {
  console.log('Doc already documents lead magnet linking. No change.');
  process.exit(0);
}

md += `

## Lead magnet linking (Phase 4)

**Where:** \`src/app/admin/sales-funnels/SalesFunnelEditor.tsx\` → Build tab, directly under the
1/2/3 build bar ("Fill brief" → "Generate funnel" → "Generate missing images").

**Two paths, one source of truth**

1. **Link existing** — the picker lists every lead-gen kit from
   \`GET /api/admin/mothermode-leadgen\` (flattened to \`{ id, slug, name, status, title, subtitle }\`
   by \`magnetOptionFromRow\`). Selecting one calls \`applyLeadMagnet\`.
2. **AI create + link** — \`onCreateLeadMagnet\` maps the funnel brief into a \`LeadGenIntake\`
   (topic/audience/goal/transformation/tone/cta/offerSlug/notes), calls
   \`POST /api/mothermode/leadgen-ai { action: 'generate', format: 'guide' }\`, saves the result via
   \`POST /api/admin/mothermode-leadgen { action: 'save' }\`, then links it.

**What linking writes** (\`applyLeadMagnet\`):

- \`leadGenSlug\` (funnel field, persisted on save)
- \`intake.leadGenSlug\`, \`intake.magnetName\`, \`intake.magnetPromise\`
- \`optin.magnetTitle\`, \`optin.magnetDescription\`

The kit itself is never copied into the funnel — only its slug and headline identity. Edit the
magnet's content in **Admin → Lead Gen**; the funnel keeps pointing at the same slug.

**Sync behavior:** a \`useEffect\` on \`[leadGenSlug, leadMagnets]\` re-selects the picker when an
existing funnel is loaded, so the dropdown reflects the saved link instead of resetting to "none".

**Notes**

- Kit list load failures are non-fatal (the picker just stays empty); AI/save failures surface in
  the editor's error banner.
- New kits are saved as \`status: 'draft'\` with slug \`slugifySalesName(magnetName)\`.
- Applied by \`scripts/patch-leadmagnet-link.cjs\` (idempotent).
`;

fs.writeFileSync(DOC, md, 'utf8');
console.log('Appended lead magnet section to docs/SALES_FUNNEL_AI_BUILDER_PORT.md');
