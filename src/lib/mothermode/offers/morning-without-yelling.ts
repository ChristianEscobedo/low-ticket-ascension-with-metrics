import {
  Moon,
  Route,
  Backpack,
  DoorOpen,
  ListChecks,
  Sparkles,
  RefreshCcw,
  Sunrise,
  HeartHandshake,
  Feather,
  LifeBuoy,
} from 'lucide-react';
import type { MotherModeOffer } from '../types';

/**
 * The Morning Without Yelling. A full front-end offer in The Daily Rhythm
 * Series. Solves one specific problem: the school-morning battle you lose by
 * 8am. Move the work to the night before and hand the routine to the kids, so
 * you stop being the engine that drags everyone out the door.
 */
export const morningWithoutYelling: MotherModeOffer = {
  slug: 'morning-without-yelling',
  productId: 'mm_morning_without_yelling',
  category: 'The Daily Rhythm Series',
  name: 'The Morning Without Yelling',
  tagline: 'Out the door on time, without becoming someone you do not want to be.',
  ready: true,

  priceCents: 2700,
  originalPriceCents: 9700,

  hero: {
    eyebrow: 'For Mothers \u00b7 The Daily Rhythm Series',
    headline: 'Get out the door on time',
    headlineEmphasis: 'without the yelling',
    headlineSuffix: 'and without starting everyone\u2019s day on a bad note.',
    subheadline:
      'No more repeating yourself ten times before anyone moves. You answer a few quick questions, the AI builds your school-morning system in minutes, and tomorrow the work is already done the night before and the kids run the routine themselves. Not another chore chart. Ready before bedtime tonight.',
    audience:
      'This is for the mother who has asked nicely, counted to three, and is tired of being the alarm, the timer, and the bad guy before 8am. Not because she is doing it wrong. Because the whole morning is routed through her. If that is you, you are exactly who we built this for.',
    promise: 'Instant access. Use it tomorrow morning.',
  },

  problem: {
    heading: 'The morning is a battle you lose by 8am.',
    intro:
      'It is not you. The entire morning is stacked into one short, high-pressure window and routed through one person, and that person is you.',
    scene:
      'It is 7:48. You have said "shoes" four times. Someone is eating cereal in slow motion, someone cannot find a bag that is exactly where it always is, and the clock is the only thing moving with any urgency. You hear your own voice climb, you watch their faces fall, and you think, again, this is not who I want to be at 7am.',
    points: [
      'You repeat yourself ten times before anyone moves.',
      'Shoes, bags, and breakfast become a daily emergency at the worst possible minute.',
      'You are the alarm, the timer, the chef, and the bad guy, all at once.',
      'Every step waits for you to narrate it, so nothing runs without you.',
      'You drop them off already drained, and a little ashamed of how it went.',
    ],
    cost:
      'This is the part no one names. The morning does not just make you late. It sets the tone of the whole day, for them and for you, and it spends the patience you wanted to bring to everything after. You are allowed to want a different start.',
  },

  origin: {
    eyebrow: 'Why we built this',
    heading: 'We stopped trying to get faster and moved the work instead.',
    paragraphs: [
      'Every tip for the school morning assumes the answer is more speed and more willpower. Wake up earlier. Be firmer. Stay on top of them. As if the problem were your pace, and not the fact that the entire morning is crammed into twenty minutes and depends on you to run every single step of it.',
      'The mothers we built this with were not slow or disorganized. They were the only moving part in a system that had no other engine. Every shoe, every bag, every transition waited on them to push it. So the morning was not a routine. It was one person manually dragging a household across a finish line, daily, against a clock.',
      'So we built a system, not a speech. The work moves to the night before, where there is slack, and the routine moves to the kids, who can run it once they can see it. We made it because we needed it, then made it portable so you do not have to invent it at 7:48 with your voice already rising.',
    ],
  },

  whatIs: {
    heading: 'Move the work to the night before.',
    paragraphs: [
      'The Morning Without Yelling is an AI tool that builds your school morning into a system the whole house can run. You answer a few quick questions about your kids and your leave time, and in minutes it gives you the night-before setup, a kid-readable morning map, and a calm exit routine.',
      'Then it does the part a chore chart never does. It front-loads tomorrow\u2019s chaos into a five-minute evening setup, then hands the steps to the kids in a form they can follow without you, so the morning stops depending on you narrating every move.',
      'You are not bad at mornings. You are the only engine in a system that was never built to have just one. Move the work to the night before, make it visible, and the morning starts running without you pushing it.',
    ],
  },

  mechanism: {
    eyebrow: 'Why it works',
    heading: 'The morning is a load-bearing problem, not a speed problem.',
    label: 'A morning that depends on you narrating every step will always be run by you.',
    paragraphs: [
      'Here is the trap. The morning crams a dozen tasks into a tiny, time-boxed window, and every one of them routes through you to happen. You are the alarm, the reminder, the locator, the timekeeper. Nothing advances until you push it. That is not a discipline gap. It is a system with exactly one moving part, under a clock, by design.',
      'The fix is not moving faster. It is changing when the work happens and who runs it. Most of the morning can be done the night before, when there is actually slack in the day. And most of what is left can be run by the kids, the moment they can see the steps instead of waiting to be told. You stop being the engine and become the person who set the system up.',
      'That is the whole mechanism. Front-load the work into a calm evening window. Make the routine visible so it does not live in your mouth. Hand the steps to the kids so the morning advances without you. Run the same shape daily until it is boring, because boring leaves on time.',
    ],
    points: [
      { title: 'Front-load it', description: 'Move the work to the night before, where the day has slack. The morning starts already half done.' },
      { title: 'Make it visible', description: 'A map the kids can read, so the routine lives on the wall instead of in your mouth.' },
      { title: 'Hand it over', description: 'Kids run their own steps once they can see them. You stop being the engine that pushes each one.' },
      { title: 'Same every day', description: 'A predictable shape lowers the volume. The goal is a morning so routine it leaves on time without a fight.' },
    ],
  },

  inside: {
    heading: 'What is inside',
    subheading: '5 personalized resources. Built from your answers in minutes, ready for tomorrow.',
    lead:
      'These are not generic charts you fill in yourself. The AI builds each one from your kids\u2019 ages and your real leave time, so the whole system fits your actual morning: front-load it, make it visible, hand it off, and leave on time. Nothing here is filler.',
    items: [
      { title: 'The Night-Before Setup', description: 'A five-minute evening checklist that defuses the morning before it starts. Clothes, bags, and breakfast decided while the day still has slack.', icon: Moon, tag: 'The night before', value: '$24', outcome: 'Tomorrow morning starts already half done.' },
      { title: 'The Visual Morning Map', description: 'A kid-readable routine they follow themselves, built for their ages, so you stop narrating every single step out loud.', icon: Route, tag: 'For the kids', value: '$27', outcome: 'The routine lives on the wall instead of in your mouth.' },
      { title: 'The Launch Pad Checklist', description: 'One landing spot for shoes, bags, and everything that goes out the door, set up the night before so nothing is ever hunted at 7:50.', icon: Backpack, tag: 'No more hunting', value: '$14', outcome: 'The frantic search for shoes and bags is over.' },
      { title: 'The Calm Exit Routine', description: 'The final ten minutes, sequenced, so leaving is boring instead of frantic. The handoff from home to door, made automatic.', icon: DoorOpen, tag: 'Out the door', value: '$19', outcome: 'You leave on time without the last-minute panic.' },
      { title: 'The Independence Cue Cards', description: 'Age-appropriate steps each kid owns, so the morning advances on their effort, not only yours. The path off being the engine.', icon: ListChecks, tag: 'They run it', value: '$10', outcome: 'The kids move themselves, instead of waiting to be pushed.' },
    ],
  },

  method: {
    heading: 'How it works',
    subheading:
      'You answer a few questions. The AI builds the system. No chart to design, no morning lost figuring it out, nothing to keep up with. The morning was never meant to run on one person.',
    steps: [
      { number: 1, title: 'Answer', description: 'A few quick questions about your kids\u2019 ages, your leave time, and where the morning usually jams. No blank chart to design. This is the only part you do.', icon: Sparkles, meta: 'About 3 minutes', shift: 'The whole morning gets planned in a calm moment, not at 7:48.' },
      { number: 2, title: 'The AI builds it', description: 'Your answers become a personalized system: the night-before setup, the visual map, the launch pad, and the exit routine. The morning arrives already designed.', icon: Sunrise, meta: 'Instant', shift: 'The work moves off your shoulders and onto a system the house can see.' },
      { number: 3, title: 'Set up tonight', description: 'Run the five-minute night-before setup and put the map on the wall. Tomorrow the kids follow the steps themselves instead of waiting on you.', icon: Moon, meta: 'Tonight', shift: 'You stop being the engine and become the person who set it up.' },
      { number: 4, title: 'Stay calm on repeat', description: 'Run the same shape each day and tweak it as the kids grow into more steps. The AI keeps it current, so the morning stays boring in the best way.', icon: RefreshCcw, meta: 'A few minutes a week', shift: 'The school morning becomes the most predictable part of the day.' },
    ],
    closer:
      'No new speed to summon. No streak to protect. You answer, the AI builds, and you walk into tomorrow with the work already done and the kids already moving, even on the hard mornings, because most mornings are.',
  },

  oldWay: {
    heading: 'The old way',
    items: [
      'Repeating yourself until you snap',
      'A frantic search for shoes and bags at 7:55',
      'Doing every step yourself because it is faster',
      'Being the alarm, the timer, and the bad guy',
      'Dropping them off drained, vowing tomorrow will be different',
    ],
  },

  newWay: {
    heading: 'The MotherMode way',
    items: [
      'A five-minute night-before setup',
      'A visual map the kids run themselves',
      'One launch pad so nothing gets hunted',
      'A calm, sequenced exit that leaves on time',
      'Steps the kids own, so you stop being the engine',
    ],
  },

  founderLetter: {
    eyebrow: 'A letter from the founder',
    heading: 'I used to apologize to my kids in the car every morning.',
    greeting:
      'If you have ever said sorry on the drive to school for how the morning went, this part is for you.',
    paragraphs: [
      'For years the morning was the worst version of me. I was gentle by lunchtime and a drill sergeant by 7:45. I read all the advice. Wake earlier, be firmer, stay consistent. It told me to be a better engine. It never once asked why the whole morning needed an engine at all.',
      'What I finally saw is that the morning was not a willpower problem. It was a design problem. Everything that had to happen was crammed into one short window, against a clock, and every single step ran through me. Of course I was yelling. I was the only moving part in a machine with a dozen jobs and twenty minutes.',
      'So I stopped trying to go faster and moved the work instead. The clothes, the bags, the breakfast call, all decided the night before when the day still had room. The steps put on the wall where the kids could read them. One spot by the door for everything that leaves. And slowly, the morning started running without me pushing every part of it.',
      'It did not make me a calmer person at 7am. It made the morning need less of me, which came to the same thing. I was not narrating and dragging anymore, I was sipping coffee while a system I built ran itself. That is the only reason this exists, and the reason I turned it into a tool that designs your morning for you, so you do not have to build it at 7:48 the way I did.',
      'I am not promising you children who leap out of bed. I am promising you a morning with a shape, so the person who drops them off is the one you actually meant to be. You have been the engine long enough. Set it up tonight, and run it tomorrow.',
    ],
    signoff: 'With you in it,',
    ps:
      'P.S. If you do one thing, run the night-before setup tonight. If tomorrow morning is not calmer within 14 days, email us and we refund every cent. The risk is mine. The calmer drop-off is yours.',
  },

  bonuses: {
    eyebrow: 'Yours free when you start today',
    heading: 'Three bonuses to make the first morning the easy one.',
    intro:
      'The AI builds the system in minutes. These make sure tomorrow actually goes differently, and that it holds.',
    totalValue: '$65',
    items: [
      { title: 'The Off-Morning Recovery Card', description: 'A one-glance plan for the mornings that go sideways anyway. The late wake-up, the lost shoe, the meltdown. Exactly what to drop so you still leave on time.', value: '$19', icon: LifeBuoy, tag: 'Use it tomorrow' },
      { title: 'The Co-Parent Morning Split', description: 'A simple way to divide the morning with a partner so it does not all route through you. Who has which steps, on one page, no negotiation at 7am.', value: '$29', icon: HeartHandshake, tag: 'Bring them in' },
      { title: 'Drop-the-Guilt Reframes', description: 'Short reframes for the mornings you raised your voice, so the guilt does not ride along to school and set the tone for the next one.', value: '$17', icon: Feather, tag: 'Let it go' },
    ],
    closer:
      'All three land in your account the moment you join. Nothing else to buy, nothing else to claim.',
  },

  proof: [
    { name: 'Renee', role: 'mother of two \u00b7 individual result', quote: 'The first morning the map was on the wall, my six-year-old just started doing the steps. I did not say a word. I almost cried into my coffee.', real: false },
    { name: 'Priya', role: 'mother of three', quote: 'The night-before setup is the whole thing. Five minutes after they are down, and the morning is already half over before it starts. We have not hunted for a shoe in weeks.', real: false },
    { name: 'Dana', role: 'mother of one', quote: 'I have tried every chore chart on the internet. This is the first one that moved the work off me instead of just listing it. I stopped being the alarm.', real: false },
  ],

  bumps: [
    { id: 'printable_editable', title: 'Printable + editable pack', price: '$4.97', description: 'Yes. Add the print-ready morning map and launch-pad labels for the wall, plus editable versions you can adjust on any device.' },
    { id: 'partner_scripts_plus', title: 'The morning split, extended', price: '$7.97', description: 'Yes. Add the full library for dividing the morning with a partner, plus the words for when one of you is gone or running late.' },
    { id: 'domain_minipacks', title: '3 bonus time-of-day packs', price: '$9.97', description: 'Yes. Add systems for the after-school stretch, the bedtime wind-down, and the weekend, so every hard hour has a plan.' },
  ],

  faqs: [
    { q: 'Is this an app?', a: 'It is an AI tool that builds your morning system for you. You answer a few questions, it does the rest. There is nothing to maintain, no notifications, no streak to protect. It is the opposite of one more thing to run before 8am.' },
    { q: 'How is this different from a chore chart?', a: 'A chart lists what should happen and still leaves you to push every step. The Morning Without Yelling moves the work to the night before and hands the routine to the kids in a form they can run, so the morning advances without you narrating it.' },
    { q: 'My kids are too young to read a chart.', a: 'The Visual Morning Map is built for ages. For little ones it uses pictures and simple icons, so even pre-readers can see what comes next and start running their own steps.' },
    { q: 'What about the mornings it still falls apart?', a: 'That is exactly what the Off-Morning Recovery Card is for. Some mornings will still slip. The card tells you what to drop in the moment so you still get out the door on time.' },
    { q: 'What if it does not work for me?', a: 'Run the system for a few mornings. If they are not calmer within 14 days, email us and we refund every cent.' },
  ],

  guarantee: {
    title: 'The Calmer Morning Guarantee',
    body: 'Run the system for a few mornings. If the school morning is not calmer within 14 days, email us and we refund every cent. No forms, no friction.',
  },

  finalCta: {
    heading: 'Start the day on your terms.',
    body: 'Mornings do not have to start with raised voices. Answer a few questions, let the AI build the system, and set it up tonight. Start today.',
  },
};
