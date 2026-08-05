/**
 * Resolve — the per-render seam. One call from each public funnel route:
 * settings + token in; (possibly merged) funnel + gate decision out.
 *
 * Decision table (settings.mode × token validity):
 *
 *   off      → generic funnel, always. Token ignored entirely.
 *   overlay  → valid token + cached payload → MERGED funnel (personalized);
 *              valid token, no payload → generic funnel + generation backstop;
 *              no/invalid token → generic funnel.
 *   gated    → valid token → as overlay; anything else → GATED (decoy page).
 *              A token minted for a DIFFERENT funnel is invalid here (fid
 *              binding), so links can't be cross-posted between funnels.
 *
 * Admins are always resolved by callers BEFORE this runs (they get base
 * content for the inline editor), so nothing here special-cases admin.
 * Every read degrades softly: missing tables or rows mean "generic page",
 * never a 500 on a public route.
 */
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import type { OptinFunnelRecord } from '@/lib/mothermode/optin/types';
import { mergeOptinFunnelPayload, mergeSalesFunnelPayload } from './merge';
import { generateLeadPersonalization } from './generate';
import { getLeadPersonalization, getPersonalizationSettings } from './store';
import { verifyPersonalizationToken } from './token';

export interface ResolveResult<T> {
  funnel: T;
  /** True → caller renders the decoy page instead of the offer. */
  gated: boolean;
  /** True → the returned funnel has personalized copy merged in. */
  personalized: boolean;
  /** AI's intent segment when personalized (admin debugging). */
  segment: string;
}

function base<T>(funnel: T): ResolveResult<T> {
  return { funnel, gated: false, personalized: false, segment: '' };
}

/**
 * Click-time backstop: a valid token arrived before any payload existed
 * (serverless froze the capture-time generation, or the token was minted
 * ahead of capture). Kick generation without blocking the render — this view
 * is generic, the NEXT one is personalized.
 */
function backstop(kind: 'sales' | 'optin', funnelId: string, email: string, fn?: string): void {
  void generateLeadPersonalization({ kind, funnelId, email, firstName: fn ?? null }).catch(
    () => {
      /* soft by design — see generate.ts */
    },
  );
}

export async function resolveSalesPersonalization(
  funnel: SalesFunnelRecord,
  ppToken: string | null | undefined,
): Promise<ResolveResult<SalesFunnelRecord>> {
  const settings = await getPersonalizationSettings('sales', funnel.id);
  if (!settings || settings.mode === 'off') return base(funnel);

  const token = verifyPersonalizationToken(ppToken);
  const valid = token && token.k === 'sales' && token.fid === funnel.id ? token : null;

  if (!valid) {
    return settings.mode === 'gated'
      ? { funnel, gated: true, personalized: false, segment: '' }
      : base(funnel);
  }

  const record = await getLeadPersonalization('sales', funnel.id, valid.em);
  if (!record) {
    backstop('sales', funnel.id, valid.em, valid.fn);
    return settings.mode === 'gated'
      ? { funnel, gated: false, personalized: false, segment: '' } // valid key → generic page, not decoy
      : base(funnel);
  }

  const merged = mergeSalesFunnelPayload(funnel, record.payload, { firstName: valid.fn ?? record.firstName });
  return { funnel: merged, gated: false, personalized: true, segment: record.intentSegment };
}

export async function resolveOptinPersonalization(
  funnel: OptinFunnelRecord,
  ppToken: string | null | undefined,
): Promise<ResolveResult<OptinFunnelRecord>> {
  const settings = await getPersonalizationSettings('optin', funnel.id);
  if (!settings || settings.mode === 'off') return base(funnel);

  const token = verifyPersonalizationToken(ppToken);
  const valid = token && token.k === 'optin' && token.fid === funnel.id ? token : null;

  if (!valid) {
    return settings.mode === 'gated'
      ? { funnel, gated: true, personalized: false, segment: '' }
      : base(funnel);
  }

  const record = await getLeadPersonalization('optin', funnel.id, valid.em);
  if (!record) {
    backstop('optin', funnel.id, valid.em, valid.fn);
    return base(funnel);
  }

  const merged = mergeOptinFunnelPayload(funnel, record.payload, { firstName: valid.fn ?? record.firstName });
  return { funnel: merged, gated: false, personalized: true, segment: record.intentSegment };
}
