import {
  Filter,
  Trash2,
  Repeat,
  MessagesSquare,
  ListChecks,
  RefreshCcw,
  Sparkles,
  Scale,
  HeartHandshake,
  Feather,
  Scissors,
} from 'lucide-react';
import type { MotherModeOffer } from '../types';

/**
 * The Offload Map. A full front-end offer in The Mental Load Series. Solves one
 * specific problem: the work that sits on your plate only because no one ever
 * decided it should not. Sort every task into Drop, Automate, Delegate, or Keep,
 * then actually move it.
 */
export const offloadMap: MotherModeOffer = {
  slug: 'offload-map',
  productId: 'mm_offload_map',
  category: 'The Mental Load Series',
  name: 'The Offload Map',
  tagline: 'Sort every task into Drop, Automate, Delegate, or Keep. Then actually hand it off.',
  ready: true,

  priceCents: 2700,
  originalPriceCents: 9700,

  hero: {
    eyebrow: 'For Mothers \u00b7 The Mental Load Series',
    headline: 'Most of what you carry',
    headlineEmphasis: 'was never only yours',
    headlineSuffix: 'and now you have one decision to prove it.',
    subheadline:
      'No more keeping a task because explaining it felt slower than doing it. You bring the list, the AI gives every item one of four decisions in minutes, and you walk away with a short Keep pile plus the exact scripts and setups to move the rest. Not another planner. Done before the coffee goes cold.',
    audience:
      'This is for the mother whose plate is full of things no one ever actually assigned her. She did not choose them. She just noticed them first, every time. If that is you, you are exactly who we built this for.',
    promise: 'Instant access. A shorter list by tonight.',
  },

  problem: {
    heading: 'You are doing things that do not need doing. By you.',
    intro:
      'Not because they are yours. Because a task with no decision attached defaults to whoever notices it first, and that is always you.',
    scene:
      'You are wiping the counter for the third time today, mentally adding the thing you just saw to a list only you can read. You could ask someone. But explaining it takes longer than doing it, and you know that, so you keep it. That is how the plate fills. One reasonable shortcut at a time, until it is buried.',
    points: [
      'Tasks sit on your plate because explaining them feels slower than doing them.',
      'You confuse what only you can do with what you have always done.',
      'You want to delegate, but you do not have the words, so you keep it.',
      'The recurring stuff comes back every week, and every week you do it again by hand.',
      'You have tried to hand things off before. They boomeranged right back to you.',
    ],
    cost:
      'This is the part no one names. Every task you keep by default is rent you pay forever, in time and attention you do not get back. You are allowed to stop paying for work that was never only yours.',
  },

  origin: {
    eyebrow: 'Why we built this',
    heading: 'We got tired of a Keep pile the size of the whole list.',
    paragraphs: [
      'Every productivity system tells you to organize the list. Sort it by priority, color-code it, put it in the right app. But organizing a load you should not be carrying just gives it a tidier place to crush you. The question was never how to arrange it. It was how much of it could leave.',
      'The mothers we built this with were not bad at managing tasks. They were carrying a Keep pile that had never been questioned, full of work that could have been dropped, automated, or handed off years ago. No one ever made them decide. So it all defaulted to Keep, which means it all defaulted to them.',
      'So we built a filter, not a planner. One that forces a single decision on every item, then hands you the means to act on it. We made it because we needed our own Keep pile cut in half, then made it portable so you do not have to invent the filter from scratch.',
    ],
  },

  whatIs: {
    heading: 'This is not another to-do list.',
    paragraphs: [
      'The Offload Map is an AI tool that runs every task you carry through one filter: Drop, Automate, Delegate, or Keep. You bring the list, it makes the decision on each line in minutes, and what is left in Keep is finally just the work that is genuinely yours.',
      'Then it does the part a to-do list never does. It writes the scripts for what you delegate, builds the setups for what you automate, and gives you permission for what you drop. The decisions do not just get made. They get acted on.',
      'You are not bad at staying on top of it. You are carrying a Keep pile no one ever made you question. Give each item one decision, and most of it can finally leave.',
    ],
  },

  mechanism: {
    eyebrow: 'Why it works',
    heading: 'The load is a default problem, not a discipline problem.',
    label: 'A task with no decision defaults to whoever notices it first.',
    paragraphs: [
      'Here is the trap. Every task that does not have an explicit decision attached has an implicit one: keep doing it the way it has always been done, by the person already doing it. That is the default, and the default is always you. You are not failing to keep up. The system quietly assigns everything to Keep unless someone interrupts it.',
      'The fix is not working harder on the list. It is forcing a real decision on each item, once, so it stops defaulting. The moment a task has to be Dropped, Automated, Delegated, or Kept on purpose, most of it does not survive the question. The Keep pile was never that big. It just never got challenged.',
      'That is the whole mechanism. Make each item face one decision. Drop what does not matter. Automate what repeats. Delegate what was never only yours. Keep only what is genuinely yours, and keep re-sorting so nothing creeps back to default.',
    ],
    points: [
      { title: 'Force the decision', description: 'Drop, Automate, Delegate, or Keep. Every item faces it once. The default of "just keep doing it" stops being free.' },
      { title: 'Cut the dead weight', description: 'A surprising amount of the list does not survive the question. You drop it before you ever do it again.' },
      { title: 'Move what is left', description: 'Scripts to delegate, setups to automate. The non-Keep piles leave your plate instead of moving around on it.' },
      { title: 'Hold the line', description: 'A weekly re-sort catches what drifted back to Keep, so the plate does not quietly refill by default.' },
    ],
  },

  inside: {
    heading: 'What is inside',
    subheading: '5 personalized resources. Built from your list in minutes, ready to use today.',
    lead:
      'These are not blank templates you sort yourself. The AI runs your actual list through the filter, so every piece is acting on your real tasks: sort them, drop them, automate them, hand them off, and protect the short pile that is left. Nothing here is filler.',
    items: [
      { title: 'The Sorting Grid', description: 'The one-page filter that gives every task a single, final home: Drop, Automate, Delegate, or Keep. No item gets to stay undecided.', icon: Filter, tag: 'Sort it', value: '$27', outcome: 'Every task has exactly one decision attached, instead of defaulting to you.' },
      { title: 'The Drop List', description: 'The permission and the prompts to delete the tasks that never actually mattered. The fastest weight you will ever lose.', icon: Trash2, tag: 'Drop it', value: '$19', outcome: 'A third of the list is gone before you do a single thing.' },
      { title: 'The Automate Library', description: 'The set-and-forget setups that delete recurring tasks for good. The standing order, the auto-refill, the recurring everything.', icon: Repeat, tag: 'Automate it', value: '$24', outcome: 'The tasks that came back every week stop coming back at all.' },
      { title: 'The Delegate Scripts', description: 'Word-for-word asks for the partner, the sitter, the family. The sentences that make the work stay handed off instead of boomeranging back.', icon: MessagesSquare, tag: 'Delegate it', value: '$24', outcome: 'The work that was never only yours finally moves, and stays moved.' },
      { title: 'The Keep List', description: 'The short, honest pile of what is genuinely yours, with everything else cleared away from around it. So you can see it is smaller than it felt.', icon: ListChecks, tag: 'Keep it', value: '$10', outcome: 'You see, in one page, how little was ever actually only yours.' },
    ],
  },

  method: {
    heading: 'How it works',
    subheading:
      'You bring the list. The AI does the deciding and the moving. No blank grid to fill in, no weekend lost, nothing to keep up with. Most of this list was never yours to carry.',
    steps: [
      { number: 1, title: 'Bring the list', description: 'Dump what you are carrying, or paste a brain dump you already have. A few quick questions about your people fill in the gaps. This is the only part you do.', icon: Sparkles, meta: 'About 3 minutes', shift: 'The whole plate is named in one place, ready to be cut down.' },
      { number: 2, title: 'The AI sorts it', description: 'Every item gets one decision: Drop, Automate, Delegate, or Keep. The load is not just organized, it arrives already cut, with the Keep pile finally small.', icon: Filter, meta: 'Instant', shift: 'You see how much of the list never needed to be yours at all.' },
      { number: 3, title: 'Move it', description: 'The AI writes the delegate scripts, lays out the automations, and confirms the drops. You send and set up. The non-Keep piles leave your plate.', icon: MessagesSquare, meta: 'One sitting', shift: 'The work moves off your plate instead of just around on it.' },
      { number: 4, title: 'Stay light', description: 'A quick weekly re-sort catches anything that drifted back to Keep before it settles. The AI keeps it current, so you do not have to.', icon: RefreshCcw, meta: 'A few minutes a week', shift: 'The plate stops quietly refilling itself by default.' },
    ],
    closer:
      'No system to maintain. No streak to protect. You bring the list once, the AI cuts and moves it, and you walk away carrying only what was actually yours.',
  },

  oldWay: {
    heading: 'The old way',
    items: [
      'Keeping a task because explaining it is slower',
      'Confusing "only I can do this" with "I have always done this"',
      'Wanting to delegate but never finding the words',
      'Doing the same recurring chores by hand, every single week',
      'Handing something off, only to have it boomerang back to you',
    ],
  },

  newWay: {
    heading: 'The MotherMode way',
    items: [
      'One final decision on every single task',
      'A Drop pile that clears a third of the list for free',
      'Automations that delete recurring work for good',
      'Scripts that move the work off your plate, not around it',
      'A weekly re-sort that keeps the plate from refilling',
    ],
  },

  founderLetter: {
    eyebrow: 'A letter from the founder',
    heading: 'I counted my Keep pile once. It was almost the whole list.',
    greeting:
      'If your plate is full of things no one ever actually handed you, this part is for you.',
    paragraphs: [
      'For years I thought the answer was a better system to hold it all. A smarter list, a tidier app, a planner that finally stuck. I was very organized and still completely buried, because I was organizing a load that should never have been mine to organize in the first place.',
      'The thing that changed it was not a new list. It was a question I had never asked of any task: who actually said this was mine. Not where does it go. Not when is it due. Just, who decided this defaults to me. And the honest answer, on item after item, was nobody. It defaulted to me because I noticed it first and kept it.',
      'So I stopped sorting and started deciding. Drop, Automate, Delegate, or Keep, one ruling per line. I dropped things I had done weekly for years. I automated refills and orders I had been doing by hand. I handed back work that was never only mine, with actual words this time so it stayed handed back. My Keep pile shrank to something I could actually carry.',
      'That did not make me a better mother. I already was one. It made me a less buried one, carrying only what was genuinely mine. That is the only reason this exists, and the reason I built it into a tool that does the deciding and the moving for you, so you do not have to invent the filter at the kitchen counter the way I did.',
      'I am not promising you a different life. I am promising you the same life with most of the dead weight gone. You have kept that list by default long enough. Bring it, let the AI cut it, and put down what was never yours today.',
    ],
    signoff: 'With you in it,',
    ps:
      'P.S. If you do one thing, run your list through the grid once. If your plate is not lighter within 14 days, email us and we refund every cent. The risk is mine. The shorter list is yours.',
  },

  bonuses: {
    eyebrow: 'Yours free when you start today',
    heading: 'Three bonuses to make the first cut the easy one.',
    intro:
      'The AI sorts the list in minutes. These make sure the things you drop and hand off actually stay gone.',
    totalValue: '$65',
    items: [
      { title: 'The First Cut Guide', description: 'Exactly how to drop your first ten items tonight without second-guessing every one. The fastest way to feel the plate get lighter on day one.', value: '$19', icon: Scissors, tag: 'Start tonight' },
      { title: 'The Fair-Share Picture', description: 'A one-page way to show your partner what the load actually is before you ask them to carry part of it. So the handoff starts with seeing, not blaming.', value: '$29', icon: HeartHandshake, tag: 'Bring them in' },
      { title: 'Drop-the-Guilt Scripts', description: 'Short reframes for the guilt that shows up the first time you delete or hand something off. Because the hardest part of putting it down is letting yourself.', value: '$17', icon: Feather, tag: 'Put it down' },
    ],
    closer:
      'All three land in your account the moment you join. Nothing else to buy, nothing else to claim.',
  },

  proof: [
    { name: 'Renee', role: 'mother of two \u00b7 individual result', quote: 'I ran my list through the grid and dropped eleven things in the first ten minutes. Eleven. Things I had been doing for years that genuinely did not matter.', real: false },
    { name: 'Priya', role: 'mother of three', quote: 'The delegate scripts are the whole thing. I had handed work off before and it always came back. This time it stayed gone, because the ask was actually clear.', real: false },
    { name: 'Dana', role: 'mother of one', quote: 'I have bought every productivity tool. This is the first one that helped me carry less instead of just organizing more. My Keep pile is half what it was.', real: false },
  ],

  bumps: [
    { id: 'printable_editable', title: 'Printable + editable pack', price: '$4.97', description: 'Yes. Add the print-ready grid plus editable versions you can sort on any device.' },
    { id: 'partner_scripts_plus', title: 'The delegate scripts, extended', price: '$7.97', description: 'Yes. Add the full script library for the harder handoffs, plus how to hold the line when the work tries to boomerang back.' },
    { id: 'domain_minipacks', title: '3 bonus domain mini-packs', price: '$9.97', description: 'Yes. Add offload mini-packs for money, health, and household so every domain gets sorted, not just the obvious one.' },
  ],

  faqs: [
    { q: 'Is this an app?', a: 'It is an AI tool that sorts your list for you. You bring the tasks, it makes the decision on each one and writes the scripts and setups. There is nothing to maintain, no notifications, no streak to protect.' },
    { q: 'How is this different from the Brain Dump System?', a: 'The Brain Dump gets the list out of your head. The Offload Map decides what happens to each item, then moves it. Many mothers do the dump first, then run that list through the map. They stack, but each works on its own.' },
    { q: 'What if everything feels like a Keep?', a: 'That is exactly the trap, and the grid is built for it. The filter forces each item to earn its place in Keep instead of defaulting there. Most do not survive the question.' },
    { q: 'I have tried to delegate before and it came back.', a: 'That is what the Delegate Scripts fix. Work boomerangs when the ask is vague. The scripts make the handoff clear enough that it stays handed off.' },
    { q: 'What if it does not work for me?', a: 'Run your list through the grid once. If your plate is not lighter within 14 days, email us and we refund every cent.' },
  ],

  guarantee: {
    title: 'The Shorter List Guarantee',
    body: 'Run your list through the grid once. If your plate does not feel lighter within 14 days, email us and we refund every cent. No forms, no friction.',
  },

  finalCta: {
    heading: 'Hand it off.',
    body: 'Most of what you carry was never only yours. Bring the list, let the AI give each item one decision, and move what was never meant to be on your plate. Start today.',
  },
};
