/**
 * Server-only resolver: turn saved ContextRefs into live ContextPacks at
 * generation time. Fetches each source from its source of truth (the offer
 * catalog or the relevant kit store), runs it through the pure adapter, and
 * clamps the result so injected context can never crowd out the brief.
 *
 * Resolving late (not at save time) means injected facts always reflect the
 * current offer/kit, and a client cannot spoof a pack's contents — it only
 * supplies a pointer. Unknown or deleted refs are silently dropped.
 *
 * Never import this from a browser bundle: it pulls in the service-role kit
 * stores.
 */
import type { ContextPack, ContextRef } from './types';
import { normalizeContextRefs } from './types';
import { clampPacks } from './prompt';
import { fromOffer, fromOfferBonuses } from './fromOffer';
import {
  fromCommunityKit,
  fromHighTicketKit,
  fromLeadGenKit,
  fromEmailKit,
} from './fromKits';
import { fromLink, fromText } from './fromInline';

import { getOffer } from '@/lib/mothermode/offers';
import { getKitById as getCommunityById } from '@/lib/mothermode/community/store';
import { getKitById as getHighTicketById } from '@/lib/mothermode/highticket/store';
import { getKitById as getLeadGenById } from '@/lib/mothermode/leadgen/store';
import { getKitById as getEmailById } from '@/lib/mothermode/email/store';

/** Resolve one ref to a pack, or null when the source no longer exists. */
async function resolveOne(ref: ContextRef): Promise<ContextPack | null> {
  try {
    switch (ref.kind) {
      case 'offer': {
        const offer = getOffer(ref.id);
        return offer ? fromOffer(offer as never) : null;
      }
      case 'offer-bonuses': {
        const offer = getOffer(ref.id);
        return offer ? fromOfferBonuses(offer as never) : null;
      }
      case 'community-kit': {
        const rec = await getCommunityById(ref.id);
        return rec ? fromCommunityKit(rec as never) : null;
      }
      case 'high-ticket-kit': {
        const rec = await getHighTicketById(ref.id);
        return rec ? fromHighTicketKit(rec as never) : null;
      }
      case 'lead-gen-kit': {
        const rec = await getLeadGenById(ref.id);
        return rec ? fromLeadGenKit(rec as never) : null;
      }
      case 'email-kit': {
        const rec = await getEmailById(ref.id);
        return rec ? fromEmailKit(rec as never) : null;
      }
      case 'link':
        return fromLink(ref);
      case 'text':
        return fromText(ref);
      default:
        return null;

    }
  } catch {
    return null;
  }
}

/**
 * Resolve a list of refs (or raw JSON) into clamped, prompt-ready packs. Order
 * is preserved; missing sources drop out. Safe to call with anything — it
 * normalizes first.
 */
export async function resolveContextRefs(
  value: unknown,
): Promise<ContextPack[]> {
  const refs = normalizeContextRefs(value);
  if (refs.length === 0) return [];
  const resolved = await Promise.all(refs.map(resolveOne));
  const packs = resolved.filter((p): p is ContextPack => p !== null);
  return clampPacks(packs);
}
