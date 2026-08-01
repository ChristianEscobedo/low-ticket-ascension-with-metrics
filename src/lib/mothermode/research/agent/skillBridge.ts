/**
 * The skills bridge (Phase 3): active declarative skills as callable
 * tools in the agent loop.
 *
 * THE CONVENTIONS
 * ---------------
 * - The tool name is `skill_<slug>` — provider function names allow only
 *   [a-zA-Z0-9_-], and skill slugs are [a-z0-9-], so the prefix strip is
 *   an exact round-trip with zero ambiguity.
 * - The trace's resultSummary carries the row's cost as `~est Nc` — the
 *   same marker convention as 'cached' — and estimateCallCost reads it
 *   there (the log row, the meter, and the per-day limit all read the
 *   ONE ledger).
 * - The breaker records REAL attempts only: a pre-wire refusal (over the
 *   daily limit, missing input, allowlist) is not the endpoint failing,
 *   so it never feeds the failure streak.
 * - A dead skills table narrows the lane to no skills — it never breaks
 *   a turn.
 *
 * Server-only (the store + env secrets). Deps injectable for the tests.
 */
import type { AgentToolDef } from '@/utils/integrations/research-agent';
import type { ResearchSkill } from '../skills/types';
import { runHttpSkill } from '../skills/run';
import {
  listActiveSkills,
  readSkillCallsToday,
  recordSkillOutcome,
} from '../skills/store';

const PREFIX = 'skill_';

/** `skill_<slug>` — provider-safe (slugs are [a-z0-9-]). */
export function skillToolName(slug: string): string {
  return `${PREFIX}${slug}`;
}

export function isSkillToolName(name: string): boolean {
  return name.startsWith(PREFIX) && name.length > PREFIX.length;
}

/** The slug back out (prefix strip — slugs never carry an underscore). */
export function skillSlugFromTool(name: string): string {
  return name.slice(PREFIX.length);
}

/** One active skill as a tool def: declared input keys become the schema. */
export function skillToToolDef(skill: ResearchSkill): AgentToolDef {
  const properties: Record<string, unknown> = {};
  for (const key of skill.inputKeys) {
    properties[key] = { type: 'string' };
  }
  return {
    name: skillToolName(skill.slug),
    description: `${skill.name}: ${skill.description} (declarative HTTP skill — ~$${(skill.costEstCents / 100).toFixed(2)} per call, capped at ${skill.maxCallsPerDay}/day)`,
    inputSchema: { type: 'object', properties },
  };
}

/** The bridge's seams, injectable so tests never touch the DB or the wire. */
export interface SkillBridgeDeps {
  listActive?: () => Promise<ResearchSkill[]>;
  callsToday?: (slug: string) => Promise<number>;
  recordOutcome?: (skillId: string, ok: boolean) => Promise<void>;
  fetchImpl?: typeof fetch;
}

/** The active skills as tool defs — the loop merges these as `extra`. */
export async function listSkillToolDefs(
  deps?: SkillBridgeDeps,
): Promise<AgentToolDef[]> {
  const list = deps?.listActive ?? listActiveSkills;
  const skills = await list().catch(() => [] as ResearchSkill[]);
  return skills.map(skillToToolDef);
}

/**
 * Run one `skill_<slug>` call through the audited runner (agent purpose:
 * active-only, inside the day's limit). The outcome records to the
 * breaker ONLY when the request actually fired.
 */
export async function runSkillTool(
  opts: { name: string; input: Record<string, unknown> },
  deps?: SkillBridgeDeps,
): Promise<{ content: string; resultSummary: string }> {
  const slug = skillSlugFromTool(opts.name);
  const list = deps?.listActive ?? listActiveSkills;
  const skills = await list().catch(() => [] as ResearchSkill[]);
  const skill = skills.find((s) => s.slug === slug);
  if (!skill) {
    return {
      content: `${opts.name} is not an active skill (unknown, paused, or still a draft). Don't retry it — use a built-in tool instead.`,
      resultSummary: `failed: no active skill ${slug}`,
    };
  }
  const callsToday = await (deps?.callsToday ?? readSkillCallsToday)(
    skill.slug,
  ).catch(() => 0);
  const result = await runHttpSkill(skill, opts.input, {
    purpose: 'agent',
    callsToday,
    fetchImpl: deps?.fetchImpl,
  });
  if (result.attempted) {
    await (deps?.recordOutcome ?? recordSkillOutcome)(
      skill.id,
      result.ok,
    ).catch(() => {});
  }
  if (!result.ok) {
    return {
      content: `the ${skill.name} skill failed: ${result.error}`,
      // 'failed' prefix = never paid, never counted as a paid run.
      resultSummary: `failed: ${result.error}`,
    };
  }
  return {
    content: JSON.stringify(result.extracted ?? {}).slice(0, 8000),
    resultSummary: `${skill.name} ok in ${result.ms}ms ~est ${skill.costEstCents}c`,
  };
}
