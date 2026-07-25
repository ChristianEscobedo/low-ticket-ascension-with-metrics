const fs = require('fs');

function write(p, c) {
  fs.writeFileSync(p, c, 'utf8');
  console.log('wrote', p, c.length);
}

// ---------- 1) types.ts: add chrome fields ----------
{
  let t = fs.readFileSync('src/lib/mothermode/sales/types.ts', 'utf8');

  const chromeBlock = `
  // Pricing chrome labels (editable on-page)
  soldSeparatelyLabel: string;
  todayLabel: string;
  pricingStackTotalLabel: string;
  savingsLabel: string; // e.g. "You save {amount} today" — {amount} replaced
  foundingPriceLabel: string;
  timerNote: string;
  resourcesInstantLabel: string; // e.g. "{count} resources. Yours instantly."
  secureCheckoutLabel: string;
  guaranteeNote: string; // e.g. "14 days, no friction."
  proofEyebrow: string; // "In her words"
  brandLine: string;
  conversionLine: string;
  generationalLine: string;
  categoryLine: string;
  founderName: string;
  founderRole: string;
`;

  if (!t.includes('soldSeparatelyLabel:')) {
    t = t.replace(
      /  \/\/ Bumps\n  bumps: \{/,
      chromeBlock + `\n  // Bumps\n  bumps: {`,
    );
  }

  // blankSalesPage defaults
  if (!t.includes("soldSeparatelyLabel: 'Sold separately'")) {
    t = t.replace(
      /    founderPs: '',\n\n    faqHeading: '',/,
      `    founderPs: '',

    soldSeparatelyLabel: 'Sold separately',
    todayLabel: 'Today',
    pricingStackTotalLabel: '',
    savingsLabel: 'You save {amount} today',
    foundingPriceLabel: 'Founding price',
    timerNote: 'Founding price holds while the timer runs.',
    resourcesInstantLabel: '{count} resources. Yours instantly.',
    secureCheckoutLabel: 'Secure checkout. Instant digital delivery.',
    guaranteeNote: '14 days, no friction.',
    proofEyebrow: 'In her words',
    brandLine: 'Motherhood, Redesigned.',
    conversionLine: 'Reclaim more.',
    generationalLine: 'So our daughters will not have to.',
    categoryLine: 'The OS for modern motherhood.',
    founderName: 'Loni Brown',
    founderRole: 'Founder of MotherMode',

    faqHeading: '',`,
    );
  }

  // normalizeSalesPage — add fields before bumps
  if (!t.includes("soldSeparatelyLabel: str('soldSeparatelyLabel'")) {
    t = t.replace(
      /    finalCtaBody: str\('finalCtaBody'\),\n\n    bumps:/,
      `    finalCtaBody: str('finalCtaBody'),

    soldSeparatelyLabel: str('soldSeparatelyLabel', 'Sold separately'),
    todayLabel: str('todayLabel', 'Today'),
    pricingStackTotalLabel: str('pricingStackTotalLabel'),
    savingsLabel: str('savingsLabel', 'You save {amount} today'),
    foundingPriceLabel: str('foundingPriceLabel', 'Founding price'),
    timerNote: str('timerNote', 'Founding price holds while the timer runs.'),
    resourcesInstantLabel: str(
      'resourcesInstantLabel',
      '{count} resources. Yours instantly.',
    ),
    secureCheckoutLabel: str(
      'secureCheckoutLabel',
      'Secure checkout. Instant digital delivery.',
    ),
    guaranteeNote: str('guaranteeNote', '14 days, no friction.'),
    proofEyebrow: str('proofEyebrow', 'In her words'),
    brandLine: str('brandLine', 'Motherhood, Redesigned.'),
    conversionLine: str('conversionLine', 'Reclaim more.'),
    generationalLine: str(
      'generationalLine',
      'So our daughters will not have to.',
    ),
    categoryLine: str('categoryLine', 'The OS for modern motherhood.'),
    founderName: str('founderName', 'Loni Brown'),
    founderRole: str('founderRole', 'Founder of MotherMode'),

    bumps:`,
    );
  }

  fs.writeFileSync('src/lib/mothermode/sales/types.ts', t);
  console.log('types.ts patched', t.includes('soldSeparatelyLabel'));
}

// ---------- 2) fromOffer.ts ----------
{
  let fo = fs.readFileSync('src/lib/mothermode/sales/fromOffer.ts', 'utf8');

  if (!fo.includes("from '@/lib/mothermode/brand'")) {
    fo = fo.replace(
      "import type { SalesPageContent } from './types';",
      "import type { SalesPageContent } from './types';\nimport { BRAND, FOUNDER } from '@/lib/mothermode/brand';",
    );
  }

  if (!fo.includes('soldSeparatelyLabel:')) {
    fo = fo.replace(
      /founderPs: offer\.founderLetter\?\.ps \|\| '',/,
      `founderPs: offer.founderLetter?.ps || '',

    soldSeparatelyLabel: 'Sold separately',
    todayLabel: 'Today',
    pricingStackTotalLabel: '',
    savingsLabel: 'You save {amount} today',
    foundingPriceLabel: 'Founding price',
    timerNote: 'Founding price holds while the timer runs.',
    resourcesInstantLabel: '{count} resources. Yours instantly.',
    secureCheckoutLabel: 'Secure checkout. Instant digital delivery.',
    guaranteeNote: '14 days, no friction.',
    proofEyebrow: 'In her words',
    brandLine: BRAND.brandLine,
    conversionLine: BRAND.conversionLine,
    generationalLine: BRAND.generationalLine,
    categoryLine: BRAND.categoryLine,
    founderName: FOUNDER.name,
    founderRole: FOUNDER.role,`,
    );
  }

  if (!fo.includes('soldSeparatelyLabel: c.soldSeparatelyLabel')) {
    fo = fo.replace(
      /urgencyText: c\.ctaSubtext \|\| 'Founding price, for the first 100 mothers\.',/,
      `urgencyText: c.ctaSubtext || 'Founding price, for the first 100 mothers.',
    soldSeparatelyLabel: c.soldSeparatelyLabel || 'Sold separately',
    todayLabel: c.todayLabel || 'Today',
    pricingStackTotalLabel: c.pricingStackTotalLabel || '',
    savingsLabel: c.savingsLabel || 'You save {amount} today',
    foundingPriceLabel: c.foundingPriceLabel || 'Founding price',
    timerNote: c.timerNote || 'Founding price holds while the timer runs.',
    resourcesInstantLabel:
      c.resourcesInstantLabel || '{count} resources. Yours instantly.',
    secureCheckoutLabel:
      c.secureCheckoutLabel || 'Secure checkout. Instant digital delivery.',
    guaranteeNote: c.guaranteeNote || '14 days, no friction.',
    proofEyebrow: c.proofEyebrow || 'In her words',
    brandLine: c.brandLine || BRAND.brandLine,
    conversionLine: c.conversionLine || BRAND.conversionLine,
    generationalLine: c.generationalLine || BRAND.generationalLine,
    categoryLine: c.categoryLine || BRAND.categoryLine,
    founderName: c.founderName || FOUNDER.name,
    founderRole: c.founderRole || FOUNDER.role,
    priceLabel: c.priceLabel || '',
    originalPriceLabel: c.originalPriceLabel || '',`,
    );
  }

  fs.writeFileSync('src/lib/mothermode/sales/fromOffer.ts', fo);
  console.log('fromOffer patched', fo.includes('soldSeparatelyLabel'));
}

// ---------- 3) ClosingSections PricingSection ----------
{
  const p = 'src/components/mothermode/parts/ClosingSections.tsx';
  let t = fs.readFileSync(p, 'utf8');

  const oldBlock = `          <div className="mt-5 flex items-baseline justify-between border-t border-ink/10 pt-5">
            <span className="text-ink/60">Sold separately</span>
            <span className="text-ink/50 line-through">
              {stackTotal > 0 ? \`$\${stackTotal}\` : formatPrice(offer.originalPriceCents)}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-display text-lg text-ink">Today</span>
            <span className="font-display text-4xl text-mode">
              {formatPrice(offer.priceCents)}
            </span>
          </div>`;

  const newBlock = `          <div className="mt-5 flex items-baseline justify-between border-t border-ink/10 pt-5">
            <MmEditable field="soldSeparatelyLabel" as="span" className="text-ink/60">
              {(offer as { soldSeparatelyLabel?: string }).soldSeparatelyLabel ||
                'Sold separately'}
            </MmEditable>
            <MmEditable
              field="originalPriceLabel"
              as="span"
              className="text-ink/50 line-through"
              value={
                (offer as { originalPriceLabel?: string }).originalPriceLabel ||
                (stackTotal > 0
                  ? \`$\${stackTotal}\`
                  : formatPrice(offer.originalPriceCents))
              }
            >
              {(offer as { originalPriceLabel?: string }).originalPriceLabel ||
                (stackTotal > 0
                  ? \`$\${stackTotal}\`
                  : formatPrice(offer.originalPriceCents))}
            </MmEditable>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <MmEditable field="todayLabel" as="span" className="font-display text-lg text-ink">
              {(offer as { todayLabel?: string }).todayLabel || 'Today'}
            </MmEditable>
            <MmEditable
              field="priceLabel"
              as="span"
              className="font-display text-4xl text-mode"
              value={
                (offer as { priceLabel?: string }).priceLabel ||
                formatPrice(offer.priceCents)
              }
            >
              {(offer as { priceLabel?: string }).priceLabel ||
                formatPrice(offer.priceCents)}
            </MmEditable>
          </div>`;

  if (t.includes('Sold separately') && !t.includes('soldSeparatelyLabel')) {
    if (!t.includes(oldBlock)) {
      console.log('WARN ClosingSections oldBlock not exact match');
      // try looser
      t = t.replace(
        /<span className="text-ink\/60">Sold separately<\/span>/,
        `<MmEditable field="soldSeparatelyLabel" as="span" className="text-ink/60">
              {(offer as { soldSeparatelyLabel?: string }).soldSeparatelyLabel ||
                'Sold separately'}
            </MmEditable>`,
      );
      t = t.replace(
        /\{stackTotal > 0 \? `\$\$\{stackTotal}` : formatPrice\(offer\.originalPriceCents\)\}/,
        `{(offer as { originalPriceLabel?: string }).originalPriceLabel ||
                (stackTotal > 0
                  ? \`$\${stackTotal}\`
                  : formatPrice(offer.originalPriceCents))}`,
      );
      // wrap original price span
      t = t.replace(
        /<span className="text-ink\/50 line-through">\s*\{\(offer as \{ originalPriceLabel/,
        `<MmEditable
              field="originalPriceLabel"
              as="span"
              className="text-ink/50 line-through"
              value={
                (offer as { originalPriceLabel?: string }).originalPriceLabel ||
                (stackTotal > 0
                  ? \`$\${stackTotal}\`
                  : formatPrice(offer.originalPriceCents))
              }
            >
              {(offer as { originalPriceLabel`,
      );
    } else {
      t = t.replace(oldBlock, newBlock);
    }
  }

  // If still has Sold separately plain, force full replace of pricing rows
  if (t.includes('>Sold separately<') && !t.includes('field="soldSeparatelyLabel"')) {
    t = t.replace(oldBlock, newBlock);
  }

  // Final CTA brand line
  if (t.includes('{BRAND.brandLine}') && !t.includes('field="brandLine"')) {
    t = t.replace(
      `      <p className="mt-8 font-display text-base italic text-bone/60">
        {BRAND.brandLine}
      </p>`,
      `      <MmEditable
        field="brandLine"
        as="p"
        className="mt-8 font-display text-base italic text-bone/60"
      >
        {(offer as { brandLine?: string }).brandLine || BRAND.brandLine}
      </MmEditable>`,
    );
  }

  // SalesFooter
  if (t.includes('export const SalesFooter: React.FC = () => (')) {
    t = t.replace(
      `export const SalesFooter: React.FC = () => (
  <footer className="bg-bone">
    <div className="mx-auto max-w-6xl px-4 py-10 text-center">
      <div className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
        Mother<span className="text-mode">Mode</span>
      </div>
      <p className="mt-2 text-xs text-ink/45">
        {BRAND.categoryLine} {BRAND.generationalLine}
      </p>
    </div>
  </footer>
);`,
      `export const SalesFooter: React.FC<{ offer?: MotherModeOffer }> = ({ offer }) => {
  const o = offer as
    | {
        categoryLine?: string;
        generationalLine?: string;
        brandName?: string;
      }
    | undefined;
  return (
  <footer className="bg-bone">
    <div className="mx-auto max-w-6xl px-4 py-10 text-center">
      <div className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
        Mother<span className="text-mode">Mode</span>
      </div>
      <p className="mt-2 text-xs text-ink/45">
        <MmEditable field="categoryLine" as="span">
          {o?.categoryLine || BRAND.categoryLine}
        </MmEditable>{' '}
        <MmEditable field="generationalLine" as="span">
          {o?.generationalLine || BRAND.generationalLine}
        </MmEditable>
      </p>
    </div>
  </footer>
  );
};`,
    );
  }

  // Manual pricing block if still hardcoded
  if (t.includes('Sold separately') && !t.includes('field="soldSeparatelyLabel"')) {
    // read current pricing section and rewrite whole PricingSection return pricing card bottom
    const start = t.indexOf('const stackTotal');
    console.log('stackTotal at', start);
  }

  fs.writeFileSync(p, t);
  console.log(
    'ClosingSections',
    t.includes('soldSeparatelyLabel') || t.includes('field="soldSeparatelyLabel"'),
    t.includes('SalesFooter: React.FC<{ offer'),
  );
}

// ---------- 4) MotherModeSalesPage pass offer to footer ----------
{
  const p = 'src/components/mothermode/MotherModeSalesPage.tsx';
  let t = fs.readFileSync(p, 'utf8');
  t = t.replace('<SalesFooter />', '<SalesFooter offer={offer} />');
  fs.writeFileSync(p, t);
  console.log('MotherModeSalesPage footer offer', t.includes('SalesFooter offer={offer}'));
}

// ---------- 5) Sidebar full rewrite ----------
{
  const p = 'src/components/mothermode/parts/Sidebar.tsx';
  write(
    p,
    `'use client';

import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { formatPrice } from '@/lib/mothermode/format';
import { CheckoutButton } from './CheckoutButton';
import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';

interface SidebarProps {
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  originalPriceCents: number;
  insideCount: number;
  guaranteeTitle: string;
  ctaLabel?: string;
  priceLabel?: string;
  originalPriceLabel?: string;
  resourcesInstantLabel?: string;
  timerNote?: string;
  savingsLabel?: string;
  secureCheckoutLabel?: string;
  guaranteeNote?: string;
}

/** Sticky offer card. Price, what is included, one CTA, the guarantee. */
export const Sidebar: React.FC<SidebarProps> = ({
  slug,
  name,
  category,
  priceCents,
  originalPriceCents,
  insideCount,
  guaranteeTitle,
  ctaLabel,
  priceLabel,
  originalPriceLabel,
  resourcesInstantLabel,
  timerNote,
  savingsLabel,
  secureCheckoutLabel,
  guaranteeNote,
}) => {
  const [time, setTime] = useState({ h: 23, m: 47, s: 12 });

  useEffect(() => {
    const id = setInterval(() => {
      setTime((p) => {
        if (p.s > 0) return { ...p, s: p.s - 1 };
        if (p.m > 0) return { ...p, m: p.m - 1, s: 59 };
        if (p.h > 0) return { h: p.h - 1, m: 59, s: 59 };
        return p;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const savings = originalPriceCents - priceCents;
  const displayPrice = priceLabel || formatPrice(priceCents);
  const displayOriginal = originalPriceLabel || formatPrice(originalPriceCents);
  const resourcesLine = (
    resourcesInstantLabel || '{count} resources. Yours instantly.'
  ).replace('{count}', String(insideCount));
  const savingsText = (savingsLabel || 'You save {amount} today').replace(
    '{amount}',
    formatPrice(savings),
  );

  const cell = (v: number, label: string) => (
    <div className="text-center">
      <div className="rounded-md border border-ink/10 bg-bone py-1.5 text-lg font-semibold tabular-nums text-ink">
        {v.toString().padStart(2, '0')}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-ink/40">
        {label}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm sm:p-7">
      <div className="mb-5 text-center">
        <MmEditable
          field="category"
          as="div"
          className="text-xs uppercase tracking-[0.2em] text-mode"
        >
          {category}
        </MmEditable>
        <MmEditable
          field="name"
          as="div"
          className="mt-1 font-display text-2xl leading-snug text-ink"
        >
          {name}
        </MmEditable>
        <MmEditable
          field="resourcesInstantLabel"
          as="div"
          className="mt-1 text-sm text-ink/50"
          value={resourcesInstantLabel || '{count} resources. Yours instantly.'}
        >
          {resourcesLine}
        </MmEditable>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {cell(time.h, 'Hrs')}
        {cell(time.m, 'Min')}
        {cell(time.s, 'Sec')}
      </div>
      <MmEditable
        field="timerNote"
        as="p"
        className="mb-5 text-center text-xs text-ink/45"
      >
        {timerNote || 'Founding price holds while the timer runs.'}
      </MmEditable>

      <div className="mb-6 text-center">
        <div className="flex items-baseline justify-center gap-2">
          <MmEditable
            field="priceLabel"
            as="span"
            className="font-display text-4xl text-ink"
            value={displayPrice}
          >
            {displayPrice}
          </MmEditable>
          <MmEditable
            field="originalPriceLabel"
            as="span"
            className="text-base text-ink/40 line-through"
            value={displayOriginal}
          >
            {displayOriginal}
          </MmEditable>
        </div>
        <MmEditable
          field="savingsLabel"
          as="div"
          className="mt-1 text-sm font-medium text-mode"
          value={savingsLabel || 'You save {amount} today'}
        >
          {savingsText}
        </MmEditable>
      </div>

      <CheckoutButton
        slug={slug}
        label={ctaLabel || 'Get instant access'}
        className="w-full"
      />

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-center gap-2 text-xs text-ink/50">
          <Lock className="h-3.5 w-3.5 text-mode" />
          <MmEditable field="secureCheckoutLabel" as="span">
            {secureCheckoutLabel ||
              'Secure checkout. Instant digital delivery.'}
          </MmEditable>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-brass/30 bg-brass/[0.06] p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brass" />
          <div className="text-xs text-ink/70">
            <MmEditable
              field="guaranteeTitle"
              as="span"
              className="font-semibold text-ink"
            >
              {guaranteeTitle}
            </MmEditable>
            {'. '}
            <MmEditable field="guaranteeNote" as="span">
              {guaranteeNote || '14 days, no friction.'}
            </MmEditable>
          </div>
        </div>
      </div>
    </div>
  );
};
`,
  );
}

// ---------- 6) HeroSection ----------
{
  const p = 'src/components/mothermode/parts/HeroSection.tsx';
  let t = fs.readFileSync(p, 'utf8');

  if (!t.includes('resourcesInstantLabel=')) {
    t = t.replace(
      /ctaLabel=\{\s*\(offer as \{ ctaLabel\?: string \}\)\.ctaLabel \|\|\s*`Get \$\{offer\.name\}`\s*\}\s*\/>/,
      `ctaLabel={
                  (offer as { ctaLabel?: string }).ctaLabel ||
                  \`Get \${offer.name}\`
                }
                priceLabel={(offer as { priceLabel?: string }).priceLabel}
                originalPriceLabel={
                  (offer as { originalPriceLabel?: string }).originalPriceLabel
                }
                resourcesInstantLabel={
                  (offer as { resourcesInstantLabel?: string })
                    .resourcesInstantLabel
                }
                timerNote={(offer as { timerNote?: string }).timerNote}
                savingsLabel={(offer as { savingsLabel?: string }).savingsLabel}
                secureCheckoutLabel={
                  (offer as { secureCheckoutLabel?: string }).secureCheckoutLabel
                }
                guaranteeNote={
                  (offer as { guaranteeNote?: string }).guaranteeNote
                }
              />`,
    );
  }

  if (t.includes('{BRAND.brandLine} {BRAND.conversionLine}')) {
    t = t.replace(
      `              <p className="mt-6 border-t border-ink/10 pt-5 text-base italic text-ink/60">
                {BRAND.brandLine} {BRAND.conversionLine}
              </p>`,
      `              <p className="mt-6 border-t border-ink/10 pt-5 text-base italic text-ink/60">
                <MmEditable field="brandLine" as="span">
                  {(offer as { brandLine?: string }).brandLine || BRAND.brandLine}
                </MmEditable>{' '}
                <MmEditable field="conversionLine" as="span">
                  {(offer as { conversionLine?: string }).conversionLine ||
                    BRAND.conversionLine}
                </MmEditable>
              </p>`,
    );
  }

  fs.writeFileSync(p, t);
  console.log(
    'HeroSection',
    t.includes('resourcesInstantLabel'),
    t.includes('field="brandLine"'),
  );
}

// ---------- 7) ContentSidebar ----------
{
  const p = 'src/components/mothermode/parts/ContentSidebar.tsx';
  let t = fs.readFileSync(p, 'utf8');

  if (t.includes('In her words') && !t.includes('proofEyebrow')) {
    t = t.replace(
      `          <div className="text-xs uppercase tracking-[0.18em] text-mode">
            In her words
          </div>`,
      `          <MmEditable
            field="proofEyebrow"
            as="div"
            className="text-xs uppercase tracking-[0.18em] text-mode"
          >
            {(offer as { proofEyebrow?: string }).proofEyebrow || 'In her words'}
          </MmEditable>`,
    );
  }

  if (t.includes('Founding price') && !t.includes('foundingPriceLabel')) {
    t = t.replace(
      `        <div className="text-xs uppercase tracking-[0.18em] text-brass">
          Founding price
        </div>
        <div className="mt-2 flex items-baseline justify-center gap-2">
          <span className="font-display text-3xl text-ink">
            {formatPrice(offer.priceCents)}
          </span>
          <span className="text-sm text-ink/40 line-through">
            {formatPrice(offer.originalPriceCents)}
          </span>
        </div>`,
      `        <MmEditable
          field="foundingPriceLabel"
          as="div"
          className="text-xs uppercase tracking-[0.18em] text-brass"
        >
          {(offer as { foundingPriceLabel?: string }).foundingPriceLabel ||
            'Founding price'}
        </MmEditable>
        <div className="mt-2 flex items-baseline justify-center gap-2">
          <MmEditable
            field="priceLabel"
            as="span"
            className="font-display text-3xl text-ink"
            value={
              (offer as { priceLabel?: string }).priceLabel ||
              formatPrice(offer.priceCents)
            }
          >
            {(offer as { priceLabel?: string }).priceLabel ||
              formatPrice(offer.priceCents)}
          </MmEditable>
          <MmEditable
            field="originalPriceLabel"
            as="span"
            className="text-sm text-ink/40 line-through"
            value={
              (offer as { originalPriceLabel?: string }).originalPriceLabel ||
              formatPrice(offer.originalPriceCents)
            }
          >
            {(offer as { originalPriceLabel?: string }).originalPriceLabel ||
              formatPrice(offer.originalPriceCents)}
          </MmEditable>
        </div>`,
    );
  }

  fs.writeFileSync(p, t);
  console.log('ContentSidebar', t.includes('foundingPriceLabel'));
}

// ---------- 8) ProofSection ----------
{
  const p = 'src/components/mothermode/parts/ProofSection.tsx';
  let t = fs.readFileSync(p, 'utf8');

  if (t.includes('{FOUNDER.name}') && !t.includes('field="founderName"')) {
    t = t.replace(
      `              <div className="mt-2 font-display text-3xl text-ink">{FOUNDER.name}</div>
              <div className="text-base text-ink/45">{FOUNDER.role}</div>
              <p className="mt-4 font-display text-lg italic text-mode">
                {BRAND.generationalLine}
              </p>`,
      `              <MmEditable
                field="founderName"
                as="div"
                className="mt-2 font-display text-3xl text-ink"
              >
                {(offer as { founderName?: string }).founderName || FOUNDER.name}
              </MmEditable>
              <MmEditable
                field="founderRole"
                as="div"
                className="text-base text-ink/45"
              >
                {(offer as { founderRole?: string }).founderRole || FOUNDER.role}
              </MmEditable>
              <MmEditable
                field="generationalLine"
                as="p"
                className="mt-4 font-display text-lg italic text-mode"
              >
                {(offer as { generationalLine?: string }).generationalLine ||
                  BRAND.generationalLine}
              </MmEditable>`,
    );
  }

  t = t.replace(
    `              alt={FOUNDER.name}`,
    `              alt={(offer as { founderName?: string }).founderName || FOUNDER.name}`,
  );

  fs.writeFileSync(p, t);
  console.log('ProofSection', t.includes('field="founderName"'));
}

// ---------- 9) inlineEdit price sync ----------
{
  const p = 'src/components/mothermode/sales/inlineEdit.tsx';
  let t = fs.readFileSync(p, 'utf8');

  if (!t.includes("field === 'priceLabel'")) {
    t = t.replace(
      `    } else {
      edit.setField(field, value);
    }
    edit.setInlineEdit(null);
  };`,
      `    } else if (field === 'priceLabel' || field === 'originalPriceLabel') {
      edit.setField(field, value);
      // Keep cents in sync so checkout / Stripe math stays correct
      const dollars = Number(String(value).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(dollars)) {
        edit.setField(
          field === 'priceLabel' ? 'priceCents' : 'originalPriceCents',
          Math.round(dollars * 100),
        );
      }
    } else {
      edit.setField(field, value);
    }
    edit.setInlineEdit(null);
  };`,
    );
  }

  if (!t.includes("'originalPriceCents'")) {
    t = t.replace(
      `  'priceCents',
  'trialDays',
]);`,
      `  'priceCents',
  'originalPriceCents',
  'trialDays',
]);`,
    );
  }

  fs.writeFileSync(p, t);
  console.log('inlineEdit price sync', t.includes("field === 'priceLabel'"));
}

// ---------- 10) Fix ClosingSections pricing if still broken ----------
{
  const p = 'src/components/mothermode/parts/ClosingSections.tsx';
  let t = fs.readFileSync(p, 'utf8');
  if (!t.includes('field="soldSeparatelyLabel"')) {
    // rewrite PricingSection entirely from marker
    const start = t.indexOf('export const PricingSection');
    const end = t.indexOf('export const GuaranteeSection');
    if (start >= 0 && end > start) {
      const replacement = `export const PricingSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const stackTotal = offer.inside.items
    .map((i) => (i.value ? Number(i.value.replace(/[^0-9.]/g, '')) : 0))
    .reduce((sum, n) => sum + n, 0);
  const o = offer as {
    pricingEyebrow?: string;
    ctaLabel?: string;
    soldSeparatelyLabel?: string;
    todayLabel?: string;
    priceLabel?: string;
    originalPriceLabel?: string;
  };
  const originalDisplay =
    o.originalPriceLabel ||
    (stackTotal > 0 ? \`$\${stackTotal}\` : formatPrice(offer.originalPriceCents));
  const priceDisplay = o.priceLabel || formatPrice(offer.priceCents);
  return (
    <section className="border-t border-ink/10 bg-white/40">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div className="text-center">
          <MmEditable
            field="priceDescription"
            as="div"
            className="text-sm uppercase tracking-[0.2em] text-mode"
          >
            {o.pricingEyebrow || 'What it costs to keep carrying it'}
          </MmEditable>
          <MmEditable
            field="tagline"
            as="h2"
            className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
          >
            {offer.tagline || 'One page. One sitting. One price.'}
          </MmEditable>
        </div>

        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-ink/10 bg-bone p-7">
          <ul className="space-y-3">
            {offer.inside.items.map((item, ii) => (
              <li
                key={item.title + ii}
                className="flex items-baseline justify-between gap-4 text-base"
              >
                <MmEditable field={\`insideItems.\${ii}.title\`} as="span" className="text-ink/70">
                  {item.title}
                </MmEditable>
                <MmEditable field={\`insideItems.\${ii}.value\`} as="span" className="text-ink/45">
                  {item.value ?? ''}
                </MmEditable>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-baseline justify-between border-t border-ink/10 pt-5">
            <MmEditable field="soldSeparatelyLabel" as="span" className="text-ink/60">
              {o.soldSeparatelyLabel || 'Sold separately'}
            </MmEditable>
            <MmEditable
              field="originalPriceLabel"
              as="span"
              className="text-ink/50 line-through"
              value={originalDisplay}
            >
              {originalDisplay}
            </MmEditable>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <MmEditable field="todayLabel" as="span" className="font-display text-lg text-ink">
              {o.todayLabel || 'Today'}
            </MmEditable>
            <MmEditable
              field="priceLabel"
              as="span"
              className="font-display text-4xl text-mode"
              value={priceDisplay}
            >
              {priceDisplay}
            </MmEditable>
          </div>
          <div className="mt-7 text-center">
            <CheckoutButton
              slug={offer.slug}
              label={o.ctaLabel || \`Get \${offer.name}\`}
              className="w-full"
            />

            <MmEditable field="promise" as="p" className="mt-3 text-sm text-ink/50">
              {offer.hero.promise}
            </MmEditable>
          </div>
        </div>
      </div>
    </section>
  );
};

`;
      t = t.slice(0, start) + replacement + t.slice(end);
      fs.writeFileSync(p, t);
      console.log('PricingSection fully rewritten');
    }
  } else {
    console.log('PricingSection already has soldSeparatelyLabel field');
  }
}

console.log('ALL DONE');
