const fs = require('fs');
const t = fs.readFileSync('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', 'utf8');
const keys = [
  'footer',
  'defaultMotherModeSalesFooter',
  'newFunnel',
  'createFunnel',
  'blank',
  'setFooter',
  'footer:',
];
for (const k of keys) {
  let n = 0,
    i = 0;
  while ((i = t.indexOf(k, i)) >= 0) {
    n++;
    i++;
  }
  console.log(k, n);
}

// Find create/new handlers
const patterns = [
  'function startNew',
  'function create',
  'const create',
  'onCreate',
  'New funnel',
  'new funnel',
  'defaultMotherModeSales',
  'defaultMotherModeCheckout',
  'useState<SalesFooter',
  'useState.*footer',
  "tab === 'footer'",
  'setFooterField',
  'footer.brandLine',
];
for (const p of patterns) {
  const i = t.search(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  console.log('search', p, i);
  if (i >= 0) console.log(t.slice(i, i + 400));
  console.log('---');
}

// dump footer tab UI
const fi = t.indexOf("id: 'footer'");
console.log('footer tab def', fi);
console.log(t.slice(fi, fi + 200));
const ft = t.indexOf("case 'footer'");
console.log('case footer', ft);
const ft2 = t.indexOf("tab === 'footer'");
console.log('tab===footer', ft2);
if (ft2 >= 0) console.log(t.slice(ft2, ft2 + 1200));

// find initial state for new funnel
const ni = t.indexOf('defaultMotherModeSalesFooter()');
console.log('default footer call', ni);
if (ni >= 0) console.log(t.slice(ni - 300, ni + 200));

// find where funnel state is initialized
const si = t.indexOf('useState<Partial');
console.log('partial state', si);
const sj = t.indexOf('useState<SalesFunnel');
console.log('funnel state', sj);
console.log(t.slice(sj, sj + 800));
