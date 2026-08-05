/**
 * The skills bridge (agent/skillBridge.ts + the loop's merge + the cost
 * marker): active skills as callable tools. Pins the name round-trip
 * (provider-safe), the def shape, the merge (extras join BEFORE the
 * policy filter — a policy narrows skills like built-ins), the cost
 * marker rule in estimateCallCost, and runSkillTool's outcome accounting
 * (the breaker hears about REAL attempts only) — all off the DB via the
 * injected seams.
 */
import { describe, expect, it } from 'vitest';
import {
  isSkillToolName,
  listSkillToolDefs,
  runSkillTool,
  skillSlugFromTool,
  skillToToolDef,
  skillToolName,
} from '@/lib/mothermode/research/agent/skillBridge';
import { buildResearchToolDefs } from '@/lib/mothermode/research/agent/toolDefs';
import { estimateCallCost } from '@/lib/mothermode/research/agent/cost';
import type { ResearchSkill } from '@/lib/mothermode/research/skills/types';

const SKILL: ResearchSkill = {
  id: 'sk1',
  slug: 'amazon-lookup',
  name: 'Amazon Lookup',
  description: 'product search',
  inputKeys: ['query'],
  allowedHosts: ['api.example.com'],
  executor: {
    kind: 'http',
    method: 'GET',
    urlTemplate: 'https://api.example.com/search?q={{input.query}}',
    headers: {},
    extract: [{ name: 'title', path: 'data.items.0.title' }],
  },
  costEstCents: 3,
  maxCallsPerDay: 5,
  status: 'active',
  consecutiveFailures: 0,
  lastCalledAt: null,
  createdAt: null,
  updatedAt: null,
};

const okFetch = (body: unknown) =>
  (async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;

describe('names + defs', () => {
  it('the tool name is provider-safe and round-trips the slug exactly', () => {
    expect(skillToolName('amazon-lookup')).toBe('skill_amazon-lookup');
    expect(isSkillToolName('skill_amazon-lookup')).toBe(true);
    expect(isSkillToolName('web_search')).toBe(false);
    expect(skillSlugFromTool('skill_amazon-lookup')).toBe('amazon-lookup');
  });

  it('a skill becomes a def whose schema IS the declared input keys', async () => {
    const def = skillToToolDef(SKILL);
    expect(def.name).toBe('skill_amazon-lookup');
    expect(def.description).toContain('~$0.03 per call');
    expect(def.description).toContain('capped at 5/day');
    expect(def.inputSchema).toEqual({
      type: 'object',
      properties: { query: { type: 'string' } },
    });

    const defs = await listSkillToolDefs({ listActive: async () => [SKILL] });
    expect(defs).toHaveLength(1);
    // A dead table narrows to NO skills, never a broken turn.
    const dead = await listSkillToolDefs({
      listActive: async () => {
        throw new Error('db down');
      },
    });
    expect(dead).toEqual([]);
  });
});

describe('the merge: extras join the lane BEFORE the policy filter', () => {
  const extra = [skillToToolDef(SKILL)];

  it('no policy = skills in the lane; a policy narrows them like tools', () => {
    const open = buildResearchToolDefs({ extra });
    expect(open.some((d) => d.name === 'skill_amazon-lookup')).toBe(true);

    const narrow = buildResearchToolDefs({ extra, policy: ['web_search'] });
    expect(narrow.some((d) => d.name === 'skill_amazon-lookup')).toBe(false);

    const granted = buildResearchToolDefs({
      extra,
      policy: ['web_search', 'skill_amazon-lookup'],
    });
    expect(granted.some((d) => d.name === 'skill_amazon-lookup')).toBe(true);
    expect(granted.some((d) => d.name === 'social_search')).toBe(false);
  });
});

describe('the cost marker', () => {
  it('estimateCallCost reads ~est Nc from a skill result line', () => {
    expect(
      estimateCallCost({
        name: 'skill_amazon-lookup',
        resultSummary: 'Amazon Lookup ok in 210ms ~est 3c',
      }),
    ).toEqual({ paid: true, cached: false, estCostCents: 3 });
  });

  it('a failed skill call is never paid; a missing marker claims nothing', () => {
    expect(
      estimateCallCost({ name: 'skill_x', resultSummary: 'failed: HTTP 503' })
        .estCostCents,
    ).toBe(0);
    expect(
      estimateCallCost({ name: 'skill_x', resultSummary: 'ok but no marker' })
        .estCostCents,
    ).toBe(0);
    // …and built-ins are untouched by the rule.
    expect(
      estimateCallCost({ name: 'social_search', resultSummary: 'cached, 100 chars' })
        .estCostCents,
    ).toBe(0);
  });
});

describe('runSkillTool', () => {
  it('an unknown/inactive skill refuses without touching the wire', async () => {
    let fetched = false;
    const out = await runSkillTool(
      { name: 'skill_ghost', input: {} },
      {
        listActive: async () => [SKILL],
        fetchImpl: (async () => {
          fetched = true;
          throw new Error('never');
        }) as unknown as typeof fetch,
      },
    );
    expect(out.resultSummary).toBe('failed: no active skill ghost');
    expect(fetched).toBe(false);
    expect(out.content).toContain("use a built-in tool instead");
  });

  it('a good call extracts, carries the marker, and records the attempt', async () => {
    const recorded: Array<{ id: string; ok: boolean }> = [];
    const out = await runSkillTool(
      { name: 'skill_amazon-lookup', input: { query: 'desk' } },
      {
        listActive: async () => [SKILL],
        callsToday: async () => 0,
        recordOutcome: async (id, ok) => {
          recorded.push({ id, ok });
        },
        fetchImpl: okFetch({ data: { items: [{ title: 'FlexiSpot' }] } }),
      },
    );
    expect(out.resultSummary).toContain('~est 3c');
    expect(out.content).toContain('FlexiSpot');
    expect(recorded).toEqual([{ id: 'sk1', ok: true }]);
  });

  it('the daily limit refuses AND never feeds the breaker (no attempt)', async () => {
    let recorded = 0;
    const out = await runSkillTool(
      { name: 'skill_amazon-lookup', input: { query: 'desk' } },
      {
        listActive: async () => [SKILL],
        callsToday: async () => 5, // at the row's cap
        recordOutcome: async () => {
          recorded += 1;
        },
        fetchImpl: okFetch({ data: { items: [] } }),
      },
    );
    expect(out.resultSummary).toContain('failed: daily limit');
    expect(recorded).toBe(0);
  });

  it('a real HTTP failure DOES feed the breaker, as a failure', async () => {
    const recorded: Array<{ id: string; ok: boolean }> = [];
    const out = await runSkillTool(
      { name: 'skill_amazon-lookup', input: { query: 'desk' } },
      {
        listActive: async () => [SKILL],
        callsToday: async () => 0,
        recordOutcome: async (id, ok) => {
          recorded.push({ id, ok });
        },
        fetchImpl: (async () => ({
          ok: false,
          status: 500,
          text: async () => 'server error',
        })) as unknown as typeof fetch,
      },
    );
    expect(out.resultSummary).toContain('failed: HTTP 500');
    expect(recorded).toEqual([{ id: 'sk1', ok: false }]);
  });
});
