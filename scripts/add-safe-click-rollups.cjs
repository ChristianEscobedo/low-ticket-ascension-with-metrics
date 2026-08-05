/**
 * Moves the "clicks must never break the page" wrapper out of the dashboard and
 * into the lib, so every surface degrades identically instead of each one
 * inventing its own fallback. Idempotent.
 */
const fs = require('fs');

const file = 'src/lib/mothermode/planner/links.ts';
const src = fs.readFileSync(file, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';

if (src.includes('getClickRollupsSafe')) {
  console.log('already present — no changes');
  process.exit(0);
}

const block = [
  '',
  '/**',
  ' * Click rollups that cannot take a page down.',
  ' *',
  ' * Clicks are a secondary metric on pages whose primary job is revenue, and the',
  ' * planner migration may legitimately not be applied on a given database. So a',
  ' * failure returns null — which every caller renders as "n/a" (honestly unknown)',
  ' * rather than 0 (a claim that nobody clicked).',
  ' *',
  ' * Shared rather than re-implemented per surface: three pages each inventing a',
  ' * fallback is how one screen ends up showing 0 while another shows n/a from the',
  ' * same failure.',
  ' */',
  'export async function getClickRollupsSafe(): Promise<ClickRollups | null> {',
  '  try {',
  '    return await getClickRollups();',
  '  } catch {',
  '    return null;',
  '  }',
  '}',
  '',
].join(nl);

fs.writeFileSync(file, src.replace(/\s*$/, '') + nl + block);
console.log('added getClickRollupsSafe() to', file);
