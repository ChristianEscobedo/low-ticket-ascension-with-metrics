/**
 * The Research Lab agent loop: run one user turn to completion.
 *
 * Flow: persist the user message -> rebuild plain-text history -> resolve the
 * session's context packs -> up to MAX_ROUNDS of (model -> tools -> model) ->
 * persist the assistant turn WITH the tool-call trace -> stream events out.
 *
 * History carries prior turns as plain user/assistant text only. The live
 * tool transcript exists only inside this turn, which keeps the rebuild
 * trivial and provider-identical (see research-agent.ts).
 *
 * Server-only: pulls in the service-role store and the integrations.
 */
import {
  callAgentModel,
  type AgentMessage,
} from '@/utils/integrations/research-agent';
import {
  appendMessage,
  listMessages,
  touchSession,
  logAgentCall,
  readCallUsage,
} from '../store';
import { estimateCallCost, TOOL_COST_ESTIMATES_CENTS } from './cost';
import {
  checkBudget,
  budgetBlockedOutcome,
  type CallUsage,
} from './budget';
import {
  type ResearchArtifact,
  type ResearchMessage,
  type ResearchSession,
  type ToolCallRecord,
} from '../types';
import { buildResearchSystemPrompt } from './prompt';
import {
  researchToolDefs,
  runResearchTool,
  type ToolRunOutcome,
} from './tools';
import { listSkillToolDefs } from './skillBridge';
import { getExpert } from '../experts/store';
import { listLearnings } from '../learnings';
import {
  DEFAULT_RESEARCH_EXPERT,
  type ResearchExpert,
} from '../experts/types';
import { resolveContextRefs } from '@/lib/mothermode/context/resolve';
import { getOffer } from '@/lib/mothermode/offers';
import type { ContextRef } from '@/lib/mothermode/context';

/** Hard cap on model<->tool rounds per turn. A runaway loop costs real money. */
const MAX_ROUNDS = 8;
/** Prior turns replayed into history. */
const HISTORY_LIMIT = 24;
/** Cap on a single tool result fed back to the model. */
const TOOL_RESULT_CHAR_CAP = 9000;

export type ResearchAgentEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; call: ToolCallRecord }
  | { type: 'artifact'; artifact: ResearchArtifact }
  | { type: 'message'; message: ResearchMessage }
  | { type: 'done' }
  | { type: 'error'; error: string }
  /** A streamed assistant text chunk (0.2), fired as it lands. */
  | { type: 'text-delta'; text: string };

export interface RunTurnInput {
  session: ResearchSession;
  userText: string;
  /** Picker model id ('' / undefined = Auto; the expert's model wins when set). */
  model?: string;
  /**
   * The expert running this turn (roadmap 1.2). Resolution order: an
   * explicit expert object → expertSlug via the store (degrades on error)
   * → the code-level DEFAULT_RESEARCH_EXPERT, which is exactly the
   * hardcoded research agent's behavior.
   */
  expert?: ResearchExpert;
  expertSlug?: string;
  updatedBy?: string | null;
  /** Recipe provenance: the run + 0-based step this turn belongs to. Both
   *  persisted messages are stamped, so the transcript can group the run's
   *  steps and label the speaking expert. Plain chat leaves these unset. */
  recipeRunId?: string;
  recipeStepIndex?: number;
  emit: (event: ResearchAgentEvent) => void;
}

function clampToolResult(text: string): string {
  if (text.length <= TOOL_RESULT_CHAR_CAP) return text;
  return `${text.slice(0, TOOL_RESULT_CHAR_CAP)}\n... [truncated ${text.length - TOOL_RESULT_CHAR_CAP} chars]`;
}

/** Prior turns -> provider-agnostic history (text only, oldest first). */
function toHistory(messages: ResearchMessage[]): AgentMessage[] {
  const slice = messages.slice(-HISTORY_LIMIT);
  const out: AgentMessage[] = [];
  for (const m of slice) {
    if (!m.content.trim()) continue;
    out.push(
      m.role === 'assistant'
        ? { role: 'assistant', content: m.content }
        : { role: 'user', content: m.content },
    );
  }
  return out;
}

export async function runResearchTurn(input: RunTurnInput): Promise<void> {
  const { session, emit } = input;
  const userText = input.userText.trim();
  if (!userText) {
    emit({ type: 'error', error: 'A message is required.' });
    return;
  }

  // The expert (roadmap 1.2): one loop, many configs. The default config IS
  // the research agent, so an unconfigured turn is byte-identical to before.
  // Resolved FIRST: both persisted turns carry its slug as provenance.
  const expert =
    input.expert ??
    (input.expertSlug ? await getExpert(input.expertSlug) : null) ??
    DEFAULT_RESEARCH_EXPERT;

  // 1. Persist the user turn; title the session on its first message.
  try {
    const prior = await listMessages(session.id, { limit: 1 });
    await appendMessage({
      sessionId: session.id,
      role: 'user',
      content: userText,
      expertSlug: expert.slug,
      recipeRunId: input.recipeRunId,
      recipeStepIndex: input.recipeStepIndex,
    });
    await touchSession(session.id, prior.length === 0 ? userText : undefined);
  } catch (err) {
    emit({
      type: 'error',
      error:
        err instanceof Error ? err.message : 'Could not save the message.',
    });
    return;
  }

  // 2. History + context packs + system prompt.
  const history = toHistory(await listMessages(session.id));
  const refs: ContextRef[] = [...session.contextRefs];
  if (
    session.offerSlug &&
    !refs.some((r) => r.kind === 'offer' && r.id === session.offerSlug)
  ) {
    const offer = getOffer(session.offerSlug);
    refs.unshift({
      kind: 'offer',
      id: session.offerSlug,
      label: offer?.name ?? session.offerSlug,
    });
  }
  const packs = await resolveContextRefs(refs);
  // Cross-session memory (4.4): the offer's distilled learnings (or the
  // house-wide set when the session has no offer scope). Degrades to []
  // on any failure — a dead learnings table never blocks a turn.
  const learnings = await listLearnings(session.offerSlug).catch(() => []);
  const system = buildResearchSystemPrompt({
    session,
    packs,
    roleOverride: expert.persona || undefined,
    learnings: learnings.map((l) => l.body),
  });
  // The session's research depth decides the tool lane; the expert's policy
  // can only NARROW that lane, never widen it. Declarative skills (Phase 3)
  // join as `extra` — merged BEFORE the policy filter, so a policy narrows
  // them exactly like built-in tools.
  const skillDefs = await listSkillToolDefs();
  const tools = researchToolDefs({
    deep: session.intake.depth === 'deep',
    policy: expert.tools,
    extra: skillDefs,
  });
  // The expert's model preference beats the caller's when both are set.
  const turnModel = expert.model || input.model;

  // 3. The loop. `transcript` accumulates this turn's assistant+tool messages.
  const transcript: AgentMessage[] = [];
  const trace: ToolCallRecord[] = [];
  let rounds = 0;
  // The budget (2.4): today's paid usage, read once per turn and accumulated
  // locally as rounds settle. The kill switch is an env flag.
  let usage: CallUsage | null = null;
  const killSwitch = !!process.env.RESEARCH_PAID_TOOLS_OFF;

  emit({ type: 'status', text: 'Thinking.' });

  while (rounds < MAX_ROUNDS) {
    rounds += 1;
    const result = await callAgentModel({
      model: turnModel,
      system,
      messages: [...history, ...transcript],
      tools,
      maxTokens: 8000,
      // Token streaming (0.2): the assistant's text streams into the
      // workspace as it lands instead of arriving as one block.
      onTextDelta: (delta) => emit({ type: 'text-delta', text: delta }),
    });

    if (!result.ok) {
      emit({ type: 'error', error: result.error });
      return;
    }

    const { text, toolCalls, model } = result.data;

    // Final answer: persist the assistant turn with the trace and finish.
    if (toolCalls.length === 0) {
      const content =
        text ||
        (trace.length > 0
          ? 'Done. The artifacts panel has what I saved.'
          : 'I have nothing to add here.');
      try {
        const message = await appendMessage({
          sessionId: session.id,
          role: 'assistant',
          content,
          toolCalls: trace,
          model,
          expertSlug: expert.slug,
          recipeRunId: input.recipeRunId,
          recipeStepIndex: input.recipeStepIndex,
        });
        emit({ type: 'message', message });
        emit({ type: 'done' });
      } catch (err) {
        emit({
          type: 'error',
          error:
            err instanceof Error
              ? err.message
              : 'Could not save the assistant reply.',
        });
      }
      return;
    }

    // Tool round: run the calls IN PARALLEL (independent scrapes are the
    // common case — a 3-tool sweep is ~3x faster), streaming each trace
    // record as it lands. The persisted trace and the provider transcript
    // stay in CALL order, so both are deterministic regardless of which
    // call finished first.
    transcript.push({ role: 'assistant', content: text, toolCalls });
    emit({
      type: 'status',
      text:
        toolCalls.length === 1
          ? `Running ${toolCalls[0].name}.`
          : `Running ${toolCalls.length} tools in parallel.`,
    });
    // The budget gate (2.4): the round's paid calls check today's usage
    // (read once per turn) before any of them spend. Free tools never gate.
    const paidCalls = toolCalls.filter(
      (c) => (TOOL_COST_ESTIMATES_CENTS[c.name] ?? 0) > 0,
    );
    if (paidCalls.length > 0 && usage === null) {
      usage = await readCallUsage(session.id).catch(() => ({
        paidRunsToday: 0,
        estCostCentsToday: 0,
      }));
    }
    const roundEstCents = paidCalls.reduce(
      (n, c) => n + (TOOL_COST_ESTIMATES_CENTS[c.name] ?? 0),
      0,
    );
    const settled = await Promise.all(
      toolCalls.map(async (call) => {
        const started = Date.now();
        let outcome: ToolRunOutcome | undefined;
        const estCents = TOOL_COST_ESTIMATES_CENTS[call.name] ?? 0;
        if (estCents > 0 && usage) {
          const check = checkBudget({
            usage,
            plannedPaidRuns: paidCalls.length,
            plannedEstCostCents: roundEstCents,
            killSwitch,
          });
          if (!check.allowed) {
            outcome = budgetBlockedOutcome(call.name, check.reason);
          } else {
            // Reserve the estimate now so the NEXT round sees it.
            usage.paidRunsToday += 1;
            usage.estCostCentsToday += estCents;
          }
        }
        if (!outcome) {
          try {
            outcome = await runResearchTool({
              name: call.name,
              input: call.input,
              session,
              expert,
            });
          } catch (err) {
            outcome = {
              content: `${call.name} failed: ${
                err instanceof Error ? err.message : 'unknown error'
              }`,
              inputSummary: '',
              resultSummary: 'failed',
            };
          }
        }
        const record: ToolCallRecord = {
          id: call.id,
          name: call.name,
          inputSummary: outcome.inputSummary,
          status: /failed:|Unknown tool/.test(
            outcome.content.split('\n')[0] || '',
          )
            ? 'error'
            : 'ok',
          resultSummary: outcome.resultSummary,
          ms: Date.now() - started,
          ...(outcome.cards && outcome.cards.length > 0
            ? { cards: outcome.cards }
            : {}),
        };
        emit({ type: 'tool', call: record });
        if (outcome.artifact) {
          emit({ type: 'artifact', artifact: outcome.artifact });
        }
        return { call, record, outcome };
      }),
    );
    for (const { call, record, outcome } of settled) {
      trace.push(record);
      transcript.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: clampToolResult(outcome.content),
      });
    }
    // Telemetry: one row per call, best-effort (a dead log table must never
    // break a research turn, so failures are swallowed per call).
    await Promise.all(
      settled.map(({ record }) => {
        const cost = estimateCallCost(record);
        return logAgentCall({
          sessionId: session.id,
          tool: record.name,
          inputSummary: record.inputSummary,
          status: record.status,
          resultSummary: record.resultSummary,
          ms: record.ms,
          cached: cost.cached,
          estCostCents: cost.estCostCents,
          // Phase 4: WHO made the call + WHICH run — the scorecard's
          // measured cost reads these. Chat turns stamp the expert only.
          expertSlug: expert.slug,
          ...(input.recipeRunId ? { recipeRunId: input.recipeRunId } : {}),
        }).catch(() => {});

      }),
    );
    emit({ type: 'status', text: 'Thinking.' });
  }

  // Round cap hit: save whatever we have rather than dying silent.
  try {
    const message = await appendMessage({
      sessionId: session.id,
      role: 'assistant',
      content:
        'I hit the step limit for one turn. Tell me to continue and I will pick up where I stopped.',
      toolCalls: trace,
      model: '',
      expertSlug: expert.slug,
      recipeRunId: input.recipeRunId,
      recipeStepIndex: input.recipeStepIndex,
    });
    emit({ type: 'message', message });
    emit({ type: 'done' });
  } catch (err) {
    emit({
      type: 'error',
      error:
        err instanceof Error ? err.message : 'Could not save the reply.',
    });
  }
}
