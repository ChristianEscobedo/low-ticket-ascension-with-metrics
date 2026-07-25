/**
 * Map MotherMode AscensionOffer (production OTO source of truth) into the
 * funnel builder's editable UpsellContent — and back into AscensionOffer so
 * MotherModeUpsellPage can render the exact production layout.
 *
 * Icons are re-attached on the way back (Sparkles default) because Lucide
 * components cannot round-trip through JSONB.
 */
import type { AscensionOffer, AscensionFeature, AscensionShot } from '@/lib/mothermode/ascension';
import { Sparkles } from 'lucide-react';
import type { UpsellContent, UpsellFeatureContent, UpsellShotContent } from './types';

/** Convert a production ascension offer into editable funnel upsell content. */
export function ascensionToUpsellContent(
  offer: AscensionOffer,
  opts?: { enabled?: boolean },
): UpsellContent {
  return {
    enabled: opts?.enabled !== false,
    // Identity / pricing
    productId: offer.productId,
    billingType: offer.billingType,
    interval: offer.interval || '',
    priceCents: offer.priceCents,
    priceLabel: offer.priceLabel,
    originalPriceLabel: offer.originalPriceLabel,
    metadataType: offer.metadataType,
    pageType: offer.pageType,
    stripePriceId: '',
    productName: offer.headline,
    paymentType: offer.billingType === 'subscription' ? 'subscription' : 'one_time',

    // Timer
    timerLabel: offer.timerLabel,
    timerMinutes: offer.timerMinutes,

    // Media
    mediaVideo: Boolean(offer.media?.video),
    mediaVideoPoster: offer.media?.videoPoster || '',
    galleryEyebrow: offer.media?.galleryEyebrow || '',
    galleryAspect: offer.media?.galleryAspect || '',
    gallery: (offer.media?.gallery || []).map(shotToContent),
    imageUrl: '',
    videoUrl: '',

    // Copy
    eyebrow: offer.eyebrow,
    headline: offer.headline,
    headlineEmphasis: offer.headlineEmphasis,
    headlineSuffix: offer.headlineSuffix || '',
    subheadline: offer.subheadline,
    letter: offer.letter || [],
    bullets: (offer.features || []).map((f) => f.title),

    // Value stack
    stackEyebrow: offer.stackEyebrow,
    stackHeading: offer.stackHeading,
    features: (offer.features || []).map(featureToContent),
    totalValueLabel: offer.totalValueLabel,
    bigIdea: offer.bigIdea,

    // CTAs / guarantee
    ctaYes: offer.acceptLabel,
    ctaNo: offer.declineLabel,
    yesHref: '',
    guaranteeTitle: offer.guarantee?.title || '',
    guaranteeBody: offer.guarantee?.body || '',
  };
}

/**
 * Build an AscensionOffer-shaped object from funnel upsell content so we can
 * reuse MotherModeUpsellPage section-for-section.
 */
export function upsellContentToAscension(
  content: UpsellContent,
  opts?: { productIdFallback?: string; pageTypeFallback?: string },
): AscensionOffer {
  const c = content;
  const features: AscensionFeature[] =
    c.features?.length > 0
      ? c.features.map((f) => ({
          title: f.title,
          description: f.description,
          value: f.value || '',
          icon: 'Sparkles',
          core: Boolean(f.core),
        }))
      : (c.bullets || []).map((title) => ({
          title,
          description: '',
          value: '',
          icon: 'Sparkles',
        }));

  const gallery: AscensionShot[] = (c.gallery || []).map((s) => ({
    src: s.src || undefined,
    alt: s.alt || '',
    caption: s.caption || undefined,
    hint: s.hint || undefined,
  }));

  const billingType =
    c.billingType === 'subscription' || c.paymentType === 'subscription'
      ? 'subscription'
      : 'one_time';

  return {
    productId: c.productId || opts?.productIdFallback || 'funnel_upsell',
    billingType,
    interval:
      c.interval === 'yearly' || c.interval === 'monthly'
        ? c.interval
        : billingType === 'subscription'
          ? 'monthly'
          : undefined,
    priceCents: c.priceCents || 0,
    priceLabel: c.priceLabel || '',
    originalPriceLabel: c.originalPriceLabel || '',
    metadataType: c.metadataType || 'mothermode_upsell',
    pageType: c.pageType || opts?.pageTypeFallback || 'oto',
    timerLabel: c.timerLabel || 'This offer is held while this page is open',
    timerMinutes: c.timerMinutes || 15,
    media:
      c.mediaVideo || gallery.length > 0 || c.galleryEyebrow
        ? {
            video: c.mediaVideo || undefined,
            videoPoster: c.mediaVideoPoster || undefined,
            galleryEyebrow: c.galleryEyebrow || undefined,
            gallery: gallery.length > 0 ? gallery : undefined,
            galleryAspect: c.galleryAspect || undefined,
          }
        : undefined,
    eyebrow: c.eyebrow || '',
    headline: c.headline || '',
    headlineEmphasis: c.headlineEmphasis || '',
    headlineSuffix: c.headlineSuffix || undefined,
    subheadline: c.subheadline || '',
    letter: c.letter?.length ? c.letter : c.subheadline ? [c.subheadline] : [],
    stackEyebrow: c.stackEyebrow || 'What you get',
    stackHeading: c.stackHeading || c.productName || 'This offer',
    features,
    totalValueLabel: c.totalValueLabel || '',
    bigIdea: c.bigIdea || '',
    acceptLabel: c.ctaYes || 'Yes, add this',
    declineLabel: c.ctaNo || 'No thanks',
    guarantee: {
      title: c.guaranteeTitle || 'Guarantee',
      body: c.guaranteeBody || '',
    },
  };
}

function featureToContent(f: AscensionFeature): UpsellFeatureContent {
  return {
    title: f.title,
    description: f.description,
    value: f.value || '',
    core: Boolean(f.core),
  };
}

function shotToContent(s: AscensionShot): UpsellShotContent {
  return {
    src: s.src || '',
    alt: s.alt || '',
    caption: s.caption || '',
    hint: s.hint || '',
  };
}
