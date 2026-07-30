/**
 * verify-utm-migration.cjs
 *
 * db-table-audit.cjs answers "does the table exist?". That is not the same
 * question as "did 20261005000000_planner_funnel_links_and_utm.sql apply?",
 * because two of that migration's three moves are ALTER TABLE ADD COLUMN on
 * tables that already existed. A table-level audit reports those as present no
 * matter what, so it would happily print "nothing to apply" against a database
 * where `utm_content` was never added.
 *
 * That matters more here than usual: src/lib/mothermode/leadUtmContent.ts
 * catches "column does not exist" and disables the field for the life of the
 * process, so a missing column produces no error anywhere -- it looks exactly
 * like nobody clicked a tracked link. This script is the check that tells those
 * two states apart.
 *
 * Read-only. Every probe is a zero-row select.
 *
 *   node scripts/verify-utm-migration.cjs
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[m[1]] && v) process.env[m[1]] = v;
    }
  }
}
loadEnv();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

/** Exactly what the migration is supposed to have produced. */
const EXPECTED = [
  {
    table: 'mothermode_content_plan',
    columns: ['funnel_id', 'funnel_page', 'destination_url'],
    why: 'move 1 - the card names its destination',
  },
  {
    table: 'mothermode_utm_links',
    columns: [
      'id', 'plan_id', 'funnel_id', 'funnel_page', 'piece_id', 'label',
      'base_url', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
      'utm_term', 'full_url', 'short_code', 'click_count', 'last_clicked_at',
      'created_at', 'updated_at', 'created_by',
    ],
    why: 'move 2 - the link registry',
  },
  {
    table: 'mothermode_link_clicks',
    columns: ['id', 'link_id', 'clicked_at', 'ip_hash', 'ua_family', 'referrer'],
    why: 'move 3 - per-click rows behind /go/<code>',
  },
  {
    table: 'mothermode_sales_funnel_leads',
    columns: ['utm_content'],
    why: 'receiving half of utm_content=piece_id (sales)',
  },
  {
    table: 'mothermode_optin_leads',
    columns: ['utm_content'],
    why: 'receiving half of utm_content=piece_id (optin)',
  },
];

/**
 * Probe one column. PostgREST rejects an unknown column in `select` with 400 +
 * PGRST202/42703, which is a different signal from a missing table (404).
 */
async function columnExists(table, column) {
  const res = await fetch(
    `${URL_BASE}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(column)}&limit=0`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  if (res.ok) return { ok: true };
  const body = await res.text();
  return {
    ok: false,
    status: res.status,
    missingTable: res.status === 404 || /PGRST205/.test(body),
    body: body.slice(0, 160),
  };
}

(async () => {
  console.log(`\nTarget project: ${URL_BASE}`);
  console.log('Migration:      20261005000000_planner_funnel_links_and_utm.sql\n');

  const problems = [];

  for (const { table, columns, why } of EXPECTED) {
    const results = [];
    for (const col of columns) {
      const r = await columnExists(table, col);
      if (r.status === 401 || r.status === 403) {
        console.error(`\nAUTH FAILED (${r.status}) probing ${table}.${col}`);
        console.error(`  ${r.body}`);
        console.error('\n  Keys are per-project. No conclusions drawn.\n');
        process.exit(2);
      }
      results.push({ col, ...r });
      if (!r.ok) problems.push({ table, col, ...r });
    }
    const bad = results.filter((r) => !r.ok);
    const mark = bad.length === 0 ? 'OK  ' : 'FAIL';
    console.log(`  [${mark}] ${table}  (${why})`);
    console.log(`         ${results.length - bad.length}/${results.length} columns present`);
    for (const b of bad) {
      console.log(`         - ${b.col}  [${b.status}] ${b.missingTable ? 'TABLE MISSING' : b.body}`);
    }
  }

  console.log('');
  if (problems.length) {
    console.log(`${problems.length} problem(s). The migration is NOT fully applied.`);
    console.log('Apply supabase/_bundle_pending.sql (it is re-runnable), then re-run this.\n');
    process.exit(1);
  }

  console.log('Migration fully applied: all tables and columns present.');
  console.log('utm_content will now persist for real -- the leadUtmContent.ts shim');
  console.log('is no longer masking anything on this database.\n');
})();
