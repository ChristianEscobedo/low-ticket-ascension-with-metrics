import {
  ListChecks,
  SplitSquareVertical,
  MessagesSquare,
  RefreshCcw,
  Map,
} from 'lucide-react';
import type { InsideItem, MotherModeOffer } from '../types';

/**
 * Builds a complete, coherent MotherModeOffer from the offer-specific essentials
 * while filling the shared scaffolding (method, bumps, faqs, guarantee) with
 * MotherMode defaults. Used to register catalog offers that are still being
 * deep-authored, so their pages render real copy rather than placeholders.
 *
 * Mark `ready: false` until the offer gets its bespoke proof and full copy.
 */
export interface DraftSpec {
  slug: string;
  productId: string;
  category: string;
  name: string;
  tagline: string;
  priceCents?: number;
  originalPriceCents?: number;
  hero: MotherModeOffer['hero'];
  problem: MotherModeOffer['problem'];
  whatIs: MotherModeOffer['whatIs'];
  inside: MotherModeOffer['inside'];
  oldWay: string[];
  newWay: string[];
  finalCta: MotherModeOffer['finalCta'];
}

const sharedBumps = [
  { id: 'printable_editable', title: 'Printable + editable pack', price: '$4.97', description: 'Yes. Add the print-ready PDFs plus editable versions you can fill on any device.' },
  { id: 'partner_scripts_plus', title: 'The partner conversation, extended', price: '$7.97', description: 'Yes. Add the full script library for the harder asks, plus how to hold the conversation when it gets tense.' },
  { id: 'domain_minipacks', title: '3 bonus domain mini-packs', price: '$9.97', description: 'Yes. Add mini-packs for the next three rooms of your life so nothing gets left in your head.' },
];

const sharedFaqs = [
  { q: 'Is this an app?', a: 'No. It is a set of templates and scripts you can print or fill on any device. Nothing to learn, nothing to maintain.' },
  { q: 'How long does it take?', a: 'The first pass takes one short sitting. After that it is a few minutes to keep running.' },
  { q: 'What if it does not work for me?', a: 'Use it once. If it does not lighten the load within 14 days, email us and we refund every cent.' },
];

function defaultMethod(): MotherModeOffer['method'] {
  return {
    heading: 'How it works',
    steps: [
      { number: 1, title: 'Name it', description: 'Get the full picture out of your head and onto the page.', icon: ListChecks },
      { number: 2, title: 'Sort it', description: 'Decide each item once: drop, automate, delegate, or keep.', icon: SplitSquareVertical },
      { number: 3, title: 'Hand it off', description: 'Use the scripts to move the work that was never only yours.', icon: MessagesSquare },
      { number: 4, title: 'Keep it light', description: 'A short weekly rhythm so it never refills to the same level.', icon: RefreshCcw },
    ],
  };
}

const defaultIcons = [ListChecks, SplitSquareVertical, MessagesSquare, RefreshCcw, Map];

/** Attach default icons to inside items that did not specify one. */
function withIcons(items: Omit<InsideItem, 'icon'>[]): InsideItem[] {
  return items.map((item, i) => ({ ...item, icon: defaultIcons[i % defaultIcons.length] }));
}

export function makeDraftOffer(spec: DraftSpec): MotherModeOffer {
  return {
    slug: spec.slug,
    productId: spec.productId,
    category: spec.category,
    name: spec.name,
    tagline: spec.tagline,
    ready: false,
    priceCents: spec.priceCents ?? 2700,
    originalPriceCents: spec.originalPriceCents ?? 9700,
    hero: spec.hero,
    problem: spec.problem,
    whatIs: spec.whatIs,
    inside: spec.inside,
    method: defaultMethod(),
    oldWay: { heading: 'The old way', items: spec.oldWay },
    newWay: { heading: 'The MotherMode way', items: spec.newWay },
    proof: [],
    bumps: sharedBumps,
    faqs: sharedFaqs,
    guarantee: {
      title: 'The 14-Day Guarantee',
      body: 'Use it once. If it does not lighten the load within 14 days, email us and we refund every cent. No forms, no friction.',
    },
    finalCta: spec.finalCta,
  };
}

export { withIcons };
