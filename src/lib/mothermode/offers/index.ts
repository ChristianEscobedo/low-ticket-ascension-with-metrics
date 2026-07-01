import type { MotherModeOffer } from '../types';
import { brainDump } from './brain-dump';
import { offloadMap } from './offload-map';
import { fivePmReset } from './five-pm-reset';
import { morningWithoutYelling } from './morning-without-yelling';
import { first90Days } from './seasonal-drafts';
import {
  invisibleLaborInventory,
  weeklyReset,
  mentalLoadAudit,
} from './mental-load-drafts';

/**
 * The MotherMode front-end offer catalog. Each entry is one low-ticket resource
 * pack with its own /mothermode/[slug] sales page. Order here is the display
 * order on any catalog/index surface.
 */
export const OFFERS: MotherModeOffer[] = [
  brainDump,
  fivePmReset,
  morningWithoutYelling,
  first90Days,
  offloadMap,
  invisibleLaborInventory,
  weeklyReset,
  mentalLoadAudit,
];

/** The front-end offer, used to scope the shared content hub's review state when
 *  no specific offer is in context. */
export const DEFAULT_OFFER_SLUG = OFFERS[0].slug;

/** Fast slug lookup. */
const BY_SLUG: Record<string, MotherModeOffer> = OFFERS.reduce(
  (map, offer) => {
    map[offer.slug] = offer;
    return map;
  },
  {} as Record<string, MotherModeOffer>,
);

export function getOffer(slug: string): MotherModeOffer | undefined {
  return BY_SLUG[slug];
}

export function getOfferByProductId(productId: string): MotherModeOffer | undefined {
  return OFFERS.find((o) => o.productId === productId);
}

/** All slugs, for static generation of the dynamic route. */
export function allOfferSlugs(): string[] {
  return OFFERS.map((o) => o.slug);
}

export {
  brainDump,
  fivePmReset,
  first90Days,
  morningWithoutYelling,
  offloadMap,
  invisibleLaborInventory,
  weeklyReset,
  mentalLoadAudit,
};
