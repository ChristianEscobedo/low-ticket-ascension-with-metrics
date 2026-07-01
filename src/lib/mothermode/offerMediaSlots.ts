import type { MotherModeOffer } from './types';

/**
 * The image slots an admin can publish on a sales page. Each maps directly to a
 * field on `offer.media`. This is the single source of truth shared by the read
 * helper, the admin API, and the editor UI. Kept free of server-only imports so
 * the client editor can use it too.
 */
export const OFFER_MEDIA_SLOTS = [
  {
    key: 'vslPoster',
    label: 'Walkthrough video poster',
    hint: '1280 x 720',
  },
  {
    key: 'mockup',
    label: 'Product mockup',
    hint: '1200 x 760',
  },
  {
    key: 'founderPhoto',
    label: 'Founder portrait',
    hint: '900 x 1100',
  },
] as const;

export type OfferMediaSlot = (typeof OFFER_MEDIA_SLOTS)[number]['key'];

/** The publishable shape of an offer's imagery. */
export type OfferMedia = NonNullable<MotherModeOffer['media']>;

const VALID_SLOTS = new Set<string>(OFFER_MEDIA_SLOTS.map((s) => s.key));

/** True when a string is one of the known, editable media slots. */
export function isOfferMediaSlot(slot: string): slot is OfferMediaSlot {
  return VALID_SLOTS.has(slot);
}
