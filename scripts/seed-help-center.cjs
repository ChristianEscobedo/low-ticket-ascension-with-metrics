/**
 * seed-help-center.cjs — one-shot Help Center seeder.
 *
 * Upserts the starter knowledge base articles and changelog entries from
 * `src/lib/mothermode/help/seedContent.ts` into Supabase with the service
 * role. Idempotent BY SLUG / NATURAL KEY: safe to re-run, and it WILL
 * overwrite rows whose slug matches a seed row. If you have hand-edited a
 * seeded article in /admin/help and want to keep your edits, change the
 * article's slug first (or skip seeding).
 *
 * Usage:
 *   node scripts/seed-help-center.cjs           # seed both tables
 *   node scripts/seed-help-center.cjs --dry     # print what would be written
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

/**
 * Load the seed module by compiling the TypeScript barrel (and its whole
 * `seedContent/` directory) on the fly with the project's own `typescript`
 * package. This handles imports, `import type`, generics, and re-exports, so
 * we never have to maintain a fragile regex stripper as the seed grows.
 */
function loadSeedModule() {
  const ts = require('typescript');
  const entry = path.join(process.cwd(), 'src/lib/mothermode/help/seedContent.ts');

  const out = ts.transpileModule(fs.readFileSync(entry, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    fileName: entry,
  }).outputText;

  // The barrel re-exports from ./seedContent/*; resolve those through the same
  // transpile-on-read hook so relative imports work.
  const Module = require('module');
  const origJs = require.extensions['.js'];
  require.extensions['.ts'] = function (m, filename) {
    const src = fs.readFileSync(filename, 'utf8');
    const js = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
      fileName: filename,
    }).outputText;
    m._compile(js, filename);
  };

  const m = new Module(entry, module);
  m.filename = entry;
  m.paths = Module._nodeModulePaths(path.dirname(entry));
  m._compile(out, entry);
  require.extensions['.ts'] = origJs; // not needed further, restore
  return m.exports;
}

async function main() {
  const dry = process.argv.includes('--dry');
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Need NEXT_PUBLIC_SUPABASE_URL + a service role key.');
    process.exit(1);
  }

  const { HELP_CENTER_SEED_ARTICLES, HELP_CENTER_SEED_CHANGELOG } = loadSeedModule();
  const now = new Date().toISOString();

  const articleRows = HELP_CENTER_SEED_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    excerpt: a.excerpt,
    body: a.body,
    published: a.published,
    sort_order: a.sortOrder,
    audience: a.audience === 'buyer' ? 'buyer' : 'admin',
    updated_by: 'seed-help-center',
    updated_at: now,
  }));
  const changelogRows = HELP_CENTER_SEED_CHANGELOG.map((c) => ({
    version: c.version,
    released_on: c.releasedOn,
    entry_type: c.entryType,
    title: c.title,
    body: c.body,
    published: c.published,
    updated_by: 'seed-help-center',
    updated_at: now,
  }));

  if (dry) {
    console.log(`DRY RUN. ${articleRows.length} articles, ${changelogRows.length} changelog entries.`);
    for (const a of articleRows) console.log(`  article: ${a.category} / ${a.slug}`);
    for (const c of changelogRows) console.log(`  changelog: ${c.released_on} ${c.version} ${c.title}`);
    return;
  }

  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false } });

  // Articles: upsert on the unique slug.
  const aRes = await db
    .from('mothermode_kb_articles')
    .upsert(articleRows, { onConflict: 'slug' });
  if (aRes.error) {
    console.error('articles upsert failed:', aRes.error.message);
    process.exit(1);
  }

  // Changelog: natural key is (released_on, title). Delete seed-owned rows that
  // match the key, then insert fresh. Keeps it idempotent without a unique
  // constraint, and never touches rows that were not seed-authored.
  let inserted = 0;
  for (const row of changelogRows) {
    const existing = await db
      .from('mothermode_changelog')
      .select('id, updated_by')
      .eq('released_on', row.released_on)
      .eq('title', row.title)
      .limit(1);
    if (existing.error) {
      console.error('changelog read failed:', existing.error.message);
      process.exit(1);
    }
    const match = existing.data && existing.data[0];
    if (match && match.updated_by && match.updated_by !== 'seed-help-center') {
      console.log(`  skip (hand-edited): ${row.released_on} ${row.title}`);
      continue;
    }
    if (match) {
      const upd = await db
        .from('mothermode_changelog')
        .update(row)
        .eq('id', match.id);
      if (upd.error) {
        console.error(`changelog update failed for ${row.title}:`, upd.error.message);
        process.exit(1);
      }
    } else {
      const ins = await db.from('mothermode_changelog').insert(row);
      if (ins.error) {
        console.error(`changelog insert failed for ${row.title}:`, ins.error.message);
        process.exit(1);
      }
    }
    inserted += 1;
  }

  console.log(`Seeded ${articleRows.length} articles and ${inserted} changelog entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
