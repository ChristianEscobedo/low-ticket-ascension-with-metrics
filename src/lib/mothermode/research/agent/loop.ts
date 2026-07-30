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
} from '../store';
import {
  type ResearchArtifact,
  type ResearchMessage,
  type ResearchSession,
  type ToolCallRecord,
} from '../types';
import { buildResearchSystemPrompt } from './prompt';
import { researchToolDefs, runResearchTool } from './tools';
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
  | { type: 'error'; error: string };

export interface RunTurnInput {
  session: ResearchSession;
  userText: string;
  /** Picker model id ('' / undefined = Auto). */
  model?: string;
  updatedBy?: string | null;
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

  // 1. Persist the user turn; title the session on its first message.
  try {
    const prior = await listMessages(session.id, { limit: 1 });
    await appendMessage({
      sessionId: session.id,
      role: 'user',
      content: userText,
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
  const system = buildResearchSystemPrompt({ session, packs });
  // The session's research depth decides the tool lane: standard gets the
  // everyday eight, deep adds the paid performance/comment tools.
  const tools = researchToolDefs({ deep: session.intake.depth === 'deep' });

  // 3. The loop. `transcript` accumulates this turn's assistant+tool messages.
  const transcript: AgentMessage[] = [];
  const trace: ToolCallRecord[] = [];
  let rounds = 0;

  emit({ type: 'status', text: 'Thinking.' });

  while (rounds < MAX_ROUNDS) {
    rounds += 1;
    const result = await callAgentModel({
      model: input.model,
      system,
      messages: [...history, ...transcript],
      tools,
      maxTokens: 8000,
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

    // Tool round: run each call, stream the trace, continue the transcript.
    transcript.push({ role: 'assistant', content: text, toolCalls });
    for (const call of toolCalls) {
      const started = Date.now();
      emit({
        type: 'status',
        text: `Running ${call.name}.`,
      });
      let outcome;
      try {
        outcome = await runResearchTool({
          name: call.name,
          input: call.input,
          session,
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
      const record: ToolCallRecord = {
        id: call.id,
        name: call.name,
        inputSummary: outcome.inputSummary,
        status: /failed:|Unknown tool/.test(outcome.content.split('\n')[0] || '')
          ? 'error'
          : 'ok',
        resultSummary: outcome.resultSummary,
        ms: Date.now() - started,
      };
      trace.push(record);
      emit({ type: 'tool', call: record });
      if (outcome.artifact) {
        emit({ type: 'artifact', artifact: outcome.artifact });
      }
      transcript.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: clampToolResult(outcome.content),
      });
    }
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
