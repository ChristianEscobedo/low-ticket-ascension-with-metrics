const fs = require('fs');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

const checks = [
  // types
  ['types.timerLabel', 'src/lib/mothermode/sales/types.ts', 'timerLabel: string'],
  ['types.brandLabel', 'src/lib/mothermode/sales/types.ts', 'brandLabel: string'],
  ['norm.timerLabel', 'src/lib/mothermode/sales/types.ts', "timerLabel: asString(o.timerLabel"],
  ['norm.brandLabel', 'src/lib/mothermode/sales/types.ts', "brandLabel: asString(o.brandLabel"],
  // defaults
  ['def.timer', 'src/lib/mothermode/sales/defaults.ts', "timerLabel: 'Founding price held for:'"],
  ['def.brand', 'src/lib/mothermode/sales/defaults.ts', "brandLabel: 'MOTHERMODE'"],
  ['def.footer', 'src/lib/mothermode/sales/defaults.ts', 'defaultMotherModeSalesFooter'],
  // checkout component
  ['co.import', 'src/components/mothermode/checkout/MotherModeCheckout.tsx', 'MmEditable'],
  ['co.timerField', 'src/components/mothermode/checkout/MotherModeCheckout.tsx', 'field="timerLabel"'],
  ['co.brandField', 'src/components/mothermode/checkout/MotherModeCheckout.tsx', 'field="brandLabel"'],
  ['co.onDark', 'src/components/mothermode/checkout/MotherModeCheckout.tsx', 'onDark'],
  // checkout page
  ['cp.timerProp', 'src/components/mothermode/sales/CheckoutPage.tsx', 'timerLabel={c.timerLabel'],
  ['cp.brandProp', 'src/components/mothermode/sales/CheckoutPage.tsx', 'brandLabel={c.brandLabel'],
  ['cp.sheetTimer', 'src/components/mothermode/sales/CheckoutPage.tsx', 'field="timerLabel"'],
  ['cp.sheetBrand', 'src/components/mothermode/sales/CheckoutPage.tsx', 'field="brandLabel"'],
  ['cp.provider', 'src/components/mothermode/sales/CheckoutPage.tsx', 'SalesPageEditProvider'],
  ['cp.footer', 'src/components/mothermode/sales/CheckoutPage.tsx', 'OptinFooter'],
  // wordmark
  ['wm.client', 'src/components/mothermode/optin/Wordmark.tsx', "'use client'"],
  ['wm.edit', 'src/components/mothermode/optin/Wordmark.tsx', 'useSalesPageEdit'],
  ['wm.path', 'src/components/mothermode/optin/Wordmark.tsx', 'footer.brandLine'],
  // hero
  ['hero.shared', 'src/components/mothermode/parts/HeroSection.tsx', 'OptinWordmark'],
  // admin
  ['admin.timer', 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx', "setCheckoutField('timerLabel'"],
  ['admin.brand', 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx', "setCheckoutField('brandLabel'"],
  ['admin.footerSeed', 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx', 'defaultMotherModeSalesFooter()'],
  ['admin.footerTab', 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx', "tab === 'footer'"],
  // path support
  ['inline.footerPath', 'src/components/mothermode/sales/inlineEdit.tsx', "field.startsWith('footer.')"],
  ['inline.saveFooter', 'src/components/mothermode/sales/inlineEdit.tsx', 'footer: draft.footer'],
  // store
  ['store.footer', 'src/lib/mothermode/sales/store.ts', 'footer: normalizeSalesFooter'],
  ['store.dupFooter', 'src/lib/mothermode/sales/store.ts', 'footer: src.footer'],
];

// negative checks
const negatives = [
  ['hero.noLocal', 'src/components/mothermode/parts/HeroSection.tsx', 'const Wordmark'],
];

let fail = 0;
for (const [label, path, needle] of checks) {
  const ok = read(path).includes(needle);
  console.log(ok ? 'PASS' : 'FAIL', label);
  if (!ok) fail++;
}
for (const [label, path, needle] of negatives) {
  const ok = !read(path).includes(needle);
  console.log(ok ? 'PASS' : 'FAIL', label);
  if (!ok) fail++;
}

// dump checkout MmEditable blocks
const co = read('src/components/mothermode/checkout/MotherModeCheckout.tsx');
const tIdx = co.indexOf('field="timerLabel"');
const bIdx = co.indexOf('field="brandLabel"');
console.log('\n--- timer MmEditable ---');
console.log(co.slice(Math.max(0, tIdx - 40), tIdx + 280));
console.log('\n--- brand MmEditable ---');
console.log(co.slice(Math.max(0, bIdx - 40), bIdx + 280));

// OptinFooter brandLine editable?
const of = read('src/components/mothermode/optin/OptinFooter.tsx');
console.log('\nOptinFooter brandLine edit?', of.includes('brandLine'));
console.log('OptinFooter footer.brandLine?', of.includes('footer.brandLine') || of.includes("field=\"brandLine\"") || of.includes("field='brandLine'"));

if (fail) {
  console.error('\n' + fail + ' failures');
  process.exitCode = 1;
} else {
  console.log('\nALL PASS');
}
