/**
 * Default MotherMode-branded copy for a new optin funnel.
 * Voice: Editorial Warm, design-guide rules (no em dashes, no banned words).
 */
import type {
  OptinFooterContent,
  OptinOtoContent,
  OptinPageContent,
  OptinThankYouContent,
} from './types';

export function defaultMotherModeOptin(): OptinPageContent {
  return {
    eyebrow: 'Free resource',
    headline: 'Get your head back',
    headlineEmphasis: 'before',
    headlineSuffix: 'the week runs you.',
    subheadline:
      'A clear, printable system for unloading the mental load so you can see what is actually on your plate and what can come off it.',
    audience: 'For mothers who are done running an operating system they did not choose.',
    benefits: [
      'Name everything living rent-free in your head in under 20 minutes',
      'Sort what only you can do from what can move',
      'Walk away with a one-page map you can reuse every week',
    ],
    ctaText: 'Send me the system',
    badgeText: 'Free · Instant access',
    magnetTitle: 'The Brain Dump Starter',
    magnetDescription:
      'A short, brand-styled guide plus the printable template. No fluff. Just the first cut.',
    coverImageUrl: '',
    heroVideoUrl: '',
    emailPlaceholder: 'you@email.com',
    namePlaceholder: 'First name',
    collectName: true,
    privacyNote: 'No spam. Unsubscribe anytime. Your email stays private.',
  };
}

export function defaultMotherModeOto(): OptinOtoContent {
  return {
    enabled: true,
    eyebrow: 'One-time offer',
    headline: 'Want the full pack while you are here?',
    subheadline:
      'Upgrade from the free starter to the complete Brain Dump System. The same method, fully built out, with the weekly reset and partner scripts.',
    bullets: [
      'Full Brain Dump System (the paid resource pack)',
      'Weekly Reset worksheet + load map',
      'Partner scripts so the conversation is structural, not personal',
    ],
    priceLabel: '$27',
    originalPriceLabel: '$47',
    ctaYes: 'Yes, give me the full system',
    ctaNo: 'No thanks, just the free starter',
    yesHref: '/mothermode/brain-dump',
    timerMinutes: 15,
    imageUrl: '',
    videoUrl: '',
  };
}

export function defaultMotherModeThankYou(): OptinThankYouContent {
  return {
    headline: 'Check your inbox.',
    subheadline:
      'Your starter is on its way. While you wait, take the next step into the full redesign.',
    ctaText: 'See the full system',
    ctaHref: '/mothermode/brain-dump',
    secondaryNote: 'It can take a minute. Check spam if you do not see it.',
  };
}

export function defaultMotherModeFooter(): OptinFooterContent {
  return {
    enabled: true,
    brandLine: 'MotherMode',
    disclaimer:
      'This page may contain affiliate links. We may earn a commission if you purchase through them. Results are not guaranteed and are based on individual effort.',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Contact', href: '/contact' },
    ],
    copyright: `© ${new Date().getFullYear()} MotherMode. All rights reserved.`,
  };
}
