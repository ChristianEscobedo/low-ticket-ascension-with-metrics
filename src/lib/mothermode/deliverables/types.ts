/**
 * Types for the MotherMode resource deliverables system. Each purchasable
 * item (a core "what's inside" resource, or an order bump) resolves to one
 * long-form, brand-styled document a buyer opens right after checkout.
 *
 * Code ships a full default for every resource (this is the actual product).
 * An admin can override any single document from /admin/deliverables without
 * a deploy; the override lives in the `mothermode_deliverables` table and is
 * merged over the code default at render time.
 */

/** One deliverable document. `html` is trusted, hand-authored brand markup
 *  (Tailwind utility classes matching design-guide.txt), never user input. */
export interface DeliverableDoc {
  /** Offer slug, e.g. 'brain-dump-system'. Scopes the document to its offer. */
  slug: string;
  /** Stable key, e.g. 'brain-dump-template'. Matches an InsideItem.resourceKey
   *  or an OfferBump.id 1:1 so the sales page and the delivery page agree. */
  key: string;
  /** Document title, shown in the header and browser tab. */
  title: string;
  /** One-line subtitle under the title. */
  subtitle: string;
  /** Full document body, brand-styled HTML. */
  html: string;
}

/** The DB row shape for `mothermode_deliverables`. */
export interface DeliverableOverrideRow {
  slug: string;
  key: string;
  title: string | null;
  subtitle: string | null;
  html: string;
  updated_at?: string | null;
  updated_by?: string | null;
}
