const fs = require('fs');

function patchFile(file, mutator) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.replace(/\r\n/g, '\n');
  const next = mutator(t);
  if (next === t) {
    console.error('NO CHANGE in', file);
    process.exit(1);
  }
  fs.writeFileSync(file, crlf ? next.replace(/\n/g, '\r\n') : next);
  console.log('ok', file);
}

function replaceOnce(src, oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error('FAIL missing:', label);
    process.exit(1);
  }
  return src.replace(oldStr, newStr);
}

patchFile('src/lib/mothermode/sales/types.ts', (t) => {
  t = replaceOnce(
    t,
    `export interface SuccessContent {
  headline: string;
  subheadline: string;
  purchaseSummary: string;
  deliveryCards: { title: string; description: string; href: string; icon: string }[];
  ctaText: string;
  ctaHref: string;
  supportEmail: string;
  secondaryNote: string;
}`,
    `export interface SuccessContent {
  headline: string;
  subheadline: string;
  purchaseSummary: string;
  inboxNote: string;
  deliverySectionHeading: string;
  deliverySectionIntro: string;
  deliveryCards: { title: string; description: string; href: string; icon: string }[];
  nextEyebrow: string;
  nextHeading: string;
  nextBody: string;
  ctaText: string;
  ctaHref: string;
  supportEmail: string;
  secondaryNote: string;
}`,
    'SuccessContent',
  );

  t = replaceOnce(
    t,
    `export interface AccessContent {
  headline: string;
  subheadline: string;
  onboardingItems: { title: string; description: string; href: string }[];
  deliveryLinks: { label: string; href: string; description: string }[];
  welcomeVideoUrl: string;
  communityHref: string;
  communityLabel: string;
  supportEmail: string;
}`,
    `export interface AccessContent {
  headline: string;
  subheadline: string;
  badgeText: string;
  onboardingEyebrow: string;
  onboardingHeading: string;
  onboardingItems: { title: string; description: string; href: string }[];
  libraryEyebrow: string;
  libraryHeading: string;
  libraryIntro: string;
  deliveryLinks: { label: string; href: string; description: string }[];
  welcomeVideoUrl: string;
  communityHref: string;
  communityLabel: string;
  communityBody: string;
  supportHeading: string;
  supportBody: string;
  supportEmail: string;
}`,
    'AccessContent',
  );

  t = replaceOnce(
    t,
    `export function normalizeSuccess(raw: unknown): SuccessContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    headline: asString(o.headline, "You're in. Here's what happens next."),
    subheadline: asString(o.subheadline),
    purchaseSummary: asString(o.purchaseSummary),
    deliveryCards: asObjectArray(o.deliveryCards).map((c) => ({
      title: asString(c.title),
      description: asString(c.description),
      href: asString(c.href),
      icon: asString(c.icon, 'check'),
    })),
    ctaText: asString(o.ctaText, 'Go to my access'),
    ctaHref: asString(o.ctaHref),
    supportEmail: asString(o.supportEmail, 'support@mothermode.com'),
    secondaryNote: asString(o.secondaryNote),
  };
}`,
    `export function normalizeSuccess(raw: unknown): SuccessContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    headline: asString(o.headline, "You're in. Here's what happens next."),
    subheadline: asString(o.subheadline),
    purchaseSummary: asString(o.purchaseSummary),
    inboxNote: asString(
      o.inboxNote,
      'Check your inbox for the receipt and login. If it is not there in a minute, check spam.',
    ),
    deliverySectionHeading: asString(o.deliverySectionHeading, 'What is now yours'),
    deliverySectionIntro: asString(
      o.deliverySectionIntro,
      'Open any card below, or go straight to your full access hub.',
    ),
    deliveryCards: asObjectArray(o.deliveryCards).map((c) => ({
      title: asString(c.title),
      description: asString(c.description),
      href: asString(c.href),
      icon: asString(c.icon, 'check'),
    })),
    nextEyebrow: asString(o.nextEyebrow, 'What comes next'),
    nextHeading: asString(o.nextHeading, 'This is the first room of the redesign.'),
    nextBody: asString(
      o.nextBody,
      'Use what you just unlocked. When you are ready for the full system, your access hub is where everything lives.',
    ),
    ctaText: asString(o.ctaText, 'Go to my access'),
    ctaHref: asString(o.ctaHref),
    supportEmail: asString(o.supportEmail, 'support@mothermode.com'),
    secondaryNote: asString(o.secondaryNote),
  };
}`,
    'normalizeSuccess',
  );

  t = replaceOnce(
    t,
    `export function normalizeAccess(raw: unknown): AccessContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    headline: asString(o.headline, 'Welcome to your members area'),
    subheadline: asString(o.subheadline),
    onboardingItems: asObjectArray(o.onboardingItems).map((i) => ({
      title: asString(i.title),
      description: asString(i.description),
      href: asString(i.href),
    })),
    deliveryLinks: asObjectArray(o.deliveryLinks).map((l) => ({
      label: asString(l.label),
      href: asString(l.href),
      description: asString(l.description),
    })),
    welcomeVideoUrl: asString(o.welcomeVideoUrl),
    communityHref: asString(o.communityHref),
    communityLabel: asString(o.communityLabel, 'Join the community'),
    supportEmail: asString(o.supportEmail, 'support@mothermode.com'),
  };
}`,
    `export function normalizeAccess(raw: unknown): AccessContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    headline: asString(o.headline, 'Welcome to your members area'),
    subheadline: asString(o.subheadline),
    badgeText: asString(o.badgeText, 'Members area'),
    onboardingEyebrow: asString(o.onboardingEyebrow, 'Start here'),
    onboardingHeading: asString(o.onboardingHeading, 'Your first three moves'),
    onboardingItems: asObjectArray(o.onboardingItems).map((i) => ({
      title: asString(i.title),
      description: asString(i.description),
      href: asString(i.href),
    })),
    libraryEyebrow: asString(o.libraryEyebrow, 'Your library'),
    libraryHeading: asString(o.libraryHeading, 'Everything included'),
    libraryIntro: asString(
      o.libraryIntro,
      'Open any resource below. Bookmark this page — it is your home base.',
    ),
    deliveryLinks: asObjectArray(o.deliveryLinks).map((l) => ({
      label: asString(l.label),
      href: asString(l.href),
      description: asString(l.description),
    })),
    welcomeVideoUrl: asString(o.welcomeVideoUrl),
    communityHref: asString(o.communityHref),
    communityLabel: asString(o.communityLabel, 'Join the community'),
    communityBody: asString(
      o.communityBody,
      'Meet the people doing this with you. Introduce yourself and say what you are offloading this week.',
    ),
    supportHeading: asString(o.supportHeading, 'Need a hand?'),
    supportBody: asString(
      o.supportBody,
      'Questions about access, downloads, or your order — we are here.',
    ),
    supportEmail: asString(o.supportEmail, 'support@mothermode.com'),
  };
}`,
    'normalizeAccess',
  );

  t = replaceOnce(
    t,
    `export function blankSuccess(): SuccessContent {
  return {
    headline: "You're in. Here's what happens next.",
    subheadline: '',
    purchaseSummary: '',
    deliveryCards: [],
    ctaText: 'Go to my access',
    ctaHref: '',
    supportEmail: 'support@mothermode.com',
    secondaryNote: '',
  };
}`,
    `export function blankSuccess(): SuccessContent {
  return {
    headline: "You're in. Here's what happens next.",
    subheadline: '',
    purchaseSummary: '',
    inboxNote:
      'Check your inbox for the receipt and login. If it is not there in a minute, check spam.',
    deliverySectionHeading: 'What is now yours',
    deliverySectionIntro: 'Open any card below, or go straight to your full access hub.',
    deliveryCards: [],
    nextEyebrow: 'What comes next',
    nextHeading: 'This is the first room of the redesign.',
    nextBody:
      'Use what you just unlocked. When you are ready for the full system, your access hub is where everything lives.',
    ctaText: 'Go to my access',
    ctaHref: '',
    supportEmail: 'support@mothermode.com',
    secondaryNote: '',
  };
}`,
    'blankSuccess',
  );

  t = replaceOnce(
    t,
    `export function blankAccess(): AccessContent {
  return {
    headline: 'Welcome to your members area',
    subheadline: '',
    onboardingItems: [],
    deliveryLinks: [],
    welcomeVideoUrl: '',
    communityHref: '',
    communityLabel: 'Join the community',
    supportEmail: 'support@mothermode.com',
  };
}`,
    `export function blankAccess(): AccessContent {
  return {
    headline: 'Welcome to your members area',
    subheadline: '',
    badgeText: 'Members area',
    onboardingEyebrow: 'Start here',
    onboardingHeading: 'Your first three moves',
    onboardingItems: [],
    libraryEyebrow: 'Your library',
    libraryHeading: 'Everything included',
    libraryIntro: 'Open any resource below. Bookmark this page — it is your home base.',
    deliveryLinks: [],
    welcomeVideoUrl: '',
    communityHref: '',
    communityLabel: 'Join the community',
    communityBody:
      'Meet the people doing this with you. Introduce yourself and say what you are offloading this week.',
    supportHeading: 'Need a hand?',
    supportBody: 'Questions about access, downloads, or your order — we are here.',
    supportEmail: 'support@mothermode.com',
  };
}`,
    'blankAccess',
  );

  return t;
});

patchFile('src/lib/mothermode/sales/defaults.ts', (t) => {
  t = replaceOnce(
    t,
    `export function defaultMotherModeSuccess(): SuccessContent {
  return {
    headline: "You're in. Here's what happens next.",
    subheadline: 'Check your email for the receipt. Your access is ready below.',
    purchaseSummary: 'The Brain Dump System — $27',
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
    ctaText: 'Go to my access',
    ctaHref: '',
    supportEmail: 'support@mothermode.com',
    secondaryNote: 'Need help? Reply to your receipt email or contact support.',
  };
}`,
    `export function defaultMotherModeSuccess(): SuccessContent {
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
}`,
    'defaultMotherModeSuccess',
  );

  t = replaceOnce(
    t,
    `export function defaultMotherModeAccess(): AccessContent {
  return {
    headline: 'Welcome to your members area',
    subheadline: 'Everything you bought is here. Start with step 1.',
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
    supportEmail: 'support@mothermode.com',
  };
}`,
    `export function defaultMotherModeAccess(): AccessContent {
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
}`,
    'defaultMotherModeAccess',
  );

  return t;
});

console.log('ALL DONE');
