/**
 * The model cascade (roadmap Phase 2): which model runs a recipe step,
 * decided by the step's SHAPE and the expert's SCORECARD — the cost story
 * (sweeps shouldn't pay frontier prices) and the quality story (the brief
 * everything inherits from shouldn't skimp), with every choice carrying
 * its reason so the run timeline can say exactly why.
 *
 * THE TIERS MAP TO THE CATALOG, NOT TO WISHFUL PRICING
 * ---------------------------------------------------
 * `callAgentModel` only honors ids from the TEXT_MODELS catalog (an
 * unkeyed provider degrades to Auto rather than failing — see
 * research-agent.ts `resolveAgentModel`), so the tiers point at catalog
 * entries:
 *   cheap    → kimi-k3 (Moonshot: the catalog's budget model)
 *   standard → '' (Auto — the owner's configured default; today's
 *              behavior, unchanged)
 *   premium  → TEXT_MODELS[0] (the catalog is ordered flagship-first —
 *              taking [0] is deliberate, and a reorder IS a cascade
 *              change)
 *
 * THE RULES
 * ---------
 * 1. An expert with a configured model keeps it. The cascade routes only
 *    Auto experts — an owner pinning a model is a decision, and routing
 *    around it would be exactly the cleverness that makes owners distrust
 *    the lane.
 * 2. The step's output artifact sets the tier: sweeps (research-brief,
 *    notes) run cheap; structure (content-plan, lead-magnet) runs
 *    standard; the artifacts money depends on (offer-brief, ad-angles,
 *    email-outline) run premium. Unknown types land on standard — never
 *    cheap-by-accident.
 * 3. Scorecards escalate UP one tier, never down: an expert failing ≥
 *    40% of ≥ 3 settled steps gets the next tier up. Downgrading a
 *    winning expert to save money is the other direction of clever —
 *    quality drops silently exactly when things look fine. v1 refuses it.
 *
 * Pure: no server imports (the interpreter and its tests share it).
 */
import { TEXT_MODELS } from '@/lib/mothermode/content/models';

export type ModelTier = 'cheap' | 'standard' | 'premium';

/** The catalog ids each tier routes to ('' = Auto / owner's default). */
export const CASCADE_TIER_MODELS: Record<ModelTier, string> = {
  cheap: 'kimi-k3',
  standard: '',
  premium: TEXT_MODELS[0].id,
};

/** The scorecard signal an escalation needs: enough settled work to be a
 *  pattern, failing often enough to be worth a tier. */
export const ESCALATION_MIN_SETTLED = 3;
export const ESCALATION_FAILURE_RATE = 0.4;

/** Artifact classes → tiers. Anything unlisted is 'standard'. */
const ARTIFACT_TIERS: Record<string, { tier: ModelTier; label: string }> = {
  'research-brief': { tier: 'cheap', label: 'sweep' },
  notes: { tier: 'cheap', label: 'sweep' },
  'content-plan': { tier: 'standard', label: 'structure' },
  'lead-magnet': { tier: 'standard', label: 'structure' },
  'offer-brief': { tier: 'premium', label: 'strategy' },
  'ad-angles': { tier: 'premium', label: 'ad copy' },
  'email-outline': { tier: 'premium', label: 'email copy' },
};

/** The tier a step's output artifact runs at (never below standard by default). */
export function tierForArtifact(outputArtifact: string): {
  tier: ModelTier;
  label: string;
} {
  return (
    ARTIFACT_TIERS[(outputArtifact || '').trim()] ?? {
      tier: 'standard',
      label: 'unclassified',
    }
  );
}

/** The tier a catalog model id belongs to (for reporting config wins). */
export function tierOfModel(modelId: string): ModelTier {
  const id = (modelId || '').trim();
  if (!id) return 'standard';
  if (id === CASCADE_TIER_MODELS.cheap) return 'cheap';
  return 'premium';
}

function bump(tier: ModelTier): ModelTier {
  if (tier === 'cheap') return 'standard';
  return 'premium';
}

export interface CascadeDecision {
  /** The catalog id to run ('' = Auto, the owner's configured default). */
  model: string;
  tier: ModelTier;
  /** True when the scorecard moved the tier up. */
  escalated: boolean;
  /** Why, in one clause — the run timeline prints it verbatim. */
  reason: string;
}

/**
 * The decision for one step. Always returns one — the caller compares
 * `decision.model` to the expert's configured model to see whether the
 * cascade actually changed anything ('' vs '' = Auto stayed Auto, nothing
 * to report).
 */
export function resolveStepModel(input: {
  /** The expert's configured model ('' = Auto). */
  expertModel: string;
  /** The step's required output artifact type. */
  outputArtifact: string;
  /** The expert's scorecard, when the fleet has one. */
  scorecard?: {
    failureRate: number | null;
    done: number;
    failed: number;
  } | null;
}): CascadeDecision {
  const configured = (input.expertModel || '').trim();
  if (configured) {
    return {
      model: configured,
      tier: tierOfModel(configured),
      escalated: false,
      reason: 'expert config',
    };
  }

  const base = tierForArtifact(input.outputArtifact);
  let tier = base.tier;
  let escalated = false;
  let escalationNote = '';

  const card = input.scorecard ?? null;
  const settled = card ? card.done + card.failed : 0;
  if (
    card &&
    card.failureRate !== null &&
    settled >= ESCALATION_MIN_SETTLED &&
    card.failureRate >= ESCALATION_FAILURE_RATE
  ) {
    tier = bump(tier);
    escalated = true;
    escalationNote = ` · escalated: ${Math.round(card.failureRate * 100)}% of ${settled} settled steps failed`;
  }

  return {
    model: CASCADE_TIER_MODELS[tier],
    tier,
    escalated,
    reason: `${tier} tier (${base.label})${escalationNote}`,
  };
}
