/**
 * Wires ArchitectureTab into the sales funnel editor.
 *
 * The ascension validator existed as a pure module with tests and no caller.
 * This adds the one thing that was missing: a surface that runs it against the
 * intake the operator is actually editing. It sits under the Offer group,
 * beside Build, because it reads the offer and changes nothing.
 */
const fs = require('fs');

const FILE = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
let src = fs.readFileSync(FILE, 'utf8');
const before = src;
const applied = [];
const skipped = [];

function sub(name, find, replace) {
  if (src.includes(replace)) {
    skipped.push(name + ' (already applied)');
    return;
  }
  if (!src.includes(find)) {
    skipped.push(name + ' (anchor not found)');
    return;
  }
  src = src.replace(find, replace);
  applied.push(name);
}

// 1. The tab id.
sub(
  'Tab union',
  "| 'emails' | 'emailStats';",
  "| 'emails' | 'emailStats' | 'architecture';",
);

// 2. The import, next to the other tab parts.
sub(
  'import',
  "import OfferTab from './parts/OfferTab';",
  "import OfferTab from './parts/OfferTab';\nimport ArchitectureTab from './parts/ArchitectureTab';",
);

// 3. The sub-nav for the Offer group, mirroring PAGE_TABS/EMAIL_TABS.
sub(
  'OFFER_TABS',
  "  const EMAIL_TABS: { id: Tab; label: string }[] = [",
  "  const OFFER_TABS: { id: Tab; label: string }[] = [\n" +
    "    { id: 'build', label: 'Build' },\n" +
    "    { id: 'architecture', label: 'Architecture' },\n" +
    "  ];\n" +
    "  const EMAIL_TABS: { id: Tab; label: string }[] = [",
);

// 4. The Offer group now owns two tabs, so it needs the derived list.
sub(
  'GROUPS offer',
  "{ id: 'offer', label: 'Offer', tabs: ['build'] },",
  "{ id: 'offer', label: 'Offer', tabs: OFFER_TABS.map((t) => t.id) },",
);

// 5. The sub-nav row, rendered on the same terms as the Pages row.
sub(
  'offer subnav',
  "        {activeGroup.id === 'pages' && (",
  "        {activeGroup.id === 'offer' && (\n" +
    "          <div className=\"flex flex-wrap gap-1\">\n" +
    "            {OFFER_TABS.map((t) => (\n" +
    "              <button key={t.id} type=\"button\" onClick={() => setTab(t.id)} className={'rounded-md px-2.5 py-1 text-xs transition-colors ' + (tab === t.id ? 'bg-bone/10 text-bone font-semibold border border-bone/20' : 'text-bone/45 hover:text-bone/80 border border-transparent')}>{t.label}</button>\n" +
    "            ))}\n" +
    "          </div>\n" +
    "        )}\n" +
    "        {activeGroup.id === 'pages' && (",
);

// 6. The panel itself. Read-only, so it takes the intake and nothing else.
sub(
  'render',
  "        {tab === 'optin' && <OptinTab",
  "        {tab === 'architecture' && <ArchitectureTab intake={intake} />}\n" +
    "        {tab === 'optin' && <OptinTab",
);

if (src !== before) fs.writeFileSync(FILE, src);

console.log('applied: ' + (applied.join(', ') || 'none'));
console.log('skipped: ' + (skipped.join(', ') || 'none'));
