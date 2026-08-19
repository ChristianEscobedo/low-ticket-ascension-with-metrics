// Wire the per-funnel test-mode toggle into the SalesFunnelEditor: the save
// payload carries testMode, loadFunnel/resetToNew set it, and a "Test mode"
// checkbox renders next to the Status field.
const fs = require('fs');
const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
let s = fs.readFileSync(p, 'utf8');
const before = s;

// 1. The save payload carries the testMode.
s = s.replace('access, footer }) });', 'access, footer, testMode }) });');

// 2. loadFunnel sets it from the record.
s = s.replace(
  'setSelectedId(f.id); setName(f.name); setSlug(f.slug); setStatus(f.status);',
  'setSelectedId(f.id); setName(f.name); setSlug(f.slug); setStatus(f.status);\n    setTestMode(f.testMode === true);'
);

// 3. resetToNew clears it.
s = s.replace(
  "setSelectedId(null); setName(''); setSlug(''); setStatus('draft');",
  "setSelectedId(null); setName(''); setSlug(''); setStatus('draft');\n    setTestMode(false);"
);

// 4. The toggle UI, next to the Status field.
const statusField = '<div className="min-w-0"><label className={labelClass}>Status</label><select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as SalesFunnelStatus)}>{SALES_FUNNEL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>';
const toggle = statusField + '\n            <label className="flex min-w-0 items-center gap-2 self-end pb-2 text-xs text-bone/70" title="Charge this funnel with the Stripe TEST keys (the 4242 card), not the live ones. Save to persist."><input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} className="h-3.5 w-3.5 accent-brass" />Test mode <span className="text-bone/40">(Stripe test keys)</span></label>';
s = s.replace(statusField, toggle);

if (s === before) {
  console.error('NO CHANGE — an anchor missed');
  process.exit(1);
}
fs.writeFileSync(p, s);
console.log('wired: save payload + loadFunnel + resetToNew + the toggle UI');
