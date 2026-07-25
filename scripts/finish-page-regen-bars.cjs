/** Insert "Regenerate this page" bars into each SalesFunnelEditor content tab. */
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx');
let ed = fs.readFileSync(P, 'utf8');

// Discover tab keys actually used in render conditions
const keys = [...new Set([...ed.matchAll(/tab === '([a-z0-9-]+)' && \(/g)].map((m) => m[1]))];
console.log('tabs found:', keys.join(', '));

const PAGE_BY_TAB = {
  optin: 'optin',
  sales: 'sales',
  vsl: 'vsl',
  checkout: 'checkout',
  upsell1: 'upsell1',
  upsell2: 'upsell2',
  upsell3: 'upsell3',
  upsell4: 'upsell4',
  'upsell-1': 'upsell1',
  'upsell-2': 'upsell2',
  'upsell-3': 'upsell3',
  'upsell-4': 'upsell4',
  upsell: 'upsell1',
  success: 'success',
  access: 'access',
};

function bar(page) {
  return `          <div className="mb-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mode/20 bg-mode/[0.06] px-3 py-2">
            <p className="text-[11px] text-bone/60">Rewrite this page from the Build tab offer stack.</p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => onGeneratePage('${page}')}
              className="rounded-lg border border-mode/40 bg-mode/15 px-3 py-1.5 text-[11px] font-semibold text-bone hover:bg-mode/25 disabled:opacity-50"
            >
              {busy === 'generatePage' ? 'Regenerating…' : 'Regenerate this page'}
            </button>
          </div>
`;
}

let inserted = 0;
for (const tab of keys) {
  const page = PAGE_BY_TAB[tab];
  if (!page) {
    console.log('skip tab (no page map):', tab);
    continue;
  }
  if (ed.includes(`onGeneratePage('${page}')`)) {
    console.log('already wired:', tab);
    continue;
  }
  const find = `tab === '${tab}' && (`;
  const idx = ed.indexOf(find);
  if (idx < 0) continue;
  // find the first opening element tag line after the condition and insert after it
  const after = idx + find.length;
  const rest = ed.slice(after);
  const m = rest.match(/^\s*\n\s*<(section|div)[^>]*>\s*\n/);
  if (!m) {
    console.log('WARN pattern miss:', tab, JSON.stringify(rest.slice(0, 90)));
    continue;
  }
  const at = after + m[0].length;
  ed = ed.slice(0, at) + bar(page) + ed.slice(at);
  inserted++;
  console.log('inserted bar:', tab, '->', page);
}

fs.writeFileSync(P, ed, 'utf8');
console.log('inserted', inserted, 'bars; file', ed.length);
