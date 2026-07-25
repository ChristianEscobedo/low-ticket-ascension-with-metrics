/**
 * Steps 3-5 of docs/SALES_FUNNEL_EDITOR_REFACTOR_NEXT_SESSION.md, in one
 * guarded pass over SalesFunnelEditor.tsx.
 *
 *  - `build` + `links` bodies      -> <OfferTab />        (parts/OfferTab.tsx)
 *  - `leads` body                  -> <LeadsTab />        (parts/LeadsTab.tsx)
 *  - optin/vsl/checkout/success/access -> parts/PageTabs components
 *  - flat 14-button tab bar        -> group bar + Pages sub-bar
 *
 * Rules this obeys (learned the expensive way, see the handoff doc):
 *  - never touch this file with replace_in_file (it echoes 1200 lines back)
 *  - assert before writing; a refused edit beats a half-applied one
 *  - anchor an inserted import on a single-line import, never on /^import\b/
 *
 * `tab` stays the single source of truth. The active group is DERIVED from it,
 * so handlers that jump straight to a page (onGenerate -> setTab('optin')) keep
 * working without also having to set a group.
 *
 * Re-running is a no-op: every step checks for its own marker first.
 */
const fs = require('fs');

const FILE = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
const PAGE_TABS_FILE = 'src/app/admin/sales-funnels/parts/PageTabs.tsx';

const src = fs.readFileSync(FILE, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
let lines = src.split(/\r?\n/);
const startCount = lines.length;
const log = [];

function fail(msg) {
  console.error('ABORT (nothing written): ' + msg);
  process.exit(1);
}

if (src.includes('<OfferTab')) {
  console.log('Already wired (found <OfferTab). No-op.');
  process.exit(0);
}
for (const dep of ['src/app/admin/sales-funnels/parts/OfferTab.tsx', 'src/app/admin/sales-funnels/parts/LeadsTab.tsx', PAGE_TABS_FILE]) {
  if (!fs.existsSync(dep)) fail('missing dependency ' + dep);
}
const pageTabsSrc = fs.readFileSync(PAGE_TABS_FILE, 'utf8');

// ---------------------------------------------------------------- regions ---
function openerIndex(tab) {
  return lines.findIndex((l) => l.trim() === `{tab === '${tab}' && (`);
}
function closerIndex(start) {
  const indent = lines[start].match(/^\s*/)[0];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].replace(/\s+$/, '') === indent + ')}') return i;
  }
  return -1;
}
function region(tab) {
  const s = openerIndex(tab);
  if (s < 0) fail(`no '{tab === '${tab}' && (' opener found`);
  const e = closerIndex(s);
  if (e < 0) fail(`no closer found for tab '${tab}'`);
  return { s, e, body: lines.slice(s, e + 1).join('\n'), size: e - s + 1 };
}
function swap(tab, replacementLines) {
  const r = region(tab);
  lines.splice(r.s, r.size, ...replacementLines);
  log.push(`  ${tab}: ${r.size} lines -> ${replacementLines.length}`);
  return r;
}
/** Field/Area labels inside a region — used to prove PageTabs lost no field. */
function labelsIn(text) {
  return Array.from(new Set((text.match(/label="[^"]+"/g) || [])));
}

// --- step 3: build (+ links, folded in) -> <OfferTab /> ----------------------
const linksRegion = region('links');
swap('build', [
  "        {tab === 'build' && (",
  '          <OfferTab',
  '            intake={intake}',
  '            setIntakeField={setIntakeField}',
  '            busy={busy}',
  '            onFillIntake={onFillIntake}',
  '            onGenerate={onGenerate}',
  '            onGenerateImages={onGenerateImages}',
  '            leadMagnetId={leadMagnetId}',
  '            leadMagnets={leadMagnets}',
  '            onPickLeadMagnet={onPickLeadMagnet}',
  '            onCreateLeadMagnet={onCreateLeadMagnet}',
  '            stack={stack}',
  '            setFrontEndField={setFrontEndField}',
  '            addBonus={addBonus}',
  '            updateBonus={updateBonus}',
  '            removeBonus={removeBonus}',
  '            addBump={addBump}',
  '            updateBump={updateBump}',
  '            removeBump={removeBump}',
  '            updateUpsell={updateUpsell}',
  '            offerSlug={offerSlug}',
  '            setOfferSlug={setOfferSlug}',
  '            leadGenSlug={leadGenSlug}',
  '            setLeadGenSlug={setLeadGenSlug}',
  '            deliverableSlug={deliverableSlug}',
  '            setDeliverableSlug={setDeliverableSlug}',
  '            deliverableKey={deliverableKey}',
  '            setDeliverableKey={setDeliverableKey}',
  '            productId={productId}',
  '            setProductId={setProductId}',
  '          />',
  '        )}',
]);

// the links body now lives inside OfferTab; prove it moved, then delete it
for (const label of labelsIn(linksRegion.body)) {
  if (!fs.readFileSync('src/app/admin/sales-funnels/parts/OfferTab.tsx', 'utf8').includes(label)) {
    fail(`links field ${label} is not present in OfferTab.tsx — refusing to delete the inline links tab`);
  }
}
{
  const r = region('links');
  lines.splice(r.s, r.size);
  log.push(`  links: ${r.size} lines -> 0 (folded into OfferTab)`);
}

// --- step 4: leads -> <LeadsTab /> ------------------------------------------
swap('leads', [
  "        {tab === 'leads' && <LeadsTab leads={leads} selectedId={selectedId} onExportCsv={exportLeadsCsv} />}",
]);

// --- step 5a: the five page bodies -> parts/PageTabs -------------------------
// Guarded per tab: if PageTabs is missing even one field label the inline body
// binds, that body is LEFT ALONE. A longer shell is better than a field the
// admin can no longer edit, and tsc cannot catch that.
const pageSwaps = [
  { tab: 'optin', comp: 'OptinTab', prop: 'optin', state: 'optin', setter: 'setOptinField' },
  { tab: 'vsl', comp: 'VslTab', prop: 'vsl', state: 'vsl', setter: 'setVslField' },
  { tab: 'checkout', comp: 'CheckoutTab', prop: 'checkout', state: 'checkout', setter: 'setCheckoutField' },
  { tab: 'success', comp: 'SuccessTab', prop: 'success', state: 'successBlock', setter: 'setSuccessField' },
  { tab: 'access', comp: 'AccessTab', prop: 'access', state: 'access', setter: 'setAccessField' },
];
const usedComponents = [];
for (const p of pageSwaps) {
  const r = region(p.tab);
  const missing = labelsIn(r.body).filter((l) => !pageTabsSrc.includes(l));
  if (missing.length) {
    log.push(`  ${p.tab}: KEPT INLINE — PageTabs is missing ${missing.join(', ')}`);
    continue;
  }
  usedComponents.push(p.comp);
  swap(p.tab, [
    `        {tab === '${p.tab}' && <${p.comp} ${p.prop}={${p.state}} setField={${p.setter}} onRegenerate={() => onGeneratePage('${p.tab}')} busy={busy === 'generatePage'} />}`,
  ]);
}

// --- step 5b: drop 'links' from the Tab union -------------------------------
const tabTypeIdx = lines.findIndex((l) => l.startsWith('type Tab ='));
if (tabTypeIdx < 0) fail("could not find the 'type Tab =' declaration");
let tabTypeBlockEnd = tabTypeIdx;
while (tabTypeBlockEnd < lines.length && !lines[tabTypeBlockEnd].includes(';')) tabTypeBlockEnd++;
let tabType = lines.slice(tabTypeIdx, tabTypeBlockEnd + 1).join(eol);
if (!/'links'/.test(tabType)) fail("'links' not found in the Tab union");
tabType = tabType.replace(/\s*\|\s*'links'/, '').replace(/'links'\s*\|\s*/, '');
lines.splice(tabTypeIdx, tabTypeBlockEnd - tabTypeIdx + 1, ...tabType.split(eol));
log.push("  type Tab: dropped 'links'");

// --- step 5c: flat tab list -> groups + derived active group -----------------
const tabsDeclIdx = lines.findIndex((l) => /^\s*const tabs\b/.test(l));
if (tabsDeclIdx < 0) fail("could not find 'const tabs'");
let tabsEnd = tabsDeclIdx;
if (!/\]\s*;?\s*$/.test(lines[tabsDeclIdx])) {
  while (tabsEnd < lines.length && !/^\s*\]\s*;?\s*$/.test(lines[tabsEnd])) tabsEnd++;
  if (tabsEnd >= lines.length) fail("could not find the end of the 'const tabs' array");
}
const oldTabsDecl = lines.slice(tabsDeclIdx, tabsEnd + 1).join(eol);
if (!oldTabsDecl.includes("'build'")) fail("'const tabs' does not mention 'build' — wrong declaration matched");
lines.splice(tabsDeclIdx, tabsEnd - tabsDeclIdx + 1, ...[
  "  const PAGE_TABS: { id: Tab; label: string }[] = [",
  "    { id: 'optin', label: 'Opt-in' },",
  "    { id: 'sales', label: 'Sales' },",
  "    { id: 'vsl', label: 'VSL' },",
  "    { id: 'checkout', label: 'Checkout' },",
  "    { id: 'upsell1', label: 'Upsell 1' },",
  "    { id: 'upsell2', label: 'Upsell 2' },",
  "    { id: 'upsell3', label: 'Upsell 3' },",
  "    { id: 'upsell4', label: 'Upsell 4' },",
  "    { id: 'success', label: 'Success' },",
  "    { id: 'access', label: 'Access' },",
  '  ];',
  '  const GROUPS: { id: string; label: string; tabs: Tab[] }[] = [',
  "    { id: 'offer', label: 'Offer', tabs: ['build'] },",
  "    { id: 'pages', label: 'Pages', tabs: PAGE_TABS.map((t) => t.id) },",
  "    { id: 'chrome', label: 'Chrome', tabs: ['footer'] },",
  "    { id: 'leads', label: 'Leads', tabs: ['leads'] },",
  '  ];',
  '  // `tab` stays the source of truth; the group is derived from it so that',
  "  // handlers jumping straight to a page (onGenerate -> setTab('optin')) still",
  '  // light up the right group with no extra bookkeeping.',
  '  const activeGroup = GROUPS.find((g) => g.tabs.includes(tab)) ?? GROUPS[0];',
]);
log.push('  const tabs -> PAGE_TABS + GROUPS + activeGroup');

const barIdx = lines.findIndex((l) => l.includes('tabs.map((t) =>'));
if (barIdx < 0) fail('could not find the tab bar (tabs.map)');
if (!lines[barIdx - 1].includes('flex flex-wrap gap-1') || lines[barIdx + 1].trim() !== '</div>') {
  fail('the tab bar does not look like the expected 3-line div — refusing to guess');
}
lines.splice(barIdx - 1, 3, ...[
  '        <div className="flex flex-wrap gap-1 border-b border-bone/10 pb-2">',
  '          {GROUPS.map((g) => (',
  "            <button key={g.id} type=\"button\" onClick={() => setTab(g.tabs[0])} className={'rounded-lg px-3 py-1.5 text-sm transition-colors ' + (activeGroup.id === g.id ? 'bg-brass/[0.14] text-brass font-semibold border border-brass/30' : 'text-bone/55 hover:text-bone border border-transparent')}>{g.label}</button>",
  '          ))}',
  '        </div>',
  "        {activeGroup.id === 'pages' && (",
  '          <div className="flex flex-wrap gap-1">',
  '            {PAGE_TABS.map((t) => (',
  "              <button key={t.id} type=\"button\" onClick={() => setTab(t.id)} className={'rounded-md px-2.5 py-1 text-xs transition-colors ' + (tab === t.id ? 'bg-bone/10 text-bone font-semibold border border-bone/20' : 'text-bone/45 hover:text-bone/80 border border-transparent')}>{t.label}</button>",
  '            ))}',
  '          </div>',
  '        )}',
]);
log.push('  tab bar -> group bar + Pages sub-bar');

// --- imports ----------------------------------------------------------------
const anchor = lines.findIndex((l) => l.trim() === "import SalesTab from './parts/SalesTab';");
if (anchor < 0) fail('could not find the SalesTab import to anchor on');
const newImports = ["import OfferTab from './parts/OfferTab';", "import LeadsTab from './parts/LeadsTab';"];
if (usedComponents.length) newImports.push(`import { ${usedComponents.join(', ')} } from './parts/PageTabs';`);
lines.splice(anchor + 1, 0, ...newImports);
log.push('  imports: ' + newImports.length + ' added after the SalesTab import');

// --- post-conditions --------------------------------------------------------
const out = lines.join(eol);
if (/\btabs\.map\(/.test(out)) fail('a stale tabs.map() survived');
if (/\{tab === 'links'/.test(out)) fail("a stale {tab === 'links'} survived");
for (const open of out.match(/^import \{(?![^\n]*\})/gm) || []) void open;
const opens = (out.match(/^import \{(?![^\n]*\})/gm) || []).length;
const closes = (out.match(/^\} from '/gm) || []).length;
if (opens !== closes) fail(`multi-line import blocks unbalanced (${opens} opens vs ${closes} closes) — an import probably landed inside one`);

fs.writeFileSync(FILE, out, 'utf8');
console.log('Wired steps 3-5:');
log.forEach((l) => console.log(l));
console.log(`  SalesFunnelEditor.tsx: ${startCount} -> ${lines.length} lines`);
