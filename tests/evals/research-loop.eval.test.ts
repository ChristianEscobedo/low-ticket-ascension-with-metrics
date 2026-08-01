import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * THE AGENT EVAL SUITE (roadmap task 0.5).
 *
 * The loop is the chassis the Experts and Recipes phases build on, so its
 * contracts are pinned here with a SCRIPTED model and a mocked tool layer —
 * no paid calls, fully deterministic:
 *
 *   - persistence: user turn saved, session titled from the first message
 *   - the round contract: tool results feed back in CALL order, trace
 *     persists with the assistant turn, artifacts stream as they land
 *   - the parallel contract: one round's calls run concurrently (task 0.1),
 *     events stream per completion, trace/transcript stay call-ordered
 *   - failure honesty: model errors surface, thrown tools become error
 *     records, the 8-round cap saves cleanly
 *   - the steering contract: the system prompt carries query discipline and
 *     the depth flag drives the tool lane
 */
vi.mock('@/utils/integrations/research-agent', () => ({
  callAgentModel: vi.fn(),
}));
vi.mock('@/lib/mothermode/research/store', () => ({
  appendMessage: vi.fn(),
  listMessages: vi.fn(),
  touchSession: vi.fn(),
  logAgentCall: vi.fn(),
  readCallUsage: vi.fn(),
}));
vi.mock('@/lib/mothermode/research/agent/tools', () => ({
  researchToolDefs: vi.fn(() => []),
  runResearchTool: vi.fn(),
}));
vi.mock('@/lib/mothermode/context/resolve', () => ({
  resolveContextRefs: vi.fn(async () => []),
}));
vi.mock('@/lib/mothermode/offers', () => ({
  getOffer: vi.fn(() => null),
}));

import { callAgentModel } from '@/utils/integrations/research-agent';
import {
  appendMessage,
  listMessages,
  touchSession,
  logAgentCall,
  readCallUsage,
} from '@/lib/mothermode/research/store';
import {
  researchToolDefs,
  runResearchTool,
} from '@/lib/mothermode/research/agent/tools';
import {
  runResearchTurn,
  type ResearchAgentEvent,
} from '@/lib/mothermode/research/agent/loop';
import { blankIntake } from '@/lib/mothermode/research/intake';
import { DEFAULT_RESEARCH_EXPERT } from '@/lib/mothermode/research/experts/types';
import type {
  ResearchArtifact,
  ResearchMessage,
  ResearchSession,
} from '@/lib/mothermode/research/types';

const model = vi.mocked(callAgentModel);
const append = vi.mocked(appendMessage);
const list = vi.mocked(listMessages);
const touch = vi.mocked(touchSession);
const defs = vi.mocked(researchToolDefs);
const runTool = vi.mocked(runResearchTool);
const callLog = vi.mocked(logAgentCall);
const callUsage = vi.mocked(readCallUsage);

function makeSession(overrides: Partial<ResearchSession> = {}): ResearchSession {
  return {
    id: 'sess1',
    title: 'New research',
    offerSlug: '',
    contextRefs: [],
    intake: blankIntake(),
    status: 'active',
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  };
}

function msg(m: Partial<ResearchMessage>): ResearchMessage {
  return {
    id: m.id ?? 'mx',
    sessionId: 'sess1',
    role: m.role ?? 'user',
    content: m.content ?? '',
    toolCalls: m.toolCalls ?? [],
    model: m.model ?? '',
    expertSlug: m.expertSlug ?? '',
    recipeRunId: m.recipeRunId ?? '',
    recipeStepIndex: m.recipeStepIndex ?? null,
    createdAt: null,
  };
}

const textReply = (text: string) =>
  ({ ok: true, data: { text, toolCalls: [], model: 'test-model' } }) as any;

const toolReply = (
  calls: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  text = '',
) => ({ ok: true, data: { text, toolCalls: calls, model: 'test-model' } }) as any;

const okOutcome = (over: Record<string, unknown> = {}) => ({
  content: 'tool ok',
  inputSummary: 'in',
  resultSummary: 'out',
  ...over,
});

function harness() {
  const events: ResearchAgentEvent[] = [];
  return {
    events,
    emit: (e: ResearchAgentEvent) => {
      events.push(e);
    },
  };
}

/** Assistant-turn input as passed to appendMessage, or undefined. */
function assistantInput() {
  return append.mock.calls.find(([i]) => i.role === 'assistant')?.[0] as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([]);
  append.mockImplementation(async (input: any) =>
    msg({
      id: `m_${append.mock.calls.length}`,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls ?? [],
      model: input.model ?? '',
    }),
  );
  touch.mockResolvedValue(undefined as any);
  defs.mockReturnValue([]);
  runTool.mockResolvedValue(okOutcome() as any);
  callLog.mockResolvedValue(undefined as any);
  callUsage.mockResolvedValue({ paidRunsToday: 0, estCostCentsToday: 0 });
});

describe('persistence + history', () => {
  it('rejects an empty message without touching the store', async () => {
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: '   ',
      emit,
    });
    expect(append).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('persists the user turn and titles the session from the first message', async () => {
    const { emit } = harness();
    model.mockResolvedValue(textReply('answer'));
    await runResearchTurn({
      session: makeSession(),
      userText: '  research mental load  ',
      emit,
    });
    expect(append).toHaveBeenCalledWith({
      sessionId: 'sess1',
      role: 'user',
      content: 'research mental load',
      // Provenance: plain chat stamps the default expert, no run.
      expertSlug: 'research',
    });
    expect(touch).toHaveBeenCalledWith('sess1', 'research mental load');
  });

  it('replays prior turns as history before the live transcript', async () => {
    list.mockResolvedValue([
      msg({ role: 'user', content: 'earlier q' }),
      msg({ role: 'assistant', content: 'earlier a' }),
    ]);
    model.mockResolvedValue(textReply('ok'));
    const { emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'next question',
      emit,
    });
    const firstCall = model.mock.calls[0][0] as any;
    expect(
      firstCall.messages.map((m: any) => m.content),
    ).toEqual(['earlier q', 'earlier a']);
  });

  it('persists a one-round answer with an empty trace and emits message+done', async () => {
    const { events, emit } = harness();
    model.mockResolvedValue(textReply('final answer'));
    await runResearchTurn({
      session: makeSession(),
      userText: 'hi',
      emit,
    });
    expect(assistantInput()?.content).toBe('final answer');
    expect(assistantInput()?.toolCalls).toEqual([]);
    expect(events.map((e) => e.type)).toContain('message');
    expect(events.at(-1)?.type).toBe('done');
  });

  it('token streaming (0.2): text-delta events fire before the persisted message', async () => {
    model.mockImplementationOnce(async (opts: any) => {
      opts.onTextDelta?.('final ');
      opts.onTextDelta?.('answer');
      return textReply('final answer');
    });
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'hi',
      emit,
    });
    const deltas = events.filter((e) => e.type === 'text-delta');
    expect(deltas.map((e) => e.text)).toEqual(['final ', 'answer']);
    const lastDelta = events.lastIndexOf(deltas[deltas.length - 1]);
    const messageIdx = events.findIndex((e) => e.type === 'message');
    expect(lastDelta).toBeGreaterThanOrEqual(0);
    expect(lastDelta).toBeLessThan(messageIdx);
  });
});

describe('the round contract', () => {
  it('feeds tool results back in CALL order and persists the trace', async () => {
    model
      .mockResolvedValueOnce(
        toolReply([
          { id: 'c1', name: 'web_search', input: { query: 'a' } },
          { id: 'c2', name: 'internal_metrics', input: {} },
        ]),
      )
      .mockResolvedValueOnce(textReply('done'));
    runTool
      .mockResolvedValueOnce(okOutcome({ content: 'RESULT_A' }) as any)
      .mockResolvedValueOnce(okOutcome({ content: 'RESULT_B' }) as any);
    const { emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'sweep',
      emit,
    });
    const second = model.mock.calls[1][0] as any;
    const toolMsgs = second.messages.filter((m: any) => m.role === 'tool');
    expect(toolMsgs.map((m: any) => m.toolCallId)).toEqual(['c1', 'c2']);
    expect(toolMsgs[0].content).toBe('RESULT_A');
    expect(assistantInput()?.toolCalls.map((t: any) => t.id)).toEqual([
      'c1',
      'c2',
    ]);
  });

  it('emits artifact events as artifacts land, before done', async () => {
    const artifact: ResearchArtifact = {
      id: 'a1',
      sessionId: 'sess1',
      type: 'notes',
      title: 'Note',
      markdown: 'md',
      structured: {},
      status: 'draft',
      handedOffTo: null,
      version: 1,
      parentId: '',
      createdBy: 'research',
      createdAt: null,
      updatedAt: null,
    };
    model
      .mockResolvedValueOnce(
        toolReply([
          {
            id: 'c1',
            name: 'create_artifact',
            input: { type: 'notes', title: 'Note', markdown: 'md' },
          },
        ]),
      )
      .mockResolvedValueOnce(textReply('saved it'));
    runTool.mockResolvedValue(okOutcome({ artifact }) as any);
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'save this',
      emit,
    });
    const artIdx = events.findIndex((e) => e.type === 'artifact');
    expect(artIdx).toBeGreaterThanOrEqual(0);
    expect((events[artIdx] as any).artifact.id).toBe('a1');
    expect(events.at(-1)?.type).toBe('done');
  });
});

describe('the parallel contract (task 0.1)', () => {
  function staggeredTools(
    stamps: Array<{ name: string; phase: 'start' | 'end'; t: number }>,
  ) {
    runTool.mockImplementation(async ({ name }: any) => {
      stamps.push({ name, phase: 'start', t: Date.now() });
      await new Promise((r) => setTimeout(r, name === 'slow' ? 40 : 5));
      stamps.push({ name, phase: 'end', t: Date.now() });
      return okOutcome();
    });
    model
      .mockResolvedValueOnce(
        toolReply([
          { id: '1', name: 'slow', input: {} },
          { id: '2', name: 'fast1', input: {} },
          { id: '3', name: 'fast2', input: {} },
        ]),
      )
      .mockResolvedValueOnce(textReply('done'));
  }

  it('starts every call before the first one finishes', async () => {
    const stamps: Array<{ name: string; phase: 'start' | 'end'; t: number }> =
      [];
    staggeredTools(stamps);
    const { emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'sweep',
      emit,
    });
    const lastStart = Math.max(
      ...stamps.filter((s) => s.phase === 'start').map((s) => s.t),
    );
    const firstEnd = Math.min(
      ...stamps.filter((s) => s.phase === 'end').map((s) => s.t),
    );
    expect(lastStart).toBeLessThanOrEqual(firstEnd);
    // And the transcript still lands in call order, not completion order.
    const second = model.mock.calls[1][0] as any;
    expect(
      second.messages
        .filter((m: any) => m.role === 'tool')
        .map((m: any) => m.toolCallId),
    ).toEqual(['1', '2', '3']);
  });

  it('streams each tool event as its call completes', async () => {
    const stamps: Array<{ name: string; phase: 'start' | 'end'; t: number }> =
      [];
    staggeredTools(stamps);
    const toolEventAt: Record<string, number> = {};
    const { emit } = harness();
    const timedEmit = (e: ResearchAgentEvent) => {
      if (e.type === 'tool') toolEventAt[e.call.name] = Date.now();
      emit(e);
    };
    await runResearchTurn({
      session: makeSession(),
      userText: 'sweep',
      emit: timedEmit,
    });
    const slowEnd = stamps.find((s) => s.name === 'slow' && s.phase === 'end');
    expect(slowEnd).toBeDefined();
    expect(toolEventAt.fast1).toBeLessThan(slowEnd!.t);
    expect(toolEventAt.fast2).toBeLessThan(slowEnd!.t);
  });
});

describe('failure honesty', () => {
  it('surfaces model errors and never persists an assistant turn', async () => {
    model.mockResolvedValue({ ok: false, error: 'anthropic 529' } as any);
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'hi',
      emit,
    });
    expect(
      events.some((e) => e.type === 'error' && /529/.test(e.error)),
    ).toBe(true);
    expect(append.mock.calls.some(([i]) => i.role === 'assistant')).toBe(
      false,
    );
  });

  it('logs one telemetry row per settled call, and telemetry never breaks a turn', async () => {
    model
      .mockResolvedValueOnce(
        toolReply([
          { id: 'c1', name: 'social_search', input: { query: 'momlife' } },
          { id: 'c2', name: 'internal_metrics', input: {} },
        ]),
      )
      .mockResolvedValueOnce(textReply('done'));
    runTool
      .mockResolvedValueOnce(
        okOutcome({ content: 'ok', resultSummary: '4521 chars' }) as any,
      )
      .mockResolvedValueOnce(
        okOutcome({ content: 'ok', resultSummary: '3 links, 120 clicks' }) as any,
      );
    // A dead log table is swallowed per call.
    callLog.mockRejectedValue(new Error('relation does not exist'));
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'sweep',
      emit,
    });
    expect(callLog).toHaveBeenCalledTimes(2);
    expect(callLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess1',
        tool: 'social_search',
        status: 'ok',
        cached: false,
        estCostCents: 4,
      }),
    );
    expect(callLog).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'internal_metrics', estCostCents: 0 }),
    );
    expect(events.at(-1)?.type).toBe('done');
  });

  it('the budget gate blocks paid calls with a readable outcome while free tools run (2.4)', async () => {
    callUsage.mockResolvedValue({ paidRunsToday: 25, estCostCentsToday: 200 });
    model
      .mockResolvedValueOnce(
        toolReply([
          { id: 'c1', name: 'social_search', input: { query: 'momlife' } },
          { id: 'c2', name: 'internal_metrics', input: {} },
        ]),
      )
      .mockResolvedValueOnce(textReply('done'));
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'sweep',
      emit,
    });
    // The paid call never ran; the free one did.
    expect(runTool).toHaveBeenCalledTimes(1);
    expect(runTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'internal_metrics' }),
    );
    // The blocked outcome fed back to the model with the readable reason.
    const toolMsgs = (model.mock.calls[1][0] as any).messages.filter(
      (m: any) => m.role === 'tool',
    );
    const blocked = toolMsgs.find((m: any) => m.toolCallId === 'c1');
    expect(blocked.content).toContain('blocked by the research budget');
    expect(blocked.content).toContain('25');
    // And the trace records it as a budget block, not a failure.
    const record = assistantInput()?.toolCalls.find((t: any) => t.id === 'c1');
    expect(record?.resultSummary).toBe('blocked: budget');
    expect(events.at(-1)?.type).toBe('done');
  });

  it('carries live cards from the outcome into the event and the persisted trace (2.2)', async () => {
    const cards = [
      {
        kind: 'posts' as const,
        title: 'tiktok · 1 post',
        items: [
          {
            text: 'day in the life',
            meta: '12.4% engagement',
            url: 'https://tiktok.com/x',
            lines: [],
          },
        ],
      },
    ];
    model
      .mockResolvedValueOnce(
        toolReply([{ id: 'c1', name: 'top_posts', input: {} }]),
      )
      .mockResolvedValueOnce(textReply('done'));
    runTool.mockResolvedValue(okOutcome({ cards }) as any);
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'rank them',
      emit,
    });
    const toolEvent = events.find((e) => e.type === 'tool') as any;
    expect(toolEvent.call.cards).toEqual(cards);
    expect(assistantInput()?.toolCalls[0].cards).toEqual(cards);
  });

  it('turns a thrown tool into an error record and keeps looping', async () => {
    model
      .mockResolvedValueOnce(
        toolReply([{ id: 'c1', name: 'social_search', input: {} }]),
      )
      .mockResolvedValueOnce(textReply('recovered'));
    runTool.mockRejectedValue(new Error('gateway boom'));
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'go',
      emit,
    });
    const record = assistantInput()?.toolCalls[0];
    expect(record?.status).toBe('error');
    const toolMsg = (model.mock.calls[1][0] as any).messages.find(
      (m: any) => m.role === 'tool',
    );
    expect(toolMsg.content).toContain('social_search failed: gateway boom');
    expect(events.at(-1)?.type).toBe('done');
  });

  it('hits the 8-round cap and saves the step-limit message', async () => {
    model.mockResolvedValue(
      toolReply([{ id: 'x', name: 'web_search', input: {} }]),
    );
    const { events, emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'loop forever',
      emit,
    });
    expect(model).toHaveBeenCalledTimes(8);
    expect(assistantInput()?.content).toContain('step limit');
    expect(events.at(-1)?.type).toBe('done');
  });
});

describe('the steering contract', () => {
  it('carries query discipline and the auto evidence mode in the system prompt', async () => {
    model.mockResolvedValue(textReply('ok'));
    const { emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'hi',
      emit,
    });
    const sys = (model.mock.calls[0][0] as any).system as string;
    expect(sys).toContain('NEVER search the offer or product NAME');
    expect(sys).toContain('EVIDENCE MODE: AUTO');
    expect(sys).not.toContain('DEEP RESEARCH MODE IS ON');
  });

  it('drives the tool lane and the prompt addendum from intake.depth', async () => {
    model.mockResolvedValue(textReply('ok'));
    const { emit } = harness();
    await runResearchTurn({
      session: makeSession({
        intake: { ...blankIntake(), depth: 'deep' },
      }),
      userText: 'hi',
      emit,
    });
    // extra: the declarative-skill defs merged pre-policy (Phase 3); the
    // skills store degrades to [] here, so the field is present and empty.
    expect(defs).toHaveBeenCalledWith({ deep: true, policy: [], extra: [] });
    const sys = (model.mock.calls[0][0] as any).system as string;
    expect(sys).toContain('DEEP RESEARCH MODE IS ON');

    vi.clearAllMocks();
    list.mockResolvedValue([]);
    append.mockImplementation(async (input: any) => msg({ role: input.role }));
    touch.mockResolvedValue(undefined as any);
    model.mockResolvedValue(textReply('ok'));
    await runResearchTurn({
      session: makeSession(),
      userText: 'hi',
      emit,
    });
    expect(defs).toHaveBeenCalledWith({ deep: false, policy: [], extra: [] });
  });
});

describe('the expert contract (roadmap 1.2)', () => {
  it('flows the expert config through defs, prompt, model, and the executor', async () => {
    const wren = {
      ...DEFAULT_RESEARCH_EXPERT,
      slug: 'copy',
      name: 'Wren',
      persona: 'You are Wren, the copy expert.',
      model: 'wren-model',
      tools: ['web_search', 'create_artifact'],
      artifactTypes: ['notes'],
    };
    model.mockResolvedValue(textReply('ok'));
    const { emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'hi',
      expert: wren,
      model: 'caller-model',
      emit,
    });
    // Policy narrows the lane, persona replaces the ROLE, expert model wins.
    expect(defs).toHaveBeenCalledWith({
      deep: false,
      policy: ['web_search', 'create_artifact'],
      extra: [],
    });
    const first = model.mock.calls[0][0] as any;
    expect(first.system.startsWith('You are Wren, the copy expert.')).toBe(
      true,
    );
    expect(first.system).toContain('ARTIFACTS.');
    expect(first.model).toBe('wren-model');

    // And the executor receives the expert on every tool round (1.4: the
    // create_artifact executor stamps provenance from it).
    vi.clearAllMocks();
    list.mockResolvedValue([]);
    append.mockImplementation(async (input: any) => msg({ role: input.role }));
    touch.mockResolvedValue(undefined as any);
    callLog.mockResolvedValue(undefined as any);
    model
      .mockResolvedValueOnce(
        toolReply([{ id: 'c1', name: 'web_search', input: { query: 'q' } }]),
      )
      .mockResolvedValueOnce(textReply('done'));
    await runResearchTurn({
      session: makeSession(),
      userText: 'go',
      expert: wren,
      emit,
    });
    expect(runTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'web_search', expert: wren }),
    );
  });

  it('no expert = the research agent exactly as before (the no-op default)', async () => {
    model.mockResolvedValue(textReply('ok'));
    const { emit } = harness();
    await runResearchTurn({
      session: makeSession(),
      userText: 'hi',
      emit,
    });
    expect(defs).toHaveBeenCalledWith({ deep: false, policy: [], extra: [] });
    const sys = (model.mock.calls[0][0] as any).system as string;
    expect(sys).toContain('You are the MotherMode Research Lab agent');
    // The executor still receives an expert object (the default config).
    expect(runTool).not.toHaveBeenCalled(); // sanity: single text round
  });
});
