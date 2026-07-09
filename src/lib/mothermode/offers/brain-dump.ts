import {
  Brain,
  ListChecks,
  SplitSquareVertical,
  MessagesSquare,
  RefreshCcw,
  Map,
  Moon,
  HeartHandshake,
  Feather,
  Sparkles,
} from 'lucide-react';
import type { MotherModeOffer } from '../types';

/**
 * The Brain Dump System. The flagship front-end offer. Solves one specific
 * problem: the invisible list a mother carries in her head. Entry point into
 * the full MotherMode redesign.
 */
export const brainDump: MotherModeOffer = {
  slug: 'brain-dump-system',
  productId: 'mm_brain_dump_system',
  category: 'The Mental Load Series',
  name: 'The Brain Dump System',
  tagline: 'Get every open tab out of your head and onto one page.',
  ready: true,

  priceCents: 700,
  originalPriceCents: 9700,

  hero: {
    eyebrow: 'For Mothers \u00b7 The Mental Load Series',
    headline: 'Go to bed with',
    headlineEmphasis: 'a calm mind',
    headlineSuffix: 'and wake up without the list already running.',
    subheadline:
      'No more lying awake running tomorrow. No more being the only one who knows where everything is. You answer a few quick questions, the AI builds your personalized system in minutes, and the people around you start carrying their share. Not another app to keep up with. Done before the coffee goes cold.',
    audience:
      'This is for the mother running the entire house from memory. Not because she chose to, but because no one else is keeping the list. If that is you, you are exactly who we built this for.',
    promise: 'Instant access. A lighter head in minutes, not someday.',
  },

  problem: {
    heading: 'You are the only one who knows.',
    intro:
      'Not because you chose to be. Because the list lives in one place, and that place is your head. It does not switch off when you do.',
    scene:
      "It is 11pm. The house is finally quiet, and your mind picks that exact moment to read the list back to you. The permission slip. The shoes that don't fit anymore. The text you still have not answered. You are not awake because you are anxious. You are awake because you are the only backup copy.",
    points: [
      "You lie awake running tomorrow. The form, the milk, the shoes that don't fit anymore.",
      'You open your phone to do one thing and forget it before the screen unlocks.',
      'You carry the dentist, the birthday gift, the prescription refill, the field-trip cash.',
      'You snap at the people you love, then carry the guilt of that too.',
      'You have tried the notes app, the planner, the sticky notes. The list still lives in your head.',
    ],
    cost:
      "This is the part no one names. The load is not just tiring, it is expensive. It takes the 11pm hour, the patience you meant to keep, the version of you who used to have a thought of her own. It's ok to want that back.",
  },

  origin: {
    eyebrow: 'Why we built this',
    heading: 'We got tired of being told to write it down.',
    paragraphs: [
      'Every tool aimed at the mental load makes the same quiet assumption: that the problem is you. That you forgot, that you are scattered, that the right planner would fix it. So it hands you a blank page and walks away.',
      'We never bought that. The mothers we built this with were not disorganized. They were running a full-time tracking job no one else could see, on top of the one with a paycheck. A prettier page does not lighten a load. It just gives it a nicer place to sit.',
      'So we built the opposite of a planner. Not a place to keep the list. A method to get it out of you, decide it once, and move the parts that were never only yours. We made it because we needed it, then made it portable so you do not have to build it from scratch at 11pm.',
    ],
  },

  whatIs: {
    heading: 'This is not another planner.',
    paragraphs: [
      'The Brain Dump System is an AI tool that pulls the mental load out of your head for you. You answer a few quick questions, and in minutes it builds the full inventory of what you are tracking, for everyone, named and visible for the first time.',
      'Then it does the part a planner never does. It asks, of each item, not where do I file this, but who said this was mine. It sorts every line, writes the scripts to hand off the work that was never only yours, and keeps a rhythm so the list never climbs back to where it started.',
      'You are not bad at remembering. You are holding too much. Name what you are carrying, and you can finally put some of it down.',
    ],
  },

  mechanism: {
    eyebrow: 'Why it works',
    heading: 'The mental load is a visibility problem, not a memory problem.',
    label: 'You cannot hand off what no one else can see.',
    paragraphs: [
      'A list that lives in your head has exactly one feature: only you can read it. That is the whole trap. It cannot be shared, split, or handed off, so it defaults to you, every time, by design. You are not failing the system. The system keeps no other copy.',
      'The fix is not remembering better. It is changing where the list lives. The moment it leaves your head and lands on one page, it becomes something other people can see, question, and carry. Visible work can be divided. Invisible work cannot.',
      'That is the whole mechanism. Get it out so it is shareable. Decide each item once. Move what should have been shared from the beggining. Then easily maintain it in less than 10 minutes a week.',
    ],
    points: [
      { title: 'Externalize', description: 'Out of your head, onto one page. The list stops being yours alone the second someone else can read it.' },
      { title: 'Decide once', description: 'Drop, Automate, Delegate, or Keep. The real cost of a task is re-deciding it. You pay that one time, not every night.' },
      { title: 'Hand off', description: 'Word-for-word scripts for the asks mothers carry for years, because saying the sentence felt harder than doing the task.' },
      { title: 'Stay light', description: 'A weekly reset that catches the list before it refills, so the load never gets the chance to climb back.' },
    ],
  },

  inside: {
    heading: 'What is inside',
    subheading: '5 personalized resources. Built from your answers in minutes, ready to use today.',
    lead:
      'These are not generic templates you fill in yourself. The AI builds each one from your answers, so every piece fits your actual life: get it out, decide it once, hand off what was never yours, keep it light. Nothing here is filler.',
    items: [
      { title: 'The Brain Dump Template', description: 'The structured prompts that pull every open tab out of your head. No blank page to stare at, no wondering if you missed something.', icon: ListChecks, tag: 'Get it out', value: '$27', outcome: 'The list leaves your head and becomes something anyone can read.' },
      { title: 'The Sorting Pass', description: 'Move each item into Drop, Automate, Delegate, or Keep. The decision gets made one time, not re-made every night at 11pm.', icon: SplitSquareVertical, tag: 'Decide once', value: '$24', outcome: 'A third of the list is gone before you do a single task.' },
      { title: 'The Delegate Scripts', description: 'The exact words for the partner, the sitter, the family. The sentences most mothers never find, so the asking stays harder than the doing.', icon: MessagesSquare, tag: 'Hand it off', value: '$19', outcome: 'The work that was never only yours finally moves off your plate.' },
      { title: 'The Weekly Reset', description: 'A one-page rhythm that catches the list before it refills. About 10 minutes, once a week. Not a new habit to defend.', icon: RefreshCcw, tag: 'Keep it light', value: '$17', outcome: 'The load never gets the chance to climb back to where it was.' },
      { title: 'The Load Map', description: 'A one-page picture of where the weight actually sits, so you stop guessing and know exactly what to cut first.', icon: Map, tag: 'See it', value: '$10', outcome: 'You can finally point at the invisible work and say: this is what I carry.' },
    ],
  },

  method: {
    heading: 'How it works',
    subheading:
      'You answer a few questions. The AI does the rest. No blank page, no weekend lost, nothing to keep up with. Most of the work here was never yours to do.',
    steps: [
      { number: 1, title: 'Answer', description: 'A few quick questions about your life and your people. No blank page to stare at. This is the only part you do.', icon: Brain, meta: 'About 3 minutes', shift: 'The whole load gets named in one place, without you digging for it.' },
      { number: 2, title: 'The AI builds it', description: 'Your answers become a personalized system, already sorted into Drop, Automate, Delegate, and Keep. The load is not just out of your head, it arrives already shrunk.', icon: Sparkles, meta: 'Instant', shift: 'You see how much you were carrying that never needed to be yours.' },
      { number: 3, title: 'Hand off', description: 'The AI writes the exact words for the partner, the sitter, the family. You send them. The work that was never only yours finally moves.', icon: MessagesSquare, meta: 'One conversation', shift: 'The work leaves your plate instead of just moving around on it.' },
      { number: 4, title: 'Stay light', description: 'A quick weekly check catches new items before they pile back up. The AI keeps it current, so you do not have to.', icon: RefreshCcw, meta: 'A few minutes a week', shift: 'The list never climbs back to the level that used to keep you up.' },
    ],
    closer:
      'No project to start. No streak to protect. You answer, the AI builds, and you walk away with a system that survives a hard week, because most weeks are.',
  },

  oldWay: {
    heading: 'The old way',
    items: [
      'A prettier planner you fill in for three days',
      '"Just write it down" and somehow still remember it all',
      'Doing it yourself because explaining it takes longer',
      'Another app you download, open twice, then resent for the notifications',
      'Waiting for the season to calm down. It does not.',
    ],
  },

  newWay: {
    heading: 'The MotherMode way',
    items: [
      'One structured dump that empties your head in a sitting',
      'A sorting system that decides each item once',
      'Scripts that move the work off your plate, not around it',
      'A weekly reset that keeps the load from refilling',
      'A clear map of what to put down first',
    ],
  },

  founderLetter: {
    eyebrow: 'A letter from the founder',
    heading: 'I wrote the first version of this for myself.',
    greeting:
      'If you are reading this with a quiet house and a loud head, this part is for you.',
    paragraphs: [
      'For years I thought I was the problem. I had the planners. I had the apps. I still woke at 3am running a list no one else could see, and I still snapped at the people I love over things that were not their fault. I decided I was just bad at this.',
      'I was not bad at it. I was the only one holding it. Every appointment, every size they outgrew, every form with a date on it lived in one place, and that place never got to clock out. That is not a character flaw. It is a design flaw, and I inherited it without ever agreeing to it.',
      'So one weekend I stopped trying to remember better and got it all out instead. Every open tab onto one page. Then I did the part the planners never tell you to do. I asked, of each line, who actually said this was mine. Most of it I kept. Some of it I dropped. A surprising amount I handed back to people who should have been carrying it all along.',
      'That weekend did not make me a better mother. I already was one. It made me a less buried one. I got the 11pm hour back. I got a thought of my own back. That is the only reason this exists, and the reason I built it into a tool that does the heavy part for you, so you do not have to spend a weekend figuring it out the way I did.',
      'I am not promising you a different life. I am promising you the same life with your head above the water line. You have carried the list long enough. Answer a few questions, let the AI do the heavy part, and put some of it down today.',
    ],
    signoff: 'With Love,',
    ps:
      'P.S. If you do one thing, do the first brain dump. If your head does not feel lighter within 14 days, email us and we refund every cent. The risk is mine. The quiet is yours.',
  },

  bonuses: {
    eyebrow: 'Yours free when you start today',
    heading: 'Three bonuses to make the first night the easy one.',
    intro:
      'The AI gets the list out of your head in minutes. These make sure the quiet actually sticks past the first day.',
    totalValue: '$65',
    items: [
      { title: 'The First Night Guide', description: 'Exactly what to do the evening after your first dump so the quiet does not evaporate by morning. Not more work. A short ritual that closes the loop your brain keeps reopening.', value: '$19', icon: Moon, tag: 'Use it tonight' },
      { title: 'The Invisible Work Conversation', description: 'A one-page way to show your partner what the load actually is, before you ask them to carry part of it. So the conversation starts with seeing, not blaming.', value: '$29', icon: HeartHandshake, tag: 'Bring them in' },
      { title: 'Drop-the-Guilt Scripts', description: 'Short reframes for the guilt that shows up the first time you hand something off. Because the hardest part of putting it down is letting yourself.', value: '$17', icon: Feather, tag: 'Put it down' },
    ],
    closer:
      'All three land in your account the moment you join. Nothing else to buy, nothing else to claim.',
  },

  proof: [
    { name: 'Renee', role: 'mother of two \u00b7 individual result', quote: 'I did the dump on a Sunday morning. For the first night in a long time my brain was quiet at bedtime. The list was finally out of my brain.', real: false },
    { name: 'Priya', role: 'mother of three', quote: 'The delegate scripts helped alot. Asking always felt harderso I never asked, just did.', real: false },
    { name: 'Dana', role: 'mother of one', quote: 'I have bought every planner. This is the first one that asked me to take things off the list instead of just writing them down prettier.', real: false },
  ],

  bumps: [
    { id: 'printable_editable', title: 'Printable + editable pack', price: '$4.97', description: 'Yes. Add the print-ready PDFs plus editable versions you can fill on any device.' },
    { id: 'partner_scripts_plus', title: 'The partner conversation, extended', price: '$7.97', description: 'Yes. Add the full script library for the harder asks, plus how to hold the conversation when it gets tense.' },
    { id: 'domain_minipacks', title: '3 bonus domain mini-packs', price: '$9.97', description: 'Yes. Add brain-dump mini-packs for money, health, and household so no domain gets left in your head.' },
  ],

  faqs: [
    { q: 'Is this an app?', a: 'It is an AI tool that builds your resources for you. You answer a few questions, it does the rest. There is nothing to maintain, no notifications, no streak to protect. It is the opposite of the apps that already drain you.' },
    { q: 'I have tried writing it down before.', a: 'You do not write it down this time. You answer a few questions and the AI builds the list, sorts it, and writes the hand-off scripts for you. Writing it down was never the hard part. Deciding and handing off was.' },
    { q: 'How long does it take?', a: 'A few minutes. You answer the questions, the AI builds everything, and you are done. The weekly check is shorter still.' },
    { q: 'Will this help with the partner conversation?', a: 'Yes. The Delegate Scripts give you the words for the asks most mothers dread making.' },
    { q: 'What if it does not work for me?', a: 'Do one brain dump. If your head does not feel lighter within 14 days, email us and we refund every cent.' },
  ],

  guarantee: {
    title: 'The Lighter Head Guarantee',
    body: 'Do one brain dump. If your mind does not feel quieter within 14 days, email us and we refund every cent. No forms, no friction.',
  },

  finalCta: {
    heading: 'Put some of it down.',
    body: 'You have carried the list long enough. Answer a few questions, lighten the load and calm the chaos, and go to bed with it quiet. Start today.',
  },
};
