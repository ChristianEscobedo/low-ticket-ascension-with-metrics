/**
 * Agent Recipes (roadmap task 3.1): the declarative step-list model.
 *
 * A recipe is DATA: steps of {expert, instruction, inputFrom,
 * outputArtifact, gate}. One sequential interpreter (./run.ts) drives it —
 * auto steps run straight through, approve gates pause the run for a human
 * decision, and every artifact a step emits gets lineage-stamped with its
 * input's id (the 1.4 envelope columns).
 *
 * Pure: no server imports.
 */

export const RECIPE_GATES = ['auto', 'approve'] as const;
export type RecipeGate = (typeof RECIPE_GATES)[number];

/** What a step reads as its input envelope. */
export type RecipeInputFrom =
  | 'brief' // the session's research brief (or nothing, when blank)
  | 'previous' // the artifact the previous step emitted
  | 'none'; // no input — the step starts cold

/** An optional handoff fired when the step completes (3.3): the artifact
 *  goes through the EXISTING handoff pipeline (Draft or Build) — auto
 *  steps fire immediately, gated steps fire on approval. 'system' is the
 *  Full System fan-out (lead magnet + opt-in funnel + nurture kit + sales
 *  funnel draft + planner cards, manifest persisted); it always Builds. */
export interface RecipeStepHandoff {
  target:
    | 'planner-cards'
    | 'leadgen-kit'
    | 'email-kit'
    | 'sales-funnel'
    | 'system'
    | 'reel-cues';
  /** Build (true) runs the target's own pipeline; Draft (false) pre-fills.
   *  Ignored by 'system' — the fan-out always builds its buildable parts.
   *  For 'reel-cues': Build = match the library first, then generate what's
   *  missing; Draft = library matches only, never a paid generation. */
  generate: boolean;
}

export interface RecipeStep {
  /** The expert slug to run this step as ('research' resolves to the default). */
  expert: string;
  /** The instruction the expert receives as its user message. The token
   *  {input} is replaced with the input artifact's markdown (or a note
   *  that none exists). */
  instruction: string;
  inputFrom: RecipeInputFrom;
  /** The artifact TYPE this step must emit (create_artifact enforced by
   *  the expert's contract; the interpreter validates one landed). */
  outputArtifact: string;
  gate: RecipeGate;
  handoff?: RecipeStepHandoff;
}

export interface Recipe {
id: string;
  slug: string;
  name: string;
  description: string;
  steps: RecipeStep[];
  budgetEstCents: number;
  status: 'active' | 'archived';
  /** Phase 4 (citation v2): 'flag' = nudge + honest note (v1, the
   *  default); 'enforce' = a sweep below the citation floor FAILS the
   *  step. Opt-in per play; migration 20261118000000. Optional — an
   *  unstamped recipe (older fixture or row) behaves as 'flag'. */
  citationMode?: 'flag' | 'enforce';

  createdAt: string | null;
  updatedAt: string | null;
}

export interface RecipeRow {
  id: string;
  slug: string | null;
  name: string | null;
  description: string | null;
  steps: unknown;
  budget_est_cents: number | null;
  status: string | null;
  citation_mode?: string | null;
  created_at: string | null;
  updated_at: string | null;
}


export const RECIPE_RUN_STATUSES = [
  'running',
  'gated',
  'done',
  'failed',
  'canceled',
] as const;
export type RecipeRunStatus = (typeof RECIPE_RUN_STATUSES)[number];

export interface RecipeStepState {
  status: 'pending' | 'running' | 'done' | 'gated' | 'failed' | 'skipped';
  /** The artifact id this step emitted ('' until it lands). */
  artifactId: string;
  /** A one-line note (the gate prompt, or why it failed). */
  note: string;
  at: string | null;
}

export interface RecipeRun {
  id: string;
  recipeId: string;
  sessionId: string;
  status: RecipeRunStatus;
  currentStep: number;
  stepsState: RecipeStepState[];
  estCostCents: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RecipeRunRow {
  id: string;
  recipe_id: string;
  session_id: string | null;
  status: string | null;
  current_step: number | null;
  steps_state: unknown;
  est_cost_cents: number | null;
  created_at: string | null;
  updated_at: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Defensive normalize of the steps JSONB. Malformed steps are dropped. */
export function normalizeRecipeSteps(value: unknown): RecipeStep[] {
  if (!Array.isArray(value)) return [];
  const out: RecipeStep[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const expert = str(rec.expert);
    const instruction = str(rec.instruction);
    const outputArtifact = str(rec.outputArtifact);
    if (!expert || !instruction || !outputArtifact) continue;
    const step: RecipeStep = {
      expert,
      instruction,
      inputFrom:
        rec.inputFrom === 'previous' || rec.inputFrom === 'none'
          ? rec.inputFrom
          : 'brief',
      outputArtifact,
      gate: rec.gate === 'approve' ? 'approve' : 'auto',
    };
    // The optional handoff (3.3), defended: known target + boolean generate.
    const h = rec.handoff;
    if (h && typeof h === 'object' && !Array.isArray(h)) {
      const hr = h as Record<string, unknown>;
      const target = hr.target;
      if (
        target === 'planner-cards' ||
        target === 'leadgen-kit' ||
        target === 'email-kit' ||
        target === 'sales-funnel' ||
        target === 'system' ||
        target === 'reel-cues'
      ) {
        step.handoff = { target, generate: hr.generate === true };
      }
    }
    out.push(step);
  }
  return out;
}

export function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    slug: str(row.slug),
    name: str(row.name) || str(row.slug),
    description: str(row.description),
    steps: normalizeRecipeSteps(row.steps),
    budgetEstCents:
      typeof row.budget_est_cents === 'number' &&
      Number.isFinite(row.budget_est_cents) &&
      row.budget_est_cents > 0
        ? Math.floor(row.budget_est_cents)
        : 150,
    status: row.status === 'archived' ? 'archived' : 'active',
    citationMode: row.citation_mode === 'enforce' ? 'enforce' : 'flag',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


export function toRecipeRunStatus(v: unknown): RecipeRunStatus {
  return v === 'gated' ||
    v === 'done' ||
    v === 'failed' ||
    v === 'canceled'
    ? v
    : 'running';
}

/** Defensive normalize of the steps_state JSONB. */
export function normalizeStepsState(value: unknown): RecipeStepState[] {
  if (!Array.isArray(value)) return [];
  const out: RecipeStepState[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const status = str(rec.status);
    out.push({
      status:
        status === 'running' ||
        status === 'done' ||
        status === 'gated' ||
        status === 'failed' ||
        status === 'skipped'
          ? status
          : 'pending',
      artifactId: str(rec.artifactId),
      note: str(rec.note),
      at: typeof rec.at === 'string' ? rec.at : null,
    });
  }
  return out;
}

/** A fresh steps_state for a run about to start. */
export function initialStepsState(stepCount: number): RecipeStepState[] {
  return Array.from({ length: stepCount }, () => ({
    status: 'pending' as const,
    artifactId: '',
    note: '',
    at: null,
  }));
}

// ---------------------------------------------------------------------------
// Owner-authored plays (Phase 2: fork & edit)
// ---------------------------------------------------------------------------

/** A step as the fork editor + the save action see it (looser than
 *  RecipeStep on purpose — the draft may be mid-edit). */
export interface RecipeDraftStep {
  expert: string;
  instruction: string;
  inputFrom?: string;
  outputArtifact: string;
  gate?: string;
  handoff?: { target: string; generate?: boolean } | null;
}

const HANDOFF_TARGETS: readonly string[] = [
  'planner-cards',
  'leadgen-kit',
  'email-kit',
  'sales-funnel',
  'system',
  'reel-cues',
];

/**
 * What a draft still needs before it can save — one phrase per problem,
 * joined by the caller ("the play needs a name, step 2 needs an expert").
 * Shared by the API (400s) and the editor (the live error line), so the
 * two can never disagree about what is saveable. Steps that pass here are
 * exactly the ones `normalizeRecipeSteps` keeps — the save never silently
 * drops a step the owner wrote.
 */
export function recipeDraftErrors(draft: {
  name?: string;
  slug?: string;
  steps?: unknown;
}): string[] {
  const errors: string[] = [];
  if (!(draft.name || '').trim()) errors.push('a name');
  const slug = (draft.slug || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) {
    errors.push('a slug (lowercase letters, numbers, dashes, 2–60 chars)');
  }
  const steps = Array.isArray(draft.steps) ? draft.steps : [];
  if (steps.length === 0) errors.push('at least one step');
  steps.forEach((raw, i) => {
    const label = `step ${i + 1}`;
    if (!raw || typeof raw !== 'object') {
      errors.push(`${label} is malformed`);
      return;
    }
    const s = raw as Record<string, unknown>;
    if (typeof s.expert !== 'string' || !s.expert.trim()) {
      errors.push(`${label} needs an expert`);
    }
    if (typeof s.instruction !== 'string' || !s.instruction.trim()) {
      errors.push(`${label} needs an instruction`);
    }
    if (typeof s.outputArtifact !== 'string' || !s.outputArtifact.trim()) {
      errors.push(`${label} needs an output artifact`);
    }
    if (s.gate !== undefined && s.gate !== 'auto' && s.gate !== 'approve') {
      errors.push(`${label}'s gate is unknown`);
    }
    const h = s.handoff;
    if (h && typeof h === 'object' && !Array.isArray(h)) {
      const target = (h as Record<string, unknown>).target;
      if (
        typeof target === 'string' &&
        target &&
        !HANDOFF_TARGETS.includes(target)
      ) {
        errors.push(`${label}'s handoff target is unknown`);
      }
    }
  });
  return errors;
}

export function rowToRecipeRun(row: RecipeRunRow): RecipeRun {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    sessionId: row.session_id ?? '',
    status: toRecipeRunStatus(row.status),
    currentStep:
      typeof row.current_step === 'number' && Number.isFinite(row.current_step)
        ? Math.max(0, Math.floor(row.current_step))
        : 0,
    stepsState: normalizeStepsState(row.steps_state),
    estCostCents:
      typeof row.est_cost_cents === 'number' &&
      Number.isFinite(row.est_cost_cents)
        ? Math.max(0, Math.floor(row.est_cost_cents))
        : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
