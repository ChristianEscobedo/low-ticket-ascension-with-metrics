/**
 * MotherMode Sales Funnel default starter copy.
 * Editorial Warm voice (bone / ink / mode / brass) — same as the optin funnel.
 * These are the "Load MotherMode defaults" starting points for each block.
 */
import type {
  SalesOptinContent,
  SalesPageContent,
  VslPageContent,
  CheckoutContent,
  UpsellContent,
  SuccessContent,
  AccessContent,
  SalesFooterContent,
} from './types';
import { offerToSalesContent } from './fromOffer';
import { ascensionToUpsellContent } from './fromAscension';
import { brainDump } from '@/lib/mothermode/offers/brain-dump';
import {
  mothermodeOS,
  osAnnualUpgrade,
  redesignVault,
  motherModeCoaching,
} from '@/lib/mothermode/ascension';

export function defaultMotherModeSalesOptin(): SalesOptinContent {
  return {
    eyebrow: 'Free Starter Kit',
    headline: 'The system that turns',
    headlineEmphasis: 'mental overload',
    headlineSuffix: 'into momentum.',
    subheadline:
      'If your brain feels like a browser with 47 tabs open, this is the 20-minute unload that shows you exactly what can come off your plate.',
    audience: 'For the parent, founder, or human who is tired of carrying it all.',
    benefits: [
      'Unload your head in 20 minutes flat',
      'See what is actually urgent vs. just loud',
      'Find the one thing you can delegate this week',
      'Walk away lighter, clearer, and with a plan',
    ],
    ctaText: 'Send me the starter',
    badgeText: 'Free',
    magnetTitle: 'The Brain Dump Starter',
    magnetDescription:
      'A one-page printable + a 5-minute audio walkthrough. No fluff, no 40-page PDF you will never read.',
    coverImageUrl: '',
    heroVideoUrl: '',
    emailPlaceholder: 'you@email.com',
    namePlaceholder: 'First name',
    collectName: true,
    privacyNote: 'No spam. Unsubscribe anytime. Your email stays private.',
  };
}

export function defaultMotherModeSalesPage(): SalesPageContent {
  // Exact structure + copy from the production Brain Dump offer.
  return offerToSalesContent(brainDump);
}

export function defaultMotherModeVsl(): VslPageContent {
  return {
    eyebrow: 'Watch this first',
    headline: 'The 12-minute video that will change how you carry the load',
    subheadline:
      'Before you buy anything, watch this. It explains the system, why it works, and what to do first.',
    videoUrl: '',
    ctaRevealSeconds: 420,
    ctaText: 'Get the full system',
    ctaHref: '',
    bullets: [
      'Why the mental load is invisible — and how to make it visible',
      'The 3-bucket sort that takes 20 minutes and changes everything',
      'The one conversation that redistributes the load overnight',
    ],
    stickyPlayer: true,
    autoplay: false,
  };
}

export function defaultMotherModeCheckout(): CheckoutContent {
  return {
    eyebrow: 'Secure checkout',
    headline: 'Complete your order',
    subheadline: 'The Brain Dump System is one payment away.',
    priceLabel: '$7',
    priceCents: 700,
    stripePriceId: '',
    productName: 'The Brain Dump System',
    productId: 'mm_brain_dump_system',
    productImageUrl: '',
    bullets: [
      'The Brain Dump Template',
      'The Sorting Pass',
      'The Delegate Scripts',
      'The Weekly Reset',
      'The Load Map',
      'Instant access after purchase',
    ],
    ctaText: 'Buy now — $7',
    guaranteeText: '14-day money-back guarantee. If it does not lighten your load, we refund you.',
    paymentType: 'one_time',
    trialDays: 0,
    timerLabel: 'Founding price held for:',
    brandLabel: 'MOTHERMODE',
  };
}

export function defaultMotherModeUpsell1(): UpsellContent {
  return ascensionToUpsellContent(mothermodeOS, { enabled: true });
}


export function defaultMotherModeUpsell2(): UpsellContent {
  return ascensionToUpsellContent(osAnnualUpgrade, { enabled: true });
}


export function defaultMotherModeUpsell3(): UpsellContent {
  return ascensionToUpsellContent(redesignVault, { enabled: true });
}


export function defaultMotherModeUpsell4(): UpsellContent {
  return ascensionToUpsellContent(motherModeCoaching, { enabled: true });
}


export function defaultMotherModeSuccess(): SuccessContent {
  return {
    headline: "You're in. Here's what happens next.",
    subheadline: 'Check your email for the receipt. Your access is ready below.',
    purchaseSummary: 'The Brain Dump System — $27',
    inboxNote:
      'Check your inbox for the receipt and login. If it is not there in a minute, check spam.',
    deliverySectionHeading: 'What is now yours',
    deliverySectionIntro: 'Open any card below, or go straight to your full access hub.',
    deliveryCards: [
      {
        title: 'Start the system',
        description: 'Watch the 5-minute walkthrough and do your first Brain Dump.',
        href: '',
        icon: 'play',
      },
      {
        title: 'Download the tools',
        description: 'All 5 printables + audio files. Print or save to your phone.',
        href: '',
        icon: 'download',
      },
      {
        title: 'Join the community',
        description: 'Private group of people doing the weekly Brain Dump together.',
        href: '',
        icon: 'users',
      },
    ],
    nextEyebrow: 'What comes next',
    nextHeading: 'This is the first room of the redesign.',
    nextBody:
      'Use what you just unlocked. When you are ready for the full system, your access hub is where everything lives.',
    ctaText: 'Go to my access',
    ctaHref: '',
    supportEmail: 'support@mothermode.com',
    secondaryNote: 'Need help? Reply to your receipt email or contact support.',
  };
}

export function defaultMotherModeAccess(): AccessContent {
  return {
    headline: 'Welcome to your members area',
    subheadline: 'Everything you bought is here. Start with step 1.',
    badgeText: 'Members area',
    onboardingEyebrow: 'Start here',
    onboardingHeading: 'Your first three moves',
    onboardingItems: [
      {
        title: 'Watch the welcome video',
        description: '2-minute orientation — what to do first.',
        href: '',
      },
      {
        title: 'Do your first Brain Dump',
        description: '20 minutes. Print the printable, press play on the audio.',
        href: '',
      },
      {
        title: 'Join the community',
        description: 'Introduce yourself. Say what you are offloading this week.',
        href: '',
      },
    ],
    libraryEyebrow: 'Your library',
    libraryHeading: 'Everything included',
    libraryIntro: 'Open any resource below. Bookmark this page — it is your home base.',
    deliveryLinks: [
      {
        label: 'Brain Dump printable + audio',
        href: '',
        description: 'The core 20-minute weekly protocol.',
      },
      {
        label: 'Sorting Pass tool',
        href: '',
        description: 'Urgent vs. important vs. delegate.',
      },
      {
        label: 'Weekly Reset checklist',
        href: '',
        description: 'Close every loop before Monday.',
      },
      {
        label: 'Load Map template',
        href: '',
        description: 'See who carries what in your household.',
      },
      {
        label: 'Delegate Scripts',
        href: '',
        description: 'Word-for-word asks that work.',
      },
      {
        label: 'Partner Scripts Plus',
        href: '',
        description: 'Conversations that redistribute the load.',
      },
    ],
    welcomeVideoUrl: '',
    communityHref: '',
    communityLabel: 'Join the community',
    communityBody:
      'Meet the people doing this with you. Introduce yourself and say what you are offloading this week.',
    supportHeading: 'Need a hand?',
    supportBody: 'Questions about access, downloads, or your order — we are here.',
    supportEmail: 'support@mothermode.com',
  };
}

export function defaultMotherModeSalesFooter(): SalesFooterContent {
  return {
    enabled: true,
    brandLine: 'MotherMode',
    disclaimer:
      'This page may contain affiliate links. We may earn a commission if you purchase through them. Results are not guaranteed.',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Contact', href: '/contact' },
    ],
    copyright: `© ${new Date().getFullYear()} MotherMode. All rights reserved.`,
  };
}