/**
 * The shared run recap (roadmap Phase 3, "Share Run recap"): compose the
 * ONE payload a public share link serves — transcript + funnel map + money
 * map — and the sanitization that makes it safe to publish.
 *
 * THE PII / SECRET POSTURE (decided here, before anything renders)
 * ----------------------------------------------------------------
 * A share link is an owner-initiated, revocable capability: the owner
 * presses Share because the receipts ARE the story. The payload therefore
 * deliberately INCLUDES the play name, the run's status/steps/crew, what
 * it cost (cents), the money map (clicks / leads / attributed revenue),
 * the funnel map, and the run's transcript turns with a slim tool trace.
 *
 * Everything else is stripped or redacted at composition time — the public
 * route never sees the raw rows:
 *
 *   1. NO INTERNAL IDS. Run / session / artifact / message ids never leave
 *      (a leaked id is an enumeration handle against admin-guarded data;
 *      the payload simply carries none). Turns and steps key by index.
 *   2. NO ADMIN LINKS. Funnel-map node hrefs and money-map editor hrefs
 *      point at /admin — useless to a stranger and noisy about our URL
 *      structure. Stripped to ''.
 *   3. NO SCRAPED-PII BULK. Tool-call cards (scraped posts/reviews with
 *      author handles — the densest PII surface) stay internal; the public
 *      trace keeps only name + one-line input/result summaries.
 *   4. SECRET REDACTION on every free-text field a human or model touched
 *      (turn content, tool summaries, step notes, recipe/artifact/asset
 *      labels): `redactSecrets` masks API keys, Bearer/Basic values, AWS
 *      key ids, Slack/Stripe webhook URLs, credential-looking URL params
 *      and key:value pairs, and PEM private-key blocks. Lossy ON PURPOSE —
 *      the public payload never sees the raw string.
 *   5. NO SESSION TITLE. It is internal bookkeeping (first-message
 *      derived); the play's name headlines the recap instead.
 *
 * Transport posture lives at the route (no-store, noindex); revocation is
 * a row delete. Pure: no server imports — the server read (shareRead.ts)
 * maps rows in, tests pin the shape.
 */
import type { RunDetail } from './runDetail';
import type { RecipeRunStatus, RecipeStepState } from './types';
import type { ResearchMessage } from '../types';
import { buildFunnelMap, type FunnelMap } from '../funnelMap';
import type { RunMoneyMap } from '../moneyMap';
import { expertDisplayName, runProgress, type ExpertInfo } from './crew';

// ---------------------------------------------------------------------------
// Secret redaction — the vocabulary moved to ../redact.ts (it now guards
// BOTH the artifact WRITE path and this public READ path). Re-exported so
// every existing import keeps working against the same patterns.
// ---------------------------------------------------------------------------
export { redactSecrets } from '../redact';
import { redactSecrets } from '../redact';

// ---------------------------------------------------------------------------
// The payload shape
// ---------------------------------------------------------------------------

/** The public trace of one tool call: name + one-line summaries. The
 *  scraped-cards payload (posts/reviews with author handles) deliberately
 *  never crosses the boundary. */
export interface RecapTool {
  name: string;
  status: 'ok' | 'error';
  inputSummary: string;
  resultSummary: string;
}

export interface RecapTurn {
  role: 'user' | 'assistant';
  /** 'the owner' · 'step 2 instruction' · the expert's display name. */
  speaker: string;
  stepIndex: number | null;
  model: string;
  content: string;
  tools: RecapTool[];
}

export interface RecapStep {
  status: RecipeStepState['status'];
  /** The step expert's display name ('' when the recipe row is gone). */
  expertName: string;
  outputArtifact: string;
  note: string;
}

export interface RunRecap {
  /** Payload schema version, for future readers. */
  version: 1;
  recipeName: string;
  status: RecipeRunStatus;
  stepsDone: number;
  stepCount: number;
  /** What the run cost, in cents — the owner's number, shared by choice. */
  estCostCents: number;
  startedAt: string | null;
  /** Crew display names in first-use order. */
  crew: string[];
  steps: RecapStep[];
  /** The proof: clicks / leads / attributed revenue per artifact, editor
   *  hrefs stripped, labels redacted. Null discipline carries (n/a). */
  moneyMap: RunMoneyMap;
  /** Every artifact's build map with handoff state, node hrefs stripped. */
  funnelMaps: FunnelMap[];
  transcript: RecapTurn[];
  /** When the link was minted (the share row's created_at). */
  sharedAt: string | null;
}

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

/** Money map, public-safe: no internal ids, no editor hrefs, labels
 *  redacted. Numbers and the null discipline pass through untouched. */
export function sanitizeMoneyMap(map: RunMoneyMap): RunMoneyMap {
  return {
    ...map,
    perArtifact: map.perArtifact.map((a) => ({
      ...a,
      // An artifact id is an enumeration handle — the payload carries none.
      artifactId: '',
      title: redactSecrets(a.title),
      handedOffLabel: a.handedOffLabel ? redactSecrets(a.handedOffLabel) : null,
      handedOffHref: null,
      systemParts: a.systemParts.map((p) => ({
        ...p,
        id: '',
        label: redactSecrets(p.label),
        href: '',
      })),
    })),
  };
}

/** Funnel map, public-safe: no node ids, no hrefs, labels redacted. */
export function sanitizeFunnelMap(map: FunnelMap): FunnelMap {
  return {
    root: {
      ...map.root,
      title: redactSecrets(map.root.title),
      parentTitle: redactSecrets(map.root.parentTitle),
    },
    lanes: map.lanes.map((lane) => ({
      ...lane,
      nodes: lane.nodes.map((node) => ({
        ...node,
        // Node ids are kit/funnel row ids (the admin editor links) — strip.
        id: '',
        label: redactSecrets(node.label),
        href: '',
      })),
    })),
  };
}


/** One transcript turn, public-safe: redacted content, slim tool trace. */
export function recapTurn(
  message: ResearchMessage,
  experts: ExpertInfo[],
): RecapTurn {
  const isUser = message.role === 'user';
  return {
    role: isUser ? 'user' : 'assistant',
    speaker: isUser
      ? message.recipeStepIndex !== null
        ? `step ${message.recipeStepIndex + 1} instruction`
        : 'the owner'
      : expertDisplayName(message.expertSlug || 'research', experts),
    stepIndex: message.recipeStepIndex,
    model: (message.model || '').trim(),
    content: redactSecrets(message.content),
    tools: message.toolCalls.map((call) => ({
      name: call.name,
      status: call.status === 'error' ? 'error' : 'ok',
      inputSummary: redactSecrets(call.inputSummary),
      resultSummary: redactSecrets(call.resultSummary),
    })),
  };
}

// ---------------------------------------------------------------------------
// The composer
// ---------------------------------------------------------------------------

/**
 * Compose the public recap from the admin run detail. Everything the admin
 * page renders passes through the sanitizers above; nothing else is added.
 * A gone recipe still recaps (steps fall back to their state rows); an
 * empty transcript is honest (pre-provenance runs).
 */
export function buildRunRecap(input: {
  detail: RunDetail;
  experts: ExpertInfo[];
  sharedAt: string | null;
}): RunRecap {
  const { detail, experts } = input;
  const { run, recipe } = detail;
  const progress = runProgress(run);

  const steps: RecapStep[] = run.stepsState.map((s, i) => {
    const step = recipe?.steps[i];
    return {
      status: s.status,
      expertName: step ? expertDisplayName(step.expert, experts) : '',
      outputArtifact: step?.outputArtifact ?? '',
      note: redactSecrets(s.note),
    };
  });

  const crew: string[] = [];
  if (recipe) {
    for (const step of recipe.steps) {
      const name = expertDisplayName(step.expert, experts);
      if (!crew.includes(name)) crew.push(name);
    }
  }

  const funnelMaps: FunnelMap[] = [];
  for (const { artifact } of detail.artifacts) {
    const map = buildFunnelMap({
      artifact,
      artifacts: detail.artifacts.map((e) => e.artifact),
    });
    if (map) funnelMaps.push(sanitizeFunnelMap(map));
  }

  return {
    version: 1,
    recipeName: redactSecrets(recipe?.name ?? '') || 'A play',
    status: run.status,
    stepsDone: progress.done,
    stepCount: progress.total,
    estCostCents: run.estCostCents,
    startedAt: run.createdAt,
    crew,
    steps,
    moneyMap: sanitizeMoneyMap(detail.moneyMap),
    funnelMaps,
    transcript: detail.transcript.map((m) => recapTurn(m, experts)),
    sharedAt: input.sharedAt,
  };
}
