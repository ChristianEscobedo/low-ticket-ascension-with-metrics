/**
 * The recipe interpreter (roadmap task 3.1): run a declarative step list
 * through the generalized loop, one expert at a time, sequentially.
 *
 * Per step: resolve the expert (slug → config, default = research), build
 * the instruction ({input} = the input envelope's markdown), run ONE turn,
 * then find the artifact the step emitted and lineage-stamp it with its
 * input's id. Auto steps run straight through; approve gates pause the run
 * as 'gated' (the mission UI resumes it with a decision). The per-run
 * budget stops a runaway: est cents are read from the call log before and
 * after each step, and a run that spends past the recipe's budget fails
 * with the reason on the step.
 *
 * Dependencies are INJECTED (the real ones resolve lazily via dynamic
 * import) so the interpreter is unit-testable without booting the
 * integrations layer.
 */
import {
  initialStepsState,
  type Recipe,
  type RecipeRun,
  type RecipeStep,
  type RecipeStepState,
} from './types';
import type { ResearchArtifact, ResearchSession } from '../types';
import type { ResearchExpert } from '../experts/types';
import { DEFAULT_RESEARCH_EXPERT } from '../experts/types';
import { handoffNotice, citationCoverage, CITATION_FLOOR } from './crew';
import type { RunEventKind } from './store';

export interface RecipeRunEvent {
  type: 'step' | 'artifact' | 'gated' | 'done' | 'failed' | 'canceled';
  stepIndex: number;
  text: string;
  artifact?: ResearchArtifact;
}

export interface RecipeDeps {
  getExpert: (slug: string) => Promise<ResearchExpert | null>;
  runTurn: (input: {
    session: ResearchSession;
    userText: string;
    expert: ResearchExpert;
    /** Recipe provenance: stamped on both persisted turns, so the session
     *  transcript groups the run's steps and labels the speaking expert. */
    recipeRunId?: string;
    recipeStepIndex?: number;
    emit: (event: { type: string }) => void;
  }) => Promise<void>;
  listArtifacts: (sessionId: string) => Promise<ResearchArtifact[]>;
  stampParent: (artifactId: string, parentId: string) => Promise<void>;
  readUsageCents: (sessionId: string) => Promise<number>;
  /** Fire the step's handoff through the EXISTING pipeline (3.3). 'system'
   *  is the Full System fan-out — it always Builds its buildable parts.
   *  Returns the handed_off_to label on success, throws on failure. */
  runHandoff: (input: {
    artifactId: string;
    target:
      | 'planner-cards'
      | 'leadgen-kit'
      | 'email-kit'
      | 'sales-funnel'
      | 'system'
      | 'reel-cues';
    session: ResearchSession;
    generate: boolean;
  }) => Promise<string | void>;
  /** Post a handoff beat into the session transcript (initiated/completed/
   *  failed), stamped with the run's provenance. Optional: absent = silent
   *  handoffs (the injected-deps tests). */
  postNotice?: (input: {
    sessionId: string;
    text: string;
    recipeRunId?: string;
    recipeStepIndex?: number;
    expertSlug?: string;
  }) => Promise<void>;
  updateRun: (
    runId: string,
    patch: Partial<
      Pick<RecipeRun, 'status' | 'currentStep' | 'stepsState' | 'estCostCents'>
    >,
  ) => Promise<void>;
  /** Cancel support (owner can stop a RUNNING run): re-reads the run row,
   *  true when its status flipped to 'canceled'. Checked between steps and
   *  after an in-flight turn — a cancel never interrupts a turn, it stops
   *  the NEXT one. Absent in tests = never canceled. */
  isCanceled?: (runId: string) => Promise<boolean>;
  /** Append to the run's event log (the trust spine: what the run did, in
   *  order). Optional: absent = no log (the injected-deps tests assert on
   *  a fake instead). */
  logEvent?: (input: {
    runId: string;
    kind: RunEventKind;
    stepIndex?: number | null;
    text: string;
  }) => Promise<void>;
  /** Tell the owner a run is waiting on their decision (email when the
   *  channel is configured; a no-op otherwise). Optional: absent = silent
   *  gates (the injected-deps tests). */
  notifyGate?: (input: {
    recipeName: string;
    stepNote: string;
    runId: string;
    sessionId: string;
  }) => Promise<void>;
  /** The model cascade (Phase 2): the step's model, routed by artifact
   *  tier + the expert's scorecard when the expert is on Auto. The
   *  interpreter applies the choice only when it CHANGES the model — an
   *  Auto expert staying on the owner's default is not news. Optional:
   *  absent = no cascade (the injected-deps tests). */
  cascadeModel?: (input: {
    expert: ResearchExpert;
    outputArtifact: string;
  }) => Promise<{ model: string; reason: string } | null>;
}

/** The production deps, resolved lazily (keeps vitest off the integrations). */
async function defaultDeps(): Promise<RecipeDeps> {
  const { getExpert } = await import('../experts/store');
  const { runResearchTurn } = await import('../agent/loop');
  const { listArtifacts, upsertArtifact, readCallUsage } = await import(
    '../store'
  );
  return {
    getExpert,
    runTurn: async ({
      session,
      userText,
      expert,
      recipeRunId,
      recipeStepIndex,
      emit,
    }) => {
      await runResearchTurn({
        session,
        userText,
        expert,
        recipeRunId,
        recipeStepIndex,
        emit: emit as never,
      });
    },
    listArtifacts,
    stampParent: async (artifactId, parentId) => {
      await upsertArtifact({ id: artifactId, sessionId: '', parentId });
    },
    readUsageCents: async (sessionId) =>
      (await readCallUsage(sessionId)).estCostCentsToday,
    runHandoff: async ({ artifactId, target, session, generate }) => {
      const { runHandoff } = await import('../handoff');
      const result = await runHandoff({
        artifactId,
        target,
        session,
        generate,
      });
      if (!result.ok) throw new Error(result.error);
      return result.handedOffTo.label;
    },
    postNotice: async ({
      sessionId,
      text,
      recipeRunId,
      recipeStepIndex,
      expertSlug,
    }) => {
      const { appendMessage } = await import('../store');
      // A notice is the crew's receipt, never a reason to fail a handoff.
      await appendMessage({
        sessionId,
        role: 'assistant',
        content: text,
        expertSlug: expertSlug ?? '',
        recipeRunId,
        recipeStepIndex,
      }).catch(() => {});
    },
    updateRun: async (runId, patch) => {
      const { updateRecipeRun } = await import('./store');
      await updateRecipeRun(runId, patch);
    },
    isCanceled: async (runId) => {
      const { getRecipeRun } = await import('./store');
      return (await getRecipeRun(runId))?.status === 'canceled';
    },
    logEvent: async (input) => {
      const { logRunEvent } = await import('./store');
      await logRunEvent(input);
    },
    notifyGate: async (input) => {
      const { sendGateNotification } = await import('../notify');
      await sendGateNotification(input);
    },
    cascadeModel: async ({ expert, outputArtifact }) => {
      const { resolveStepModel } = await import('../agent/modelCascade');
      const { getExpertScorecardsCached } = await import('./scorecards');
      const cards = await getExpertScorecardsCached();
      const decision = resolveStepModel({
        expertModel: expert.model,
        outputArtifact,
        scorecard: cards.find((c) => c.slug === expert.slug) ?? null,
      });
      return { model: decision.model, reason: decision.reason };
    },
  };
}

/**
 * Fire a step's handoff, honestly: a handoff failure fails the step. The
 * chat trail rides along — initiated, then completed (with the outcome
 * label) or failed (with the reason) — stamped with the run's provenance
 * so the beats group under this step's divider in the transcript.
 */
async function fireHandoff(
  deps: RecipeDeps,
  step: RecipeStep,
  artifact: Pick<ResearchArtifact, 'id' | 'title'>,
  session: ResearchSession,
  provenance: { runId: string; stepIndex: number; expertSlug: string },
): Promise<string> {
  if (!step.handoff) return '';
  const h = step.handoff;
  const artifactTitle = artifact.title || 'untitled';
  const noticeInput = {
    sessionId: session.id,
    recipeRunId: provenance.runId,
    recipeStepIndex: provenance.stepIndex,
    expertSlug: provenance.expertSlug,
  };
  await deps.postNotice?.({
    ...noticeInput,
    text: handoffNotice({
      phase: 'initiated',
      target: h.target,
      generate: h.generate,
      artifactTitle,
    }),
  });
  await deps.logEvent?.({
    runId: provenance.runId,
    kind: 'handoff-initiated',
    stepIndex: provenance.stepIndex,
    text: `${h.target}${h.generate ? ' (build)' : ' (draft)'} from "${artifactTitle}"`,
  });
  try {
    const label = await deps.runHandoff({
      artifactId: artifact.id,
      target: h.target,
      session,
      generate: h.generate,
    });
    await deps.postNotice?.({
      ...noticeInput,
      text: handoffNotice({
        phase: 'completed',
        target: h.target,
        generate: h.generate,
        artifactTitle,
        detail: typeof label === 'string' && label.trim() ? label : undefined,
      }),
    });
    await deps.logEvent?.({
      runId: provenance.runId,
      kind: 'handoff-completed',
      stepIndex: provenance.stepIndex,
      text:
        typeof label === 'string' && label.trim() ? label : `${h.target} done`,
    });
    return ` → ${h.target}${h.generate ? ' (built)' : ' (draft)'}`;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    await deps.postNotice?.({
      ...noticeInput,
      text: handoffNotice({
        phase: 'failed',
        target: h.target,
        generate: h.generate,
        artifactTitle,
        detail: reason,
      }),
    });
    await deps.logEvent?.({
      runId: provenance.runId,
      kind: 'handoff-failed',
      stepIndex: provenance.stepIndex,
      text: `${h.target}: ${reason}`,
    });
    return ` → handoff FAILED: ${reason}`;
  }
}

function stepNote(step: RecipeStep, index: number): string {
  return `step ${index + 1}: ${step.expert} → ${step.outputArtifact}`;
}

/**
 * Run a recipe from `startStep` (0 for a fresh run, the gated index when
 * resuming). Returns the final run status. The caller persists the run row
 * (createRecipeRun) before calling and reads it back after.
 */
export async function runRecipe(opts: {
  recipe: Recipe;
  run: RecipeRun;
  session: ResearchSession;
  startStep?: number;
  /** The step-sized lane (4.1+): cap how many steps THIS invocation runs.
   *  When the cap bites before the recipe ends, the run returns 'running'
   *  and the lane requeues the next step's job. Absent = the whole recipe
   *  (inline starts, tests). */
  maxSteps?: number;
  deps?: Partial<RecipeDeps>;
  emit?: (event: RecipeRunEvent) => void;
}): Promise<RecipeRun['status']> {
  // Injected deps win; the integrations layer is only touched when a dep
  // is actually missing (which is what keeps the unit tests off it).
  const injected = opts.deps ?? {};
  const complete =
    injected.getExpert &&
    injected.runTurn &&
    injected.listArtifacts &&
    injected.stampParent &&
    injected.readUsageCents &&
    injected.updateRun;
  const deps: RecipeDeps = complete
    ? (injected as RecipeDeps)
    : { ...(await defaultDeps()), ...injected };
  const emit = opts.emit ?? (() => {});
  const { recipe, session } = opts;
  const steps = recipe.steps;
  const stepsState: RecipeStepState[] =
    opts.run.stepsState.length === steps.length
      ? [...opts.run.stepsState]
      : initialStepsState(steps.length);
  const startStep = opts.startStep ?? 0;
  const startCents = await deps.readUsageCents(session.id);
  let spent = opts.run.estCostCents;
  /** The owner's cancel lands between turns, never mid-turn. */
  const isCanceled = () =>
    deps.isCanceled ? deps.isCanceled(opts.run.id) : Promise.resolve(false);
  /** One beat, two sinks: the caller's live event + the append-only log
   *  (the trust spine — what the run did, in order). */
  const track = (event: RecipeRunEvent, kind: RunEventKind) => {
    emit(event);
    deps.logEvent?.({
      runId: opts.run.id,
      kind,
      stepIndex:
        event.stepIndex >= 0 && event.stepIndex < steps.length
          ? event.stepIndex
          : null,
      text: event.text,
    });
  };

  // The envelope chain: the artifact each step hands the next one.
  let previousArtifact: ResearchArtifact | null = null;
  if (startStep > 0) {
    const prevId = stepsState[startStep - 1]?.artifactId;
    if (prevId) {
      const arts = await deps.listArtifacts(session.id);
      previousArtifact = arts.find((a) => a.id === prevId) ?? null;
    }
    // A gated step's handoff fires on APPROVAL (3.3): the owner reviewed
    // the artifact, and only now does it build downstream.
    const prevStep = steps[startStep - 1];
    const prevState = stepsState[startStep - 1];
    if (
      prevStep?.handoff &&
      prevState?.status === 'gated' &&
      prevState.artifactId
    ) {
      const result = await fireHandoff(
        deps,
        prevStep,
        {
          id: prevState.artifactId,
          title: previousArtifact?.title ?? '',
        },
        session,
        {
          runId: opts.run.id,
          stepIndex: startStep - 1,
          expertSlug: prevStep.expert,
        },
      );
      const failed = result.includes('handoff FAILED');
      stepsState[startStep - 1] = {
        ...prevState,
        status: failed ? 'failed' : 'done',
        note: prevState.note + result,
      };
      await deps.updateRun(opts.run.id, {
        status: failed ? 'failed' : 'running',
        currentStep: startStep - 1,
        stepsState,
        estCostCents: spent,
      });
      if (failed) {
        track(
          {
            type: 'failed',
            stepIndex: startStep - 1,
            text: stepsState[startStep - 1].note,
          },
          'failed',
        );
        return 'failed';
      }
    }
  }

  const stepLimit =
    typeof opts.maxSteps === 'number' && Number.isFinite(opts.maxSteps)
      ? Math.min(steps.length, startStep + Math.max(1, Math.floor(opts.maxSteps)))
      : steps.length;

  for (let i = startStep; i < stepLimit; i++) {
    // Cancel check: a running run the owner canceled stops BEFORE the next
    // step's turn starts (the step is marked skipped, honestly).
    if (await isCanceled()) {
      stepsState[i] = {
        status: 'skipped',
        artifactId: '',
        note: `${stepNote(steps[i], i)} skipped: canceled by the owner`,
        at: new Date().toISOString(),
      };
      await deps.updateRun(opts.run.id, {
        status: 'canceled',
        currentStep: i,
        stepsState,
        estCostCents: spent,
      });
      track(
        { type: 'canceled', stepIndex: i, text: stepsState[i].note },
        'canceled',
      );
      return 'canceled';
    }
    const step = steps[i];
    // The model cascade (Phase 2): resolve the expert BEFORE the
    // step-started beat, so the timeline can say which model took the
    // step and why. An Auto expert's step routes by artifact tier +
    // scorecard; only an actual change earns the note suffix — staying
    // on the owner's configured default is not news.
    const expert =
      (await deps.getExpert(step.expert)) ?? DEFAULT_RESEARCH_EXPERT;
    let stepExpert = expert;
    let cascadeNote = '';
    if (deps.cascadeModel) {
      const choice = await deps
        .cascadeModel({ expert, outputArtifact: step.outputArtifact })
        .catch(() => null);
      if (choice && choice.model !== (expert.model || '')) {
        stepExpert = { ...expert, model: choice.model };
        cascadeNote = ` · ${choice.model || 'auto'} (${choice.reason})`;
      }
    }
    const baseNote = stepNote(step, i) + cascadeNote;
    stepsState[i] = {
      status: 'running',
      artifactId: '',
      note: baseNote,
      at: new Date().toISOString(),
    };
    await deps.updateRun(opts.run.id, {
      status: 'running',
      currentStep: i,
      stepsState,
      estCostCents: spent,
    });
    track({ type: 'step', stepIndex: i, text: baseNote }, 'step-started');

    // The input envelope for this step.
    const inputMarkdown =
      step.inputFrom === 'previous'
        ? (previousArtifact?.markdown ?? '')
        : step.inputFrom === 'brief'
          ? session.intake.goal
          : '';
    const instruction = step.instruction.replace(
      '{input}',
      inputMarkdown ||
        '(no input envelope exists yet — say so and produce the best draft you can from context)',
    );

    let turnError = '';
    await deps.runTurn({
      session,
      userText: instruction,
      expert: stepExpert,
      recipeRunId: opts.run.id,
      recipeStepIndex: i,
      emit: (event) => {
        if (event.type === 'error') turnError = 'the step turn errored';
      },
    });

    // The artifact this step emitted: the newest of the required type.
    const artifacts = await deps.listArtifacts(session.id);
    let emitted =
      artifacts.find(
        (a) =>
          a.type === step.outputArtifact &&
          a.id !== previousArtifact?.id &&
          !stepsState.some((s) => s.artifactId === a.id),
      ) ?? null;

    if (turnError || !emitted) {
      stepsState[i] = {
        status: 'failed',
        artifactId: '',
        note: turnError
          ? `${baseNote} failed: the turn errored`
          : `${baseNote} failed: no ${step.outputArtifact} artifact was created`,
        at: new Date().toISOString(),
      };
      await deps.updateRun(opts.run.id, {
        status: 'failed',
        currentStep: i,
        stepsState,
        estCostCents: spent,
      });
      track(
        {
          type: 'failed',
          stepIndex: i,
          text: stepsState[i].note,
        },
        'failed',
      );
      return 'failed';
    }

    // Citation coverage (trust spine v1): a research brief must carry
    // receipts. Below the floor, ONE nudge turn re-asks with a citation
    // demand — then the step lands with its coverage said honestly in the
    // note and a citation-low event when it is still thin (v1 never
    // hard-fails a sweep; hard failure graduates in v2).
    let receiptsNote = '';
    if (step.outputArtifact === 'research-brief') {
      // `brief` is the const, provably non-null artifact (the early return
      // above guarantees it) — the nudge resolution reassigns `emitted`.
      const brief = emitted;
      let coverage = citationCoverage(brief.markdown);
      if (coverage.total > 0 && coverage.ratio < CITATION_FLOOR) {
        await deps.runTurn({
          session,
          userText: `${instruction}\n\nIMPORTANT: every claim line must carry its receipt — a URL, a subreddit (r/...), a handle (@...), or an exact quoted stat — and save the research-brief artifact again with them included.`,
          expert: stepExpert,
          recipeRunId: opts.run.id,
          recipeStepIndex: i,
          emit: () => {},
        });
        const after = await deps.listArtifacts(session.id);
        const newer =
          after.find(
            (a) =>
              a.type === step.outputArtifact &&
              a.id !== brief.id &&
              a.id !== previousArtifact?.id &&
              !stepsState.some((s) => s.artifactId === a.id),
          ) ?? null;
        emitted =
          newer ??
          after.find((a) => a.id === brief.id) ??
          brief;
        coverage = citationCoverage(emitted.markdown);
      }
      const low = coverage.total > 0 && coverage.ratio < CITATION_FLOOR;
      receiptsNote = ` · receipts ${coverage.sourced}/${coverage.total}${low ? ' (low)' : ''}`;
      if (low) {
        await deps.logEvent?.({
          runId: opts.run.id,
          kind: 'citation-low',
          stepIndex: i,
          text: `receipts ${coverage.sourced}/${coverage.total} — this brief is thinly sourced, read it that way`,
        });
      }
      // Phase 4 (citation v2): the play's enforce mode. Still thin AFTER the
      // ONE nudge and the step FAILS — the run dies honestly instead of
      // shipping unreceipted research downstream. The thin artifact stays
      // (it is the evidence of WHY), the run stops. The default 'flag'
      // behavior below is untouched.
      if (low && opts.recipe.citationMode === 'enforce') {
        stepsState[i] = {
          status: 'failed',
          artifactId: emitted.id,
          note: `${baseNote} failed: receipts ${coverage.sourced}/${coverage.total} is below this play's citation floor`,
          at: new Date().toISOString(),
        };
        await deps.updateRun(opts.run.id, {
          status: 'failed',
          currentStep: i,
          stepsState,
          estCostCents: spent,
        });
        track(
          {
            type: 'failed',
            stepIndex: i,
            text: stepsState[i].note,
          },
          'failed',
        );
        return 'failed';
      }
    }


    // Lineage: the emitted artifact's parent is its input envelope.
    if (previousArtifact && step.inputFrom === 'previous') {
      await deps.stampParent(emitted.id, previousArtifact.id);
    }
    stepsState[i] = {
      status: 'done',
      artifactId: emitted.id,
      note: baseNote + receiptsNote,
      at: new Date().toISOString(),
    };
    track(
      { type: 'artifact', stepIndex: i, text: emitted.title, artifact: emitted },
      'artifact',
    );

    // A cancel that landed DURING this turn: the step's work is real (its
    // artifact exists and stays done) — but no further step starts.
    if (await isCanceled()) {
      await deps.updateRun(opts.run.id, {
        status: 'canceled',
        currentStep: i,
        stepsState,
        estCostCents: spent,
      });
      track(
        {
          type: 'canceled',
          stepIndex: i,
          text: 'canceled by the owner',
        },
        'canceled',
      );
      return 'canceled';
    }

    // The per-run budget: read the delta after the step.
    const nowCents = await deps.readUsageCents(session.id);
    spent = Math.max(spent, nowCents - startCents + opts.run.estCostCents);
    if (spent > recipe.budgetEstCents) {
      stepsState[i] = {
        ...stepsState[i],
        status: 'failed',
        note: `${baseNote} stopped: the run spent ~$${(spent / 100).toFixed(2)} of its ~$${(recipe.budgetEstCents / 100).toFixed(2)} budget`,
      };
      await deps.updateRun(opts.run.id, {
        status: 'failed',
        currentStep: i,
        stepsState,
        estCostCents: spent,
      });
      track(
        { type: 'failed', stepIndex: i, text: stepsState[i].note },
        'budget-stopped',
      );
      return 'failed';
    }

    // The human gate: pause AFTER the artifact exists, so the owner reviews
    // the real output before the next expert touches it.
    if (step.gate === 'approve') {
      stepsState[i] = {
        ...stepsState[i],
        status: 'gated',
        note: `review "${emitted.title}" — approve to continue to ${i + 2 <= steps.length - 1 ? stepNote(steps[i + 1], i + 1) : 'the end'}`,
      };
      await deps.updateRun(opts.run.id, {
        status: 'gated',
        currentStep: i,
        stepsState,
        estCostCents: spent,
      });
      track({ type: 'gated', stepIndex: i, text: stepsState[i].note }, 'gated');
      // Tell the owner — a run waiting silently is a run abandoned.
      await deps.notifyGate?.({
        recipeName: recipe.name,
        stepNote: stepsState[i].note,
        runId: opts.run.id,
        sessionId: session.id,
      });
      return 'gated';
    }

    // The step's handoff (3.3): auto steps fire on completion, through the
    // EXISTING handoff pipeline. A handoff failure fails the step honestly.
    if (step.handoff) {
      const result = await fireHandoff(
        deps,
        step,
        { id: emitted.id, title: emitted.title },
        session,
        { runId: opts.run.id, stepIndex: i, expertSlug: expert.slug },
      );
      stepsState[i] = { ...stepsState[i], note: stepsState[i].note + result };
      if (result.includes('handoff FAILED')) {
        stepsState[i] = { ...stepsState[i], status: 'failed' };
        await deps.updateRun(opts.run.id, {
          status: 'failed',
          currentStep: i,
          stepsState,
          estCostCents: spent,
        });
        track(
          { type: 'failed', stepIndex: i, text: stepsState[i].note },
          'failed',
        );
        return 'failed';
      }
    }

    previousArtifact = emitted;
    await deps.updateRun(opts.run.id, {
      status: 'running',
      currentStep: i,
      stepsState,
      estCostCents: spent,
    });
  }

  // The step-sized lane's exit: the cap bit before the recipe ended — the
  // run stays 'running' (each finished step already persisted its state)
  // and the lane requeues the next slice.
  if (stepLimit < steps.length) {
    return 'running';
  }

  await deps.updateRun(opts.run.id, {
    status: 'done',
    currentStep: steps.length,
    stepsState,
    estCostCents: spent,
  });
  track(
    { type: 'done', stepIndex: steps.length, text: 'recipe complete' },
    'done',
  );
  return 'done';
}
