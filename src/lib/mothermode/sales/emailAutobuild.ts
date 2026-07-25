/**
 * Sales funnel -> Email Marketing Kit autobuild (effect layer).
 *
 * `emailPlan.ts` decides *what* each funnel event deserves. This module performs
 * it: resolve the planned context refs into real packs, generate the sequence,
 * upsert the kit, and bind the kit back onto the funnel event.
 *
 * Design notes worth knowing before you change anything here:
 *
 *  - Generation is per event and failures are isolated. One event failing (rate
 *    limit, bad JSON from the model) must not lose the kits that already
 *    generated, and must not abort the whole batch, so every event returns its
 *    own result and the caller reports them individually.
 *
 *  - Kits are written back as `draft`, never `active`. A generated sequence has
 *    not been read by a human yet, and these emails go to people who paid money.
 *    The admin reviews, then flips it live. When we regenerate over an existing
 *    kit we KEEP that kit's current status, so re-running the builder on an
 *    already-live kit does not silently take it offline.
 *
 *  - Regeneration reuses the existing kit row (by bound id, else by planned
 *    slug) instead of inserting a second kit with a duplicate slug. Without
 *    this, "regenerate" would orphan the kit the funnel is actually bound to.
 *
 *  - The funnel is saved ONCE at the end with all new bindings merged in, rather
 *    than once per event, so a partial batch cannot interleave writes with the
 *    admin's own save.
 */
import { resolveContextRefs } from '@/lib/mothermode/context/resolve';
import { getKitById, getKitBySlug, upsertKit } from '@/lib/mothermode/email/store';
import { aiGenerateSequence } from '@/utils/integrations/openai-email';
import { buildSalesEmailPlan, salesEmailKitFramework, type SalesEmailKitPlan } from './emailPlan';
import { resolveEmailKitIdForEvent, upsertFunnel } from './store';
import type { SalesEmailEvent, SalesEmailKitBinding, SalesFunnelRecord } from './types';

/** Outcome for a single funnel event. */
export interface SalesEmailKitBuildResult {
  event: SalesEmailEvent;
  eventLabel: string;
  ok: boolean;
  /** Kit id when the kit was written. */
  kitId?: string;
  kitSlug?: string;
  kitName?: string;
  /** Number of emails in the generated sequence. */
  emailCount?: number;
  /** Present when `ok` is false. */
  error?: string;
}

export interface AutobuildSalesEmailKitsOptions {
  /** Limit generation to these events. Defaults to every known event. */
  events?: SalesEmailEvent[];
  /** Skip events that already have a kit bound. */
  onlyMissing?: boolean;
  /** Admin email for the audit columns. */
  updatedBy?: string | null;
}

export interface AutobuildSalesEmailKitsOutput {
  results: SalesEmailKitBuildResult[];
  /** The funnel after bindings were merged, or the original when nothing built. */
  funnel: SalesFunnelRecord;
  built: number;
  failed: number;
}

/**
 * Find the kit row a plan should overwrite, if any.
 *
 * Two ways a kit can already exist for this event: the funnel is bound to it
 * (authoritative), or a previous run created a kit at this deterministic slug
 * but the binding was later cleared. Both must be reused, since `slug` is
 * unique and a blind insert would fail or duplicate.
 */
async function findExistingKit(funnel: SalesFunnelRecord, plan: SalesEmailKitPlan) {
  const boundId = resolveEmailKitIdForEvent(funnel, plan.event);
  if (boundId) {
    const byId = await getKitById(boundId);
    if (byId) return byId;
  }
  return getKitBySlug(plan.slug);
}

/** Generate and persist one kit for one planned event. */
async function buildOne(
  funnel: SalesFunnelRecord,
  plan: SalesEmailKitPlan,
  updatedBy?: string | null,
): Promise<SalesEmailKitBuildResult> {
  const base = { event: plan.event, eventLabel: plan.eventLabel };
  const framework = salesEmailKitFramework(plan.event);

  try {
    // Refs are just pointers; the generator needs the resolved text.
    const packs = await resolveContextRefs(plan.contextRefs);

    const generated = await aiGenerateSequence(
      plan.intake,
      plan.campaignType,
      framework,
      packs,
    );
    if (!generated.ok) {
      return { ...base, ok: false, error: generated.error };
    }

    const existing = await findExistingKit(funnel, plan);
    const kit = await upsertKit({
      id: existing?.id ?? null,
      slug: existing?.slug ?? plan.slug,
      name: plan.name,
      campaignType: plan.campaignType,
      framework,
      // Never promote to active on our own; never demote a live kit either.
      status: existing?.status ?? 'draft',
      intake: plan.intake,
      contextRefs: plan.contextRefs,
      sequence: generated.data,
      updatedBy: updatedBy ?? null,
    });

    return {
      ...base,
      ok: true,
      kitId: kit.id,
      kitSlug: kit.slug,
      kitName: kit.name,
      emailCount: generated.data.emails?.length ?? 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return { ...base, ok: false, error: message };
  }
}

/** Merge new bindings over the funnel's existing ones, keyed by event. */
function mergeBindings(
  existing: SalesEmailKitBinding[] | undefined,
  additions: SalesEmailKitBinding[],
): SalesEmailKitBinding[] {
  const byEvent = new Map<SalesEmailEvent, SalesEmailKitBinding>();
  for (const binding of existing ?? []) {
    if (binding?.event) byEvent.set(binding.event, binding);
  }
  for (const binding of additions) byEvent.set(binding.event, binding);
  return Array.from(byEvent.values());
}

/**
 * Build email kits for a sales funnel's events and bind them back.
 *
 * Returns one result per attempted event plus the saved funnel. When every event
 * fails, the funnel is returned untouched rather than re-saved for no reason.
 */
export async function autobuildSalesEmailKits(
  funnel: SalesFunnelRecord,
  options: AutobuildSalesEmailKitsOptions = {},
): Promise<AutobuildSalesEmailKitsOutput> {
  const plans = buildSalesEmailPlan(funnel, {
    events: options.events,
    onlyMissing: options.onlyMissing,
  });

  const results: SalesEmailKitBuildResult[] = [];
  const bindings: SalesEmailKitBinding[] = [];

  // Sequential on purpose: each event is several model calls, and firing all
  // thirteen at once is the fastest way to get rate limited into failure.
  for (const plan of plans) {
    const result = await buildOne(funnel, plan, options.updatedBy);
    results.push(result);
    if (result.ok && result.kitId) {
      bindings.push({ event: plan.event, emailKitId: result.kitId });
    }
  }

  const built = results.filter((r) => r.ok).length;
  const failed = results.length - built;

  if (bindings.length === 0) {
    return { results, funnel, built, failed };
  }

  const emailKits = mergeBindings(funnel.emailKits, bindings);
  // emailKitId is the legacy single-kit field and means "optin".
  const optinBinding = bindings.find((b) => b.event === 'optin');

  const saved = await upsertFunnel({
    id: funnel.id,
    slug: funnel.slug,
    name: funnel.name,
    status: funnel.status,
    offerSlug: funnel.offerSlug,
    leadGenSlug: funnel.leadGenSlug,
    deliverableSlug: funnel.deliverableSlug,
    deliverableKey: funnel.deliverableKey,
    emailKitId: optinBinding?.emailKitId ?? funnel.emailKitId,
    emailKits,
    productId: funnel.productId,
    optin: funnel.optin,
    sales: funnel.sales,
    vsl: funnel.vsl,
    checkout: funnel.checkout,
    upsell1: funnel.upsell1,
    upsell2: funnel.upsell2,
    upsell3: funnel.upsell3,
    upsell4: funnel.upsell4,
    success: funnel.success,
    access: funnel.access,
    footer: funnel.footer,
    updatedBy: options.updatedBy ?? null,
  });

  return { results, funnel: saved, built, failed };
}
