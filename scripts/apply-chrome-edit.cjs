/**
 * Apply sales-funnel chrome editability (idempotent):
 * - CheckoutContent.timerLabel + brandLabel (types, defaults, normalize)
 * - MotherModeCheckout MmEditable chrome
 * - CheckoutPage prop pass + field sheet rows
 * - OptinWordmark hover-edit via footer.brandLine
 * - HeroSection uses shared OptinWordmark
 * - Admin checkout tab timer/brand inputs
 */
const fs = require('fs');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function write(p, t) {
  fs.writeFileSync(p, t);
  console.log('W', p);
}
function once(t, needle, insert, label) {
  if (t.includes(insert.trim().slice(0, 40)) && insert.length > 20) {
    // loose already-present check handled by callers
  }
  if (!t.includes(needle)) {
    console.error('MISS', label, JSON.stringify(needle).slice(0, 120));
    process.exitCode = 1;
    return null;
  }
  return t.replace(needle, insert);
}

// ---------------------------------------------------------------------------
// 1) types — CheckoutContent
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/types.ts';
  let t = read(p);
  if (!t.includes('timerLabel: string')) {
    const needle = `  paymentType: string;
  trialDays: number;
}

/** One feature row in an upsell value stack`;
    const repl = `  paymentType: string;
  trialDays: number;
  /** Top urgency timer bar label (before the countdown). */
  timerLabel: string;
  /** Header brand wordmark text on the checkout page. */
  brandLabel: string;
}

/** One feature row in an upsell value stack`;
    if (!t.includes(needle)) {
      // try CRLF
      const n2 = needle.replace(/\n/g, '\r\n');
      const r2 = repl.replace(/\n/g, '\r\n');
      if (t.includes(n2)) {
        t = t.replace(n2, r2);
      } else {
        console.error('types CheckoutContent miss');
        process.exitCode = 1;
      }
    } else {
      t = t.replace(needle, repl);
    }
  } else {
    console.log('skip types timerLabel');
  }

  // normalizeCheckout
  if (!t.includes("timerLabel: asString(o.timerLabel")) {
    const needle = `    paymentType: asString(o.paymentType, 'one_time'),
    trialDays: asNumber(o.trialDays, 0),
  };
}

export function normalizeUpsell`;
    const repl = `    paymentType: asString(o.paymentType, 'one_time'),
    trialDays: asNumber(o.trialDays, 0),
    timerLabel: asString(o.timerLabel, 'Founding price held for:'),
    brandLabel: asString(o.brandLabel, 'MOTHERMODE'),
  };
}

export function normalizeUpsell`;
    if (!t.includes(needle)) {
      const n2 = needle.replace(/\n/g, '\r\n');
      const r2 = repl.replace(/\n/g, '\r\n');
      if (t.includes(n2)) t = t.replace(n2, r2);
      else {
        console.error('normalizeCheckout miss');
        process.exitCode = 1;
      }
    } else {
      t = t.replace(needle, repl);
    }
  } else {
    console.log('skip normalizeCheckout chrome');
  }
  write(p, t);
}

// ---------------------------------------------------------------------------
// 2) defaults checkout
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/defaults.ts';
  let t = read(p);
  if (!t.includes("timerLabel: 'Founding price held for:'")) {
    const needle = `    paymentType: 'one_time',
    trialDays: 0,
  };
}`;
    const repl = `    paymentType: 'one_time',
    trialDays: 0,
    timerLabel: 'Founding price held for:',
    brandLabel: 'MOTHERMODE',
  };
}`;
    if (!t.includes(needle)) {
      const n2 = needle.replace(/\n/g, '\r\n');
      const r2 = repl.replace(/\n/g, '\r\n');
      if (t.includes(n2)) t = t.replace(n2, r2);
      else {
        console.error('defaults checkout miss');
        process.exitCode = 1;
      }
    } else {
      t = t.replace(needle, repl);
    }
  } else {
    console.log('skip defaults timerLabel');
  }
  write(p, t);
}

// ---------------------------------------------------------------------------
// 3) MotherModeCheckout
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/checkout/MotherModeCheckout.tsx';
  let t = read(p);

  if (!t.includes('SalesPageEditContext')) {
    t = t.replace(
      "import { OrderSummary } from './OrderSummary';",
      "import { OrderSummary } from './OrderSummary';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }

  if (!t.includes('timerLabel?: string')) {
    const needle = `  /** Optional back-link label. */
  backLabel?: string;
}`;
    const repl = `  /** Optional back-link label. */
  backLabel?: string;
  /** Top timer bar label. Editable in funnel builder via checkout.timerLabel. */
  timerLabel?: string;
  /** Header brand text. Editable in funnel builder via checkout.brandLabel. */
  brandLabel?: string;
}`;
    if (!t.includes(needle)) {
      const n2 = needle.replace(/\n/g, '\r\n');
      const r2 = repl.replace(/\n/g, '\r\n');
      if (t.includes(n2)) t = t.replace(n2, r2);
      else {
        console.error('checkout iface miss');
        process.exitCode = 1;
      }
    } else {
      t = t.replace(needle, repl);
    }
  }

  if (!t.includes("timerLabel = 'Founding price held for:'")) {
    // Match both compact and spaced prop destructure
    const patterns = [
      [
        `export const MotherModeCheckout: React.FC<MotherModeCheckoutProps> = ({
  offer,
  affiliateRef,
  successPath,
  backHref,
  backLabel,
}) => {`,
        `export const MotherModeCheckout: React.FC<MotherModeCheckoutProps> = ({
  offer,
  affiliateRef,
  successPath,
  backHref,
  backLabel,
  timerLabel = 'Founding price held for:',
  brandLabel = 'MOTHERMODE',
}) => {`,
      ],
    ];
    let hit = false;
    for (const [a, b] of patterns) {
      if (t.includes(a)) {
        t = t.replace(a, b);
        hit = true;
        break;
      }
      const a2 = a.replace(/\n/g, '\r\n');
      const b2 = b.replace(/\n/g, '\r\n');
      if (t.includes(a2)) {
        t = t.replace(a2, b2);
        hit = true;
        break;
      }
    }
    if (!hit) {
      console.error('checkout props miss');
      process.exitCode = 1;
    }
  }

  if (!t.includes('field="timerLabel"')) {
    const oldHeader = `      <div className="bg-mode px-4 py-2.5 text-center text-bone">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 text-sm">
          <Timer className="h-4 w-4" />
          <span className="font-semibold tracking-wide">
            Founding price held for:
          </span>
          <span className="font-mono text-base tabular-nums text-brass">
            {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
          </span>
        </div>
      </div>

      <header className="border-b border-ink/10 bg-bone/80 py-5 text-center backdrop-blur">
        <span className="font-display text-lg tracking-[0.2em] text-mode">
          MOTHERMODE
        </span>
      </header>`;

    const newHeader = `      <div className="bg-mode px-4 py-2.5 text-center text-bone">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 text-sm">
          <Timer className="h-4 w-4" />
          <MmEditable
            field="timerLabel"
            as="span"
            onDark
            value={timerLabel}
            className="font-semibold tracking-wide px-1"
          >
            {timerLabel}
          </MmEditable>
          <span className="font-mono text-base tabular-nums text-brass">
            {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
          </span>
        </div>
      </div>

      <header className="border-b border-ink/10 bg-bone/80 py-5 text-center backdrop-blur">
        <MmEditable
          field="brandLabel"
          as="span"
          value={brandLabel}
          className="font-display text-lg tracking-[0.2em] text-mode px-1"
        >
          {brandLabel}
        </MmEditable>
      </header>`;

    if (t.includes(oldHeader)) {
      t = t.replace(oldHeader, newHeader);
    } else {
      const o2 = oldHeader.replace(/\n/g, '\r\n');
      const n2 = newHeader.replace(/\n/g, '\r\n');
      if (t.includes(o2)) t = t.replace(o2, n2);
      else {
        console.error('checkout header miss');
        const i = t.indexOf('Founding price held');
        console.log(JSON.stringify(t.slice(Math.max(0, i - 80), i + 500)));
        process.exitCode = 1;
      }
    }
  } else {
    console.log('skip checkout header');
  }

  write(p, t);
}

// ---------------------------------------------------------------------------
// 4) CheckoutPage props + field sheet
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/CheckoutPage.tsx';
  let t = read(p);

  if (!t.includes('timerLabel={c.timerLabel')) {
    const needle = `        <MotherModeCheckout
          offer={offer}
          successPath={successPath}
          backHref={backHref}
          backLabel={backLabel}
        />`;
    const repl = `        <MotherModeCheckout
          offer={offer}
          successPath={successPath}
          backHref={backHref}
          backLabel={backLabel}
          timerLabel={c.timerLabel || 'Founding price held for:'}
          brandLabel={c.brandLabel || 'MOTHERMODE'}
        />`;
    if (t.includes(needle)) t = t.replace(needle, repl);
    else {
      const n2 = needle.replace(/\n/g, '\r\n');
      const r2 = repl.replace(/\n/g, '\r\n');
      if (t.includes(n2)) t = t.replace(n2, r2);
      else {
        console.error('CheckoutPage props miss');
        process.exitCode = 1;
      }
    }
  }

  if (!t.includes('field="timerLabel"')) {
    const needle = `                      <Field
                        edit={edit}
                        field="eyebrow"
                        label="Eyebrow"
                        value={c.eyebrow}
                      />`;
    const repl = `                      <Field
                        edit={edit}
                        field="timerLabel"
                        label="Timer label"
                        value={c.timerLabel}
                      />
                      <Field
                        edit={edit}
                        field="brandLabel"
                        label="Header brand"
                        value={c.brandLabel}
                      />
                      <Field
                        edit={edit}
                        field="eyebrow"
                        label="Eyebrow"
                        value={c.eyebrow}
                      />`;
    if (t.includes(needle)) t = t.replace(needle, repl);
    else {
      const n2 = needle.replace(/\n/g, '\r\n');
      const r2 = repl.replace(/\n/g, '\r\n');
      if (t.includes(n2)) t = t.replace(n2, r2);
      else {
        console.error('CheckoutPage sheet miss');
        process.exitCode = 1;
      }
    }
  }

  write(p, t);
}

// ---------------------------------------------------------------------------
// 5) OptinWordmark
// ---------------------------------------------------------------------------
{
  const content = `'use client';

import React from 'react';
import { useSalesPageEdit } from '@/components/mothermode/sales/SalesPageEditContext';

/**
 * Shared MotherMode wordmark used on optin / oto / thank-you / funnel pages.
 *
 * In funnel edit mode the brand name is hover-editable and saves to
 * \`footer.brandLine\` (shared chrome across the funnel). Catalog pages
 * render the static default with no edit chrome.
 */
export const OptinWordmark: React.FC<{
  /** Override brand text. Defaults to footer.brandLine or "MotherMode". */
  brandName?: string;
  className?: string;
}> = ({ brandName, className = '' }) => {
  const edit = useSalesPageEdit();
  const fromFooter =
    (edit?.draft as { footer?: { brandLine?: string } } | undefined)?.footer
      ?.brandLine || '';
  // Prefer a short brand — if footer brandLine is a long tagline, fall back.
  const resolved =
    brandName ||
    (fromFooter && fromFooter.length <= 24 ? fromFooter : '') ||
    'MotherMode';

  const letter = (resolved.trim()[0] || 'M').toUpperCase();

  const nameEl = (() => {
    if (edit?.isEditMode) {
      return (
        <span
          className="cursor-pointer rounded px-1 text-sm font-semibold uppercase tracking-[0.28em] text-ink outline-dashed outline-1 outline-transparent transition-all hover:bg-mode/[0.04] hover:outline-mode/50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            edit.openEdit(e, 'footer.brandLine', resolved, false);
          }}
          title="Click to edit brand"
        >
          {resolved}
        </span>
      );
    }
    if (resolved === 'MotherMode') {
      return (
        <span className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
          Mother<span className="text-mode">Mode</span>
        </span>
      );
    }
    // Keep Mode accent when brand ends with Mode
    if (/mode$/i.test(resolved)) {
      const base = resolved.replace(/mode$/i, '');
      return (
        <span className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
          {base}
          <span className="text-mode">Mode</span>
        </span>
      );
    }
    return (
      <span className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
        {resolved}
      </span>
    );
  })();

  return (
    <div
      className={\`mb-8 flex items-center justify-center gap-3 \${className}\`.trim()}
    >
      <div className="h-px w-10 bg-ink/15" />
      <div className="inline-flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mode font-display text-base font-semibold text-bone">
          {letter}
        </span>
        {nameEl}
      </div>
      <div className="h-px w-10 bg-ink/15" />
    </div>
  );
};
`;
  // Preserve CRLF style of repo TSX files
  write('src/components/mothermode/optin/Wordmark.tsx', content.replace(/\n/g, '\r\n'));
}

// ---------------------------------------------------------------------------
// 6) HeroSection — shared OptinWordmark
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/HeroSection.tsx';
  let t = read(p);

  if (!t.includes("from '@/components/mothermode/optin/Wordmark'")) {
    const needle = "import { Sidebar } from './Sidebar';";
    if (t.includes(needle)) {
      t = t.replace(
        needle,
        "import { Sidebar } from './Sidebar';\nimport { OptinWordmark } from '@/components/mothermode/optin/Wordmark';",
      );
    } else {
      console.error('Hero import anchor miss');
      process.exitCode = 1;
    }
  }

  // Remove local Wordmark component (LF or CRLF)
  const localWmLf = `/** The MotherMode wordmark: a small Mode badge + name. */
const Wordmark: React.FC = () => (
  <div className="mb-8 flex items-center justify-center gap-3">
    <div className="h-px w-10 bg-ink/15" />
    <div className="inline-flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mode font-display text-base font-semibold text-bone">
        M
      </span>
      <span className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
        Mother<span className="text-mode">Mode</span>
      </span>
    </div>
    <div className="h-px w-10 bg-ink/15" />
  </div>
);

`;
  if (t.includes(localWmLf)) {
    t = t.replace(localWmLf, '');
  } else if (t.includes(localWmLf.replace(/\n/g, '\r\n'))) {
    t = t.replace(localWmLf.replace(/\n/g, '\r\n'), '');
  } else if (t.includes('const Wordmark: React.FC')) {
    console.error('local Wordmark present but pattern mismatch');
    process.exitCode = 1;
  }

  if (t.includes('<Wordmark />')) {
    t = t.replace(/<Wordmark \/>/g, '<OptinWordmark />');
  }

  write(p, t);
}

// ---------------------------------------------------------------------------
// 7) Admin SalesFunnelEditor — checkout timer/brand fields
// ---------------------------------------------------------------------------
{
  const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
  let t = read(p);

  // Only add if brandLabel field input missing
  if (!t.includes("field=\"brandLabel\"") && !t.includes("['brandLabel']") && !t.includes('brandLabel')) {
    // Find a checkout field near trialDays or guaranteeText or paymentType
    const anchors = [
      `field="guaranteeText"`,
      `field="paymentType"`,
      `field="ctaText"`,
      `key="guaranteeText"`,
    ];
    let placed = false;
    for (const a of anchors) {
      const i = t.indexOf(a);
      if (i < 0) continue;
      // Find end of that field block — insert after the containing component close is hard.
      // Instead look for a TextField / Field pattern nearby.
      console.log('admin anchor found', a, 'at', i);
      console.log(JSON.stringify(t.slice(i - 120, i + 280)));
      placed = true;
      break;
    }
    if (!placed) {
      console.log('admin: no checkout field anchor — manual check later');
    }
  } else {
    console.log('admin already has brandLabel or will inspect');
  }

  // Try structured insert: common pattern setField('checkout'... or draft.checkout
  if (!t.includes('timerLabel') || !t.includes('brandLabel')) {
    // Search for checkout section text inputs pattern
    const m = t.match(/checkout\.(ctaText|guaranteeText|paymentType|trialDays)/);
    if (m) {
      console.log('admin checkout field ref:', m[0], 'idx', m.index);
      console.log(JSON.stringify(t.slice(m.index - 200, m.index + 400)));
    } else {
      // schema-driven?
      const m2 = t.match(/CheckoutContent|CHECKOUT_FIELDS|checkoutFields/);
      console.log('admin schema?', m2 && m2[0]);
    }
  }

  write(p, t);
}

console.log('done apply-chrome-edit');
