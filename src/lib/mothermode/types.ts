/**
 * Types for the MotherMode front-end offer catalog. Each offer is one
 * low-ticket resource pack with its own sales page, all funneling into the
 * shared ascension (OS membership, Redesign Vault, Coaching).
 */
import type { LucideIcon } from 'lucide-react';

/** One resource inside the pack ("what's inside" / modules equivalent). */
export interface InsideItem {
  title: string;
  description: string;
  icon: LucideIcon;
  tag?: string;
  value?: string;
  /** The one-line shift this piece creates. What changes the moment she uses it. */
  outcome?: string;
  /** Optional thumbnail. Path under /public, e.g. /mothermode/brain-dump/template.png */
  image?: string;
  /** Stable key matching a DeliverableDoc in src/lib/mothermode/deliverables.
   *  When set, this item links straight to /mothermode/resource/[slug]/[resourceKey]. */
  resourceKey?: string;
}


/** A step in the "how it works" method. */
export interface MethodStep {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Time or cadence anchor, e.g. "20 minutes, once". Lowers perceived effort. */
  meta?: string;
  /** The internal shift the step produces. The reaction, not the instruction. */
  shift?: string;
}

/** A compact feature card for the supporting grid. */
export interface FeatureCard {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** A free bonus stacked on top of the core offer to lift perceived value. */
export interface BonusItem {
  title: string;
  description: string;
  value: string;
  icon: LucideIcon;
  tag?: string;
}

/** An order bump offered at checkout. */
export interface OfferBump {
  id: string;
  title: string;
  price: string;
  description: string;
}

/** A proof / testimonial. `real` gates which ones can run on paid traffic. */
export interface Proof {
  name: string;
  role: string;
  quote: string;
  real: boolean;
  /** Optional headshot. Path under /public. Falls back to a monogram. */
  avatar?: string;
}

export interface Faq {
  q: string;
  a: string;
}

/** A single front-end resource offer. */
export interface MotherModeOffer {
  /** URL slug: /mothermode/[slug]. */
  slug: string;
  /** Stable id used for ProductContext + purchase tracking. */
  productId: string;
  /** Editorial category label, e.g. "The Mental Load Series". */
  category: string;
  /** Product name, e.g. "The Brain Dump System". */
  name: string;
  /** One-line promise used in cards and meta. */
  tagline: string;
  /** Set false for offers still being authored (renders a "coming soon" note). */
  ready: boolean;

  priceCents: number;
  originalPriceCents: number;

  /** Optional imagery. Drop files in /public/mothermode and reference them here.
   *  Any field left unset renders a labelled placeholder slot. */
  media?: {
    /** Poster for the hero VSL/preview card. Set to show a video slot. */
    vslPoster?: string;
    /** The product mockup shown in the hero offer card. */
    mockup?: string;
    /** Founder portrait used in the founder note. */
    founderPhoto?: string;
  };

  hero: {
    eyebrow: string;
    headline: string;
    /** Phrase rendered in Mode aubergine inside the headline. */
    headlineEmphasis: string;
    headlineSuffix?: string;
    subheadline: string;
    /** Identity qualifier under the subheadline, e.g. "For the mother who...".
     *  Signals exactly who the page is for and triggers the "that's me" reaction. */
    audience?: string;
    /** Short reassurance under the CTA. */
    promise: string;
  };

  problem: {
    heading: string;
    intro: string;
    /** A short second-person vignette that makes the pain concrete. */
    scene?: string;
    points: string[];
    /** The calibrated cost line: what the load takes, plus permission to want it back. */
    cost?: string;
  };

  /** "Why we built this" origin story. Mechanism-forward letters earn trust by
   *  leading with the reason the thing exists before selling the thing. */
  origin?: { eyebrow: string; heading: string; paragraphs: string[] };

  whatIs: { heading: string; paragraphs: string[] };

  /** The unique mechanism: why this works when the usual fixes do not. The
   *  centerpiece of mechanism-forward copy. */
  mechanism?: {
    eyebrow: string;
    heading: string;
    /** The one line worth remembering if she reads nothing else. */
    label: string;
    paragraphs: string[];
    points?: { title: string; description: string }[];
  };

  inside: {
    heading: string;
    subheading: string;
    /** A mechanism-forward lead line: how the pieces relate, before the list. */
    lead?: string;
    items: InsideItem[];
  };
  method: {
    heading: string;
    subheading?: string;
    steps: MethodStep[];
    /** The line that lands the transformation after the steps. */
    closer?: string;
  };

  oldWay: { heading: string; items: string[] };
  newWay: { heading: string; items: string[] };

  /** Free fast-action bonuses, stacked near the bottom to lift value before the
   *  final ask. Optional so offers without bonuses simply skip the section. */
  bonuses?: {
    eyebrow: string;
    heading: string;
    intro?: string;
    items: BonusItem[];
    /** Total stack value, e.g. "$65". Rendered as a badge. */
    totalValue?: string;
    /** The line that lands after the stack, e.g. delivery reassurance. */
    closer?: string;
  };

  /** A long-form sales letter from the founder. The personal, direct-response
   *  close. Falls back to the shared FOUNDER.bio when unset. */
  founderLetter?: {
    eyebrow: string;
    heading: string;
    /** Opening line set apart above the body, in the confidante register. */
    greeting?: string;
    paragraphs: string[];
    /** Sign-off line above the name, e.g. "With you in it,". */
    signoff: string;
    /** The P.S. The last thing she reads. Usually the risk-reversal. */
    ps?: string;
  };

  features?: FeatureCard[];
  proof: Proof[];
  bumps: OfferBump[];
  faqs: Faq[];

  guarantee: { title: string; body: string };
  finalCta: { heading: string; body: string };
}
