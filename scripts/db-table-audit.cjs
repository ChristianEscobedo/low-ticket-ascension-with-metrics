/**
 * db-table-audit.cjs
 *
 * Diffs the tables declared in supabase/migrations/*.sql against the tables that
 * actually exist in the live database.
 *
 * Why this exists: PostgREST reports a missing table as
 * "Could not find the table 'public.X' in the schema cache", which reads like a
 * caching problem but almost always means the migration was never applied. This
 * script answers "which migrations are missing?" instead of finding out one
 * feature at a time as each one 500s in the UI.
 *
 * Read-only. Probes each table with a zero-row select; never writes.
 *
 *   node scripts/db-table-audit.cjs
 */
const fs = require('fs');
const path = require('path');

// --- env ------------------------------------------------------------------
function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      let v = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = v;
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

// --- collect declared tables ---------------------------------------------
const MIG_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const files = fs
  .readdirSync(MIG_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

/** table name -> migration file that creates it */
const declared = new Map();
const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["`]?([a-z0-9_]+)["`]?/gi;

for (const f of files) {
  const sql = fs.readFileSync(path.join(MIG_DIR, f), 'utf8');
  let m;
  while ((m = createRe.exec(sql)) !== null) {
    const t = m[1];
    if (!declared.has(t)) declared.set(t, f);
  }
}

// --- probe ----------------------------------------------------------------
async function exists(table) {
  const res = await fetch(
    `${URL_BASE}/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  if (res.ok) return { ok: true };
  const body = await res.text();
  // PostgREST uses 404 + PGRST205 for "relation does not exist".
  const missing = res.status === 404 || /PGRST205|does not exist|schema cache/i.test(body);
  return { ok: false, missing, status: res.status, body: body.slice(0, 200) };
}

(async () => {
  const missing = [];
  const present = [];
  const odd = [];

  for (const [table, file] of declared) {
    const r = await exists(table);

    // A 401/403 means we never got to ask the database anything -- the
    // credentials are wrong. Bail immediately instead of classifying 44 tables
    // as "inconclusive" and printing a summary that reads like "nothing is
    // missing". This exact case wasted a full debugging cycle: the URL in
    // .env.local was switched to a new project while the service_role key was
    // left pointing at the old one.
    if (r.status === 401 || r.status === 403) {
      console.error(`\nAUTH FAILED (${r.status}) probing "${table}".`);
      console.error(`  ${r.body}`);
      console.error(`\n  URL in use: ${URL_BASE}`);
      console.error(
        '  Supabase keys are per-project. If you changed NEXT_PUBLIC_SUPABASE_URL,',
      );
      console.error(
        '  you must also replace SUPABASE_SERVICE_ROLE_KEY (and the anon key) with',
      );
      console.error(
        '  the ones from that same project: Dashboard -> Project Settings -> API.',
      );
      console.error('\nNo conclusions drawn about the schema.\n');
      process.exit(2);
    }

    if (r.ok) present.push(table);
    else if (r.missing) missing.push({ table, file });
    else odd.push({ table, file, status: r.status, body: r.body });
  }

  console.log(`\nMigrations scanned: ${files.length}`);
  console.log(`Target project:     ${URL_BASE}`);
  console.log(`Tables declared:    ${declared.size}`);
  console.log(`Present in DB:      ${present.length}`);
  console.log(`MISSING from DB:    ${missing.length}`);
  // Always surface this. A non-zero count means the numbers above are partial,
  // so it must not be hidden below the fold where a summary looks conclusive.
  console.log(`INCONCLUSIVE:       ${odd.length}\n`);

  if (missing.length) {
    // Group by migration file - that's the unit you actually apply.
    const byFile = new Map();
    for (const { table, file } of missing) {
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file).push(table);
    }
    console.log('--- MISSING, grouped by migration to apply ---');
    for (const [file, tables] of [...byFile].sort()) {
      console.log(`\n  ${file}`);
      for (const t of tables) console.log(`      - ${t}`);
    }
    console.log('\n--- files, newline separated ---');
    for (const [file] of [...byFile].sort()) console.log(file);
  } else {
    console.log('All declared tables exist. Nothing to apply.');
  }

  if (odd.length) {
    console.log('\n--- inconclusive (not a clean 404; check manually) ---');
    for (const o of odd) console.log(`  ${o.table}  [${o.status}] ${o.body}`);
  }

  // Machine-readable handoff for build-migration-bundle.cjs, so the bundle
  // contains exactly what is missing rather than "everything after a date".
  const out = path.join(process.cwd(), 'supabase', '_pending.json');
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        missingTables: missing.map((m) => m.table),
        presentTables: present,
        missingFiles: [...new Set(missing.map((m) => m.file))].sort(),
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nWrote supabase/_pending.json`);
  console.log('');
})();
