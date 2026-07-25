const fs = require('fs');

// 1) blankSalesPage full shape
{
  const p = 'src/lib/mothermode/sales/types.ts';
  let c = fs.readFileSync(p, 'utf8');
  const start = c.indexOf('export function blankSalesPage');
  const end = c.indexOf('export function blankVslPage');
  if (start < 0 || end < 0) throw new Error('markers missing blankSalesPage');
  const neu = `export function blankSalesPage(): SalesPageContent {
  return {
    name: '',
    tagline: '',
    category: '',
    priceCents: 0,
    originalPriceCents: 0,
    priceLabel: '',
    originalPriceLabel: '',
    priceDescription: '',
    ctaText: 'Get instant access',
    ctaSubtext: '',
    guaranteeTitle: '',
    guaranteeText: '',
    heroImageUrl: '',
    heroVideoUrl: '',
    founderPhotoUrl: '',

    eyebrow: '',
    headline: '',
    headlineEmphasis: '',
    headlineSuffix: '',
    subheadline: '',
    audience: '',
    promise: '',

    problemHeading: '',
    problemIntro: '',
    problemScene: '',
    problemPoints: [],
    problemCost: '',
    problemBody: '',

    originEyebrow: '',
    originHeading: '',
    originParagraphs: [],

    whatIsHeading: '',
    whatIsParagraphs: [],
    solutionHeading: '',
    solutionBody: '',

    mechanismEyebrow: '',
    mechanismHeading: '',
    mechanismLabel: '',
    mechanismParagraphs: [],
    mechanismPoints: [],

    insideHeading: '',
    insideSubheading: '',
    insideLead: '',
    insideItems: [],
    featuresHeading: '',
    features: [],

    methodHeading: '',
    methodSubheading: '',
    methodSteps: [],
    methodCloser: '',

    oldWayHeading: '',
    oldWayItems: [],
    newWayHeading: '',
    newWayItems: [],

    proof: [],
    testimonialsHeading: '',
    testimonials: [],

    bonusesEyebrow: '',
    bonusesHeading: '',
    bonusesIntro: '',
    bonusesItems: [],
    bonusesTotalValue: '',
    bonusesCloser: '',

    founderEyebrow: '',
    founderHeading: '',
    founderGreeting: '',
    founderParagraphs: [],
    founderSignoff: '',
    founderPs: '',

    faqHeading: '',
    faqs: [],
    finalCtaHeading: '',
    finalCtaBody: '',

    bumps: [],
  };
}

`;
  c = c.slice(0, start) + neu + c.slice(end);
  fs.writeFileSync(p, c);
  console.log('blankSalesPage fixed');
}

// 2) fromOffer bonuses + icons
{
  const p = 'src/lib/mothermode/sales/fromOffer.ts';
  let c = fs.readFileSync(p, 'utf8');

  if (!c.includes("from 'lucide-react'")) {
    c = c.replace(
      "import type { MotherModeOffer } from '@/lib/mothermode/types';",
      "import type { MotherModeOffer } from '@/lib/mothermode/types';\nimport { Gift, Sparkles } from 'lucide-react';"
    );
  }

  // Fix bonuses items mapping: value must be string, icon must be LucideIcon
  c = c.replace(
    /items: \(c\.bonusesItems \|\| \[\]\)\.map\(\(b\) => \(\{[\s\S]*?\}\)\)\,/,
    `items: (c.bonusesItems || []).map((b) => ({
              title: b.title,
              description: b.description,
              value: b.value || '',
              icon: Gift,
            })),`
  );

  // Replace remaining undefined icons with Sparkles
  c = c.replace(/icon: undefined as any,/g, 'icon: Sparkles,');

  fs.writeFileSync(p, c);
  console.log('fromOffer icons fixed');
}
