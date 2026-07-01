import { makeDraftOffer, withIcons } from './draft';
import type { MotherModeOffer } from '../types';

/**
 * Front-end offers organized around hard times of day and season of life. The
 * 5pm Reset and The Morning Without Yelling are authored as full pages in their
 * own files (./five-pm-reset, ./morning-without-yelling).
 */

export const first90Days: MotherModeOffer = makeDraftOffer({
  slug: 'first-90-days',
  productId: 'mm_first_90_days',
  category: 'The Fourth Trimester Series',
  name: 'The First 90 Days',
  tagline: 'Systems for the newborn fog, so your recovery is not one more thing you carry.',
  hero: {
    eyebrow: 'The Fourth Trimester Series \u00b7 Resource Pack',
    headline: 'Move through the newborn fog with',
    headlineEmphasis: 'systems, not willpower',
    headlineSuffix: 'so your own recovery stops coming last.',
    subheadline:
      'The First 90 Days is a set of ready-to-run systems for feeds, sleep, visitors, and your recovery. Built so the early weeks have a shape, and so someone is finally looking after you too.',
    promise: 'Instant access. Set it up in an afternoon.',
  },
  problem: {
    heading: 'No one set anything up for you.',
    intro: 'You were handed a baby and a thousand opinions. Not a system.',
    points: [
      'Feeds and sleep blur into one long undated day.',
      'Your own recovery is the last thing anyone tracks, including you.',
      'Advice is everywhere. None of it is organized for the woman in the middle of it.',
    ],
  },
  whatIs: {
    heading: 'A shape for the shapeless weeks.',
    paragraphs: [
      'The First 90 Days turns the fourth trimester into something with edges. Simple logs and checklists that hold the details so your foggy brain does not have to.',
      'Half of it is for the baby. The other half is for you, because recovery is not a luxury you earn later.',
    ],
  },
  inside: {
    heading: 'What is inside',
    subheading: 'Three systems for the first three months.',
    items: withIcons([
      { title: 'The Feed + Sleep Log', description: 'A dead-simple way to track the day so you can answer the doctor and yourself.', tag: 'For the baby' },
      { title: 'The Recovery Checklist', description: 'The care your body needs, named and scheduled. For you, not the baby.', tag: 'For you' },
      { title: 'The Visitor + Meal Scripts', description: 'The words to set terms for visits and to let people feed you without the awkwardness.', tag: 'Accept help' },
    ]),
  },
  oldWay: ['Tracking feeds on scraps and your memory', 'Putting your recovery last, again', 'Saying yes to every visitor at the worst time'],
  newWay: ['One simple log for the whole day', 'Your recovery named and scheduled', 'Scripts that turn offers of help into actual help'],
  finalCta: {
    heading: 'Be cared for, too.',
    body: 'The early weeks were never meant to be carried alone and undated. Give them a shape, and let some of the care point back at you. Start today.',
  },
});
