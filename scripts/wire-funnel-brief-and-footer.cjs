/**
 * Task B finisher: add `footer` to the sales-ai route (allowlist + generate
 * response), sanity-check the funnel-brief / footer-normalizer imports used by
 * openai-sales.ts, then re-run the AI fill coverage audit and refresh
 * scripts/ai-fill-coverage.txt.
 *
 * Idempotent. Safe to re-run.
 */
const fs = require('fs');
const { execSync } = require('child_process');

const ROUTE = 'src/app/api/mothermode/sales-ai/route.ts';
let route = fs.readFileSync(ROUTE, 'utf8');
let changed = false;

if (!/'success', 'access', 'footer',/.test(route)) {
  route = route.replace(/'success', 'access',/, "'success', 'access', 'footer',");
  changed = true;
}
if (!/footer: result\.data\.footer,/.test(route)) {
  route = route.replace(
    /access: result\.data\.access,/,
    'access: result.data.access,\n    footer: result.data.footer,',
  );
  changed = true;
}
if (changed) fs.writeFileSync(ROUTE, route, 'utf8');

const routeNow = fs.readFileSync(ROUTE, 'utf8');
console.log('route allowlist has footer :', /'access', 'footer'/.test(routeNow));
console.log('route response has footer  :', /footer: result\.data\.footer/.test(routeNow));

const types = fs.readFileSync('src/lib/mothermode/sales/types.ts', 'utf8');
console.log(
  'normalizeSalesFooter export :',
  /export\s+function\s+normalizeSalesFooter/.test(types) ||
    /export\s+const\s+normalizeSalesFooter/.test(types),
);

const brief = fs.readFileSync('src/lib/mothermode/sales/funnelBrief.ts', 'utf8');
console.log(
  'funnelBriefFromIntake export :',
  /export\s+(function|const)\s+funnelBriefFromIntake/.test(brief),
);
console.log(
  'formatFunnelBriefForPrompt   :',
  /export\s+(function|const)\s+formatFunnelBriefForPrompt/.test(brief),
);

const sales = fs.readFileSync('src/utils/integrations/openai-sales.ts', 'utf8');
console.log(
  'brief injected (funnel+page) :',
  (sales.match(/formatFunnelBriefForPrompt\(brief\)/g) || []).length,
  'call sites',
);

console.log('\n--- audit ---');
const out = execSync('node scripts/audit-ai-fill-coverage.cjs', { encoding: 'utf8' });
fs.writeFileSync('scripts/ai-fill-coverage.txt', out, 'utf8');
const lines = out.split(/\r?\n/);
const start = lines.findIndex((l) => /^page\s|TOTAL|^--- GAP/.test(l));
lines
  .filter((l, i) =>
    /TOTAL|HEADLINE NUMBER|^--- GAP|^\s*\(none\)|NO AI SCHEMA|GAP: never|^footer|GAP \(/.test(l) ||
    (i > start && /^(optin|sales|vsl|checkout|upsell\d|success|access|footer)\s/.test(l)),
  )
  .slice(0, 40)
  .forEach((l) => console.log(l));
