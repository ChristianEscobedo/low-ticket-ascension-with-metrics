/** Inspect what we need for the lead-magnet picker (Phase 4). */
const fs = require('fs');
const path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const out = [];

function grep(file, re, label) {
  let src;
  try {
    src = R(file);
  } catch {
    out.push(`### ${label} — MISSING ${file}`);
    return;
  }
  out.push(`### ${label} (${file})`);
  src.split(/\r?\n/).forEach((l, i) => {
    if (re.test(l)) out.push(`${i + 1} ${l.trim()}`);
  });
  out.push('');
}

grep('src/lib/mothermode/sales/types.ts', /magnet|Optin|leadMagnet|cover/i, 'sales types optin/magnet');
grep('src/lib/mothermode/sales/defaults.ts', /magnet|cover/i, 'sales defaults magnet');
grep('src/lib/mothermode/leadgen/types.ts', /^export (type|interface)|title|promise|format|slug|id/i, 'leadgen types');
grep('src/app/api/admin/mothermode-leadgen/route.ts', /export async function|action|json\(|\.from\(/i, 'leadgen admin api');
grep('src/app/api/mothermode/leadgen-ai/route.ts', /export async function|action ===|case '/i, 'leadgen ai api');
grep('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', /setOptinField|const \[optin|magnetTitle|magnetPromise|coverImageUrl/i, 'editor optin fields');
grep('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', /1\. AI fill|2\. Generate full funnel|3\. Generate missing images|btnGhost =|btnPrimary =/i, 'editor build bar');

fs.writeFileSync(path.join(__dirname, 'leadgen-link-inspect.txt'), out.join('\n'), 'utf8');
console.log('written', out.length, 'lines');
