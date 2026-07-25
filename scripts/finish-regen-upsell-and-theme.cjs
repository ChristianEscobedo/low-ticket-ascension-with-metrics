/**
 * 1) Recolor regen bars to the admin brass palette (mode/* is not in tailwind config here).
 * 2) Add regen bar to UpsellTab via optional onRegenerate prop + wire upsell1-4.
 */
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx');
let ed = fs.readFileSync(P, 'utf8');

// 1) recolor
ed = ed
  .split('border border-mode/20 bg-mode/[0.06]')
  .join('border border-brass/25 bg-brass/[0.05]')
  .split('rounded-lg border border-mode/40 bg-mode/15 px-3 py-1.5 text-[11px] font-semibold text-bone hover:bg-mode/25 disabled:opacity-50')
  .join('rounded-lg border border-brass/30 bg-brass/[0.14] px-3 py-1.5 text-[11px] font-semibold text-brass hover:bg-brass/20 disabled:opacity-40');

// 2) UpsellTab prop
if (!ed.includes('onRegenerate?:')) {
  ed = ed.replace(
    `function UpsellTab({ label, upsell, setField }: { label: string; upsell: UpsellContent; setField: <K extends keyof UpsellContent>(key: K, value: UpsellContent[K]) => void; }) {`,
    `function UpsellTab({ label, upsell, setField, onRegenerate, regenBusy }: { label: string; upsell: UpsellContent; setField: <K extends keyof UpsellContent>(key: K, value: UpsellContent[K]) => void; onRegenerate?: () => void; regenBusy?: boolean; }) {`,
  );
  ed = ed.replace(
    `      <div className="text-xs uppercase tracking-[0.2em] text-brass/80 font-semibold">{label}</div>`,
    `      <div className="text-xs uppercase tracking-[0.2em] text-brass/80 font-semibold">{label}</div>
      {onRegenerate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/25 bg-brass/[0.05] px-3 py-2">
          <p className="text-[11px] text-bone/60">Rewrite this upsell from the Build tab offer stack.</p>
          <button
            type="button"
            disabled={Boolean(regenBusy)}
            onClick={onRegenerate}
            className="rounded-lg border border-brass/30 bg-brass/[0.14] px-3 py-1.5 text-[11px] font-semibold text-brass hover:bg-brass/20 disabled:opacity-40"
          >
            {regenBusy ? 'Regenerating…' : 'Regenerate this page'}
          </button>
        </div>
      )}`,
  );
  console.log('UpsellTab prop + bar added');
}

// 3) wire upsell tabs
for (const n of [1, 2, 3, 4]) {
  const find = `{tab === 'upsell${n}' && <UpsellTab label="Upsell ${n}" upsell={upsell${n}} setField={setUpsell${n}Field} />}`;
  const repl = `{tab === 'upsell${n}' && <UpsellTab label="Upsell ${n}" upsell={upsell${n}} setField={setUpsell${n}Field} onRegenerate={() => onGeneratePage('upsell${n}')} regenBusy={busy === 'generatePage'} />}`;
  if (ed.includes(find)) {
    ed = ed.replace(find, repl);
    console.log('wired upsell', n);
  } else if (ed.includes(`onGeneratePage('upsell${n}')`)) {
    console.log('already wired upsell', n);
  } else {
    console.warn('WARN upsell wire miss', n);
  }
}

fs.writeFileSync(P, ed, 'utf8');
console.log('done', ed.length);
