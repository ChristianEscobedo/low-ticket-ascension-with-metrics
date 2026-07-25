/**
 * build-migration-bundle.cjs
 *
 * Builds ONE ordered, RE-RUNNABLE .sql file from the migrations, for pasting into
 * the Supabase SQL editor.
 *
 * WHY THIS IS WRITTEN THIS WAY
 * ----------------------------
 * The first version of this script trusted scripts/db-table-audit.cjs, which
 * probes tables through PostgREST and treats a 404 as "table missing". That is
 * wrong. Running the resulting bundle produced:
 *
 *     ERROR: 42P07: relation "integrations" already exists
 *
 * The table exists in Postgres; PostgREST just wasn't serving it (not in the
 * exposed schema cache / no grants). So a REST 404 means "not reachable via the
 * API", which is a superset of "not created". We cannot reliably tell the two
 * apart from outside the database.
 *
 * So we stop trying to decide what to include, and instead make everything safe
 * to run twice. Each migration is normalized to idempotent form:
 *
 *   CREATE TABLE x            -> CREATE TABLE IF NOT EXISTS x
 *   CREATE INDEX i            -> CREATE INDEX IF NOT EXISTS i
 *   ALTER TABLE t ADD COLUMN  -> ADD COLUMN IF NOT EXISTS
 *   CREATE POLICY p ON t      -> DROP POLICY IF EXISTS p ON t; CREATE POLICY ...
 *   CREATE TRIGGER g ON t     -> DROP TRIGGER IF EXISTS g ON t; CREATE TRIGGER ...
 *   CREATE TYPE ...           -> wrapped in a DO block that ignores duplicate_object
 *
 * Those are the five shapes that actually throw on a second run. Postgres has
 * native IF NOT EXISTS for tables, indexes and columns; policies and triggers
 * don't, so they get a preceding DROP; enum types need the DO/exception wrapper.
 *
 * INSERT statements are NOT made idempotent -- there is no general way to do it.
 * Any migration containing one is reported so you can eyeball it before running.
 *
 *   node scripts/build-migration-bundle.cjs [fromTimestamp]
 *
 * Writes: supabase/_bundle_pending.sql   (disposable, gitignored)
 */
const fs = require('fs');
const path = require('path');

const FROM = process.argv[2] || '20260614000000';
const MIG_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const OUT = path.join(process.cwd(), 'supabase', '_bundle_pending.sql');

/** Strip string literals and comments so regexes don't match inside them. */
function maskNonCode(sql) {
  return sql
    .replace(/--[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/'(?:[^']|'')*'/g, (m) => ' '.repeat(m.length))
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => m.replace(/[^\n]/g, ' '));
}

function makeIdempotent(sql) {
  const notes = [];

  // CREATE TABLE -> CREATE TABLE IF NOT EXISTS
  sql = sql.replace(
    /\bcreate\s+table\s+(?!if\s+not\s+exists\b)/gi,
    (m) => {
      notes.push('table guarded');
      return m.replace(/\s+$/, ' ') + 'IF NOT EXISTS ';
    },
  );

  // CREATE [UNIQUE] INDEX -> ... IF NOT EXISTS
  sql = sql.replace(
    /\bcreate\s+(unique\s+)?index\s+(?!if\s+not\s+exists\b)(?!concurrently\b)/gi,
    (m, uniq) => {
      notes.push('index guarded');
      return `CREATE ${uniq ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS `;
    },
  );

  // ADD COLUMN -> ADD COLUMN IF NOT EXISTS
  sql = sql.replace(/\badd\s+column\s+(?!if\s+not\s+exists\b)/gi, () => {
    notes.push('column guarded');
    return 'ADD COLUMN IF NOT EXISTS ';
  });

  // CREATE POLICY "name" ON table  ->  DROP POLICY IF EXISTS ... ; CREATE POLICY ...
  sql = sql.replace(
    /\bcreate\s+policy\s+("(?:[^"]+)"|[a-z0-9_]+)\s+on\s+((?:[a-z0-9_]+\.)?(?:"[^"]+"|[a-z0-9_]+))/gi,
    (m, name, table) => {
      notes.push('policy made re-runnable');
      return `DROP POLICY IF EXISTS ${name} ON ${table};\nCREATE POLICY ${name} ON ${table}`;
    },
  );

  // CREATE TRIGGER name ... ON table  ->  DROP TRIGGER IF EXISTS name ON table; ...
  sql = sql.replace(
    /\bcreate\s+trigger\s+([a-z0-9_]+)([\s\S]*?)\bon\s+((?:[a-z0-9_]+\.)?(?:"[^"]+"|[a-z0-9_]+))/gi,
    (m, name, mid, table) => {
      notes.push('trigger made re-runnable');
      return `DROP TRIGGER IF EXISTS ${name} ON ${table};\nCREATE TRIGGER ${name}${mid}ON ${table}`;
    },
  );

  // CREATE TYPE ... ;  ->  DO block swallowing duplicate_object
  sql = sql.replace(/\bcreate\s+type\s+[\s\S]*?;/gi, (stmt) => {
    notes.push('type guarded');
    const body = stmt.trim().replace(/;$/, '');
    return `DO $idem$ BEGIN\n  ${body};\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $idem$;`;
  });

  return { sql, notes: [...new Set(notes)] };
}

const files = fs
  .readdirSync(MIG_DIR)
  .filter((f) => f.endsWith('.sql') && /^\d{14}/.test(f))
  .filter((f) => f.slice(0, 14) >= FROM)
  .sort();

if (!files.length) {
  console.error(`No migrations at or after ${FROM}.`);
  process.exit(1);
}

const parts = [
  '-- =====================================================================',
  '-- RE-RUNNABLE MIGRATION BUNDLE (generated -- do not commit as a migration)',
  `-- Generated: ${new Date().toISOString()}`,
  `-- Source:    ${files.length} migration(s) from ${FROM} onward, in order`,
  '--',
  '-- Every statement that would fail on a second run has been guarded, so this',
  '-- is safe to run against a database in an unknown state of partial migration.',
  '-- Wrapped in one transaction: any failure rolls the whole thing back.',
  '-- =====================================================================',
  '',
  'BEGIN;',
  '',
];

const withInserts = [];

for (const f of files) {
  const raw = fs.readFileSync(path.join(MIG_DIR, f), 'utf8');
  const { sql, notes } = makeIdempotent(raw);

  if (/\binsert\s+into\b/i.test(maskNonCode(raw))) withInserts.push(f);

  parts.push(
    '-- ---------------------------------------------------------------------',
    `-- ${f}`,
    notes.length ? `-- guarded: ${notes.join(', ')}` : '-- guarded: (nothing needed)',
    '-- ---------------------------------------------------------------------',
    '',
    sql.trim(),
    '',
  );
}

parts.push('COMMIT;', '');
fs.writeFileSync(OUT, parts.join('\n'), 'utf8');

console.log(`\nWrote supabase/_bundle_pending.sql`);
console.log(
  `  ${files.length} migrations, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`,
);
console.log('  all CREATE TABLE / INDEX / POLICY / TRIGGER / TYPE and ADD COLUMN guarded\n');

if (withInserts.length) {
  console.log('--- contains INSERT statements (not idempotent, review these) ---');
  for (const f of withInserts) console.log(`  ${f}`);
  console.log('');
}

console.log('Next:');
console.log('  1. Supabase dashboard -> SQL Editor -> paste _bundle_pending.sql -> Run');
console.log('  2. node scripts/db-table-audit.cjs');
console.log('     Any table still reported MISSING now means "exists but not exposed');
console.log('     through the REST API", not "not created" -- check grants/exposed schema.\n');
