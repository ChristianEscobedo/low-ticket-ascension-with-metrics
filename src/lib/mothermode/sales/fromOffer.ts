/**
 * Map a MotherModeOffer (the production sales-page source of truth) into the
 * funnel builder's editable SalesPageContent shape — and back.
 *
 * This is how the builder stays pixel-structure-aligned with
 * MotherModeSalesPage while remaining fully customizable per funnel.
 */
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { Gift, Sparkles } from 'lucide-react';
import type { SalesPageContent } from './types';
import { BRAND, FOUNDER } from '@/lib/mothermode/brand';

/** Convert a catalog offer into editable funnel sales content. */
export function offerToSalesContent(offer: MotherModeOffer): SalesPageContent {
  return {
    // Identity / pricing
    name: offer.name,
    tagline: offer.tagline,
    category: offer.category,
    priceCents: offer.priceCents,
    originalPriceCents: offer.originalPriceCents,
    priceLabel: formatCents(offer.priceCents),
    originalPriceLabel: formatCents(offer.originalPriceCents),
    priceDescription: 'One-time payment. Instant access. No subscription.',
    ctaText: `Get ${offer.name}`,
    ctaSubtext: offer.hero.promise || 'Instant access.',
    guaranteeText: offer.guarantee?.body || '',
    guaranteeTitle: offer.guarantee?.title || '',
    heroImageUrl: offer.media?.mockup || '',
    heroVideoUrl: offer.media?.vslPoster || '',
    founderPhotoUrl: offer.media?.founderPhoto || '',

    // Hero
    eyebrow: offer.hero.eyebrow,
    headline: offer.hero.headline,
    headlineEmphasis: offer.hero.headlineEmphasis,
    headlineSuffix: offer.hero.headlineSuffix || '',
    subheadline: offer.hero.subheadline,
    audience: offer.hero.audience || '',
    promise: offer.hero.promise || '',

    // Problem
    problemHeading: offer.problem.heading,
    problemIntro: offer.problem.intro,
    problemScene: offer.problem.scene || '',
    problemPoints: offer.problem.points || [],
    problemCost: offer.problem.cost || '',
    // legacy flat fields (kept for older funnels / simple editors)
    problemBody: [offer.problem.intro, offer.problem.scene, offer.problem.cost]
      .filter(Boolean)
      .join('\n\n'),

    // Origin
    originEyebrow: offer.origin?.eyebrow || '',
    originHeading: offer.origin?.heading || '',
    originParagraphs: offer.origin?.paragraphs || [],

    // What is
    whatIsHeading: offer.whatIs.heading,
    whatIsParagraphs: offer.whatIs.paragraphs || [],
    solutionHeading: offer.whatIs.heading,
    solutionBody: (offer.whatIs.paragraphs || []).join('\n\n'),

    // Mechanism
    mechanismEyebrow: offer.mechanism?.eyebrow || '',
    mechanismHeading: offer.mechanism?.heading || '',
    mechanismLabel: offer.mechanism?.label || '',
    mechanismParagraphs: offer.mechanism?.paragraphs || [],
    mechanismPoints: (offer.mechanism?.points || []).map((p) => ({
      title: p.title,
      description: p.description,
    })),

    // Inside
    insideHeading: offer.inside.heading,
    insideSubheading: offer.inside.subheading,
    insideLead: offer.inside.lead || '',
    insideItems: offer.inside.items.map((item) => ({
      title: item.title,
      description: item.description,
      tag: item.tag || '',
      value: item.value || '',
      outcome: item.outcome || '',
    })),
    featuresHeading: offer.inside.heading,
    features: offer.inside.items.map((i) => i.title),

    // Method
    methodHeading: offer.method.heading,
    methodSubheading: offer.method.subheading || '',
    methodSteps: offer.method.steps.map((s) => ({
      number: s.number,
      title: s.title,
      description: s.description,
      meta: s.meta || '',
      shift: s.shift || '',
    })),
    methodCloser: offer.method.closer || '',

    // Old vs new
    oldWayHeading: offer.oldWay.heading,
    oldWayItems: offer.oldWay.items || [],
    newWayHeading: offer.newWay.heading,
    newWayItems: offer.newWay.items || [],

    // Proof
    proof: offer.proof.map((p) => ({
      name: p.name,
      role: p.role || '',
      quote: p.quote,
      real: p.real !== false,
    })),
    testimonialsHeading:
      (offer as { testimonialsHeading?: string }).testimonialsHeading ||
      'Mothers who put some of it down.',
    testimonials: offer.proof.map((p) => ({
      quote: p.quote,
      author: p.name,
      role: p.role || '',
    })),

    // Bonuses
    bonusesEyebrow: offer.bonuses?.eyebrow || '',
    bonusesHeading: offer.bonuses?.heading || '',
    bonusesIntro: offer.bonuses?.intro || '',
    bonusesItems: (offer.bonuses?.items || []).map((b) => ({
      title: b.title,
      description: b.description,
      value: b.value || '',
    })),
    bonusesTotalValue: offer.bonuses?.totalValue || '',
    bonusesCloser: offer.bonuses?.closer || '',

    // Founder letter
    founderEyebrow: offer.founderLetter?.eyebrow || '',
    founderHeading: offer.founderLetter?.heading || '',
    founderGreeting: offer.founderLetter?.greeting || '',
    founderParagraphs: offer.founderLetter?.paragraphs || [],
    founderSignoff: offer.founderLetter?.signoff || '',
    founderPs: offer.founderLetter?.ps || '',

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
    founderRole: FOUNDER.role,

    // FAQ / final
    faqHeading:
      (offer as { faqHeading?: string }).faqHeading ||
      'The questions mothers ask first.',
    faqs: offer.faqs.map((f) => ({ question: f.q, answer: f.a })),
    finalCtaHeading: offer.finalCta.heading,
    finalCtaBody: offer.finalCta.body,

    // Bumps (shown on sales sidebar / checkout context)
    bumps: offer.bumps.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      price: b.price,
    })),
  };
}

/**
 * Build a MotherModeOffer-shaped object from funnel sales content so we can
 * reuse the exact production section components (Hero, Narrative, etc.).
 */
export function salesContentToOffer(
  content: SalesPageContent,
  opts: { slug: string; productId?: string },
): MotherModeOffer {
  const c = content;
  const offer = {
    slug: opts.slug,
    productId: opts.productId || `funnel_${opts.slug}`,
    category: c.category || 'MotherMode',
    name: c.name || 'Offer',
    tagline: c.tagline || c.subheadline || '',
    ready: true,
    // Funnel-only extras read by MmEditable sections / CheckoutButton
    ctaLabel: c.ctaText || `Get ${c.name || 'access'}`,
    pricingEyebrow: c.priceDescription || '',
    faqHeading: c.faqHeading || 'The questions mothers ask first.',
    testimonialsHeading:
      c.testimonialsHeading || 'Mothers who put some of it down.',
    urgencyText: c.ctaSubtext || 'Founding price, for the first 100 mothers.',
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
    originalPriceLabel: c.originalPriceLabel || '',
    priceCents: c.priceCents || parsePriceLabel(c.priceLabel),

    originalPriceCents:
      c.originalPriceCents || parsePriceLabel(c.originalPriceLabel),

    media: {
      vslPoster: c.heroVideoUrl || undefined,
      mockup: c.heroImageUrl || undefined,
      founderPhoto: c.founderPhotoUrl || undefined,
    },
    hero: {
      eyebrow: c.eyebrow,
      headline: c.headline,
      headlineEmphasis: c.headlineEmphasis,
      headlineSuffix: c.headlineSuffix || undefined,
      subheadline: c.subheadline,
      audience: c.audience || undefined,
      promise: c.promise || c.ctaSubtext || '',
    },
    problem: {
      heading: c.problemHeading,
      intro: c.problemIntro || c.problemBody || '',
      scene: c.problemScene || undefined,
      points:
        c.problemPoints?.length > 0
          ? c.problemPoints
          : splitBody(c.problemBody),
      cost: c.problemCost || undefined,
    },
    origin:
      c.originHeading || c.originParagraphs?.length
        ? {
            eyebrow: c.originEyebrow || 'Why we built this',
            heading: c.originHeading || '',
            paragraphs: c.originParagraphs || [],
          }
        : undefined,
    whatIs: {
      heading: c.whatIsHeading || c.solutionHeading || '',
      paragraphs:
        c.whatIsParagraphs?.length > 0
          ? c.whatIsParagraphs
          : splitBody(c.solutionBody),
    },
    mechanism:
      c.mechanismHeading || c.mechanismParagraphs?.length
        ? {
            eyebrow: c.mechanismEyebrow || 'Why it works',
            heading: c.mechanismHeading || '',
            label: c.mechanismLabel || '',
            paragraphs: c.mechanismParagraphs || [],
            points: c.mechanismPoints || [],
          }
        : undefined,
    inside: {
      heading: c.insideHeading || c.featuresHeading || 'What is inside',
      subheading: c.insideSubheading || '',
      lead: c.insideLead || undefined,
      items:
        c.insideItems?.length > 0
          ? c.insideItems.map((item, i) => ({
              title: item.title,
              description: item.description,
              tag: item.tag || undefined,
              value: item.value || undefined,
              outcome: item.outcome || undefined,
              // icon is required on InsideItem in some paths — sections tolerate missing via fallback
              icon: 'Sparkles',
              resourceKey: undefined,
            }))
          : (c.features || []).map((title) => ({
              title,
              description: '',
              icon: 'Sparkles',
            })),
    },
    method: {
      heading: c.methodHeading || 'How it works',
      subheading: c.methodSubheading || undefined,
      steps: (c.methodSteps || []).map((s, i) => ({
        number: s.number || i + 1,
        title: s.title,
        description: s.description,
        meta: s.meta || undefined,
        shift: s.shift || undefined,
        icon: 'Sparkles',
      })),
      closer: c.methodCloser || undefined,
    },
    oldWay: {
      heading: c.oldWayHeading || 'The old way',
      items: c.oldWayItems || [],
    },
    newWay: {
      heading: c.newWayHeading || 'The new way',
      items: c.newWayItems || [],
    },
    bonuses:
      c.bonusesHeading || c.bonusesItems?.length
        ? {
            eyebrow: c.bonusesEyebrow || 'Bonuses',
            heading: c.bonusesHeading || '',
            intro: c.bonusesIntro || undefined,
            items: (c.bonusesItems || []).map((b) => ({
              title: b.title,
              description: b.description,
              value: b.value || '',
              icon: 'Gift',
            })),
            totalValue: c.bonusesTotalValue || undefined,
            closer: c.bonusesCloser || undefined,
          }
        : undefined,
    founderLetter:
      c.founderHeading || c.founderParagraphs?.length
        ? {
            eyebrow: c.founderEyebrow || 'A note from the founder',
            heading: c.founderHeading || '',
            greeting: c.founderGreeting || undefined,
            paragraphs: c.founderParagraphs || [],
            signoff: c.founderSignoff || '',
            ps: c.founderPs || undefined,
          }
        : undefined,
    proof:
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
          })),
    bumps: (c.bumps || []).map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      price: b.price,
    })),
    faqs: (c.faqs || []).map((f) => ({
      q: f.question,
      a: f.answer,
    })),
    guarantee: {
      title: c.guaranteeTitle || 'Guarantee',
      body: c.guaranteeText || '',
    },
    finalCta: {
      heading: c.finalCtaHeading || c.ctaText || '',
      body: c.finalCtaBody || c.ctaSubtext || '',
    },
  };
  return offer as MotherModeOffer;
}


function formatCents(cents: number): string {
  if (!cents && cents !== 0) return '';
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function parsePriceLabel(label: string): number {
  if (!label) return 0;
  const n = Number(String(label).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function splitBody(body: string): string[] {
  if (!body) return [];
  return body
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
