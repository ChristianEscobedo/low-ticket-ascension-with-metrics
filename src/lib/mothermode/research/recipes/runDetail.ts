/**
 * Run detail + Money Map server reads (roadmap Phase 2): one run, everything
 * the owner needs to judge it — the run row, its recipe, the scoped
 * transcript, the event timeline, and the money map (what the run made and
 * what it earned).
 *
 * This is a COMPOSITION of existing stores, not a new query shape: the run
 * events table (trust spine), the research store (artifacts + messages with
 * run provenance), the planner link registry + attribution join (adMetrics),
 * and the planner board. The join itself is pure (`research/moneyMap.ts`);
 * this file only fetches and maps rows into it.
 *
 * READ-FAILURE POLICY
 * -------------------
 * Every read degrades the way its own store already does, and the money
 * map's null discipline carries the consequences upward: a failed link read
 * makes clicks n/a, a failed attribution read makes leads/revenue n/a. The
 * one hard failure is the run row itself — no run, no detail (null, the
 * route 404s). Artifacts THROW by design (listArtifacts), so that read is
 * caught here and degraded to [] — the run still renders from stepsState,
 * with the artifact enrichments absent.
 *
 * Server-only (service-role stores).
 */
import {
  getRecipeRun,
  listRecipes,
  listRunEvents,
  type RecipeRunEvent,
} from './store';
import { getRunShare, type RunShare } from './shares';

import type { Recipe, RecipeRun } from './types';
import {
  getSession,
  listArtifacts,
  listMessages,
} from '../store';
import type { ResearchArtifact, ResearchMessage } from '../types';
import {
  buildRunMoneyMap,
  type MoneyMapArtifactInput,
  type MoneyMapLinkLike,
  type MoneyMapSystemPart,
  type RunMoneyMap,
} from '../moneyMap';
import {
  getPieceAttributionSafe,
  listUtmLinks,
} from '@/lib/mothermode/planner/links';
import { listContentPlan } from '@/lib/mothermode/planner/store';

/** One run artifact with the step that emitted it. */
export interface RunArtifactEntry {
  artifact: ResearchArtifact;
  stepIndex: number | null;
}

export interface RunDetail {
  run: RecipeRun;
  /** Null when the recipe row is gone (runs outlive recipes). */
  recipe: Recipe | null;
  sessionTitle: string;
  /** The trust-spine timeline, oldest first. */
  events: RecipeRunEvent[];
  /** The run's chat turns only (recipe_run_id = the run), oldest first. */
  transcript: ResearchMessage[];
  /** Artifacts the run's steps emitted, in step order. */
  artifacts: RunArtifactEntry[];
  moneyMap: RunMoneyMap;
  /** The run's live public recap link (Phase 3), or null when unshared /
   *  pre-migration. The admin page renders copy/revoke from it. */
  share: RunShare | null;
}


/** Defensive read of structured.systemManifest (Full System fan-out parts). */
function systemManifestOf(artifact: ResearchArtifact): MoneyMapSystemPart[] {
  const raw = artifact.structured?.systemManifest;
  if (!Array.isArray(raw)) return [];
  const out: MoneyMapSystemPart[] = [];
  for (const part of raw) {
    if (!part || typeof part !== 'object') continue;
    const rec = part as Record<string, unknown>;
    const kind = typeof rec.kind === 'string' ? rec.kind : '';
    if (!kind) continue;
    out.push({
      kind,
      id: typeof rec.id === 'string' ? rec.id : '',
      label: typeof rec.label === 'string' ? rec.label : '',
      href: typeof rec.href === 'string' ? rec.href : '',
    });
  }
  return out;
}

/** The run's artifacts (rows that still exist), in step order. */
function runArtifactEntries(
  run: RecipeRun,
  sessionArtifacts: ResearchArtifact[],
): RunArtifactEntry[] {
  const byId = new Map(sessionArtifacts.map((a) => [a.id, a] as const));
  const out: RunArtifactEntry[] = [];
  const seen = new Set<string>();
  run.stepsState.forEach((s, i) => {
    const id = (s.artifactId || '').trim();
    if (!id || seen.has(id)) return;
    const artifact = byId.get(id);
    if (!artifact) return; // deleted after the run — the step note remains
    seen.add(id);
    out.push({ artifact, stepIndex: i });
  });
  return out;
}

/**
 * Compose the money map for a run. All four reads are independent; each
 * failure nulls only its own metric family (see the module header).
 */
async function composeMoneyMap(
  run: RecipeRun,
  artifacts: RunArtifactEntry[],
): Promise<RunMoneyMap> {
  const [linksResult, attribution, plansResult] = await Promise.all([
    // The admin half of the link registry THROWS on failure — caught here so
    // clicks degrade to n/a rather than taking the run page down.
    listUtmLinks({ limit: 1000 }).then(
      (rows): MoneyMapLinkLike[] | null =>
        rows.map((r) => ({
          id: r.id,
          utmContent: r.utmContent,
          pieceId: r.pieceId,
          funnelId: r.funnelId,
          optinFunnelId: r.optinFunnelId,
          clickCount: r.clickCount,
        })),
      (): MoneyMapLinkLike[] | null => null,
    ),
    getPieceAttributionSafe(),
    // The planner store degrades to [] on failure; a throw still becomes
    // null. Null means "card counts unknown", [] means "no cards exist".
    listContentPlan()
      .then((items): string[] | null => items.map((i) => i.pieceId))
      .catch((): string[] | null => null),
  ]);

  const mapArtifacts: MoneyMapArtifactInput[] = artifacts.map(
    ({ artifact, stepIndex }) => ({
      id: artifact.id,
      title: artifact.title,
      type: artifact.type,
      stepIndex,
      handedOffTo: artifact.handedOffTo
        ? {
            kind: artifact.handedOffTo.kind,
            id: artifact.handedOffTo.id,
            label: artifact.handedOffTo.label,
            count: artifact.handedOffTo.count,
          }
        : null,
      systemManifest: systemManifestOf(artifact),
    }),
  );

  return buildRunMoneyMap({
    artifacts: mapArtifacts,
    links: linksResult,
    attribution,
    planPieceIds: plansResult,
  });
}

/**
 * Everything the run detail page renders, or null when the run does not
 * exist. The money map stands alone (`getRunMoneyMap`) for the runs feed's
 * per-row summary line, which should not pay for the transcript.
 */
export async function getRunDetail(runId: string): Promise<RunDetail | null> {
  const clean = (runId || '').trim();
  if (!clean) return null;
  const run = await getRecipeRun(clean);
  if (!run) return null;

  const [recipes, session, events, messages, sessionArtifacts, share] =
    await Promise.all([
      listRecipes({ includeArchived: true }),
      getSession(run.sessionId),
      listRunEvents(run.id),
      // Bounded read filtered in memory: the transcript is only the run's
      // turns (provenance-stamped). 500 covers a run's steps with room for
      // the notices between them; a session chat continues past the run, so
      // the tail can age out — the events timeline is the complete record.
      listMessages(run.sessionId, { limit: 500 }),
      // listArtifacts THROWS by design; the detail page still renders from
      // stepsState when it does.
      listArtifacts(run.sessionId).catch(
        (): ResearchArtifact[] => [] as ResearchArtifact[],
      ),
      // The live public link (Phase 3). Degrades null pre-migration — the
      // run page just shows the Share button.
      getRunShare(run.id),
    ]);

  const artifacts = runArtifactEntries(run, sessionArtifacts);
  const moneyMap = await composeMoneyMap(run, artifacts);

  return {
    run,
    recipe: recipes.find((r) => r.id === run.recipeId) ?? null,
    sessionTitle: session?.title ?? '',
    events,
    transcript: messages.filter((m) => m.recipeRunId === run.id),
    artifacts,
    moneyMap,
    share,
  };
}


/** Just the money map (the runs feed's per-row summary line). */
export async function getRunMoneyMap(
  runId: string,
): Promise<RunMoneyMap | null> {
  const clean = (runId || '').trim();
  if (!clean) return null;
  const run = await getRecipeRun(clean);
  if (!run) return null;
  const sessionArtifacts = await listArtifacts(run.sessionId).catch(
    (): ResearchArtifact[] => [] as ResearchArtifact[],
  );
  return composeMoneyMap(run, runArtifactEntries(run, sessionArtifacts));
}
