/**
 * Expand SalesPageContent to full MotherMode offer structure +
 * rewrite normalizer, defaults, fromOffer field names, SalesPage component.
 */
const fs = require('fs');

// ---------------------------------------------------------------------------
// 1) Expand SalesPageContent interface + normalizer in types.ts
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/types.ts';
  let c = fs.readFileSync(p, 'utf8');

  const iface = `/** Sales page (step 2) — full MotherMode long-form structure (editable).
 *  Mirrors MotherModeOffer sections so the public page can reuse the exact
 *  production layout while remaining fully customizable per funnel.
 */
export interface SalesPageContent {
  // Identity / pricing
  name: string;
  tagline: string;
  category: string;
  priceCents: number;
  originalPriceCents: number;
  priceLabel: string;
  originalPriceLabel: string;
  priceDescription: string;
  ctaText: string;
  ctaSubtext: string;
  guaranteeTitle: string;
  guaranteeText: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  founderPhotoUrl: string;

  // Hero
  eyebrow: string;
  headline: string;
  headlineEmphasis: string;
  headlineSuffix: string;
  subheadline: string;
  audience: string;
  promise: string;

  // Problem
  problemHeading: string;
  problemIntro: string;
  problemScene: string;
  problemPoints: string[];
  problemCost: string;
  /** @deprecated flat body kept for older funnels */
  problemBody: string;

  // Origin
  originEyebrow: string;
  originHeading: string;
  originParagraphs: string[];

  // What is / solution
  whatIsHeading: string;
  whatIsParagraphs: string[];
  solutionHeading: string;
  solutionBody: string;

  // Mechanism
  mechanismEyebrow: string;
  mechanismHeading: string;
  mechanismLabel: string;
  mechanismParagraphs: string[];
  mechanismPoints: { title: string; description: string }[];

  // Inside / features
  insideHeading: string;
  insideSubheading: string;
  insideLead: string;
  insideItems: {
    title: string;
    description: string;
    tag: string;
    value: string;
    outcome: string;
  }[];
  featuresHeading: string;
  features: string[];

  // Method
  methodHeading: string;
  methodSubheading: string;
  methodSteps: {
    number: number;
    title: string;
    description: string;
    meta: string;
    shift: string;
  }[];
  methodCloser: string;

  // Old vs new
  oldWayHeading: string;
  oldWayItems: string[];
  newWayHeading: string;
  newWayItems: string[];

  // Proof / testimonials
  proof: { name: string; role: string; quote: string; real: boolean }[];
  testimonialsHeading: string;
  testimonials: { quote: string; author: string; role: string }[];

  // Bonuses
  bonusesEyebrow: string;
  bonusesHeading: string;
  bonusesIntro: string;
  bonusesItems: { title: string; description: string; value: string }[];
  bonusesTotalValue: string;
  bonusesCloser: string;

  // Founder letter
  founderEyebrow: string;
  founderHeading: string;
  founderGreeting: string;
  founderParagraphs: string[];
  founderSignoff: string;
  founderPs: string;

  // FAQ / final
  faqHeading: string;
  faqs: { question: string; answer: string }[];
  finalCtaHeading: string;
  finalCtaBody: string;

  // Bumps
  bumps: {
    id: string;
    title: string;
    description: string;
    price: string;
  }[];
}

`;

  const start = c.indexOf('/** Sales page (step 2)');
  const end = c.indexOf('/** VSL page (step 3)');
  if (start < 0 || end < 0) throw new Error('SalesPageContent markers missing');
  c = c.slice(0, start) + iface + c.slice(end);

  const norm = `export function normalizeSalesPage(raw: unknown): SalesPageContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const str = (k: string, fb = '') => asString(o[k], fb);
  const arr = (k: string) => asStringArray(o[k]);
  const objs = (k: string) => asObjectArray(o[k]);
  const num = (k: string, fb = 0) => {
    const v = o[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : fb;
  };

  const testimonials = objs('testimonials').map((t) => ({
    quote: asString(t.quote),
    author: asString(t.author) || asString(t.name),
    role: asString(t.role),
  }));

  const proofRaw = objs('proof');
  const proof =
    proofRaw.length > 0
      ? proofRaw.map((p) => ({
          name: asString(p.name) || asString(p.author),
          role: asString(p.role),
          quote: asString(p.quote),
          real: p.real !== false,
        }))
      : testimonials.map((t) => ({
          name: t.author,
          role: t.role,
          quote: t.quote,
          real: true,
        }));

  const faqs = objs('faqs').map((f) => ({
    question: asString(f.question) || asString(f.q),
    answer: asString(f.answer) || asString(f.a),
  }));

  const insideItems = objs('insideItems').map((item) => ({
    title: asString(item.title),
    description: asString(item.description),
    tag: asString(item.tag),
    value: asString(item.value),
    outcome: asString(item.outcome),
  }));

  const features = arr('features');
  const problemPoints = arr('problemPoints');

  return {
    name: str('name'),
    tagline: str('tagline'),
    category: str('category'),
    priceCents: num('priceCents'),
    originalPriceCents: num('originalPriceCents'),
    priceLabel: str('priceLabel'),
    originalPriceLabel: str('originalPriceLabel'),
    priceDescription: str('priceDescription'),
    ctaText: str('ctaText'),
    ctaSubtext: str('ctaSubtext'),
    guaranteeTitle: str('guaranteeTitle'),
    guaranteeText: str('guaranteeText'),
    heroImageUrl: str('heroImageUrl'),
    heroVideoUrl: str('heroVideoUrl'),
    founderPhotoUrl: str('founderPhotoUrl'),

    eyebrow: str('eyebrow'),
    headline: str('headline'),
    headlineEmphasis: str('headlineEmphasis'),
    headlineSuffix: str('headlineSuffix'),
    subheadline: str('subheadline'),
    audience: str('audience'),
    promise: str('promise'),

    problemHeading: str('problemHeading'),
    problemIntro: str('problemIntro') || str('problemBody'),
    problemScene: str('problemScene'),
    problemPoints,
    problemCost: str('problemCost'),
    problemBody: str('problemBody'),

    originEyebrow: str('originEyebrow'),
    originHeading: str('originHeading'),
    originParagraphs: arr('originParagraphs'),

    whatIsHeading: str('whatIsHeading') || str('solutionHeading'),
    whatIsParagraphs: arr('whatIsParagraphs'),
    solutionHeading: str('solutionHeading') || str('whatIsHeading'),
    solutionBody: str('solutionBody'),

    mechanismEyebrow: str('mechanismEyebrow'),
    mechanismHeading: str('mechanismHeading'),
    mechanismLabel: str('mechanismLabel'),
    mechanismParagraphs: arr('mechanismParagraphs'),
    mechanismPoints: objs('mechanismPoints').map((p) => ({
      title: asString(p.title),
      description: asString(p.description),
    })),

    insideHeading: str('insideHeading') || str('featuresHeading'),
    insideSubheading: str('insideSubheading'),
    insideLead: str('insideLead'),
    insideItems:
      insideItems.length > 0
        ? insideItems
        : features.map((title) => ({
            title,
            description: '',
            tag: '',
            value: '',
            outcome: '',
          })),
    featuresHeading: str('featuresHeading') || str('insideHeading'),
    features:
      features.length > 0
        ? features
        : insideItems.map((i) => i.title).filter(Boolean),

    methodHeading: str('methodHeading'),
    methodSubheading: str('methodSubheading'),
    methodSteps: objs('methodSteps').map((s, i) => ({
      number: typeof s.number === 'number' ? s.number : i + 1,
      title: asString(s.title),
      description: asString(s.description),
      meta: asString(s.meta),
      shift: asString(s.shift),
    })),
    methodCloser: str('methodCloser'),

    oldWayHeading: str('oldWayHeading'),
    oldWayItems: arr('oldWayItems'),
    newWayHeading: str('newWayHeading'),
    newWayItems: arr('newWayItems'),

    proof,
    testimonialsHeading: str('testimonialsHeading', 'What mothers say'),
    testimonials:
      testimonials.length > 0
        ? testimonials
        : proof.map((p) => ({
            quote: p.quote,
            author: p.name,
            role: p.role,
          })),

    bonusesEyebrow: str('bonusesEyebrow'),
    bonusesHeading: str('bonusesHeading'),
    bonusesIntro: str('bonusesIntro'),
    bonusesItems: objs('bonusesItems').map((b) => ({
      title: asString(b.title),
      description: asString(b.description),
      value: asString(b.value),
    })),
    bonusesTotalValue: str('bonusesTotalValue'),
    bonusesCloser: str('bonusesCloser'),

    founderEyebrow: str('founderEyebrow'),
    founderHeading: str('founderHeading'),
    founderGreeting: str('founderGreeting'),
    founderParagraphs: arr('founderParagraphs'),
    founderSignoff: str('founderSignoff'),
    founderPs: str('founderPs'),

    faqHeading: str('faqHeading', 'Questions'),
    faqs,
    finalCtaHeading: str('finalCtaHeading'),
    finalCtaBody: str('finalCtaBody'),

    bumps: objs('bumps').map((b) => ({
      id: asString(b.id),
      title: asString(b.title),
      description: asString(b.description),
      price: asString(b.price),
    })),
  };
}

`;

  const nStart = c.indexOf('export function normalizeSalesPage');
  const nEnd = c.indexOf('export function normalizeVsl');
  if (nStart < 0 || nEnd < 0) throw new Error('normalizeSalesPage markers missing');
  c = c.slice(0, nStart) + norm + c.slice(nEnd);

  fs.writeFileSync(p, c);
  console.log('types.ts expanded');
}

// ---------------------------------------------------------------------------
// 2) Fix fromOffer.ts field names to match Proof/Faq/Bump
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/fromOffer.ts';
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(
    /proof: offer\.proof\.map\(\(p\) => \(\{[\s\S]*?\}\)\)/,
    `proof: offer.proof.map((p) => ({
      name: p.name,
      role: p.role || '',
      quote: p.quote,
      real: p.real !== false,
    }))`,
  );
  c = c.replace(
    /testimonials: offer\.proof\.map\(\(p\) => \(\{[\s\S]*?\}\)\)/,
    `testimonials: offer.proof.map((p) => ({
      quote: p.quote,
      author: p.name,
      role: p.role || '',
    }))`,
  );
  c = c.replace(
    /faqs: offer\.faqs\.map\(\(f\) => \(\{ question: f\.question, answer: f\.answer \}\)\)/,
    `faqs: offer.faqs.map((f) => ({ question: f.q, answer: f.a }))`,
  );
  c = c.replace(
    /bumps: offer\.bumps\.map\(\(b\) => \(\{[\s\S]*?\}\)\)/,
    `bumps: offer.bumps.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      price: b.price,
    }))`,
  );
  // reverse map proof/faqs
  c = c.replace(
    /proof:\s*c\.proof\?\.length > 0[\s\S]*?:\s*\(c\.testimonials \|\| \[\]\)\.map\(\(t\) => \(\{[\s\S]*?\}\)\)/,
    `proof:
      c.proof?.length > 0
        ? c.proof.map((p) => ({
            name: p.name,
            role: p.role || '',
            quote: p.quote,
            real: p.real !== false,
          }))
        : (c.testimonials || []).map((t) => ({
            name: t.author,
            role: t.role || '',
            quote: t.quote,
            real: true,
          }))`,
  );
  c = c.replace(
    /faqs: \(c\.faqs \|\| \[\]\)\.map\(\(f\) => \(\{\s*question: f\.question,\s*answer: f\.answer,\s*\}\)\)/,
    `faqs: (c.faqs || []).map((f) => ({
      q: f.question,
      a: f.answer,
    }))`,
  );
  c = c.replace(
    /bumps: \(c\.bumps \|\| \[\]\)\.map\(\(b\) => \(\{[\s\S]*?\}\)\)/,
    `bumps: (c.bumps || []).map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      price: b.price,
    }))`,
  );
  fs.writeFileSync(p, c);
  console.log('fromOffer.ts field names fixed');
}

// ---------------------------------------------------------------------------
// 3) Defaults from brain-dump offer
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/defaults.ts';
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes("from './fromOffer'") && !c.includes('from "./fromOffer"')) {
    // add import after types import
    c = c.replace(
      /from '\.\/types';/,
      `from './types';\nimport { offerToSalesContent } from './fromOffer';\nimport { brainDump } from '@/lib/mothermode/offers/brain-dump';`,
    );
  }
  const start = c.indexOf('export function defaultMotherModeSalesPage');
  const end = c.indexOf('export function defaultMotherModeVsl');
  if (start < 0 || end < 0) throw new Error('defaults sales markers missing');
  const neu = `export function defaultMotherModeSalesPage(): SalesPageContent {
  // Exact structure + copy from the production Brain Dump offer.
  return offerToSalesContent(brainDump);
}

`;
  c = c.slice(0, start) + neu + c.slice(end);
  fs.writeFileSync(p, c);
  console.log('defaults.ts uses brainDump offer');
}

// ---------------------------------------------------------------------------
// 4) SalesPage: exact MotherMode layout via offer adapter + inline edit overlay
// ---------------------------------------------------------------------------
{
  const page = `'use client';

import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { MotherModeSalesPage } from '@/components/mothermode/MotherModeSalesPage';
import { salesContentToOffer } from '@/lib/mothermode/sales/fromOffer';
import {
  InlineEditPopup,
  SalesEditToolbar,
  useSalesInlineEdit,
  Editable,
} from './inlineEdit';

interface Props {
  funnel: SalesFunnelRecord;
  isAdmin?: boolean;
}

/**
 * Editable sales page that renders the EXACT MotherMode long-form layout
 * (UrgencyBar → Hero → two-column narrative → Inside → Proof → Pricing →
 * Guarantee → FAQ → Founder → Bonus → Final CTA → Footer) while driving
 * every field from funnel.sales JSON.
 *
 * Admins get the floating Edit toolbar. Click any labelled field in the
 * inspector strip below the page (or use admin form tabs) to customize.
 * The visual page itself mirrors production section-for-section.
 */
export default function SalesPage({ funnel, isAdmin = false }: Props) {
  const edit = useSalesInlineEdit(funnel, 'sales', isAdmin);
  const c = edit.draft.sales;

  const offer = salesContentToOffer(c, {
    slug: funnel.offerSlug || funnel.slug || 'offer',
    productId: funnel.productId || undefined,
  });

  // Checkout CTAs inside MotherModeSalesPage go to /mothermode/checkout?offer=
  // For funnel builder we want /funnel/{slug}/checkout. Patch via a thin
  // wrapper: override window navigation is too brittle; instead we set the
  // offer slug and rely on CheckoutButton using ROUTES.checkout.
  // Funnel-specific checkout is linked from the admin toolbar + CTA strip.

  return (
    <div className="relative">
      {/* Production-identical layout */}
      <MotherModeSalesPage offer={offer} />

      {/* Funnel checkout bridge — sticky for buyers coming from this builder path */}
      {!edit.isEditMode && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <a
            href={\`/funnel/\${funnel.slug}/checkout\`}
            className="inline-flex items-center gap-2 rounded-full bg-mode px-6 py-3 text-sm font-semibold text-bone shadow-lg transition-colors hover:bg-mode-deep"
          >
            {c.ctaText || 'Continue to checkout'}
          </a>
        </div>
      )}

      {/* Admin edit chrome */}
      {isAdmin && (
        <>
          <SalesEditToolbar edit={edit} />
          <InlineEditPopup edit={edit} />

          {/* Field inspector — structured editable fields matching the layout */}
          {edit.isEditMode && (
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[45vh] overflow-y-auto border-t border-ink/10 bg-bone/95 p-4 shadow-2xl backdrop-blur">
              <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field edit={edit} field="eyebrow" label="Hero eyebrow" value={c.eyebrow} />
                <Field edit={edit} field="headline" label="Headline" value={c.headline} />
                <Field edit={edit} field="headlineEmphasis" label="Headline emphasis" value={c.headlineEmphasis} />
                <Field edit={edit} field="headlineSuffix" label="Headline suffix" value={c.headlineSuffix} />
                <Field edit={edit} field="subheadline" label="Subheadline" value={c.subheadline} multiline />
                <Field edit={edit} field="audience" label="Audience line" value={c.audience} multiline />
                <Field edit={edit} field="promise" label="Promise" value={c.promise} />
                <Field edit={edit} field="problemHeading" label="Problem heading" value={c.problemHeading} />
                <Field edit={edit} field="problemIntro" label="Problem intro" value={c.problemIntro} multiline />
                <Field edit={edit} field="problemScene" label="Problem scene" value={c.problemScene} multiline />
                <Field edit={edit} field="problemCost" label="Problem cost" value={c.problemCost} multiline />
                <Field edit={edit} field="originHeading" label="Origin heading" value={c.originHeading} />
                <Field edit={edit} field="whatIsHeading" label="What-is heading" value={c.whatIsHeading} />
                <Field edit={edit} field="mechanismHeading" label="Mechanism heading" value={c.mechanismHeading} />
                <Field edit={edit} field="mechanismLabel" label="Mechanism label" value={c.mechanismLabel} />
                <Field edit={edit} field="insideHeading" label="Inside heading" value={c.insideHeading} />
                <Field edit={edit} field="insideSubheading" label="Inside subheading" value={c.insideSubheading} />
                <Field edit={edit} field="methodHeading" label="Method heading" value={c.methodHeading} />
                <Field edit={edit} field="priceLabel" label="Price" value={c.priceLabel} />
                <Field edit={edit} field="originalPriceLabel" label="Original price" value={c.originalPriceLabel} />
                <Field edit={edit} field="ctaText" label="CTA text" value={c.ctaText} />
                <Field edit={edit} field="ctaSubtext" label="CTA subtext" value={c.ctaSubtext} />
                <Field edit={edit} field="guaranteeTitle" label="Guarantee title" value={c.guaranteeTitle} />
                <Field edit={edit} field="guaranteeText" label="Guarantee body" value={c.guaranteeText} multiline />
                <Field edit={edit} field="finalCtaHeading" label="Final CTA heading" value={c.finalCtaHeading} />
                <Field edit={edit} field="finalCtaBody" label="Final CTA body" value={c.finalCtaBody} multiline />
                <Field edit={edit} field="founderHeading" label="Founder heading" value={c.founderHeading} />
                <Field edit={edit} field="bonusesHeading" label="Bonuses heading" value={c.bonusesHeading} />
                <p className="sm:col-span-2 lg:col-span-3 text-xs text-ink/50">
                  Lists (problem points, inside items, FAQs, proof, method steps, bumps) are editable in Admin → Sales Funnels → Sales tab, or via AI generate / Load MotherMode defaults. Saving here writes the full sales JSON block.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  edit,
  field,
  label,
  value,
  multiline,
}: {
  edit: ReturnType<typeof useSalesInlineEdit>;
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-ink/50">
        {label}
      </span>
      {multiline ? (
        <textarea
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode"
          rows={3}
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode"
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      )}
    </label>
  );
}
`;
  fs.writeFileSync('src/components/mothermode/sales/SalesPage.tsx', page);
  console.log('SalesPage.tsx rewritten');
}

// ---------------------------------------------------------------------------
// 5) Export fromOffer from index
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/index.ts';
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    if (!c.includes('fromOffer')) {
      c += `\nexport { offerToSalesContent, salesContentToOffer } from './fromOffer';\n`;
      fs.writeFileSync(p, c);
      console.log('index export added');
    }
  }
}

console.log('done');
