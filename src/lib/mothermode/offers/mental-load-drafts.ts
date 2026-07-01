import { makeDraftOffer, withIcons } from './draft';
import type { MotherModeOffer } from '../types';

/**
 * Front-end offers in The Mental Load Series, alongside The Brain Dump System
 * and The Offload Map (both authored as full pages in their own files).
 */

export const invisibleLaborInventory: MotherModeOffer = makeDraftOffer({
  slug: 'invisible-labor-inventory',
  productId: 'mm_invisible_labor_inventory',
  category: 'The Mental Load Series',
  name: 'The Invisible Labor Inventory',
  tagline: 'Make the unseen work visible. For you, and for the conversation.',
  hero: {
    eyebrow: 'The Mental Load Series \u00b7 Resource Pack',
    headline: 'Make the unseen work',
    headlineEmphasis: 'visible',
    headlineSuffix: 'for you, and for the partner conversation.',
    subheadline:
      'The Invisible Labor Inventory puts the work no one sees on paper: the noticing, the tracking, the remembering. Once it is visible, it can finally be shared instead of assumed.',
    promise: 'Instant access. The full picture today.',
  },
  problem: {
    heading: 'The work no one sees is still work.',
    intro: 'You cannot redistribute what no one has named.',
    points: [
      'You are the default for every detail, and nobody clocks it as labor.',
      'When you ask for help, the response is "just tell me what to do", which is the work.',
      'You feel the imbalance but cannot prove it, even to yourself.',
    ],
  },
  whatIs: {
    heading: 'Put it all on paper.',
    paragraphs: [
      'The Invisible Labor Inventory is a structured catalog of the unseen work: anticipating, deciding, tracking, and managing. It turns a vague feeling of "too much" into a list you can point to.',
      'Then it gives you a fair-share picture and the scripts to have the conversation without it becoming a fight.',
    ],
  },
  inside: {
    heading: 'What is inside',
    subheading: 'Three resources to make the invisible undeniable.',
    items: withIcons([
      { title: 'The Full Inventory', description: 'Every category of unseen work, prompted so nothing gets missed.', tag: 'Start here' },
      { title: 'The Fair-Share Picture', description: 'A simple visual of who carries what, so the imbalance is plain.', tag: 'See it' },
      { title: 'The Conversation Scripts', description: 'How to share the load without blame, defensiveness, or a scorecard war.', tag: 'Talk it through' },
    ]),
  },
  oldWay: ['Being the default for every detail', 'Hearing "just tell me what to do"', 'Feeling the imbalance with no proof'],
  newWay: ['Every invisible task named', 'A clear picture of who carries what', 'A conversation that redistributes, not blames'],
  finalCta: {
    heading: 'Name what you carry.',
    body: 'The load stays invisible until you write it down. Make it visible, and it can finally be shared. Start today.',
  },
});

export const weeklyReset: MotherModeOffer = makeDraftOffer({
  slug: 'weekly-reset',
  productId: 'mm_weekly_reset',
  category: 'The Mental Load Series',
  name: 'The Weekly Reset',
  tagline: 'A one-page operating rhythm so the list never refills to the same level.',
  hero: {
    eyebrow: 'The Mental Load Series \u00b7 Resource Pack',
    headline: 'A one-page rhythm so the list',
    headlineEmphasis: 'never refills',
    headlineSuffix: 'to the same level again.',
    subheadline:
      'The Weekly Reset is the short, repeatable ritual that keeps a cleared head clear. About ten minutes, once a week, so you stop sliding back into the same overwhelm by Wednesday.',
    promise: 'Instant access. Run your first reset this week.',
  },
  problem: {
    heading: 'You clear the decks, then it all comes back.',
    intro: 'Clearing the load once is not the problem. Keeping it clear is.',
    points: [
      'You finally get organized, and within a week you are buried again.',
      'There is no moment in your week that catches what is coming.',
      'Every Monday starts from behind instead of from a plan.',
    ],
  },
  whatIs: {
    heading: 'The maintenance ritual.',
    paragraphs: [
      'The Weekly Reset is a single page you run once a week. It catches the open loops, previews the week ahead, and confirms what got handed off, so nothing quietly lands back on you.',
      'It is the difference between clearing the load once and keeping your head clear for good.',
    ],
  },
  inside: {
    heading: 'What is inside',
    subheading: 'Three resources to keep a clear head clear.',
    items: withIcons([
      { title: 'The Weekly Reset Page', description: 'The single page you run in ten minutes to reset the whole week.', tag: 'Start here' },
      { title: 'The Preview + Prep Block', description: 'A quick look ahead so the week stops ambushing you.', tag: 'Look ahead' },
      { title: 'The Handoff Check', description: 'A fast confirm that delegated work is actually moving, not boomeranging back.', tag: 'Stay clear' },
    ]),
  },
  oldWay: ['Getting organized, then buried by Wednesday', 'No moment that catches what is coming', 'Every Monday starting from behind'],
  newWay: ['A ten-minute weekly reset', 'A preview that ends the ambush', 'A check that keeps handoffs handed off'],
  finalCta: {
    heading: 'Keep it light.',
    body: 'A clear head does not stay clear by accident. Give it a ten-minute weekly rhythm. Start this week.',
  },
});

export const mentalLoadAudit: MotherModeOffer = makeDraftOffer({
  slug: 'mental-load-audit',
  productId: 'mm_mental_load_audit',
  category: 'The Mental Load Series',
  name: 'The Mental Load Audit',
  tagline: 'A short diagnostic that scores where the load is heaviest, so you know what to fix first.',
  priceCents: 1700,
  originalPriceCents: 4700,
  hero: {
    eyebrow: 'The Mental Load Series \u00b7 Diagnostic',
    headline: 'Find out where the load is',
    headlineEmphasis: 'heaviest',
    headlineSuffix: 'so you fix the right thing first.',
    subheadline:
      'The Mental Load Audit is a short diagnostic that scores the weight you are carrying across ten domains, then shows you the one to address first. It is the on-ramp to the full Wheel inside the MotherMode OS.',
    promise: 'Instant access. Your score in minutes.',
  },
  problem: {
    heading: 'You know you are overwhelmed. You do not know where to start.',
    intro: 'When everything feels heavy, the hardest part is choosing the first thing to put down.',
    points: [
      'Every area of your life feels like it needs attention at once.',
      'You start in the wrong place and burn out before anything changes.',
      'You have no way to measure whether things are getting better or worse.',
    ],
  },
  whatIs: {
    heading: 'Diagnosis before prescription.',
    paragraphs: [
      'The Mental Load Audit scores how heavy the load sits across ten domains of your life, then points to the one carrying the most weight. You stop guessing where to begin.',
      'It is the first move of the MotherMode method, and the on-ramp to the full Wheel and your MotherMode Index inside the OS.',
    ],
  },
  inside: {
    heading: 'What is inside',
    subheading: 'A diagnostic that tells you where to start.',
    items: withIcons([
      { title: 'The 10-Domain Score', description: 'Rate the load across ten areas to see the full picture in one place.', tag: 'Start here' },
      { title: 'The Heaviest-First Map', description: 'The one domain to address first, so your effort goes where it counts.', tag: 'Your priority' },
      { title: 'Your Next Step', description: 'A clear first action, plus how this connects to the full Wheel inside the OS.', tag: 'Move' },
    ]),
  },
  oldWay: ['Trying to fix everything at once', 'Starting in the wrong place and burning out', 'No way to measure if it is improving'],
  newWay: ['A clear score across ten domains', 'The single heaviest area named', 'A first step you can take today'],
  finalCta: {
    heading: 'See where it is heaviest.',
    body: 'You cannot redesign what you have not named. Score the load, find the heaviest domain, and start there. Take the audit today.',
  },
});
