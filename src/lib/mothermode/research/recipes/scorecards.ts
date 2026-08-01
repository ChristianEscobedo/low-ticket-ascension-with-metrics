/**
 * Expert scorecards, server side (roadmap Phase 2 kickoff): compose the
 * recent run history + the recipes that own those runs + the artifacts the
 * steps emitted into per-expert cards. The aggregation itself is pure
 * (`research/scorecards.ts`); this file only fetches and maps.
 *
 * Reads: recent runs (bounded — scorecards are a "lately" view, not an
 * all-time ledger), all recipes incl. archived (runs outlive their
 * recipes), and ONE batched artifact-by-ids read for the fates (runs span
 * sessions, so per-session reads would fan out).
 *
 * Degrades by family: no recipes/runs → empty cards; a failed artifact
 * read → fates unknown (nulls), never "everything deleted".
 *
 * Server-only (service-role stores).
 */
import { listRecipeRuns, listRecipes } from './store';
import { listArtifactsByIds } from '../store';
import {
  buildExpertScorecards,
  type ArtifactFateLike,
  type ExpertScorecard,
} from '../scorecards';

/** How much history a scorecard covers. Deliberately run-bounded rather
 *  than day-bounded: 100 runs is "the fleet lately" regardless of cadence,
 *  and the number is visible here so a deeper history is a considered
 *  choice, not an accident. */
const SCORECARD_RUN_LIMIT = 100;

export async function getExpertScorecards(): Promise<ExpertScorecard[]> {
  const [runs, recipes] = await Promise.all([
    listRecipeRuns({ limit: SCORECARD_RUN_LIMIT }),
    listRecipes({ includeArchived: true }),
  ]);
  if (runs.length === 0) return [];

  const artifactIds: string[] = [];
  for (const run of runs) {
    for (const s of run.stepsState) {
      const id = (s.artifactId || '').trim();
      if (id) artifactIds.push(id);
    }
  }

  // The fate read throws by design; a failure nulls the fate family for
  // every card (acceptanceRate null, fatesKnown false) rather than
  // reporting a fleet-wide deletion that never happened.
  const artifactsById = await listArtifactsByIds(artifactIds)
    .then((map): Map<string, ArtifactFateLike> => {
      const out = new Map<string, ArtifactFateLike>();
      map.forEach((a, id) =>
        out.set(id, { status: a.status, version: a.version }),
      );
      return out;
    })
    .catch(() => null);

  // Phase 4: MEASURED per-expert cost from the call log's stamped rows
  // (migration 20261118000000). Null on failure or pre-migration — every
  // card keeps its step-share allocation, honestly flagged.
  const { readExpertCostByRun } = await import('../store');
  const measuredCostByExpert = await readExpertCostByRun(
    runs.map((r) => r.id),
  ).catch(() => null);

  return buildExpertScorecards({
    runs,
    recipes,
    artifactsById,
    measuredCostByExpert,
  });
}


/* ------------------------------------------------------------------ *
 * The cascade's read: memoized so a step-sized lane doesn't pay it per step
 * ------------------------------------------------------------------ */

let _cache: { at: number; cards: ExpertScorecard[] } | null = null;
const SCORECARDS_TTL_MS = 5 * 60 * 1000;

/**
 * Scorecards with a 5-minute process-local memo. The step-sized lane
 * invokes runRecipe PER STEP, and the model cascade consults the
 * scorecards on every Auto expert — without the memo each step would
 * re-read 100 runs + their artifacts. Five minutes is short enough that a
 * score move lands within a run or two, long enough that a recipe never
 * pays twice.
 */
export async function getExpertScorecardsCached(opts?: {
  ttlMs?: number;
}): Promise<ExpertScorecard[]> {
  const ttl = Math.max(0, opts?.ttlMs ?? SCORECARDS_TTL_MS);
  if (_cache && Date.now() - _cache.at < ttl) return _cache.cards;
  const cards = await getExpertScorecards();
  _cache = { at: Date.now(), cards };
  return cards;
}
