const fs = require('fs');
const p = 'src/lib/mothermode/sales/defaults.ts';
let c = fs.readFileSync(p, 'utf8');

const start = c.indexOf('export function defaultMotherModeSalesPage');
const end = c.indexOf('export function defaultMotherModeVsl');
if (start < 0 || end < 0) {
  console.error('sales markers missing', start, end);
  process.exit(1);
}

const sales = `export function defaultMotherModeSalesPage(): SalesPageContent {
  return {
    eyebrow: 'For Mothers · The Mental Load Series',
    headline: 'Go to bed with',
    headlineEmphasis: 'a calm mind',
    subheadline:
      'No more lying awake running tomorrow. No more being the only one who knows where everything is. You answer a few quick questions, the AI builds your personalized system in minutes, and the people around you start carrying their share. Not another app to keep up with. Done before the coffee goes cold.',
    problemHeading: 'You are the only one who knows.',
    problemBody:
      'Not because you chose to be. Because the list lives in one place, and that place is your head. It does not switch off when you do. It is 11pm. The house is finally quiet, and your mind picks that exact moment to read the list back to you. The permission slip. The shoes that do not fit anymore. The text you still have not answered. You are not awake because you are anxious. You are awake because you are the only backup copy.',
    solutionHeading: 'This is not another planner.',
    solutionBody:
      'The Brain Dump System is an AI tool that pulls the mental load out of your head for you. You answer a few quick questions, and in minutes it builds the full inventory of what you are tracking, for everyone, named and visible for the first time. Then it sorts every line, writes the scripts to hand off the work that was never only yours, and keeps a rhythm so the list never climbs back to where it started.',
    featuresHeading: 'What is inside',
    features: [
      'The Brain Dump Template — pull every open tab out of your head',
      'The Sorting Pass — Drop, Automate, Delegate, or Keep',
      'The Delegate Scripts — exact words for the partner, sitter, family',
      'The Weekly Reset — catch the list before it refills',
      'The Load Map — see where the weight actually sits',
    ],
    testimonialsHeading: 'What mothers say',
    testimonials: [
      {
        quote:
          'I did the Brain Dump on Sunday and by Wednesday I had handed off two things I had been carrying for months. It sounds simple because it is.',
        author: 'Sarah M.',
        role: 'Working mom of two',
      },
      {
        quote:
          'The Load Map conversation changed my house. My partner finally saw the invisible work. We redistributed three things that night.',
        author: 'Jen R.',
        role: 'Founder, mom of three',
      },
    ],
    priceLabel: '$7',
    originalPriceLabel: '$97',
    priceDescription: 'One-time payment. Instant access. No subscription.',
    faqHeading: 'Questions',
    faqs: [
      {
        question: 'How long does this take?',
        answer:
          'A few minutes to answer the questions. The AI builds your system instantly. Most mothers are using it the same day.',
      },
      {
        question: 'Is this just another planner?',
        answer:
          'No. A planner gives you a blank page. This pulls the list out of your head, decides it once, and writes the handoff scripts for you.',
      },
      {
        question: 'What if it does not work for me?',
        answer:
          'You have 14 days. If your head is not lighter, email us and we refund you in full. What you have already used is yours to keep.',
      },
    ],
    ctaText: 'Get the Brain Dump System',
    ctaSubtext: 'Instant access. A lighter head in minutes, not someday.',
    guaranteeText:
      '14-day quiet-head guarantee. If it is not lighter, we refund every cent.',
    heroImageUrl: '',
    heroVideoUrl: '',
  };
}

`;

c = c.slice(0, start) + sales + c.slice(end);

// Checkout defaults → $7 Brain Dump
const cStart = c.indexOf('export function defaultMotherModeCheckout');
const cEnd = c.indexOf('export function defaultMotherModeUpsell1');
if (cStart >= 0 && cEnd > cStart) {
  const checkout = `export function defaultMotherModeCheckout(): CheckoutContent {
  return {
    eyebrow: 'Secure checkout',
    headline: 'Complete your order',
    subheadline: 'The Brain Dump System is one payment away.',
    priceLabel: '$7',
    priceCents: 700,
    stripePriceId: '',
    productName: 'The Brain Dump System',
    productId: 'mm_brain_dump_system',
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
  };
}

`;
  c = c.slice(0, cStart) + checkout + c.slice(cEnd);
}

fs.writeFileSync(p, c);
console.log(
  'ok',
  c.includes("headline: 'Go to bed with'"),
  c.includes("priceLabel: '$7'"),
  c.includes('mm_brain_dump_system'),
);
