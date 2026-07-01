/**
 * Client-side purchase tracker for the MotherMode funnel.
 *
 * Writes a single localStorage record (`mothermode_purchases`) as the visitor
 * moves through checkout -> OTO1 (MotherMode OS) -> OTO2 (annual upgrade) ->
 * OTO3 (Redesign Vault) -> OTO4 (Coaching) so the success page can
 * render the right delivery without a server round-trip.
 *
 * Source of truth for billing remains Stripe + the server-side entitlement
 * webhook; this store is for delivery-page UX only.
 */
import { STORAGE } from './brand';

export type OsInterval = 'monthly' | 'annual';

export interface MotherModePurchases {
  /** Front-end resource pack purchased at checkout. */
  fe: boolean;
  /** Slug of the front-end pack, e.g. 'brain-dump-system'. */
  feSlug?: string;
  /** Order-bump ids attached at checkout (free-form, vary per offer). */
  bumps: string[];
  /** OTO1 — the MotherMode OS membership joined. */
  os: boolean;
  /** OTO2 upgrades the membership from 'monthly' to 'annual'. */
  osInterval?: OsInterval;
  /** OTO3 — the Redesign Vault (lifetime library of every pack). */
  vault: boolean;
  /** OTO4 — the founding coaching year. */
  coaching: boolean;
  email?: string;
  firstName?: string;
  purchasedAt?: number;
}

const STORAGE_KEY = STORAGE.purchases;

const EMPTY: MotherModePurchases = {
  fe: false,
  bumps: [],
  os: false,
  vault: false,
  coaching: false,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function readPurchases(): MotherModePurchases {
  if (!isBrowser()) return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<MotherModePurchases>;
    return {
      fe: !!parsed.fe,
      feSlug: parsed.feSlug,
      bumps: Array.isArray(parsed.bumps) ? parsed.bumps.filter(Boolean) : [],
      os: !!parsed.os,
      osInterval:
        parsed.osInterval === 'annual'
          ? 'annual'
          : parsed.osInterval === 'monthly'
            ? 'monthly'
            : undefined,
      vault: !!parsed.vault,
      coaching: !!parsed.coaching,
      email: parsed.email,
      firstName: parsed.firstName,
      purchasedAt: parsed.purchasedAt,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writePurchases(
  next: Partial<MotherModePurchases>,
): MotherModePurchases {
  if (!isBrowser()) return { ...EMPTY, ...next } as MotherModePurchases;
  const current = readPurchases();
  const mergedBumps = Array.from(
    new Set([...(current.bumps || []), ...(next.bumps || [])]),
  );
  const merged: MotherModePurchases = {
    fe: current.fe || !!next.fe,
    feSlug: next.feSlug ?? current.feSlug,
    bumps: mergedBumps,
    os: current.os || !!next.os,
    osInterval: next.osInterval ?? current.osInterval,
    vault: current.vault || !!next.vault,
    coaching: current.coaching || !!next.coaching,
    email: next.email ?? current.email,
    firstName: next.firstName ?? current.firstName,
    purchasedAt: current.purchasedAt ?? next.purchasedAt ?? Date.now(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage may be unavailable (private mode / quota) — swallow.
  }
  return merged;
}

export function parsePurchaseQuery(
  search: string,
): Partial<MotherModePurchases> {
  const params = new URLSearchParams(search);
  const fe = params.get('fe') === '1';
  const feSlug = params.get('offer') || undefined;
  const bumpsRaw = params.get('bumps') || '';
  const bumps = bumpsRaw
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const email = params.get('email') || undefined;
  const firstName = params.get('first_name') || undefined;
  return { fe, feSlug, bumps, email, firstName };
}

export function buildPurchaseQuery(p: Partial<MotherModePurchases>): string {
  const params = new URLSearchParams();
  if (p.fe) params.set('fe', '1');
  if (p.feSlug) params.set('offer', p.feSlug);
  if (p.bumps && p.bumps.length > 0) params.set('bumps', p.bumps.join(','));
  if (p.email) params.set('email', p.email);
  if (p.firstName) params.set('first_name', p.firstName);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
