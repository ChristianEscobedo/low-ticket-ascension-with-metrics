const fs = require('fs');
const p = 'src/lib/mothermode/sales/defaults.ts';
let c = fs.readFileSync(p, 'utf8');
const start = c.indexOf('export function defaultMotherModeUpsell1');
const end = c.indexOf('export function defaultMotherModeSuccess');
if (start < 0 || end < 0) {
  console.error('markers not found', start, end);
  process.exit(1);
}

const neu = `export function defaultMotherModeUpsell1(): UpsellContent {
  return {
    enabled: true,
    eyebrow: 'Wait. Your order is not finished.',
    headline: 'You just emptied your head.',
    subheadline:
      'The pack you just got empties one list, once. The MotherMode OS is an assistant you talk to like a text. Tell it about your kids one time, and it plans the meals, builds the routines, writes the grocery list, and keeps the whole family on the same page.',
    bullets: [
      'An assistant that already knows your family',
      'The week of meals, planned and shopped',
      'Routines that run themselves',
      'The whole family, in sync',
      'A morning brief and a weekly recap',
      'Talk to it with your hands full',
    ],
    priceLabel: '$29/mo',
    originalPriceLabel: '$49/mo',
    priceCents: 2900,
    stripePriceId: '',
    productName: 'The MotherMode OS (monthly)',
    paymentType: 'subscription',
    ctaYes: 'Yes, add the MotherMode OS',
    ctaNo: 'No thanks, I will keep just the one pack',
    yesHref: '',
    timerMinutes: 15,
    imageUrl: '',
    videoUrl: '',
  };
}

export function defaultMotherModeUpsell2(): UpsellContent {
  return {
    enabled: true,
    eyebrow: 'You are in. One small upgrade before you go.',
    headline: 'Hold this rhythm for a year and take two months on us.',
    subheadline:
      'Switch to the founding year today and you get two months free, your rate locked for good, and one less thing to think about every month.',
    bullets: [
      'Two months, free (12 months for the price of 10)',
      'Your founding rate, locked for good',
      'Nothing to manage monthly',
    ],
    priceLabel: '$290/yr',
    originalPriceLabel: '$348/yr',
    priceCents: 29000,
    stripePriceId: '',
    productName: 'The MotherMode OS (annual)',
    paymentType: 'subscription',
    ctaYes: 'Yes, upgrade me to the founding year',
    ctaNo: 'No thanks, I will stay monthly',
    yesHref: '',
    timerMinutes: 10,
    imageUrl: '',
    videoUrl: '',
  };
}

export function defaultMotherModeUpsell3(): UpsellContent {
  return {
    enabled: true,
    eyebrow: 'One more thing, and then you are all set.',
    headline: 'Take every system at once. The Redesign Vault.',
    subheadline:
      'Every pack in the catalog, every room of the redesign, downloaded and yours to keep whether or not you stay a member.',
    bullets: [
      'Every Mental Load system',
      'Every Daily Rhythm system',
      'The Fourth Trimester system',
      'Every future pack, free',
      'Print and editable versions',
    ],
    priceLabel: '$97',
    originalPriceLabel: '$297',
    priceCents: 9700,
    stripePriceId: '',
    productName: 'The Redesign Vault',
    paymentType: 'one_time',
    ctaYes: 'Yes, give me the whole Vault',
    ctaNo: 'No thanks, the membership is enough for me',
    yesHref: '',
    timerMinutes: 10,
    imageUrl: '',
    videoUrl: '',
  };
}

export function defaultMotherModeUpsell4(): UpsellContent {
  return {
    enabled: true,
    eyebrow: 'The last step, and the one that changes the most.',
    headline: 'The systems do the work. A coach makes sure you live them.',
    subheadline:
      'Twice-a-month live calls, a coach who knows your kids and your week, and a small circle of mothers redesigning the same life.',
    bullets: [
      'Two live calls a month',
      'A coach who knows your family',
      'A private circle of mothers',
      'Direct access between calls',
    ],
    priceLabel: '$997/yr',
    originalPriceLabel: '$2,964/yr',
    priceCents: 99700,
    stripePriceId: '',
    productName: 'MotherMode Coaching (founding year)',
    paymentType: 'subscription',
    ctaYes: 'Yes, add the coaching year',
    ctaNo: 'No thanks, I am set with my systems',
    yesHref: '',
    timerMinutes: 10,
    imageUrl: '',
    videoUrl: '',
  };
}

`;

c = c.slice(0, start) + neu + c.slice(end);
fs.writeFileSync(p, c);
console.log('ok', c.includes('MotherMode OS (monthly)'), c.includes('Redesign Vault'));
