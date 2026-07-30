/**
 * Teaches the link store about optin (lead-magnet) destinations.
 *
 * Every edit is anchored on a string unique within links.ts. If any anchor
 * misses, nothing is written — a half-applied store would compile while
 * silently dropping optin_funnel_id on insert, which is the worst outcome
 * available here (links that look minted and point nowhere useful).
 */
const fs = require('fs');

const file = 'src/lib/mothermode/planner/links.ts';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

if (src.includes('optin_funnel_id')) {
  console.log('already applied — no changes');
  process.exit(0);
}

const edits = [
  // 1. Select the new column, or reads never see it.
  {
    from: "'id, plan_id, funnel_id, funnel_page,",
    to: "'id, plan_id, funnel_id, optin_funnel_id, funnel_page,",
  },
  // 2. Record shape.
  {
    from: `  funnelId: string | null;
  funnelPage: string;`,
    to: `  funnelId: string | null;
  /** Lead-magnet destination. Mutually exclusive with funnelId (DB CHECK). */
  optinFunnelId: string | null;
  funnelPage: string;`,
  },
  // 3. Mapper.
  {
    from: '    funnelId: (row.funnel_id as string) ?? null,',
    to: `    funnelId: (row.funnel_id as string) ?? null,
    optinFunnelId: (row.optin_funnel_id as string) ?? null,`,
  },
  // 4. List filter options.
  {
    from: `  funnelId?: string | null;
  limit?: number;`,
    to: `  funnelId?: string | null;
  optinFunnelId?: string | null;
  limit?: number;`,
  },
  // 5. List filter.
  {
    from: "  if (opts?.funnelId) query = query.eq('funnel_id', opts.funnelId);",
    to: `  if (opts?.funnelId) query = query.eq('funnel_id', opts.funnelId);
  if (opts?.optinFunnelId)
    query = query.eq('optin_funnel_id', opts.optinFunnelId);`,
  },
  // 6. Create input.
  {
    from: `  funnelId?: string | null;
  funnelPage?: string;`,
    to: `  funnelId?: string | null;
  /** Lead-magnet destination. Pass this OR funnelId, never both. */
  optinFunnelId?: string | null;
  funnelPage?: string;`,
  },
  // 7. Insert row + the exclusivity guard.
  {
    from: `  const row: Record<string, unknown> = {
    plan_id: input.planId ?? null,
    funnel_id: input.funnelId ?? null,`,
    to: `  // Fail here rather than at the DB. The CHECK constraint would raise a
  // Postgres error that surfaces to the admin as an opaque 500; a link with two
  // destinations is a caller bug worth naming.
  if (input.funnelId && input.optinFunnelId) {
    throw new Error(
      'A link points at one destination: pass funnelId or optinFunnelId, not both',
    );
  }

  const row: Record<string, unknown> = {
    plan_id: input.planId ?? null,
    funnel_id: input.funnelId ?? null,
    optin_funnel_id: input.optinFunnelId ?? null,`,
  },
];

for (const { from } of edits) {
  if (!src.includes(from)) {
    console.error('ANCHOR MISS — nothing written:', JSON.stringify(from.slice(0, 60)));
    process.exit(1);
  }
}

for (const { from, to } of edits) src = src.replace(from, to);

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log(`applied ${edits.length} edits to ${file}`);
