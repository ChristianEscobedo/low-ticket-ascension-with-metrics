/**
 * Full audit: content-type fields vs on-page Editable/MmEditable vs admin editor.
 */
const fs = require('fs');
const path = require('path');

const typesSrc = fs.readFileSync('src/lib/mothermode/sales/types.ts', 'utf8');
const adminSrc = fs.readFileSync(
  'src/app/admin/sales-funnels/SalesFunnelEditor.tsx',
  'utf8',
);

function interfaceFields(name) {
  const re = new RegExp('export interface ' + name + ' \\{([\\s\\S]*?)\\n\\}');
  const m = typesSrc.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*[?:]/gm)].map(
    (x) => x[1],
  );
}

function fieldRefs(src) {
  const set = new Set();
  for (const m of src.matchAll(/field=["']([^"']+)["']/g)) set.add(m[1]);
  return set;
}

function collectMmFields() {
  const set = new Set();
  const partsDir = 'src/components/mothermode/parts';
  for (const f of fs.readdirSync(partsDir).filter((x) => x.endsWith('.tsx'))) {
    const s = fs.readFileSync(path.join(partsDir, f), 'utf8');
    for (const m of s.matchAll(/field=["']([^"']+)["']/g)) set.add(m[1]);
  }
  const upsell = fs.readFileSync(
    'src/components/mothermode/upsell/MotherModeUpsellPage.tsx',
    'utf8',
  );
  for (const m of upsell.matchAll(/field=["']([^"']+)["']/g)) set.add(m[1]);
  return set;
}

function pageFields(name) {
  const p = `src/components/mothermode/sales/${name}.tsx`;
  if (!fs.existsSync(p)) return new Set();
  return fieldRefs(fs.readFileSync(p, 'utf8'));
}

function adminMentions(field) {
  // rough: field appears as string key in admin editor
  const patterns = [
    new RegExp(`['"]${field}['"]`),
    new RegExp(`\\.${field}\\b`),
    new RegExp(`\\[${field}\\]`),
  ];
  return patterns.some((re) => re.test(adminSrc));
}

const blocks = {
  SalesOptinContent: {
    page: 'SalesOptinPage',
    typeFields: interfaceFields('SalesOptinContent'),
  },
  SalesPageContent: {
    page: 'SalesPage',
    typeFields: interfaceFields('SalesPageContent'),
    mm: true,
  },
  VslPageContent: {
    page: 'VslPage',
    typeFields: interfaceFields('VslPageContent'),
  },
  CheckoutContent: {
    page: 'CheckoutPage',
    typeFields: interfaceFields('CheckoutContent'),
  },
  UpsellContent: {
    page: 'UpsellPage',
    typeFields: interfaceFields('UpsellContent'),
    mm: true,
  },
  SuccessContent: {
    page: 'SuccessPage',
    typeFields: interfaceFields('SuccessContent'),
  },
  AccessContent: {
    page: 'AccessPage',
    typeFields: interfaceFields('AccessContent'),
  },
  SalesFooterContent: {
    page: null,
    typeFields: interfaceFields('SalesFooterContent'),
  },
};

const mmFields = collectMmFields();

const report = [];
const gaps = [];

for (const [block, meta] of Object.entries(blocks)) {
  const pageSet = meta.page ? pageFields(meta.page) : new Set();
  const combined = new Set([...pageSet, ...(meta.mm ? mmFields : [])]);

  report.push(`\n======== ${block} (${meta.page || 'admin-only'}) ========`);
  report.push(`Type fields (${meta.typeFields.length}): ${meta.typeFields.join(', ')}`);
  report.push(
    `On-page field= refs (${combined.size}): ${[...combined].sort().join(', ')}`,
  );

  const missingOnPage = [];
  const missingAdmin = [];
  for (const f of meta.typeFields) {
    const onPage = combined.has(f);
    const admin = adminMentions(f);
    if (!onPage) missingOnPage.push(f);
    if (!admin) missingAdmin.push(f);
    if (!onPage || !admin) {
      gaps.push({
        block,
        field: f,
        onPage: onPage ? 'yes' : 'NO',
        admin: admin ? 'yes' : 'NO',
      });
    }
  }
  report.push(`Missing on-page: ${missingOnPage.join(', ') || '(none)'}`);
  report.push(`Missing admin: ${missingAdmin.join(', ') || '(none)'}`);
}

// Hardcoded non-editable copy scan in MotherMode parts (strings not wrapped)
report.push('\n======== HARDCODED COPY SCAN (parts) ========');
const hardcodedHints = [
  'Everything in the pack',
  'There is the way it has been',
  'Mothers who put some of it down',
  'The questions mothers ask first',
  'One page. One sitting',
  'What it costs to keep carrying it',
  'Get instant access',
  'Watch this first',
  'Continue to checkout',
];
for (const f of fs.readdirSync('src/components/mothermode/parts').filter((x) =>
  x.endsWith('.tsx'),
)) {
  const s = fs.readFileSync(path.join('src/components/mothermode/parts', f), 'utf8');
  for (const h of hardcodedHints) {
    if (s.includes(h)) {
      // check if nearby MmEditable
      const idx = s.indexOf(h);
      const window = s.slice(Math.max(0, idx - 200), idx + h.length + 80);
      const wrapped = window.includes('MmEditable') || window.includes('field=');
      report.push(
        `${f}: "${h}" ${wrapped ? 'NEAR MmEditable' : '*** HARDCODED / NOT EDITABLE ***'}`,
      );
    }
  }
}

// Footer page component?
report.push('\n======== FOOTER / SHARED ========');
report.push(
  `SalesFooterContent fields: ${interfaceFields('SalesFooterContent').join(', ')}`,
);
const footerUsed =
  fs.existsSync('src/components/mothermode/sales/SalesOptinPage.tsx') &&
  fs
    .readFileSync('src/components/mothermode/sales/SalesOptinPage.tsx', 'utf8')
    .includes('footer');
report.push(`Optin page references footer: ${footerUsed}`);

// Success/Access nested arrays
report.push('\n======== NESTED STRUCTURES (need special editors) ========');
const nested = [
  'SalesPageContent.problemPoints[]',
  'SalesPageContent.originParagraphs[]',
  'SalesPageContent.whatIsParagraphs[]',
  'SalesPageContent.mechanismParagraphs[] / mechanismPoints[]',
  'SalesPageContent.insideItems[]',
  'SalesPageContent.methodSteps[]',
  'SalesPageContent.oldWayItems[] / newWayItems[]',
  'SalesPageContent.proof[] / testimonials[]',
  'SalesPageContent.bonusesItems[]',
  'SalesPageContent.founderParagraphs[]',
  'SalesPageContent.faqs[]',
  'SalesPageContent.bumps[]',
  'UpsellContent.letter[] / features[] / gallery[] / bullets[]',
  'SuccessContent.deliveryCards[]',
  'AccessContent.onboardingItems[] / deliveryLinks[]',
  'SalesFooterContent.links[]',
];
for (const n of nested) report.push(`- ${n}`);

// Summary table
report.push('\n======== GAP TABLE (field missing on-page OR admin) ========');
report.push('block | field | onPage | admin');
for (const g of gaps) {
  report.push(`${g.block} | ${g.field} | ${g.onPage} | ${g.admin}`);
}

const out = report.join('\n');
fs.writeFileSync('scripts/funnel-editability-audit.txt', out);
console.log(out);
console.log('\nWrote scripts/funnel-editability-audit.txt');
console.log(`Total gaps: ${gaps.length}`);
