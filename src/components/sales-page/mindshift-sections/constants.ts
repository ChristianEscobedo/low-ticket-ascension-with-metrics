import {
  Activity,
  Brain,
  Heart,
  Sparkles,
  Compass,
  Zap,
  Eraser,
  Anchor,
  Sunrise,
  Mic,
  Headphones,
  BookOpen,
  Users,
  ShieldCheck,
  Repeat,
  type LucideIcon,
} from 'lucide-react';

export const CHECKOUT_PATH = '/millionaire-mindshift/checkout';
export const REF_STORAGE_KEY = 'millionaire_mindshift_ref';
export const TIMER_STORAGE_KEY = 'millionaire-mindshift-timer';

export const FALLBACK_PRODUCT = {
  id: 'millionaire_mindshift',
  name: 'Millionaire Mindshift',
  description:
    "The Subconscious Reset Method\u2122 — a 4-step protocol (Surface → Test → Clear → Install) that reprograms the 95% of your mind quietly capping your income.",
  price_cents: 2700,
  original_price_cents: 19700,
  has_payment_plan: false,
  features: [
    'The Identity Audit',
    'The Muscle-Testing Protocol',
    'The Clearing Sequence',
    'Installing the New Identity',
    'The Daily Congruence Practice',
  ],
  bonuses: [],
};

export const PROBLEMS = [
  'You overdeliver, then resent your clients',
  'You procrastinate until you\u2019re panicked',
  'You fear visibility, but crave validation',
  'You hold back your truth because "what if I lose them?"',
  'You keep adjusting your strategy, trying to outrun the discomfort',
];

export const BELIEFS = [
  { conscious: '"I want to be wealthy."', subconscious: '"Money will make me a target."' },
  { conscious: '"I believe in abundance."', subconscious: '"Success means abandonment."' },
  { conscious: '"I know I\u2019m capable."', subconscious: '"Wealthy people are selfish."' },
  { conscious: '"I\u2019m doing the work."', subconscious: '"If I shine, someone I love will suffer."' },
  { conscious: '"I deserve more."', subconscious: '"I always have to choose: money or freedom."' },
];

export interface MethodStep {
  number: number;
  title: string;
  icon: LucideIcon;
  description: string;
}

export const METHOD_STEPS: MethodStep[] = [
  { number: 1, title: 'Surface', icon: Activity, description: 'Pull the exact ceiling belief out of the subconscious \u2014 the one your conscious mind doesn\u2019t know is there.' },
  { number: 2, title: 'Test', icon: Brain, description: 'Muscle-test it so the body confirms (in seconds) what the mind would spend months talking around.' },
  { number: 3, title: 'Clear', icon: Heart, description: 'Run the precise clearing sequence \u2014 at the nervous-system level, not the affirmation level.' },
  { number: 4, title: 'Install', icon: Sparkles, description: 'Install the new belief and verify with the body that it actually took. No guessing.' },
];

export interface Module {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
  subtitle: string;
  bullets: string[];
}

export const MODULES: Module[] = [
  {
    number: 1,
    title: 'The Identity Audit',
    description: 'Map the gap between who you say you are and what your nervous system actually believes.',
    icon: Compass,
    subtitle: 'Start Here',
    bullets: [
      'The 6-question identity audit',
      'Surface the exact ceiling belief',
      'Why your strategy isn\u2019t the problem',
    ],
  },
  {
    number: 2,
    title: 'The Muscle-Testing Protocol',
    description: 'The exact 5-minute technique to surface buried money beliefs on demand.',
    icon: Zap,
    subtitle: 'The Core Skill',
    bullets: [
      'Self-testing (no partner needed)',
      '90-second belief surfacing',
      'Calibration walkthrough',
    ],
  },
  {
    number: 3,
    title: 'The Clearing Sequence',
    description: 'Step-by-step subconscious clearing \u2014 no journaling, no bypass, no hype.',
    icon: Eraser,
    subtitle: 'Release The Block',
    bullets: [
      'Nervous-system-level clearing',
      'No re-traumatizing the story',
      'Works on inherited money beliefs',
    ],
  },
  {
    number: 4,
    title: 'Installing the New Identity',
    description: 'Test and lock in the version of you that already believes it\u2019s safe to succeed.',
    icon: Anchor,
    subtitle: 'Lock It In',
    bullets: [
      'Belief installation protocol',
      'Body-led verification (not just affirmations)',
      'How to know the rewire \u201ctook\u201d',
    ],
  },
  {
    number: 5,
    title: 'The Daily Congruence Practice',
    description: 'A 7-minute ritual to keep the new wiring online when results start showing up.',
    icon: Sunrise,
    subtitle: 'Keep It Online',
    bullets: [
      '7-minute morning protocol',
      'How to handle the \u201cupper limit\u201d wave',
      'When (and how) to re-test',
    ],
  },
];

export interface Bonus {
  number: number;
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  featured?: boolean;
  image?: string;
}

export const BONUSES: Bonus[] = [
  {
    number: 1,
    title: 'Live "Millionaire Beliefs & Safety" Zoom',
    value: '$297',
    description: 'Small-group live Zoom \u2014 bring your blocks, we run The Subconscious Reset Method\u2122 on them live and watch the muscle-test response flip in real time.',
    icon: Mic,
    gradient: 'from-amber-300/30 via-amber-200/10 to-amber-400/30',
    featured: true,
    image: 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a29d73db06ac3856e9e533a.png',
  },
  {
    number: 2,
    title: '7 Minute Miracle Meditation',
    value: '$97',
    description: 'A guided 7-minute meditation to keep the rewire online between calls \u2014 listen in the car, the shower, before launches.',
    icon: Headphones,
    gradient: 'from-amber-200/20 via-white/5 to-amber-300/20',
    image: 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a29d73d84a439b9c7e37e67.png',
  },
  {
    number: 3,
    title: 'Holding More Journal Prompts',
    value: '$47',
    description: 'Printable prompts designed to integrate (not surface-skim) the rewire. The work the body actually believes.',
    icon: BookOpen,
    gradient: 'from-amber-200/15 via-white/5 to-amber-200/15',
    image: 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a29d73d7ce0b3c81a8b0733.png',
  },
  {
    number: 4,
    title: 'The Money Memory Map',
    value: '$67',
    description: 'A guided 20-minute exercise to find the exact moment your nervous system decided money wasn\u2019t safe \u2014 and the script to update it.',
    icon: Brain,
    gradient: 'from-amber-300/20 via-amber-100/10 to-amber-200/25',
    image: 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a29d73d2719d8cb18b13465.png',
  },
  {
    number: 5,
    title: 'Private Mindshift Community',
    value: '$197',
    description: 'Inner-circle community of high-achieving entrepreneurs running the protocol live. Wins, witness, weekly accountability.',
    icon: Users,
    gradient: 'from-amber-200/20 via-amber-100/5 to-amber-300/20',
    image: 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a29d73db06ac3856e9e5330.png',
  },
  {
    number: 6,
    title: '30-Day Holding Ceiling Tracker',
    value: '$57',
    description: 'A printable tracker to catch the exact moment you sabotage \u2014 so you can clear it the same day instead of losing the month.',
    icon: Repeat,
    gradient: 'from-amber-300/15 via-white/5 to-amber-300/15',
    image: 'https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a29d73db06ac3856e9e5335.png',
  },
];

export const TOTAL_BONUS_VALUE = BONUSES.reduce((sum, b) => sum + parseInt(b.value.replace(/[$,]/g, '')), 0);

export const OLD_WAY = [
  'Read another mindset book',
  'Affirmations you don\u2019t actually believe',
  'Journaling around the same loop for months',
  'Therapy that explains the wound but never clears it',
  'Vision boards that decorate the ceiling you keep hitting',
];

export const NEW_WAY = [
  'Surface the exact subconscious belief in 90 seconds',
  'Clear it at the nervous-system level (no \u201cwork through it for months\u201d)',
  'Install a new belief your body actually holds as true',
  'Watch the income ceiling move \u2014 because the identity moved',
  'Repeat for every block that surfaces (5\u201310 min per pass)',
];

export const SYSTEM_ALLOWS = [
  'Charge premium without your stomach dropping',
  'Show up on video without the post-launch shame spiral',
  'Receive a $25K week without immediately sabotaging the next one',
  'Hold visibility without needing to disappear after',
  'Hire, delegate, and lead without re-collapsing into hustle',
  'Build wealth without losing the people you love along the way',
];

export const FAQS = [
  { q: 'Is this woo-woo?', a: 'No. Muscle testing is a measurable neuromuscular response used by chiropractors, applied kinesiologists, and nervous-system practitioners for decades. We just apply it to money beliefs.' },
  { q: 'What if I\u2019ve already done a lot of mindset work?', a: 'Then you already know mindset alone doesn\u2019t rewire the subconscious. This works underneath the level your previous work touched.' },
  { q: 'How long does the course take?', a: '~90 minutes of video. The protocol itself takes 5\u201310 minutes once you\u2019ve learned it.' },
  { q: 'Do I need a partner to muscle-test?', a: 'No. We teach self-testing in Module 2.' },
  { q: 'When is the live Zoom?', a: 'Dates announced inside the members area \u2014 usually within 2 weeks of joining. Recording sent if you can\u2019t attend live.' },
  { q: 'Refund policy?', a: '14-day "Feel the Shift" guarantee. Do the protocol once. If you don\u2019t physically feel a shift in the belief you cleared within 14 days, email us and we\u2019ll refund every cent.' },
];

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  real: boolean;
}

export const TESTIMONIALS: Testimonial[] = [
  // TODO: Replace with real Millionaire Mindshift testimonials before paid traffic.
  { name: 'Marleen', role: 'Coach \u2014 individual result, not typical', quote: 'She didn\u2019t change her offer. She ran The Subconscious Reset Method\u2122. And had the biggest cash week of her career \u2014 without a single new tactic.', real: true },
  { name: 'Sarah K.', role: 'Founder, $30K/mo agency', quote: 'I\u2019d done every mindset course. This was the first thing that actually moved the wiring underneath. Three weeks later I closed my biggest contract \u2014 and it felt easy.', real: false },
  { name: 'Daniel R.', role: 'Consultant', quote: 'The muscle-testing protocol surfaced a belief about my dad in 90 seconds that I\u2019d been talking around in therapy for two years.', real: false },
];

export interface FeatureCard {
  icon: LucideIcon;
  subtitle: string;
  title: string;
  description: string;
  bullets: string[];
}

export const FEATURES: FeatureCard[] = [
  {
    icon: Compass,
    subtitle: 'Start Here',
    title: 'The Identity Audit',
    description: 'Map the gap between who you say you are and what your nervous system actually believes about money.',
    bullets: ['6-question audit', 'Surface the ceiling belief', 'Why strategy isn\u2019t the issue'],
  },
  {
    icon: Zap,
    subtitle: 'The Core Skill',
    title: 'Muscle-Testing Protocol',
    description: 'A measurable neuromuscular technique to surface buried money beliefs in under 90 seconds \u2014 solo.',
    bullets: ['Self-testing taught', '90-second belief surfacing', 'Calibration walkthrough'],
  },
  {
    icon: Eraser,
    subtitle: 'Release The Block',
    title: 'The Clearing Sequence',
    description: 'Nervous-system-level clearing. No journaling, no re-living the story, no spiritual bypass.',
    bullets: ['Body-led release', 'Inherited belief work', 'No re-traumatization'],
  },
  {
    icon: Anchor,
    subtitle: 'Lock It In',
    title: 'Installing The New Identity',
    description: 'Test and lock in the version of you that already believes it\u2019s safe to be wealthy.',
    bullets: ['Installation protocol', 'Body verification', 'Know when it \u201ctook\u201d'],
  },
  {
    icon: Sunrise,
    subtitle: 'Daily Practice',
    title: '7-Minute Congruence Ritual',
    description: 'The daily protocol that keeps the new wiring online when wins (and upper-limit waves) start showing up.',
    bullets: ['Morning protocol', 'Upper-limit handling', 're-test cadence'],
  },
  {
    icon: Mic,
    subtitle: 'Bonus Live Call',
    title: 'Millionaire Beliefs Zoom',
    description: 'A live small-group Zoom where you bring your blocks and we muscle-test them in real time.',
    bullets: ['Live group call', 'Real-time clearing', 'Recording included'],
  },
  {
    icon: Headphones,
    subtitle: 'Embed The Work',
    title: 'Identity Rewire Audios',
    description: '4 guided audios to keep the rewire online between sessions \u2014 the car, the shower, pre-launch.',
    bullets: ['4 guided sessions', '10\u201320 min each', 'Mobile-ready'],
  },
  {
    icon: ShieldCheck,
    subtitle: 'Members Area',
    title: 'Lifetime Access Portal',
    description: 'Full course, audios, prompts, and Zoom replays \u2014 all in one private members area. Yours for life.',
    bullets: ['Lifetime access', 'Mobile + desktop', 'New rewires added'],
  },
];

export interface CaseStudyCard {
  name: string;
  metric: string;
  context: string;
  quote: string;
}

export const CASE_STUDIES: CaseStudyCard[] = [
  {
    name: 'Marleen',
    metric: 'Biggest week',
    context: 'individual client result \u2014 not typical, results vary',
    quote: 'Ran The Subconscious Reset Method\u2122 on a Sunday. By Friday her Stripe dashboard had quietly changed her life.',
  },
  {
    name: 'Sarah K.',
    metric: '$30K/mo',
    context: 'agency owner \u2014 closed her biggest contract',
    quote: '\u201cThree weeks after the rewire I closed a contract I\u2019d been chasing for a year. And it felt easy.\u201d',
  },
  {
    name: 'Daniel R.',
    metric: '90 sec',
    context: 'surfaced a 2-year-old block',
    quote: '\u201cThe protocol surfaced a belief about my dad I\u2019d been talking around in therapy for two years.\u201d',
  },
];
