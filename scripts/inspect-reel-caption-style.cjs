/**
 * Print the caption style stored on every reel, straight from the database.
 *
 * WHY THIS EXISTS
 * ---------------
 * "the render's captions don't match the preview" has now survived four fixes.
 * Every round reasoned about the pipeline from source code and pixels; nobody
 * ever read the row. The preview renders from live React state, the export
 * renders from the plan, and the plan starts from this column — so this value is
 * the fork in the road, and it takes one query to stop guessing.
 *
 * Read-only. Prints ids and caption fields only, never the whole project blob.
 *
 *   node scripts/inspect-reel-caption-style.cjs
 */
const fs = require('fs');
const path = require('path');

/** Minimal .env.local reader — no dependency on the app's loader. */
function env(name) {
  if (process.env[name]) return process.env[name].trim();
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

/** The table name lives in the store; read it instead of hardcoding a guess. */
function reelTable() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'lib', 'mothermode', 'reel', 'store.ts'),
    'utf8',
  );
  const m = src.match(/const\s+TABLE\s*=\s*'([^']+)'/);
  if (!m) throw new Error('Could not find TABLE in reel/store.ts');
  return m[1];
}

(async () => {
  const url = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const table = reelTable();
  const endpoint =
    `${url.replace(/\/$/, '')}/rest/v1/${table}` +
    '?select=id,name,project,updated_at&order=updated_at.desc&limit=15';

  const res = await fetch(endpoint, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`REST ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const rows = await res.json();
  console.log(`table = ${table} — ${rows.length} most recently updated reels\n`);
  for (const r of rows) {
    const p = r.project || {};
    const ov = p.captionOverrides || null;
    console.log(
      [
        `id=${r.id}`,
        `name=${JSON.stringify(r.name)}`,
        `captionStyle=${JSON.stringify(p.captionStyle)}`,
        `overrides=${ov ? JSON.stringify(ov) : 'none'}`,
        `clips=${Array.isArray(p.clips) ? p.clips.length : 0}`,
        `updated=${r.updated_at}`,
      ].join('  '),
    );
  }
})().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
