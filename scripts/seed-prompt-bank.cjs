/**
 * seed-prompt-bank.cjs — Prompt Bank seeder.
 *
 * Upserts the builtin prompt recipes (the text frameworks from
 * src/lib/mothermode/content/promptBank.ts, the image creative frameworks
 * from imagePromptBank.ts, plus the prompt styles from promptStyles.ts) into
 * `mothermode_prompt_recipes` with the service role.
 * Idempotent BY SLUG: safe to re-run, and it WILL overwrite rows whose slug
 * matches a seed. If you have hand-edited a recipe in /admin/prompt-bank and
 * want to keep your edits, do not re-run this script (or export first).
 *
 * Requires the 20261029000000 image-group migration (recipe_group 'image',
 * kind, size_presets columns) and the 20261030000000 inputs migration
 * (custom input fields column) to be applied before seeding.
 *
 * Usage:
 *   node scripts/seed-prompt-bank.cjs           # seed all builtin recipes
 *   node scripts/seed-prompt-bank.cjs --dry     # print what would be written
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

/** Transpile-on-read hook so the script can require the TS registries. */
function hookTypeScript() {
  const ts = require('typescript');
  require.extensions['.ts'] = function (m, filename) {
    const src = fs.readFileSync(filename, 'utf8');
    const js = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
      },
      fileName: filename,
    }).outputText;
    m._compile(js, filename);
  };
}

function recipeRow(recipe, sortOrder) {
  return {
    slug: recipe.id,
    recipe_group: recipe.group,
    label: recipe.label,
    hint: recipe.hint ?? '',
    goal: recipe.goal ?? 'shares',
    why_it_works: recipe.whyItWorks ?? [],
    template: recipe.template ?? '',
    example_hooks: recipe.exampleHooks ?? [],
    craft: recipe.craft ?? '',
    platforms: recipe.platforms ?? [],
    formats: recipe.formats ?? [],
    kind: recipe.kind ?? null,
    size_presets: recipe.sizePresetIds ?? [],
    platform_notes: recipe.platformNotes ?? {},
    source_urls: recipe.sourceUrls ?? [],
    inputs: recipe.inputs ?? [],
    enabled: recipe.enabled !== false,
    builtin: true,
    sort_order: sortOrder,
    updated_by: 'seed-prompt-bank',
  };
}

async function main() {
  const dry = process.argv.includes('--dry');
  loadEnv();
  hookTypeScript();

  const { PROMPT_RECIPES } = require('../src/lib/mothermode/content/promptBank.ts');
  const { IMAGE_PROMPT_RECIPES } = require('../src/lib/mothermode/content/imagePromptBank.ts');
  const { PROMPT_STYLES } = require('../src/lib/mothermode/content/promptStyles.ts');

  // Frameworks first in registry order, image bank next, styles last, all
  // marked builtin.
  const styleOffset = PROMPT_RECIPES.length + IMAGE_PROMPT_RECIPES.length;
  const rows = [
    ...PROMPT_RECIPES.filter((r) => r.id !== 'auto').map((r, i) =>
      recipeRow(r, i),
    ),
    ...IMAGE_PROMPT_RECIPES.map((r, i) =>
      recipeRow(r, PROMPT_RECIPES.length + i),
    ),
    ...PROMPT_STYLES.filter((s) => s.id !== 'auto').map((s, i) =>
      recipeRow(
        {
          id: s.id,
          label: s.label,
          hint: s.hint,
          group: 'style',
          goal: 'shares',
          whyItWorks: [],
          template: '',
          exampleHooks: [],
          craft: s.craft,
          platforms: s.platforms ?? [],
          formats: s.formats ?? [],
          builtin: true,
        },
        styleOffset + i,
      ),
    ),
  ];

  const withInputs = rows.filter((r) => (r.inputs ?? []).length > 0).length;
  console.log(
    `[seed-prompt-bank] ${rows.length} builtin recipes (${PROMPT_RECIPES.length} frameworks, ${IMAGE_PROMPT_RECIPES.length} image, ${PROMPT_STYLES.length - 1} styles, ${withInputs} with custom inputs)`,
  );
  if (dry) {
    for (const r of rows) console.log(`  ${r.sort_order}. [${r.recipe_group}] ${r.slug} - ${r.label}${(r.inputs ?? []).length ? ` (+${r.inputs.length} inputs)` : ''}`);
    console.log('[seed-prompt-bank] dry run, nothing written');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[seed-prompt-bank] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(url, key);

  const { error } = await sb
    .from('mothermode_prompt_recipes')
    .upsert(rows, { onConflict: 'slug' });
  if (error) {
    console.error('[seed-prompt-bank] upsert failed:', error.message);
    if (/kind|size_presets|recipe_group|inputs|schema cache|violates check/i.test(error.message)) {
      console.error(
        '[seed-prompt-bank] A prompt-bank migration has NOT been applied to this database yet.',
      );
      console.error(
        '[seed-prompt-bank] Apply both: paste supabase/migrations/20261029000000_mothermode_prompt_recipes_image_group.sql',
      );
      console.error(
        '[seed-prompt-bank] and supabase/migrations/20261030000000_mothermode_prompt_recipes_inputs.sql',
      );
      console.error(
        '[seed-prompt-bank] into the Supabase dashboard SQL editor (or run `supabase db push`), then re-run this seed.',
      );
    }
    process.exit(1);
  }
  console.log(`[seed-prompt-bank] upserted ${rows.length} recipes`);
}

main().catch((err) => {
  console.error('[seed-prompt-bank] failed:', err);
  process.exit(1);
});
