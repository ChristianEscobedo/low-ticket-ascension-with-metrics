/**
 * The MotherMode ascension ladder. The three offers a buyer is walked through
 * after the front-end pack: the OS membership, the Redesign Vault, and the
 * Retreat. Each OTO page reads one of these so the pages stay data-driven and
 * on-brand. Voice rules apply: no em dashes, no NO-list words, numerals for time.
 */
import type { LucideIcon } from 'lucide-react';
import {
  CalendarHeart,
  Users,
  RefreshCcw,
  Sparkles,
  Layers,
  Infinity as InfinityIcon,
  Download,
  Moon,
  Mic,
  Sun,
  Utensils,
  Video,
  UserCheck,
  MessageCircle,
} from 'lucide-react';

/** One line in an ascension value stack. */
export interface AscensionFeature {
  title: string;
  description: string;
  value: string;
  icon: LucideIcon;
  /** Marks the core inclusion, rendered as the highlighted row. */
  core?: boolean;
}

/** One screenshot in an ascension gallery. */
export interface AscensionShot {
  /** Path under /public, e.g. /mothermode/os/chat.png. Unset renders a slot. */
  src?: string;
  alt: string;
  /** Short line under the image, in the brand voice. */
  caption?: string;
  /** Placeholder size hint, e.g. "1080 × 1920". */
  hint?: string;
}

/** Optional imagery for an ascension page. Files live under /public/mothermode.
 *  Unset fields render labelled placeholder slots, so the page looks finished
 *  before a single asset is dropped in. */
export interface AscensionMedia {
  /** Show the video frame at the top of the page. */
  video?: boolean;
  /** Poster for that top video. Unset shows a labelled video placeholder. */
  videoPoster?: string;
  /** Eyebrow above the screenshot gallery, e.g. "See it work". */
  galleryEyebrow?: string;
  /** A row of product screenshots that show the thing in action. */
  gallery?: AscensionShot[];
  /** Tailwind aspect class for gallery frames. Defaults to phone portrait. */
  galleryAspect?: string;
}

/** A single ascension offer (one OTO step). */
export interface AscensionOffer {
  /** Stable id for tracking, e.g. 'mothermode_os'. */
  productId: string;
  /** 'subscription' charges recurring; 'one_time' is a single charge. */
  billingType: 'subscription' | 'one_time';
  /** Shown in UI for subscriptions. */
  interval?: 'monthly' | 'yearly';
  /** Amount charged, in cents. */
  priceCents: number;
  /** Display price, e.g. '$29/mo' or '$97'. */
  priceLabel: string;
  /** Struck-through anchor, e.g. '$49/mo' or '$297'. */
  originalPriceLabel: string;
  /** Metadata type tag passed to Stripe (page_type set per OTO). */
  metadataType: string;
  pageType: string;

  /** Urgency banner copy + minutes on the countdown. */
  timerLabel: string;
  timerMinutes: number;

  /** Optional imagery: a top video and a screenshot gallery. */
  media?: AscensionMedia;

  eyebrow: string;
  headline: string;
  headlineEmphasis: string;
  headlineSuffix?: string;
  subheadline: string;

  /** The personal pitch. Runs the signature move. */
  letter: string[];

  /** Value-stack heading + rows. */
  stackEyebrow: string;
  stackHeading: string;
  features: AscensionFeature[];
  totalValueLabel: string;

  /** The single line worth remembering. */
  bigIdea: string;

  acceptLabel: string;
  declineLabel: string;
  guarantee: { title: string; body: string };
}

export const mothermodeOS: AscensionOffer = {
  productId: 'mothermode_os',
  billingType: 'subscription',
  interval: 'monthly',
  priceCents: 2900,
  priceLabel: '$29/mo',
  originalPriceLabel: '$49/mo',
  metadataType: 'mothermode_upsell_1',
  pageType: 'oto1',
  timerLabel: 'Your founding rate is held while this page is open',
  timerMinutes: 15,
  media: {
    video: true,
    galleryEyebrow: 'See it work',
    gallery: [
      { alt: 'The OS planning a week of dinners in chat', caption: 'Ask in plain words. It plans the week around your kids.', hint: '1080 × 1920' },
      { alt: 'A grocery list sorted by aisle', caption: 'Those meals become a sorted grocery list in one tap.', hint: '1080 × 1920' },
      { alt: 'The morning brief on the home screen', caption: 'Two lines each morning on what today needs and who has it.', hint: '1080 × 1920' },
    ],
  },
  eyebrow: 'Wait. Your order is not finished.',
  headline: 'You just emptied your head.',
  headlineEmphasis: 'Now keep it that way.',
  headlineSuffix:
    'Meet the assistant that carries the load with you, every day.',
  subheadline:
    'The pack you just got empties one list, once. The MotherMode OS is an assistant you talk to like a text. Tell it about your kids one time, and it plans the meals, builds the routines, writes the grocery list, and keeps the whole family on the same page. The load does not just clear. It stays handled.',
  letter: [
    'Here is what the pack does not do. It does not plan Tuesday dinner around the kid who will not touch anything green. It does not hold the shoe sizes, the dentist, the early-release day. It empties your head once. Then life refills it.',
    'The OS is the part that keeps it empty. It is an assistant that lives on your phone and your laptop, and you use it by typing or talking, the way you would text a friend who happens to remember everything.',
    'You tell it about your family one time. The ages, the allergies, the sizes, the schools. From then on it plans the week of meals around exactly that, turns them into a grocery list, builds the bedtime and morning routines, and hands you a two-line brief each morning of what the day actually needs.',
    'And it is not yours to carry alone. Invite your partner, your mother, the sitter, and they all see the same plan. When you move an appointment, they watch it move. The mental load stops being the thing only you can hold.',
    'If you are bracing for one more app to keep up with, this is the opposite. No streak to protect, no feed, nothing blinking for your attention. It does the work and waits. The more you use it, the more it sounds like your family instead of a manual.',
  ],
  stackEyebrow: 'Everything the OS does for you',
  stackHeading: 'Your founding membership',
  features: [
    { title: 'An assistant that already knows your family', description: 'Tell it the ages, allergies, sizes, and schools once. It remembers, so you never repeat yourself or start from scratch again.', value: '$197', icon: Sparkles, core: true },
    { title: 'The week of meals, planned and shopped', description: 'Ask for dinners and get a week built around the allergies and the picky one, turned into a categorized grocery list in one tap.', value: '$97', icon: Utensils },
    { title: 'Routines that run themselves', description: 'Bedtime, mornings, after school. Step-by-step and age-matched, checkable, so the evening stops being a fight.', value: '$49', icon: Moon },
    { title: 'The whole family, in sync', description: 'Invite your partner, your mother, the sitter. Everyone sees the same plan, and every update lands in real time.', value: '$97', icon: Users },
    { title: 'A morning brief and a weekly recap', description: 'Two lines each morning on what today needs and who has it, then a short digest at the end of the week.', value: '$39/mo', icon: Sun },
    { title: 'Talk to it with your hands full', description: 'Cooking with a toddler on your hip? Tap the mic and say it. It listens, you glance to confirm, it is done.', value: '$29/mo', icon: Mic },
  ],
  totalValueLabel: '$508/mo',
  bigIdea: 'You cannot hold the whole load in your head. This is the place to set it down where it actually gets carried.',
  acceptLabel: 'Yes, add the MotherMode OS',
  declineLabel: 'No thanks, I will keep just the one pack',
  guarantee: {
    title: 'The 14-day quiet-head guarantee',
    body: 'Use the OS for 14 days. If your week is not lighter, email us and we refund your first month in full. Anything you have saved is yours to keep.',
  },
};

export const osAnnualUpgrade: AscensionOffer = {
  productId: 'mothermode_os',
  billingType: 'subscription',
  interval: 'yearly',
  priceCents: 29000,
  priceLabel: '$290/yr',
  originalPriceLabel: '$348/yr',
  metadataType: 'mothermode_upsell_2',
  pageType: 'oto2',
  timerLabel: 'This one-time upgrade is held while this page is open',
  timerMinutes: 10,
  media: {
    video: true,
    galleryEyebrow: 'Why mothers go annual',
    galleryAspect: 'aspect-[4/3]',
    gallery: [
      { alt: 'Two months marked free on a year view', caption: 'Twelve months of the OS for the price of ten.', hint: '1600 × 1200' },
      { alt: 'The founding rate, locked', caption: 'Your price held at the lowest it will ever be, for good.', hint: '1600 × 1200' },
    ],
  },
  eyebrow: 'You are in. One small upgrade before you go.',
  headline: 'Hold this rhythm for a year',
  headlineEmphasis: 'and take two months on us.',
  headlineSuffix: 'Same founding rate, paid once, then forgotten.',
  subheadline:
    'You just joined the OS. Switch to the founding year today and you get two months free, your rate locked for good, and one less thing to think about every month. The redesign needs a full year to settle in. This makes sure it gets one.',
  letter: [
    'The first month of the OS is the easy one. The quiet is new, the rooms are fresh, and you are motivated.',
    'Month four is the one that matters. That is when the old way usually creeps back, when a card declines, when a busy week makes you wonder if you still need it. That is exactly when you do.',
    'The founding year removes that decision. You pay once, the rate is locked at the lowest it will ever be, and the system stays put through every season instead of getting cancelled in a hard week and missed in the next.',
    'Two months come free for switching now, and this is the only time the annual rate is offered at the founding price. After today it goes to full.',
  ],
  stackEyebrow: 'What switching to annual gives you',
  stackHeading: 'The founding year',
  features: [
    { title: 'Two months, free', description: 'Twelve months of the OS for the price of ten. The savings is automatic.', value: '$58', icon: CalendarHeart, core: true },
    { title: 'Your founding rate, locked', description: 'The lowest price the OS will ever be, held for as long as you stay.', value: 'For good', icon: InfinityIcon },
    { title: 'Nothing to manage monthly', description: 'One payment, one year, zero card-decline surprises in a hard week.', value: 'Included', icon: RefreshCcw },
  ],
  totalValueLabel: 'Save $58 today',
  bigIdea: 'The redesign works when it stays. Annual is how it stays.',
  acceptLabel: 'Yes, upgrade me to the founding year',
  declineLabel: 'No thanks, I will stay monthly',
  guarantee: {
    title: 'The same 14-day guarantee',
    body: 'The quiet-head guarantee still applies. If the OS is not lighter within 14 days, email us and we refund the year in full.',
  },
};

export const redesignVault: AscensionOffer = {
  productId: 'mothermode_redesign_vault',
  billingType: 'one_time',
  priceCents: 9700,
  priceLabel: '$97',
  originalPriceLabel: '$297',
  metadataType: 'mothermode_upsell_3',
  pageType: 'oto3',
  timerLabel: 'This one-time price is held while this page is open',
  timerMinutes: 10,
  media: {
    galleryEyebrow: 'A look inside the Vault',
    galleryAspect: 'aspect-[4/5]',
    gallery: [
      { alt: 'The Mental Load systems, laid out', caption: 'The brain dump, the offload map, and the weekly reset.', hint: '1200 × 1500' },
      { alt: 'The Daily Rhythm systems', caption: 'The 5pm reset and the morning without yelling.', hint: '1200 × 1500' },
      { alt: 'The Fourth Trimester system', caption: 'The first 90 days, for the fog and your recovery.', hint: '1200 × 1500' },
    ],
  },
  eyebrow: 'One more thing, and then you are all set.',
  headline: 'Take every system at once.',
  headlineEmphasis: 'The Redesign Vault.',
  headlineSuffix: 'Yours to keep, for one payment, for good.',
  subheadline:
    'The OS hands you a new system each month. The Vault hands you all of them today. Every pack in the catalog, every room of the redesign, downloaded and yours to keep whether or not you stay a member.',
  letter: [
    'Membership is the right call for most mothers. The systems arrive as you need them, one season at a time, so nothing piles up.',
    'But some women do not want to wait for the next one. They want the whole house on the table now, to keep, so the work is done no matter what life does next year.',
    'That is the Vault. Every system MotherMode has built, and every one we build going forward, in your hands today. The school morning, the 5pm reset, the newborn fog, the invisible labor conversation, all of it.',
    'You will not see this price again. Take the whole redesign once, keep it for good, and never start from a blank page no matter which season hits.',
  ],
  stackEyebrow: 'Everything, downloaded and kept',
  stackHeading: 'The complete Vault',
  features: [
    { title: 'Every Mental Load system', description: 'The brain dump, the offload map, the invisible labor inventory, and the weekly reset.', value: '$108', icon: Layers },
    { title: 'Every Daily Rhythm system', description: 'The 5pm reset and the morning without yelling, ready to run tonight and tomorrow.', value: '$54', icon: RefreshCcw },
    { title: 'The Fourth Trimester system', description: 'The first 90 days, for the newborn fog and your own recovery.', value: '$27', icon: Moon },
    { title: 'Every future pack, free', description: 'Anything new we build lands in your Vault automatically, at no extra cost.', value: '$108', icon: InfinityIcon, core: true },
    { title: 'Print and editable versions', description: 'Every system as a print-ready PDF plus an editable file for any device.', value: 'Included', icon: Download },
  ],
  totalValueLabel: '$297',
  bigIdea: 'Buy the room when you need it, or own the whole house once and never think about it again.',
  acceptLabel: 'Yes, give me the whole Vault',
  declineLabel: 'No thanks, the membership is enough for me',
  guarantee: {
    title: 'The keep-it-all guarantee',
    body: 'Open the Vault. If it is not worth it within 14 days, email us and we refund every cent, and what you have downloaded is still yours to keep.',
  },
};

export const motherModeCoaching: AscensionOffer = {
  productId: 'mothermode_coaching',
  billingType: 'subscription',
  interval: 'yearly',
  priceCents: 99700,
  priceLabel: '$997/yr',
  originalPriceLabel: '$2,964/yr',
  metadataType: 'mothermode_upsell_4',
  pageType: 'oto4',
  timerLabel: 'A founding coaching seat is held while this page is open',
  timerMinutes: 10,
  media: {
    video: true,
    galleryEyebrow: 'Inside the coaching year',
    galleryAspect: 'aspect-[4/3]',
    gallery: [
      { alt: 'A live group coaching call on screen', caption: 'Twice a month, live. Bring the week that is not working and leave with a plan.', hint: '1600 × 1200' },
      { alt: 'The private circle of mothers between calls', caption: 'A small room of mothers between calls, so help is never more than a message away.', hint: '1600 × 1200' },
    ],
  },
  eyebrow: 'The last step, and the one that changes the most.',
  headline: 'The systems do the work.',
  headlineEmphasis: 'A coach makes sure you live them.',
  headlineSuffix: 'A guided year with a real person who knows your family.',
  subheadline:
    'The OS handles the load day to day. Coaching is the human layer on top: twice-a-month live calls, a coach who knows your kids and your week, and a small circle of mothers redesigning the same life. This is where the redesign stops being a plan and becomes how you actually live.',
  letter: [
    'A system only works as far as you trust it. The first hard week, the first pushback at home, the first month four. That is where most redesigns quietly fall apart, and it is exactly where a coach earns her keep.',
    'Coaching is a guided year. Twice a month we meet live, in a small group, and you bring the part that is not working. The dinner battle that came back. The partner who still will not see the load. The morning that unravels by 8am. You leave each call with the next move already decided.',
    'Your coach knows your family the way the OS does. The ages, the allergies, the schools, the season you are in. So the help is never generic. It is built around your actual house, not a worksheet.',
    'Between calls you are in a private circle of mothers carrying the same thing. Ask a question at 11pm and someone who gets it answers. The isolation that makes the load heavier is the first thing to go.',
    'This is the founding cohort, held at the lowest price coaching will ever be. Seats are limited so every mother gets real time on the calls, and this is the only place the invitation appears.',
  ],
  stackEyebrow: 'What the coaching year holds',
  stackHeading: 'The founding coaching year',
  features: [
    { title: 'Two live calls a month', description: 'Small-group coaching, twice a month, all year. Bring the week that is not working and leave with the next move.', value: '$1,800', icon: Video, core: true },
    { title: 'A coach who knows your family', description: 'Help built around your kids, your schools, and the season you are in, never a generic worksheet.', value: '$600', icon: UserCheck },
    { title: 'A private circle of mothers', description: 'A small founding room carrying the same load, so a question at 11pm gets a real answer.', value: '$360', icon: Users },
    { title: 'Direct access between calls', description: 'Send the hard moment as it happens and get a real reply, not a ticket number.', value: '$204', icon: MessageCircle },
  ],
  totalValueLabel: '$2,964/yr',
  bigIdea: 'A plan tells you what to do. A coach makes sure you are still standing when it gets hard, and you keep going.',
  acceptLabel: 'Yes, add the coaching year',
  declineLabel: 'No thanks, I am set with my systems',
  guarantee: {
    title: 'The first-call guarantee',
    body: 'Come to your first two calls. If coaching is not worth it, email us within 30 days and we refund the year in full.',
  },
};
