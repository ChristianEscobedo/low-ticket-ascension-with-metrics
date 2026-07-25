const fs = require('fs');

// 1) admin route emailKits
{
  const p = 'src/app/api/admin/mothermode-sales/route.ts';
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('emailKits:')) {
    if (!s.includes('emailKitId: (body.emailKitId as string) || null,')) {
      console.error('admin route: emailKitId line missing');
      process.exit(1);
    }
    s = s.replace(
      'emailKitId: (body.emailKitId as string) || null,\n      productId: (body.productId as string) || null,',
      'emailKitId: (body.emailKitId as string) || null,\n      emailKits: Array.isArray(body.emailKits) ? (body.emailKits as any) : [],\n      productId: (body.productId as string) || null,',
    );
    fs.writeFileSync(p, s);
    console.log('admin emailKits OK');
  } else {
    console.log('admin emailKits already');
  }
}

// 2) editor multi-kit
{
  const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
  let s = fs.readFileSync(p, 'utf8');

  if (!s.includes('SALES_EMAIL_EVENTS')) {
    // try several import shapes
    const candidates = [
      [
        `  slugifySalesName,\n  type SalesFooterContent,`,
        `  slugifySalesName,\n  SALES_EMAIL_EVENTS,\n  SALES_EMAIL_EVENT_LABELS,\n  type SalesEmailEvent,\n  type SalesEmailKitBinding,\n  type SalesFooterContent,`,
      ],
      [
        `slugifySalesName,\n  type SalesFooterContent,`,
        `slugifySalesName,\n  SALES_EMAIL_EVENTS,\n  SALES_EMAIL_EVENT_LABELS,\n  type SalesEmailEvent,\n  type SalesEmailKitBinding,\n  type SalesFooterContent,`,
      ],
    ];
    let ok = false;
    for (const [a, b] of candidates) {
      if (s.includes(a)) {
        s = s.replace(a, b);
        ok = true;
        break;
      }
    }
    if (!ok) {
      // fallback: inject after first import from sales/types
      const m = s.match(/from ['"]@\/lib\/mothermode\/sales\/types['"];?/);
      if (m) {
        const idx = s.indexOf(m[0]);
        // find opening brace of that import
        const start = s.lastIndexOf('import', idx);
        const brace = s.indexOf('{', start);
        const close = s.indexOf('}', brace);
        if (brace > -1 && close > brace) {
          const inside = s.slice(brace + 1, close);
          if (!inside.includes('SALES_EMAIL_EVENTS')) {
            s =
              s.slice(0, close) +
              `\n  SALES_EMAIL_EVENTS,\n  SALES_EMAIL_EVENT_LABELS,\n  type SalesEmailEvent,\n  type SalesEmailKitBinding,` +
              s.slice(close);
            ok = true;
          }
        }
      }
    }
    if (!ok) {
      console.error('editor import patch failed');
      process.exit(1);
    }
    console.log('editor imports OK');
  }

  if (!s.includes('emailKitsMap')) {
    if (!s.includes("const [emailKitId, setEmailKitId] = useState('');")) {
      console.error('emailKitId state missing');
      process.exit(1);
    }
    s = s.replace(
      "const [emailKitId, setEmailKitId] = useState('');\n  const [productId, setProductId] = useState('');",
      "const [emailKitId, setEmailKitId] = useState('');\n  const [emailKitsMap, setEmailKitsMap] = useState<Partial<Record<SalesEmailEvent, string>>>({});\n  const [productId, setProductId] = useState('');",
    );
    console.log('editor state OK');
  }

  if (!s.includes('function bindingsFromMap')) {
    if (!s.includes('function resetToNew()')) {
      console.error('resetToNew missing');
      process.exit(1);
    }
    s = s.replace(
      'function resetToNew() {',
      `function bindingsFromMap(map: Partial<Record<SalesEmailEvent, string>>): SalesEmailKitBinding[] {
    return SALES_EMAIL_EVENTS
      .map((event) => ({ event, emailKitId: (map[event] || '').trim() }))
      .filter((b) => Boolean(b.emailKitId));
  }

  function mapFromBindings(bindings: SalesEmailKitBinding[] | undefined | null, fallbackOptinId?: string | null): Partial<Record<SalesEmailEvent, string>> {
    const map: Partial<Record<SalesEmailEvent, string>> = {};
    for (const b of bindings || []) {
      if (b?.event && b?.emailKitId) map[b.event] = b.emailKitId;
    }
    if (!map.optin && fallbackOptinId) map.optin = fallbackOptinId;
    return map;
  }

  function setKitForEvent(event: SalesEmailEvent, kitId: string) {
    setEmailKitsMap((prev) => {
      const next = { ...prev };
      if (!kitId) delete next[event];
      else next[event] = kitId;
      return next;
    });
    if (event === 'optin') setEmailKitId(kitId);
  }

  function resetToNew() {`,
    );
    console.log('editor helpers OK');
  }

  if (!s.includes("setEmailKitsMap({})")) {
    s = s.replace(
      "setEmailKitId(''); setProductId('');",
      "setEmailKitId(''); setEmailKitsMap({}); setProductId('');",
    );
  }

  if (!s.includes('mapFromBindings(f.emailKits')) {
    s = s.replace(
      "setEmailKitId(f.emailKitId ?? ''); setProductId(f.productId ?? '');",
      "setEmailKitId(f.emailKitId ?? ''); setEmailKitsMap(mapFromBindings(f.emailKits, f.emailKitId)); setProductId(f.productId ?? '');",
    );
  }

  if (!s.includes('emailKits: bindingsFromMap')) {
    // tolerate spacing
    if (s.includes('emailKitId: emailKitId || null, productId: productId || null,')) {
      s = s.replace(
        'emailKitId: emailKitId || null, productId: productId || null,',
        'emailKitId: emailKitId || emailKitsMap.optin || null, emailKits: bindingsFromMap(emailKitsMap), productId: productId || null,',
      );
    } else if (s.includes('emailKitId: emailKitId || null,')) {
      s = s.replace(
        'emailKitId: emailKitId || null,',
        'emailKitId: emailKitId || emailKitsMap.optin || null, emailKits: bindingsFromMap(emailKitsMap),',
      );
    } else {
      console.error('onSave emailKitId not found');
      process.exit(1);
    }
    console.log('editor save OK');
  }

  if (!s.includes('setEmailKitsMap(mapFromBindings(item.emailKits')) {
    s = s.replace(
      "setSelectedId(item.id); setSlug(item.slug); setEmailKitId(item.emailKitId ?? '');",
      "setSelectedId(item.id); setSlug(item.slug); setEmailKitId(item.emailKitId ?? ''); setEmailKitsMap(mapFromBindings(item.emailKits, item.emailKitId));",
    );
  }

  // checklist
  if (s.includes("{ ok: Boolean(emailKitId), label: 'Email kit linked (optional but recommended)' }")) {
    s = s.replace(
      "{ ok: Boolean(emailKitId), label: 'Email kit linked (optional but recommended)' },",
      "{ ok: Boolean(emailKitId || emailKitsMap.optin || Object.keys(emailKitsMap).length), label: 'Email kit linked (optional but recommended)' },",
    );
  }
  if (s.includes('footer.disclaimer, emailKitId]);') && !s.includes('emailKitsMap]);')) {
    s = s.replace('footer.disclaimer, emailKitId]);', 'footer.disclaimer, emailKitId, emailKitsMap]);');
  }

  if (!s.includes('Email kits by funnel event')) {
    const marker = 'Email kit on optin';
    const idx = s.indexOf(marker);
    if (idx < 0) {
      console.error('email kit UI marker missing');
      process.exit(1);
    }
    // find starting <div before marker
    const start = s.lastIndexOf('<div', idx);
    // find matching close for that div — simple: first </div> after select end
    // better: find from start to the </div> that closes the select wrapper
    let end = s.indexOf('</select>', idx);
    if (end < 0) {
      console.error('select end missing');
      process.exit(1);
    }
    end = s.indexOf('</div>', end);
    if (end < 0) {
      console.error('div end missing');
      process.exit(1);
    }
    end = end + '</div>'.length;

    const multiUi = `<div className="sm:col-span-2">
              <label className={labelClass}>Email kits by funnel event</label>
              <p className="mb-2 text-xs text-bone/40">Bind a different Email Marketing kit to each step. Opt-in still mirrors the legacy single kit field.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SALES_EMAIL_EVENTS.map((event) => (
                  <div key={event} className="rounded-lg border border-bone/10 bg-ink/30 p-2">
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-bone/45">{SALES_EMAIL_EVENT_LABELS[event]}</label>
                    <select
                      className={inputClass}
                      value={emailKitsMap[event] || (event === 'optin' ? emailKitId : '') || ''}
                      onChange={(e) => setKitForEvent(event, e.target.value)}
                    >
                      <option value="">None — no auto-enroll</option>
                      {emailKits.map((k) => (
                        <option key={k.id} value={k.id}>{k.name} ({k.status})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>`;

    s = s.slice(0, start) + multiUi + s.slice(end);
    console.log('editor multi UI OK');
  } else {
    console.log('editor multi UI already');
  }

  fs.writeFileSync(p, s);
}

// 3) store imports for SalesEmailKitBinding if needed
{
  const p = 'src/lib/mothermode/sales/store.ts';
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('SalesEmailKitBinding') && !/import\s*\{[^}]*SalesEmailKitBinding/.test(s)) {
    // add to existing types import
    const re = /import\s*\{([^}]+)\}\s*from\s*'\.\/types';/;
    const m = s.match(re);
    if (m) {
      if (!m[1].includes('SalesEmailKitBinding')) {
        s = s.replace(re, (full, inside) => {
          const add = inside.trim().endsWith(',')
            ? inside + '\n  SalesEmailKitBinding,\n  SalesEmailEvent,'
            : inside + ',\n  SalesEmailKitBinding,\n  SalesEmailEvent';
          return `import {${add}} from './types';`;
        });
        fs.writeFileSync(p, s);
        console.log('store type imports OK');
      }
    }
  }

  // enroll event param
  if (s.includes('export async function enrollLeadInEmailKit') && !s.includes('event?:')) {
    s = fs.readFileSync(p, 'utf8');
    s = s.replace(
      /export async function enrollLeadInEmailKit\(input: \{[\s\S]*?\}\)/,
      (m) => {
        if (m.includes('event?:')) return m;
        if (m.includes('funnelSlug: string;')) {
          return m.replace('funnelSlug: string;', 'funnelSlug: string;\n  event?: string;');
        }
        return m.replace('})', '  event?: string;\n})');
      },
    );
    fs.writeFileSync(p, s);
    console.log('enroll event OK');
  }
}

// 4) sanity checks
const checks = {
  admin: fs.readFileSync('src/app/api/admin/mothermode-sales/route.ts', 'utf8').includes('emailKits:'),
  events: fs.readFileSync('src/lib/mothermode/sales/types.ts', 'utf8').includes('SALES_EMAIL_EVENTS'),
  getLead: fs.readFileSync('src/lib/mothermode/sales/store.ts', 'utf8').includes('getLeadById'),
  upsell: fs.readFileSync('src/components/mothermode/sales/UpsellPage.tsx', 'utf8').includes('MotherModeUpsellPage'),
  capture: fs.readFileSync('src/app/api/funnel/capture/route.ts', 'utf8').includes('resolveEmailKitIdForEvent'),
  editor: fs.readFileSync('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', 'utf8').includes('Email kits by funnel event'),
  map: fs.readFileSync('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', 'utf8').includes('emailKitsMap'),
};
console.log('CHECKS', checks);
for (const [k, v] of Object.entries(checks)) {
  if (!v) {
    console.error('FAIL', k);
    process.exit(1);
  }
}
console.log('ALL RESIDUAL OK');
