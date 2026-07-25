/* Wire editable headers/top bars:
 * - CheckoutContent.timerLabel + brandLabel
 * - MotherModeCheckout MmEditable chrome
 * - CheckoutPage passes chrome props
 * - OptinWordmark hover-edit via footer.brandLine
 * - HeroSection uses shared OptinWordmark
 */
const fs = require('fs');

function patch(p, pairs) {
  let t = fs.readFileSync(p, 'utf8');
  for (const [a, b] of pairs) {
    if (!t.includes(a)) {
      console.error('MISS in', p, JSON.stringify(a).slice(0, 140));
      process.exitCode = 1;
      return false;
    }
    t = t.replace(a, b);
  }
  fs.writeFileSync(p, t);
  console.log('P', p);
  return true;
}

// 1) types
patch('src/lib/mothermode/sales/types.ts', [
  [
    `export interface CheckoutContent {
  eyebrow: string;
  headline: string;
  subheadline: string;
  priceLabel: string;
  priceCents: number;
  stripePriceId: string;
  productName: string;
  productId: string;
  /** Optional product mockup / thumbnail shown above the order card. */
  productImageUrl: string;
  bullets: string[];
  ctaText: string;
  guaranteeText: string;
  paymentType: string;
  trialDays: number;
}`,
    `export interface CheckoutContent {
  eyebrow: string;
  headline: string;
  subheadline: string;
  priceLabel: string;
  priceCents: number;
  stripePriceId: string;
  productName: string;
  productId: string;
  /** Optional product mockup / thumbnail shown above the order card. */
  productImageUrl: string;
  bullets: string[];
  ctaText: string;
  guaranteeText: string;
  paymentType: string;
  trialDays: number;
  /** Top urgency timer bar label (before the countdown). */
  timerLabel: string;
  /** Header brand wordmark text on the checkout page. */
  brandLabel: string;
}`,
  ],
]);

// 2) defaults
patch('src/lib/mothermode/sales/defaults.ts', [
  [
    `    ctaText: 'Buy now — $7',
    guaranteeText: '14-day money-back guarantee. If it does not lighten your load, we refund you.',
    paymentType: 'one_time',
    trialDays: 0,
  };
}`,
    `    ctaText: 'Buy now — $7',
    guaranteeText: '14-day money-back guarantee. If it does not lighten your load, we refund you.',
    paymentType: 'one_time',
    trialDays: 0,
    timerLabel: 'Founding price held for:',
    brandLabel: 'MOTHERMODE',
  };
}`,
  ],
]);

// 3) MotherModeCheckout
{
  const p = 'src/components/mothermode/checkout/MotherModeCheckout.tsx';
  let t = fs.readFileSync(p, 'utf8');

  if (!t.includes('SalesPageEditContext')) {
    t = t.replace(
      "import { OrderSummary } from './OrderSummary';",
      "import { OrderSummary } from './OrderSummary';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }

  const oldIface = `interface MotherModeCheckoutProps {
  offer: MotherModeOffer;
  affiliateRef?: string;
  /**
   * Where to send the buyer after successful payment (before query string).
   * Defaults to the original OTO1 path \`/mothermode/upsell\`.
   * Funnel builder passes \`/funnel/{slug}/upsell\` so the ladder stays in-builder.
   */
  successPath?: string;
  /** Optional back-link target. Defaults to the catalog offer page. */
  backHref?: string;
  /** Optional back-link label. */
  backLabel?: string;
}`;

  const newIface = `interface MotherModeCheckoutProps {
  offer: MotherModeOffer;
  affiliateRef?: string;
  /**
   * Where to send the buyer after successful payment (before query string).
   * Defaults to the original OTO1 path \`/mothermode/upsell\`.
   * Funnel builder passes \`/funnel/{slug}/upsell\` so the ladder stays in-builder.
   */
  successPath?: string;
  /** Optional back-link target. Defaults to the catalog offer page. */
  backHref?: string;
  /** Optional back-link label. */
  backLabel?: string;
  /** Top timer bar label. Editable in funnel builder via checkout.timerLabel. */
  timerLabel?: string;
  /** Header brand text. Editable in funnel builder via checkout.brandLabel. */
  brandLabel?: string;
}`;

  if (!t.includes(oldIface)) {
    console.error('checkout iface miss');
    process.exitCode = 1;
  } else {
    t = t.replace(oldIface, newIface);
  }

  const oldProps = `export const MotherModeCheckout: React.FC<MotherModeCheckoutProps> = ({
  offer,
  affiliateRef,
  successPath,
  backHref,
  backLabel,
}) => {`;
  const newProps = `export const MotherModeCheckout: React.FC<MotherModeCheckoutProps> = ({
  offer,
  affiliateRef,
  successPath,
  backHref,
  backLabel,
  timerLabel = 'Founding price held for:',
  brandLabel = 'MOTHERMODE',
}) => {`;
  if (!t.includes(oldProps)) {
    console.error('checkout props miss');
    process.exitCode = 1;
  } else {
    t = t.replace(oldProps, newProps);
  }

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

  if (!t.includes(oldHeader)) {
    console.error('checkout header miss');
    const i = t.indexOf('Founding price held');
    console.log(JSON.stringify(t.slice(Math.max(0, i - 120), i + 450)));
    process.exitCode = 1;
  } else {
    t = t.replace(oldHeader, newHeader);
  }

  fs.writeFileSync(p, t);
  console.log('P', p);
}

// 4) CheckoutPage pass props
patch('src/components/mothermode/sales/CheckoutPage.tsx', [
  [
    `        <MotherModeCheckout
          offer={offer}
          successPath={successPath}
          backHref={backHref}
          backLabel={backLabel}
        />`,
    `        <MotherModeCheckout
          offer={offer}
          successPath={successPath}
          backHref={backHref}
          backLabel={backLabel}
          timerLabel={c.timerLabel || 'Founding price held for:'}
          brandLabel={c.brandLabel || 'MOTHERMODE'}
        />`,
  ],
]);

// 5) OptinWordmark
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
  fs.writeFileSync(
    'src/components/mothermode/optin/Wordmark.tsx',
    content.replace(/\n/g, '\r\n'),
  );
  console.log('W Wordmark');
}

// 6) HeroSection — shared OptinWordmark
{
  const p = 'src/components/mothermode/parts/HeroSection.tsx';
  let t = fs.readFileSync(p, 'utf8');
  if (!t.includes("from '@/components/mothermode/optin/Wordmark'")) {
    t = t.replace(
      "import { Sidebar } from './Sidebar';",
      "import { Sidebar } from './Sidebar';\nimport { OptinWordmark } from '@/components/mothermode/optin/Wordmark';",
    );
  }
  const localWm = `/** The MotherMode wordmark: a small Mode badge + name. */
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
  if (t.includes(localWm)) {
    t = t.replace(localWm, '');
  } else if (t.includes('const Wordmark: React.FC')) {
    console.error('local Wordmark present but pattern mismatch');
    process.exitCode = 1;
  }
  t = t.replace('<Wordmark />', '<OptinWordmark />');
  fs.writeFileSync(p, t);
  console.log('P', p);
}

// 7) CheckoutPage field sheet — add timer/brand if Editable rows exist
{
  const p = 'src/components/mothermode/sales/CheckoutPage.tsx';
  let t = fs.readFileSync(p, 'utf8');
  if (t.includes('timerLabel') && t.includes('field="eyebrow"')) {
    // already has timerLabel prop pass; check sheet fields
  }
  // Find sheet Editable pattern
  const i = t.indexOf('field="eyebrow"');
  if (i > 0 && !t.includes('field="timerLabel"')) {
    // Look at surrounding Editable component API
    const snip = t.slice(Math.max(0, i - 300), i + 400);
    console.log('SHEET SNIP:\n', snip);
  } else {
    console.log('sheet timer field already present or no eyebrow field');
  }
}

console.log('done');
