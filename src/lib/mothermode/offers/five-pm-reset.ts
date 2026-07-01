import {
  ListOrdered,
  UtensilsCrossed,
  Moon,
  LifeBuoy,
  Sparkles,
  RefreshCcw,
  Clock,
  HeartHandshake,
  Feather,
  Route,
} from 'lucide-react';
import type { MotherModeOffer } from '../types';

/**
 * The 5pm Reset. A full front-end offer in The Daily Rhythm Series. Solves one
 * specific problem: the dinner-to-bed stretch that collapses at the same time
 * every day. Replace the nightly scramble with one fixed sequence you run
 * instead of improvising while everyone needs you at once.
 */
export const fivePmReset: MotherModeOffer = {
  slug: 'five-pm-reset',
  productId: 'mm_five_pm_reset',
  category: 'The Daily Rhythm Series',
  name: 'The 5pm Reset',
  tagline: 'Turn the witching hour into the calmest part of your day.',
  ready: true,

  priceCents: 2700,
  originalPriceCents: 9700,

  hero: {
    eyebrow: 'For Mothers \u00b7 The Daily Rhythm Series',
    headline: 'Turn the witching hour into',
    headlineEmphasis: 'the calmest part of your day',
    headlineSuffix: 'dinner, baths, and bed without the meltdown. Theirs or yours.',
    subheadline:
      'No more improvising the hardest two hours while everyone needs you at once. You answer a few quick questions, the AI builds your evening sequence in minutes, and tonight you follow a calm order of operations instead of deciding everything on empty. Not another routine chart. Ready before dinner.',
    audience:
      'This is for the mother who is patient all day and somehow becomes someone she does not recognize by 6pm. Not because she is failing. Because no one ever designed the two hours that break everyone. If that is you, you are exactly who we built this for.',
    promise: 'Instant access. Use it tonight.',
  },

  problem: {
    heading: 'Every day falls apart at the same time.',
    intro:
      'It is not you. It is the two hours nobody designed. You are asked to make the most decisions at the exact moment of the day you have the least left to decide with.',
    scene:
      'It is 5:10. Someone is melting down about homework, someone else is hanging off your leg, and a small voice asks what is for dinner like it is not the hardest question on earth. You have not sat down since noon. And you can feel the patience you meant to keep draining out of you in real time, with two hours still to go.',
    points: [
      'Five o\u2019clock hits and everyone needs you at once.',
      'Dinner, homework, baths, and bedtime collide while you run on empty.',
      'You are inventing the plan in the same moment you are supposed to run it.',
      'You start the evening patient and end it raising your voice.',
      'You lie in bed replaying the part where you snapped, promising tomorrow will be different. It is not.',
    ],
    cost:
      'This is the part no one names. The witching hour does not just cost you a hard evening. It costs you the version of yourself you meant to be at the end of the day, and the calm goodnight you wanted to give. You are allowed to want those two hours back.',
  },

  origin: {
    eyebrow: 'Why we built this',
    heading: 'We stopped trying to be more patient and changed the two hours instead.',
    paragraphs: [
      'Every piece of advice for the evening rush points at you. Be more patient. Stay calm. Lower your voice. As if the problem were your temperament and not the fact that you are running an unscripted, high-stakes operation at the lowest-energy point of your day.',
      'The mothers we built this with were not short on patience. They were spending all of it on decisions that did not need to be made at 5pm at all. What is for dinner. What happens first. How do we get from the table to the bath to the bed. Decided fresh, every single night, in the middle of the noise.',
      'So we built a sequence, not a pep talk. The hard calls get made once, in a calm moment, so the version of you running the evening is just following the plan, not inventing it on empty. We made it because we needed it, then made it portable so you do not have to design your own at 5:10 with a child on your leg.',
    ],
  },

  whatIs: {
    heading: 'A sequence, not a scramble.',
    paragraphs: [
      'The 5pm Reset is an AI tool that builds the hardest two hours a fixed order of operations. You answer a few quick questions about your kids, your dinners, and your bedtime, and in minutes it gives you the exact sequence to run from the witching hour to lights out.',
      'Then it does the part a routine chart never does. It decides dinner ahead of time, writes the wind-down words that end the night in sleep instead of a standoff, and hands you a recovery card for the nights it slips, so one hard moment does not blow up the whole evening.',
      'You are not bad at evenings. You are improvising the hardest part of the day. Decide it once, in calm, and 5pm-you just runs the plan.',
    ],
  },

  mechanism: {
    eyebrow: 'Why it works',
    heading: 'The witching hour is a decision-fatigue problem, not a patience problem.',
    label: 'You are making the most decisions at the hour you have the least left to decide with.',
    paragraphs: [
      'Here is the trap. By 5pm your capacity to decide is nearly gone, spent on a whole day of small calls no one else made. And that is exactly the moment the day asks you to make forty more, fast, while everyone is loud and hungry. It is not that you lack patience. You are out of the thing patience is made of.',
      'The fix is not white-knuckling through it. It is moving the decisions out of 5pm entirely. When dinner is already decided, when the order is already set, when the words are already written, the evening stops depending on how much you have left. You are not inventing and running the plan at the same time. You are just running it.',
      'That is the whole mechanism. Decide the hard calls once, in calm. Give the two hours one fixed order so the kids learn what is next. Keep a way to recover when it slips. Run the same sequence until it gets boring, because boring is the goal.',
    ],
    points: [
      { title: 'Decide ahead', description: 'Move the hard calls out of 5pm into a calm moment. Dinner, order, and wind-down are settled before the noise starts.' },
      { title: 'One fixed order', description: 'The same sequence every night. The kids learn what comes next, so you stop negotiating each step from scratch.' },
      { title: 'Recover, do not white-knuckle', description: 'A reset card for the nights it slips, so one meltdown does not take the whole evening down with it.' },
      { title: 'Boring on purpose', description: 'Predictability is what lowers the volume. The goal is an evening so routine it stops being a battle.' },
    ],
  },

  inside: {
    heading: 'What is inside',
    subheading: '5 personalized resources. Built from your answers in minutes, ready for tonight.',
    lead:
      'These are not generic charts you fill in yourself. The AI builds each one from your kids, your dinners, and your bedtime, so the whole sequence fits your actual evening: decide it ahead, run one order, end calm, and recover when it slips. Nothing here is filler.',
    items: [
      { title: 'The Evening Sequence', description: 'A fixed, low-friction order for the whole dinner-to-bed stretch, built for your kids\u2019 ages. The spine you run on autopilot instead of improvising.', icon: ListOrdered, tag: 'The spine', value: '$27', outcome: 'The two hours run on a plan instead of on whatever you have left.' },
      { title: 'The 15-Minute Dinner Shortlist', description: 'A short, personalized list of low-effort dinners, so the meal is decided long before the meltdown asks the question.', icon: UtensilsCrossed, tag: 'Dinner decided', value: '$19', outcome: 'The hardest question of the evening is already answered.' },
      { title: 'The Wind-Down Script', description: 'The exact words and steps that move the night toward sleep instead of a standoff. The part most routines leave you to wing.', icon: Moon, tag: 'End calm', value: '$24', outcome: 'Bedtime ends in lights out, not a negotiation.' },
      { title: 'The Reset Card', description: 'A one-glance recovery for the nights it goes sideways. What to do in the moment so one hard patch does not sink the whole evening.', icon: LifeBuoy, tag: 'When it slips', value: '$19', outcome: 'A bad ten minutes stops becoming a bad night.' },
      { title: 'The Family Cue Card', description: 'A kid-readable version of the sequence, so they can see what comes next without you narrating every step out loud.', icon: Route, tag: 'For the kids', value: '$10', outcome: 'The kids run the order with you, instead of waiting to be told.' },
    ],
  },

  method: {
    heading: 'How it works',
    subheading:
      'You answer a few questions. The AI builds the sequence. No chart to design, no evening lost figuring it out, nothing to keep up with. The hard part of the evening was never meant to be improvised.',
    steps: [
      { number: 1, title: 'Answer', description: 'A few quick questions about your kids\u2019 ages, the dinners you actually make, and your bedtime. No blank chart to design. This is the only part you do.', icon: Sparkles, meta: 'About 3 minutes', shift: 'The whole evening gets planned in one calm sitting, not at 5:10.' },
      { number: 2, title: 'The AI builds it', description: 'Your answers become a personalized sequence: the order, the dinner shortlist, the wind-down words, and the reset card. The evening arrives already decided.', icon: Clock, meta: 'Instant', shift: 'Every hard call for the night is made before the noise starts.' },
      { number: 3, title: 'Run it tonight', description: 'You follow the sequence instead of inventing it. Dinner is decided, the order is set, the words are ready. You are running the plan, not writing it on empty.', icon: ListOrdered, meta: 'Tonight', shift: 'The evening stops depending on how much you have left.' },
      { number: 4, title: 'Stay calm on repeat', description: 'Run the same sequence each night and tweak it weekly as the kids change. The AI keeps it current, so the order stays boring in the best way.', icon: RefreshCcw, meta: 'A few minutes a week', shift: 'The witching hour becomes the most predictable part of the day.' },
    ],
    closer:
      'No new routine to white-knuckle. No streak to protect. You answer, the AI builds, and you walk into 5pm with the plan already made, even on the hard days, because most days are.',
  },

  oldWay: {
    heading: 'The old way',
    items: [
      'Winging the hardest two hours, every single night',
      'Deciding dinner while someone melts down about dinner',
      'Screens to keep the peace, then a fight to turn them off',
      'Bedtime as a nightly negotiation you are too tired to win',
      'Hoping tonight somehow goes differently. It does not.',
    ],
  },

  newWay: {
    heading: 'The MotherMode way',
    items: [
      'One set order for the two hardest hours',
      'A short list of low-effort dinners, decided ahead',
      'A wind-down that ends in sleep, not a standoff',
      'A reset card for the nights it slips',
      'A cue card the kids can follow themselves',
    ],
  },

  founderLetter: {
    eyebrow: 'A letter from the founder',
    heading: 'I used to dread 5pm by 2pm.',
    greeting:
      'If you can feel the witching hour coming hours before it arrives, this part is for you.',
    paragraphs: [
      'For a long time I thought the evenings were proof of something about me. I was patient at the park, patient at lunch, and then somewhere around 5pm I would turn into a person I did not want my kids to remember. I read all the gentle-parenting advice. It told me to stay calm, which is a wonderful thing to be told when you have nothing left to be calm with.',
      'What I finally understood is that 5pm was not a test of my character. It was a design flaw in my day. I was making the hardest decisions of the evening at the exact hour my brain was most empty, while three people needed me at once. Of course it fell apart. I was inventing the plan and running it at the same time, on fumes.',
      'So I stopped trying to be more patient and started deciding everything ahead. Dinner chosen in the calm of the morning. One fixed order for the whole stretch. The exact words for the wind-down, written down so I did not have to find them mid-meltdown. And a small card for the nights it still went sideways, so one bad ten minutes did not become a bad night.',
      'It did not make me a calmer person. It made the two hours possible. I was not white-knuckling anymore, I was following a plan, and the plan held even on the days I had nothing left. That is the only reason this exists, and the reason I built it into a tool that designs your sequence for you, so you do not have to figure it out at 5:10 the way I did.',
      'I am not promising you perfect evenings. I am promising you an evening with a shape, so the version of you who says goodnight is the one you actually meant to be. You have improvised the hard hours long enough. Let the AI build the sequence, and run it tonight.',
    ],
    signoff: 'With you in it,',
    ps:
      'P.S. If you do one thing, run the sequence tonight. If the evening is not calmer within 14 days, email us and we refund every cent. The risk is mine. The quiet goodnight is yours.',
  },

  bonuses: {
    eyebrow: 'Yours free when you start today',
    heading: 'Three bonuses to make the first evening the easy one.',
    intro:
      'The AI builds the sequence in minutes. These make sure tonight actually goes differently, and that it sticks.',
    totalValue: '$65',
    items: [
      { title: 'The Bad Night Recovery Card', description: 'A one-glance script for the evenings that go off the rails anyway. Exactly what to do in the moment so you can pull the night back instead of riding it down.', value: '$19', icon: LifeBuoy, tag: 'Use it tonight' },
      { title: 'The Evening Handoff Card', description: 'A simple way to split the two hours with a partner so the load does not all land on you. Who has what, on one page, no negotiation required mid-meltdown.', value: '$29', icon: HeartHandshake, tag: 'Bring them in' },
      { title: 'Drop-the-Guilt Reframes', description: 'Short reframes for the nights you raised your voice, so the guilt does not follow you into tomorrow and make the next evening worse.', value: '$17', icon: Feather, tag: 'Let it go' },
    ],
    closer:
      'All three land in your account the moment you join. Nothing else to buy, nothing else to claim.',
  },

  proof: [
    { name: 'Renee', role: 'mother of two \u00b7 individual result', quote: 'The first night I ran the sequence I did not raise my voice once. Dinner was already decided, so I was not solving anything, I was just running the plan. It felt like cheating.', real: false },
    { name: 'Priya', role: 'mother of three', quote: 'The reset card is the part I did not know I needed. The nights still slip sometimes, but now one bad moment does not take the whole evening down with it.', real: false },
    { name: 'Dana', role: 'mother of one', quote: 'I have tried a hundred routine charts. This is the first one that decided the hard stuff for me instead of just listing it. Bedtime ends in sleep now, not a standoff.', real: false },
  ],

  bumps: [
    { id: 'printable_editable', title: 'Printable + editable pack', price: '$4.97', description: 'Yes. Add print-ready sequence and cue cards for the fridge, plus editable versions you can adjust on any device.' },
    { id: 'partner_scripts_plus', title: 'The evening handoff, extended', price: '$7.97', description: 'Yes. Add the full library for splitting the two hours with a partner, plus the words for when one of you is running late or solo.' },
    { id: 'domain_minipacks', title: '3 bonus time-of-day packs', price: '$9.97', description: 'Yes. Add reset sequences for the school morning, the after-school stretch, and the weekend, so every hard hour has a plan.' },
  ],

  faqs: [
    { q: 'Is this an app?', a: 'It is an AI tool that builds your evening sequence for you. You answer a few questions, it does the rest. There is nothing to maintain, no notifications, no streak to protect. It is the opposite of one more thing to keep up with at 5pm.' },
    { q: 'How is this different from a routine chart?', a: 'A chart lists what should happen and leaves the hard calls to you in the moment. The 5pm Reset decides dinner, sets the order, and writes the wind-down ahead of time, so you are running a plan instead of inventing one on empty.' },
    { q: 'My kids are different ages. Will this still work?', a: 'Yes. The AI builds the sequence around your kids\u2019 actual ages and your real bedtime, so the order and the wind-down fit your house, not a generic family.' },
    { q: 'What about the nights it still falls apart?', a: 'That is exactly what the Reset Card is for. Some nights will still slip. The card gives you a one-glance way to recover in the moment, so one hard patch does not become a hard night.' },
    { q: 'What if it does not work for me?', a: 'Run the sequence for a few nights. If your evenings are not calmer within 14 days, email us and we refund every cent.' },
  ],

  guarantee: {
    title: 'The Calmer Evening Guarantee',
    body: 'Run the sequence for a few nights. If the witching hour is not calmer within 14 days, email us and we refund every cent. No forms, no friction.',
  },

  finalCta: {
    heading: 'Win back the evening.',
    body: 'The witching hour is a design problem, not a character flaw. Answer a few questions, let the AI build your sequence, and run it tonight. Start today.',
  },
};
