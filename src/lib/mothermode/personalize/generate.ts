/**
 * Generate orchestrator — WHEN a lead's payload gets made, and where it goes.
 *
 * Three entry points, one path:
 *   capture-time trigger (fire-and-forget from the capture routes)
 *   admin regenerate (single lead or whole-funnel batch)
 *   click-time backstop (valid token, no cached payload yet)
 *
 * Every path lands in generateLeadPersonalization, which is deliberately
 * conservative: personalization OFF means do nothing, an existing payload
 * means do nothing (unless forced), and an admin-locked (hand-edited) payload
 * is never overwritten by the machine. All failures are soft: the worst case
 * is the lead sees the generic page, exactly as before this system existed.
 */
import { getFunnelById as getSalesFunnelById } from '@/lib/mothermode/sales/store';
import { getFunnelById as getOptinFunnelById } from '@/lib/mothermode/optin/store';
import { aiGeneratePersonalization } from '@/utils/integrations/openai-personalize';
import {
  buildLeadSnapshot,
  summarizeOptinFunnel,
  summarizeSalesFunnel,
  type FunnelSummary,
  type LeadSnapshot,
} from './context';
import {
  getLeadFacts,
  getLeadPersonalization,
  getPersonalizationSettings,
  listLeadEmailsForFunnel,
  upsertLeadPersonalization,
} from './store';
import type { FunnelKind } from './types';

export interface GenerateResult {
  ok: boolean;
  /** Machine-readable skip/failure reason: 'disabled' | 'exists' |
   *  'admin-locked' | 'no-funnel' | 'ai-failed' | 'store-failed'. */
  reason?: string;
  model?: string;
  intentSegment?: string;
}

/** Serialize concurrent generation per lead (double optin + click backstop). */
const inFlight = new Set<string>();

async function snapshotForLead(
  kind: FunnelKind,
  funnelId: string,
  email: string,
  firstName: string | null,
): Promise<LeadSnapshot> {
  const facts = await getLeadFacts(kind, funnelId, email);
  if (facts) {
    return buildLeadSnapshot({
      email: facts.email,
      firstName: facts.firstName ?? firstName,
      status: facts.status,
      stepReached: facts.stepReached,
      purchased: facts.purchased,
      purchaseAmountCents: facts.purchaseAmountCents,
      utmSource: facts.utmSource,
      utmMedium: facts.utmMedium,
      utmCampaign: facts.utmCampaign,
      utmContent: facts.utmContent,
      referrer: facts.referrer,
      createdAt: facts.createdAt,
      otoAccepted: facts.otoAccepted,
    });
  }
  // No lead row (token minted ahead of capture, or lead pruned): still
  // personalize from what the token knows.
  return buildLeadSnapshot({ email, firstName });
}

async function funnelSummaryFor(kind: FunnelKind, funnelId: string): Promise<FunnelSummary | null> {
  if (kind === 'sales') {
    const funnel = await getSalesFunnelById(funnelId);
    return funnel ? summarizeSalesFunnel(funnel) : null;
  }
  const funnel = await getOptinFunnelById(funnelId);
  return funnel ? summarizeOptinFunnel(funnel) : null;
}

export async function generateLeadPersonalization(input: {
  kind: FunnelKind;
  funnelId: string;
  email: string;
  firstName?: string | null;
  /** Bypass mode-off and existing-payload checks (admin regenerate). */
  force?: boolean;
}): Promise<GenerateResult> {
  const kind = input.kind;
  const funnelId = input.funnelId;
  const email = (input.email || '').trim().toLowerCase();
  if (!funnelId || !email.includes('@')) return { ok: false, reason: 'bad-input' };

  const settings = await getPersonalizationSettings(kind, funnelId);
  if (!settings || settings.mode === 'off') {
    if (!input.force) return { ok: false, reason: 'disabled' };
  }

  // Admin-locked (hand-edited) payloads are never machine-overwritten, and
  // any existing payload short-circuits a regenerate unless forced.
  const existing = await getLeadPersonalization(kind, funnelId, email);
  if (existing && !input.force) {
    return { ok: false, reason: existing.source === 'admin' ? 'admin-locked' : 'exists' };
  }


  const lockKey = `${kind}:${funnelId}:${email}`;
  if (inFlight.has(lockKey)) return { ok: false, reason: 'in-flight' };
  inFlight.add(lockKey);
  try {
    const [funnel, lead] = await Promise.all([
      funnelSummaryFor(kind, funnelId),
      snapshotForLead(kind, funnelId, email, input.firstName ?? null),
    ]);
    if (!funnel) return { ok: false, reason: 'no-funnel' };

    const ai = await aiGeneratePersonalization({
      lead,
      funnel,
      guidance: settings?.guidance || '',
    });
    if (!ai.ok) {
      console.warn(`[personalize] AI generation failed for ${lockKey}: ${ai.error}`);
      return { ok: false, reason: 'ai-failed' };
    }

    const saved = await upsertLeadPersonalization({
      funnelKind: kind,
      funnelId,
      email,
      firstName: lead.firstName ?? input.firstName ?? null,
      intentSegment: ai.payload.intentSegment,
      payload: ai.payload,
      model: ai.model,
      source: 'ai',
    });
    if (!saved) return { ok: false, reason: 'store-failed' };
    return { ok: true, model: ai.model, intentSegment: saved.intentSegment };
  } catch (err) {
    console.warn(`[personalize] generation threw for ${lockKey}:`, err);
    return { ok: false, reason: 'ai-failed' };
  } finally {
    inFlight.delete(lockKey);
  }
}

/**
 * Fire-and-forget trigger for the capture routes. NEVER blocks, NEVER throws:
 * lead capture is the revenue path and personalization is a garnish — the
 * void-call pattern matches enrollLeadInEmailKit in the same routes. On
 * serverless the instance may freeze mid-generation; the click-time backstop
 * in resolve.ts covers that gap.
 */
export function triggerAutoPersonalization(input: {
  kind: FunnelKind;
  funnelId: string;
  email: string;
  firstName?: string | null;
}): void {
  void generateLeadPersonalization(input).catch(() => {
    /* deliberately swallowed — see docstring */
  });
}

/** Admin batch: generate (or regenerate with force) for every funnel lead. */
export async function generateForFunnelLeads(input: {
  kind: FunnelKind;
  funnelId: string;
  force?: boolean;
  limit?: number;
}): Promise<{ attempted: number; generated: number; skipped: number; failed: number }> {
  const leads = await listLeadEmailsForFunnel(input.kind, input.funnelId, input.limit ?? 200);
  const out = { attempted: 0, generated: 0, skipped: 0, failed: 0 };
  for (const lead of leads) {
    out.attempted += 1;
    const res = await generateLeadPersonalization({
      kind: input.kind,
      funnelId: input.funnelId,
      email: lead.email,
      firstName: lead.firstName,
      force: input.force,
    });
    if (res.ok) out.generated += 1;
    else if (res.reason === 'exists' || res.reason === 'admin-locked') out.skipped += 1;
    else out.failed += 1;
  }
  return out;
}
