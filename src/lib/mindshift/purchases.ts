/**
 * Client-side purchase tracker for the Millionaire Mindshift funnel.
 *
 * Writes a single localStorage record (`mindshift_purchases`) as the visitor
 * moves through checkout → OTO1 (Clearing Room) → OTO2 (annual upgrade) →
 * OTO3 (Quantum Library) so the success page can render the right delivery
 * cards without a server round-trip.
 *
 * Source of truth for billing remains Stripe + the server-side entitlement
 * webhook; this store is for delivery-page UX only.
 */

export type MindshiftBumpId =
  | 'money_blocks_vault'
  | 'financial_thermostats_zoom'
  | 'seven_deadly_sins_loa';

export type ClearingRoomInterval = 'monthly' | 'annual';

export interface MindshiftPurchases {
  fe: boolean;
  bumps: MindshiftBumpId[];
  /** OTO1 — The Clearing Room membership joined. */
  clearingRoom: boolean;
  /** OTO2 upgrades the membership from 'monthly' to 'annual'. */
  clearingRoomInterval?: ClearingRoomInterval;
  /** OTO3 — Quantum Entrepreneur lifetime library. */
  quantumLibrary: boolean;
  /** OTO4 — $500 deposit securing a Done-For-You Build spot. */
  buildDeposit: boolean;
  email?: string;
  firstName?: string;
  purchasedAt?: number;
}

const STORAGE_KEY = 'mindshift_purchases';

const EMPTY: MindshiftPurchases = {
  fe: false,
  bumps: [],
  clearingRoom: false,
  quantumLibrary: false,
  buildDeposit: false,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readPurchases(): MindshiftPurchases {
  if (!isBrowser()) return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<MindshiftPurchases>;
    return {
      fe: !!parsed.fe,
      bumps: Array.isArray(parsed.bumps) ? (parsed.bumps.filter(Boolean) as MindshiftBumpId[]) : [],
      clearingRoom: !!parsed.clearingRoom,
      clearingRoomInterval:
        parsed.clearingRoomInterval === 'annual'
          ? 'annual'
          : parsed.clearingRoomInterval === 'monthly'
            ? 'monthly'
            : undefined,
      quantumLibrary: !!parsed.quantumLibrary,
      buildDeposit: !!parsed.buildDeposit,
      email: parsed.email,
      firstName: parsed.firstName,
      purchasedAt: parsed.purchasedAt,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writePurchases(next: Partial<MindshiftPurchases>): MindshiftPurchases {
  if (!isBrowser()) return { ...EMPTY, ...next } as MindshiftPurchases;
  const current = readPurchases();
  const mergedBumps = Array.from(
    new Set([...(current.bumps || []), ...((next.bumps as MindshiftBumpId[]) || [])]),
  );
  const merged: MindshiftPurchases = {
    fe: current.fe || !!next.fe,
    bumps: mergedBumps,
    clearingRoom: current.clearingRoom || !!next.clearingRoom,
    clearingRoomInterval: next.clearingRoomInterval ?? current.clearingRoomInterval,
    quantumLibrary: current.quantumLibrary || !!next.quantumLibrary,
    buildDeposit: current.buildDeposit || !!next.buildDeposit,
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

export function parsePurchaseQuery(search: string): Partial<MindshiftPurchases> {
  const params = new URLSearchParams(search);
  const fe = params.get('fe') === '1';
  const bumpsRaw = params.get('bumps') || '';
  const bumps = bumpsRaw
    .split(',')
    .map((b) => b.trim())
    .filter(
      (b): b is MindshiftBumpId =>
        b === 'money_blocks_vault' ||
        b === 'financial_thermostats_zoom' ||
        b === 'seven_deadly_sins_loa',
    );
  const email = params.get('email') || undefined;
  const firstName = params.get('first_name') || undefined;
  const out: Partial<MindshiftPurchases> = { fe, bumps, email, firstName };
  return out;
}

export function buildPurchaseQuery(p: Partial<MindshiftPurchases>): string {
  const params = new URLSearchParams();
  if (p.fe) params.set('fe', '1');
  if (p.bumps && p.bumps.length > 0) params.set('bumps', p.bumps.join(','));
  if (p.email) params.set('email', p.email);
  if (p.firstName) params.set('first_name', p.firstName);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
