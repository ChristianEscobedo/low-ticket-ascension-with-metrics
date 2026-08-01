/**
 * Expert scorecards (roadmap Phase 2): per-expert acceptance, failure, and
 * cost — the numbers the model cascade will eventually decide from, and the
 * owner's answer to "is Wren actually good at briefs?"
 *
 * THREE SOURCES, JOINED HONESTLY
 * ------------------------------
 * 1. Run rows' `steps_state` — per-step status, note, and emitted artifact
 *    id. The step's EXPERT comes from the run's recipe (steps[i].expert),
 *    so a recipe row that is gone leaves its runs unscorable rather than
 *    misattributed ('research' is the fallback slug, matching the
 *    interpreter's own default).
 * 2. The artifact rows those steps emitted — the FATE: handed-off
 *    (accepted), version > 1 (edited by the owner after the expert wrote
 *    it), row missing (deleted), or untouched. When the artifact read
 *    fails, `artifactsById` arrives null and EVERY fate stays unknown —
 *    "we could not read the fates" is never reported as "everything was
 *    deleted" (0 is a fact; null is its absence).
 * 3. The run's `est_cost_cents` — allocated per expert by touched-step
 *    share. This is an ALLOCATION, not a measurement: the call log
 *    (`mothermode_research_call_log`) carries session + tool + cost but no
 *    expert/run columns, so per-expert cost cannot be measured today. The
 *    field is named and commented so nobody quotes it as gospel; when the
 *    log gains provenance, replace the allocation with the sum.
 *
 * WHAT COUNTS AS A STEP
 * ---------------------
 * A step that never started (fresh run, pending with no note/artifact/
 * timestamp) is not evidence of anything — it is excluded from every
 * count, including the cost allocation's denominator. Skipped and
 * mid-flight running steps count as steps (they happened) but settle
 * neither side of the failure rate.
 *
 * Pure: no server imports — the server composition lives in
 * `recipes/scorecards.ts`.
 */
import type { Recipe, RecipeRun } from './recipes/types';

/** The fate buckets the roadmap names: handed off vs edited vs deleted. */
export type ArtifactFate = 'handed-off' | 'edited' | 'untouched' | 'deleted';

/** The artifact fields a fate needs. */
export interface ArtifactFateLike {
  status: string;
  version: number;
}

export interface ExpertScorecard {
  slug: string;
  /** Runs where this expert touched at least one step. */
  runs: number;
  /** Steps the expert actually worked (never-started steps excluded). */
  steps: number;
  done: number;
  failed: number;
  /** Waiting on the owner right now (a gate is a pause, not a failure). */
  gated: number;
  /** Mid-flight, skipped, or marked-but-unsettled. */
  pending: number;
  /** Artifacts emitted, of those whose fate was checked (0 when unknown). */
  artifacts: number;
  handedOff: number;
  /** Owner revised the artifact after the expert wrote it (version > 1). */
  edited: number;
  /** The step recorded an artifact id no row has anymore. */
  deleted: number;
  untouched: number;
  /** Steps that landed with thin receipts (the `receipts n/m (low)` note). */
  citationLow: number;
  /** failed / (done + failed); null when nothing has settled yet. */
  failureRate: number | null;
  /** handedOff / known fates; null when no fate is known. */
  acceptanceRate: number | null;
  /** Phase 4: TRUE when estCostCents came from the call log's stamped
   *  rows (measured); FALSE/ABSENT when it is the step-share
   *  allocation. The summary's "~" hangs on this flag. */
  costMeasured?: boolean;


  /** Allocated (NOT measured) cost share — see the module header. */
  estCostCents: number;
  /** False when the artifact read failed: every fate above is 0 by
   *  absence, and acceptanceRate is null. The UI must say "unknown", not
   *  "zero". */
  fatesKnown: boolean;
}

function blankCard(slug: string): ExpertScorecard {
  return {
    slug,
    runs: 0,
    steps: 0,
    done: 0,
    failed: 0,
    gated: 0,
    pending: 0,
    artifacts: 0,
    handedOff: 0,
    edited: 0,
    deleted: 0,
    untouched: 0,
    citationLow: 0,
    failureRate: null,
    acceptanceRate: null,
    costMeasured: false,
    estCostCents: 0,
    fatesKnown: true,
  };
}


/** The honest divide (adMetrics' rule): no denominator, no number. */
function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** The interpreter's fallback: a step with no resolvable expert is the
 *  default researcher. One slug, shared with run.ts's DEFAULT_RESEARCH_EXPERT
 *  resolution, so the default's work never scatters across '' and
 *  'research'. */
const FALLBACK_EXPERT = 'research';

/** A step that never started carries no evidence: pending with no note, no
 *  artifact, no timestamp. (A retried step resets note/artifact but KEEPS
 *  nothing else — it reads as fresh, correctly.) */
function stepNeverStarted(s: RecipeRun['stepsState'][number]): boolean {
  return (
    s.status === 'pending' && !s.artifactId && !s.note && !s.at
  );
}

/** The `receipts n/m (low)` note the citation pass writes (crew.ts). */
const CITATION_LOW_NOTE = /\breceipts \d+\/\d+ \(low\)/;

/**
 * Build one card per expert observed across the given runs. Cards are
 * sorted by steps worked (desc), then slug — the busiest expert first.
 */
export function buildExpertScorecards(input: {
  runs: RecipeRun[];
  recipes: Recipe[];
  /** artifactId → its fate fields. Null = the read failed (fates unknown). */
  artifactsById: ReadonlyMap<string, ArtifactFateLike> | null;
  /** Phase 4: expertSlug → MEASURED cents from the call log's stamped
   *  rows. Null = the read failed (or pre-migration) — every card keeps
   *  its allocation. An expert ABSENT from the map keeps its allocation
   *  too (their calls predate the stamp). An expert present gets the
   *  measured sum and `costMeasured: true`. */
  measuredCostByExpert?: ReadonlyMap<string, number> | null;
}): ExpertScorecard[] {

  const recipeById = new Map<string, Recipe>();
  for (const r of input.recipes ?? []) recipeById.set(r.id, r);

  const cards = new Map<string, ExpertScorecard>();
  const order: string[] = [];
  const cardFor = (slug: string): ExpertScorecard => {
    const existing = cards.get(slug);
    if (existing) return existing;
    const card = blankCard(slug);
    cards.set(slug, card);
    order.push(slug);
    return card;
  };

  const fatesKnown = input.artifactsById !== null;

  for (const run of input.runs ?? []) {
    const recipe = recipeById.get(run.recipeId);

    // First pass: per-expert touched steps in THIS run (for the cost share
    // and the runs count).
    const touchedBySlug = new Map<string, number>();
    run.stepsState.forEach((s, i) => {
      if (stepNeverStarted(s)) return;
      const slug = (recipe?.steps[i]?.expert || '').trim() || FALLBACK_EXPERT;
      touchedBySlug.set(slug, (touchedBySlug.get(slug) ?? 0) + 1);
    });

    let touchedTotal = 0;
    touchedBySlug.forEach((n) => {
      touchedTotal += n;
    });

    // Cost allocation: the run's est cents split by touched-step share.
    if (run.estCostCents > 0 && touchedTotal > 0) {
      touchedBySlug.forEach((n, slug) => {
        cardFor(slug).estCostCents += Math.round(
          (run.estCostCents * n) / touchedTotal,
        );
      });
    }

    touchedBySlug.forEach((_, slug) => {
      cardFor(slug).runs += 1;
    });

    // Second pass: the per-step outcomes + artifact fates.
    run.stepsState.forEach((s, i) => {
      if (stepNeverStarted(s)) return;
      const slug = (recipe?.steps[i]?.expert || '').trim() || FALLBACK_EXPERT;
      const card = cardFor(slug);
      card.steps += 1;

      if (s.status === 'done') card.done += 1;
      else if (s.status === 'failed') card.failed += 1;
      else if (s.status === 'gated') card.gated += 1;
      else card.pending += 1;

      if (s.note && CITATION_LOW_NOTE.test(s.note)) card.citationLow += 1;

      const artifactId = (s.artifactId || '').trim();
      if (!artifactId || !fatesKnown) return;
      card.artifacts += 1;
      const artifact = input.artifactsById!.get(artifactId);
      if (!artifact) card.deleted += 1;
      else if (artifact.status === 'handed-off') card.handedOff += 1;
      else if (artifact.version > 1) card.edited += 1;
      else card.untouched += 1;
    });
  }

  const out = order.map((slug) => cards.get(slug)!);
  out.forEach((card) => {
    card.failureRate = rate(card.failed, card.done + card.failed);
    card.acceptanceRate = fatesKnown
      ? rate(
          card.handedOff,
          card.handedOff + card.edited + card.deleted + card.untouched,
        )
      : null;
    card.fatesKnown = fatesKnown;
    // Phase 4: the measured cost WINS when the log has stamped rows for
    // this expert. Absent (read failed, or their calls predate the
    // stamp) the allocation stays — honestly flagged either way.
    const measured = input.measuredCostByExpert?.get(card.slug);
    if (typeof measured === 'number') {
      card.estCostCents = measured;
      card.costMeasured = true;
    }
  });

  out.sort((a, b) => b.steps - a.steps || a.slug.localeCompare(b.slug));
  return out;
}

/** One-line card summary for list UIs; null when the expert has done nothing. */
export function scorecardSummary(card: ExpertScorecard): string | null {
  if (card.steps === 0) return null;
  const parts: string[] = [`${card.steps} ${card.steps === 1 ? 'step' : 'steps'}`];
  if (card.acceptanceRate !== null) {
    parts.push(`${Math.round(card.acceptanceRate * 100)}% accepted`);
  }
  if (card.failureRate !== null && card.failed > 0) {
    parts.push(`${Math.round(card.failureRate * 100)}% failed`);
  }
  if (card.estCostCents > 0) {
    // "~" hangs on the allocation; a measured number stands on its own.
    parts.push(
      `${card.costMeasured ? '' : '~'}$${(card.estCostCents / 100).toFixed(2)}`,
    );
  }
  return parts.join(' · ');
}


