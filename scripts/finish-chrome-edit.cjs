/**
 * Finish chrome editability gaps left by apply-chrome-edit.cjs
 */
const fs = require('fs');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function write(p, t) {
  fs.writeFileSync(p, t);
  console.log('W', p, 'len', t.length);
}
function has(t, s) {
  return t.includes(s);
}
function tryReplace(t, needle, repl, label) {
  if (t.includes(repl) || (repl.length > 60 && t.includes(repl.slice(0, 50)))) {
    // already applied if unique enough
  }
  if (t.includes(needle)) {
    console.log('OK', label);
    return t.replace(needle, repl);
  }
  const n2 = needle.replace(/\n/g, '\r\n');
  const r2 = repl.replace(/\n/g, '\r\n');
  if (t.includes(n2)) {
    console.log('OK-crlf', label);
    return t.replace(n2, r2);
  }
  console.error('MISS', label);
  console.error(' needle head:', JSON.stringify(needle.slice(0, 100)));
  return null;
}

// ---------------------------------------------------------------------------
// types.ts — interface + normalize
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/types.ts';
  let t = read(p);

  // Interface: only if CheckoutContent block lacks timerLabel
  const ifaceStart = t.indexOf('export interface CheckoutContent');
  const ifaceEnd = t.indexOf('export interface UpsellFeatureContent');
  const iface = t.slice(ifaceStart, ifaceEnd);
  console.log('iface has timerLabel?', iface.includes('timerLabel'));

  if (!iface.includes('timerLabel')) {
    // Match end of CheckoutContent precisely from live file
    const needle = `  paymentType: string;
  trialDays: number;
}

/** One feature row in an upsell value stack (JSON-safe; icons reattached at render). */
export interface UpsellFeatureContent {`;
    const repl = `  paymentType: string;
  trialDays: number;
  /** Top urgency timer bar label (before the countdown). */
  timerLabel: string;
  /** Header brand wordmark text on the checkout page. */
  brandLabel: string;
}

/** One feature row in an upsell value stack (JSON-safe; icons reattached at render). */
export interface UpsellFeatureContent {`;
    const next = tryReplace(t, needle, repl, 'CheckoutContent fields');
    if (next) t = next;
    else process.exitCode = 1;
  } else {
    console.log('skip iface');
  }

  // normalizeCheckout
  const normStart = t.indexOf('function normalizeCheckout');
  const normEnd = t.indexOf('export function normalizeUpsell');
  const norm = t.slice(normStart, normEnd);
  console.log('norm has timerLabel?', norm.includes('timerLabel'));

  if (!norm.includes('timerLabel')) {
    // Get exact trailing lines from live normalize
    const m = norm.match(/paymentType: asString\([^)]+\),\s*\r?\n\s*trialDays: asNumber\([^)]+\),\s*\r?\n\s*\};/);
    if (!m) {
      console.error('normalize trail regex miss');
      console.log(JSON.stringify(norm.slice(-250)));
      process.exitCode = 1;
    } else {
      const old = m[0];
      const nl = old.includes('\r\n') ? '\r\n' : '\n';
      const newTrail =
        `paymentType: asString(o.paymentType, 'one_time'),${nl}` +
        `    trialDays: asNumber(o.trialDays, 0),${nl}` +
        `    timerLabel: asString(o.timerLabel, 'Founding price held for:'),${nl}` +
        `    brandLabel: asString(o.brandLabel, 'MOTHERMODE'),${nl}` +
        `  };`;
      t = t.replace(old, newTrail);
      console.log('OK normalizeCheckout');
    }
  } else {
    console.log('skip normalize');
  }

  write(p, t);
}

// ---------------------------------------------------------------------------
// MotherModeCheckout — verify + dump if incomplete
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/checkout/MotherModeCheckout.tsx';
  let t = read(p);
  console.log('checkout MmEditable', t.includes('MmEditable'));
  console.log('checkout timerLabel prop', t.includes('timerLabel'));
  console.log('checkout field timer', t.includes('field="timerLabel"') || t.includes("field='timerLabel'"));

  if (!t.includes('MmEditable')) {
    if (t.includes("from './OrderSummary'")) {
      t = t.replace(
        "import { OrderSummary } from './OrderSummary';",
        "import { OrderSummary } from './OrderSummary';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
      );
    } else {
      console.error('OrderSummary import miss');
      process.exitCode = 1;
    }
  }

  if (!t.includes('timerLabel?: string')) {
    // dump props interface
    const i = t.indexOf('MotherModeCheckoutProps');
    console.log('props snip', JSON.stringify(t.slice(i, i + 600)));
    // try flexible insert before closing of props
    const m = t.match(/backLabel\?: string;\s*\r?\n\}/);
    if (m) {
      const nl = m[0].includes('\r\n') ? '\r\n' : '\n';
      t = t.replace(
        m[0],
        `backLabel?: string;${nl}` +
          `  /** Top timer bar label. Editable via checkout.timerLabel. */${nl}` +
          `  timerLabel?: string;${nl}` +
          `  /** Header brand text. Editable via checkout.brandLabel. */${nl}` +
          `  brandLabel?: string;${nl}` +
          `}`,
      );
      console.log('OK props iface');
    } else {
      console.error('props iface miss');
      process.exitCode = 1;
    }
  }

  if (!t.includes("timerLabel = 'Founding price held for:'") && !t.includes('timerLabel = "Founding price held for:"')) {
    const m = t.match(
      /export const MotherModeCheckout: React\.FC<MotherModeCheckoutProps> = \(\{[\s\S]*?backLabel,?\s*\r?\n\}\) => \{/,
    );
    if (m) {
      const old = m[0];
      const nl = old.includes('\r\n') ? '\r\n' : '\n';
      // rebuild with chrome props
      const next = old.replace(
        /backLabel,?\s*\r?\n\}\) => \{/,
        `backLabel,${nl}  timerLabel = 'Founding price held for:',${nl}  brandLabel = 'MOTHERMODE',${nl}}) => {`,
      );
      t = t.replace(old, next);
      console.log('OK props destructure');
    } else {
      console.error('destructure miss');
      const i = t.indexOf('MotherModeCheckout: React');
      console.log(JSON.stringify(t.slice(i, i + 400)));
      process.exitCode = 1;
    }
  }

  if (!t.includes('field="timerLabel"') && !t.includes("field='timerLabel'")) {
    // Replace hardcoded timer + brand spans
    // Pattern A: Founding price held for
    if (t.includes('Founding price held for:')) {
      // Replace the span wrapping the hardcoded label
      const patterns = [
        // multi-line span
        [
          /<span className="font-semibold tracking-wide">\s*Founding price held for:\s*<\/span>/,
          `<MmEditable
            field="timerLabel"
            as="span"
            onDark
            value={timerLabel}
            className="font-semibold tracking-wide px-1"
          >
            {timerLabel}
          </MmEditable>`,
        ],
        [
          /<span className="font-semibold tracking-wide">Founding price held for:<\/span>/,
          `<MmEditable field="timerLabel" as="span" onDark value={timerLabel} className="font-semibold tracking-wide px-1">{timerLabel}</MmEditable>`,
        ],
      ];
      let hit = false;
      for (const [re, rep] of patterns) {
        if (re.test(t)) {
          t = t.replace(re, rep);
          hit = true;
          console.log('OK timer span');
          break;
        }
      }
      if (!hit) {
        console.error('timer span pattern miss');
        const i = t.indexOf('Founding price');
        console.log(JSON.stringify(t.slice(i - 100, i + 200)));
        process.exitCode = 1;
      }
    }

    // brand MOTHERMODE header
    if (t.includes('MOTHERMODE') && !t.includes('field="brandLabel"')) {
      const patterns = [
        [
          /<span className="font-display text-lg tracking-\[0\.2em\] text-mode">\s*MOTHERMODE\s*<\/span>/,
          `<MmEditable
          field="brandLabel"
          as="span"
          value={brandLabel}
          className="font-display text-lg tracking-[0.2em] text-mode px-1"
        >
          {brandLabel}
        </MmEditable>`,
        ],
        [
          /<span className="font-display text-lg tracking-\[0\.2em\] text-mode">MOTHERMODE<\/span>/,
          `<MmEditable field="brandLabel" as="span" value={brandLabel} className="font-display text-lg tracking-[0.2em] text-mode px-1">{brandLabel}</MmEditable>`,
        ],
      ];
      let hit = false;
      for (const [re, rep] of patterns) {
        if (re.test(t)) {
          t = t.replace(re, rep);
          hit = true;
          console.log('OK brand span');
          break;
        }
      }
      if (!hit) {
        console.error('brand span miss');
        const i = t.indexOf('MOTHERMODE');
        console.log(JSON.stringify(t.slice(i - 120, i + 80)));
        process.exitCode = 1;
      }
    }
  }

  write(p, t);
}

// ---------------------------------------------------------------------------
// CheckoutPage
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/CheckoutPage.tsx';
  let t = read(p);
  console.log('cp timer prop', t.includes('timerLabel={c.timerLabel'));
  console.log('cp field timer', t.includes('field="timerLabel"'));

  if (!t.includes('timerLabel={c.timerLabel')) {
    const m = t.match(
      /<MotherModeCheckout\s+offer=\{offer\}[\s\S]*?backLabel=\{backLabel\}\s*\/>/,
    );
    if (m) {
      const old = m[0];
      const nl = old.includes('\r\n') ? '\r\n' : '\n';
      // insert before closing
      const next = old.replace(
        /backLabel=\{backLabel\}\s*\/>/,
        `backLabel={backLabel}${nl}          timerLabel={c.timerLabel || 'Founding price held for:'}${nl}          brandLabel={c.brandLabel || 'MOTHERMODE'}${nl}        />`,
      );
      t = t.replace(old, next);
      console.log('OK CheckoutPage props');
    } else {
      console.error('CheckoutPage MotherModeCheckout miss');
      const i = t.indexOf('MotherModeCheckout');
      console.log(JSON.stringify(t.slice(i, i + 400)));
      process.exitCode = 1;
    }
  }

  if (!t.includes('field="timerLabel"')) {
    // insert before eyebrow field in sheet
    const m = t.match(
      /<Field\s+edit=\{edit\}\s+field="eyebrow"\s+label="Eyebrow"\s+value=\{c\.eyebrow\}\s*\/>/,
    );
    if (m) {
      const old = m[0];
      const nl = old.includes('\r\n') ? '\r\n' : '\n';
      // detect indent from old
      const indent = (old.match(/^(\s*)/) || ['', '                      '])[1];
      const block =
        `${indent}<Field${nl}` +
        `${indent}  edit={edit}${nl}` +
        `${indent}  field="timerLabel"${nl}` +
        `${indent}  label="Timer label"${nl}` +
        `${indent}  value={c.timerLabel}${nl}` +
        `${indent}/>${nl}` +
        `${indent}<Field${nl}` +
        `${indent}  edit={edit}${nl}` +
        `${indent}  field="brandLabel"${nl}` +
        `${indent}  label="Header brand"${nl}` +
        `${indent}  value={c.brandLabel}${nl}` +
        `${indent}/>${nl}` +
        old;
      t = t.replace(old, block);
      console.log('OK CheckoutPage sheet');
    } else {
      // looser
      const i = t.indexOf('field="eyebrow"');
      console.log('eyebrow context', JSON.stringify(t.slice(i - 80, i + 200)));
      process.exitCode = 1;
    }
  }

  write(p, t);
}

// ---------------------------------------------------------------------------
// HeroSection
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/HeroSection.tsx';
  let t = read(p);
  console.log('hero OptinWordmark import', t.includes("optin/Wordmark"));
  console.log('hero local Wordmark', t.includes('const Wordmark'));
  console.log('hero <OptinWordmark', t.includes('<OptinWordmark'));
  console.log('hero <Wordmark', t.includes('<Wordmark'));

  if (!t.includes("from '@/components/mothermode/optin/Wordmark'")) {
    if (t.includes("import { Sidebar } from './Sidebar';")) {
      t = t.replace(
        "import { Sidebar } from './Sidebar';",
        "import { Sidebar } from './Sidebar';\nimport { OptinWordmark } from '@/components/mothermode/optin/Wordmark';",
      );
    }
  }

  if (t.includes('const Wordmark')) {
    // remove local component with regex
    const re =
      /\/\*\* The MotherMode wordmark:[\s\S]*?const Wordmark: React\.FC = \(\) => \([\s\S]*?\);\s*\r?\n\r?\n/;
    if (re.test(t)) {
      t = t.replace(re, '');
      console.log('OK removed local Wordmark');
    } else {
      console.error('local Wordmark regex miss');
      const i = t.indexOf('const Wordmark');
      console.log(JSON.stringify(t.slice(i - 80, i + 500)));
      process.exitCode = 1;
    }
  }

  if (t.includes('<Wordmark />')) {
    t = t.replace(/<Wordmark \/>/g, '<OptinWordmark />');
    console.log('OK usage swap');
  }

  write(p, t);
}

// ---------------------------------------------------------------------------
// Wordmark — ensure client + edit
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/optin/Wordmark.tsx';
  const t = read(p);
  console.log('wm use client', t.includes('use client'));
  console.log('wm useSalesPageEdit', t.includes('useSalesPageEdit'));
  console.log('wm footer.brandLine', t.includes('footer.brandLine'));
  if (!t.includes('useSalesPageEdit')) {
    console.error('Wordmark not patched');
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Admin editor — add timer/brand fields near checkout.ctaText
// ---------------------------------------------------------------------------
{
  const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
  let t = read(p);
  console.log('admin timerLabel', t.includes('timerLabel'));
  console.log('admin brandLabel', t.includes('brandLabel'));

  if (!t.includes("setCheckoutField('timerLabel'") && !t.includes('setCheckoutField("timerLabel"')) {
    const anchor =
      `<Field label="CTA text" value={checkout.ctaText} onChange={(v) => setCheckoutField('ctaText', v)} />`;
    const insert =
      `<Field label="Timer label" value={checkout.timerLabel || ''} onChange={(v) => setCheckoutField('timerLabel', v)} />\n` +
      `            <Field label="Header brand" value={checkout.brandLabel || ''} onChange={(v) => setCheckoutField('brandLabel', v)} />\n` +
      `            <Field label="CTA text" value={checkout.ctaText} onChange={(v) => setCheckoutField('ctaText', v)} />`;

    if (t.includes(anchor)) {
      t = t.replace(anchor, insert);
      console.log('OK admin fields LF');
    } else {
      const a2 = anchor.replace(/\n/g, '\r\n');
      const i2 = insert.replace(/\n/g, '\r\n');
      if (t.includes(a2)) {
        t = t.replace(a2, i2);
        console.log('OK admin fields CRLF');
      } else {
        // try find any CTA text field
        const i = t.indexOf("setCheckoutField('ctaText'");
        console.error('admin CTA anchor miss at', i);
        console.log(JSON.stringify(t.slice(i - 100, i + 120)));
        process.exitCode = 1;
      }
    }
  } else {
    console.log('skip admin fields');
  }

  write(p, t);
}

// ---------------------------------------------------------------------------
// Final verification dump
// ---------------------------------------------------------------------------
console.log('\n=== VERIFY ===');
const checks = [
  ['types iface', 'src/lib/mothermode/sales/types.ts', 'timerLabel: string'],
  ['types norm', 'src/lib/mothermode/sales/types.ts', "timerLabel: asString(o.timerLabel"],
  ['defaults', 'src/lib/mothermode/sales/defaults.ts', "timerLabel: 'Founding price held for:'"],
  ['co MmEditable', 'src/components/mothermode/checkout/MotherModeCheckout.tsx', 'MmEditable'],
  ['co field', 'src/components/mothermode/checkout/MotherModeCheckout.tsx', 'field="timerLabel"'],
  ['cp prop', 'src/components/mothermode/sales/CheckoutPage.tsx', 'timerLabel={c.timerLabel'],
  ['wm edit', 'src/components/mothermode/optin/Wordmark.tsx', 'footer.brandLine'],
  ['hero shared', 'src/components/mothermode/parts/HeroSection.tsx', 'OptinWordmark'],
  ['hero no local', 'src/components/mothermode/parts/HeroSection.tsx', 'const Wordmark', true],
  ['admin', 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx', "setCheckoutField('timerLabel'"],
];
let fail = 0;
for (const row of checks) {
  const [label, path, needle, invert] = row;
  const t = read(path);
  const ok = invert ? !t.includes(needle) : t.includes(needle);
  console.log(ok ? 'PASS' : 'FAIL', label);
  if (!ok) fail++;
}
if (fail) {
  console.error(fail, 'failures');
  process.exitCode = 1;
} else {
  console.log('ALL PASS');
}
