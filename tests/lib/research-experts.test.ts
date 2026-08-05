import { describe, it, expect } from 'vitest';

import {
  rowToExpert,
  expertAllowsArtifact,
  DEFAULT_RESEARCH_EXPERT,
  type ResearchExpert,
} from '@/lib/mothermode/research/experts/types';
import { EXPERT_SEEDS, seedToExpert } from '@/lib/mothermode/research/experts/seed';
import {
  buildResearchToolDefs,
  filterToolDefs,
  DEEP_TOOL_NAMES,
} from '@/lib/mothermode/research/agent/toolDefs';
import { buildResearchSystemPrompt } from '@/lib/mothermode/research/agent/prompt';
import { blankIntake } from '@/lib/mothermode/research/intake';
import { RESEARCH_ARTIFACT_TYPES } from '@/lib/mothermode/research/types';
import type { ResearchSession } from '@/lib/mothermode/research/types';

/**
 * The expert chassis (roadmap 1.1-1.3), pinned: the default config is a
 * provable no-op, policies narrow but never widen the lane, the artifact
 * contract reads as a model-correctable refusal, and personas replace the
 * ROLE without touching the house contracts.
 */

const CORE_COUNT = 8;

describe('rowToExpert', () => {
  it('normalizes a full row and defends junk', () => {
    const e = rowToExpert({
      id: 'x1',
      slug: 'copy',
      name: 'Copy',
      tagline: 'hooks and captions',
      glyph: 'pen',
      persona: 'You are Wren.',
      model: 'claude-opus-4-8',
      tools: ['web_search', 'web_search', 'create_artifact', 42],
      context_refs: [{ kind: 'offer', id: 'o1', label: 'Offer' }],
      artifact_types: ['notes'],
      accepts: ['research-brief'],
      emits: ['notes'],
      status: 'active',
      sort_order: 2,
      created_at: null,
      updated_at: null,
    } as any);
    expect(e.tools).toEqual(['web_search', 'create_artifact']);
    expect(e.contextRefs).toHaveLength(1);
    expect(e.artifactTypes).toEqual(['notes']);
    expect(e.sortOrder).toBe(2);
  });

  it('degrades missing fields to the safe defaults', () => {
    const e = rowToExpert({ id: 'x2', slug: null } as any);
    expect(e.persona).toBe('');
    expect(e.tools).toEqual([]);
    expect(e.artifactTypes).toEqual([]);
    expect(e.status).toBe('active');
  });
});

describe('DEFAULT_RESEARCH_EXPERT', () => {
  it('is the no-op config (empty everything = the hardcoded agent)', () => {
    expect(DEFAULT_RESEARCH_EXPERT.persona).toBe('');
    expect(DEFAULT_RESEARCH_EXPERT.tools).toEqual([]);
    expect(DEFAULT_RESEARCH_EXPERT.artifactTypes).toEqual([]);
    expect(DEFAULT_RESEARCH_EXPERT.model).toBe('');
  });
});

describe('filterToolDefs', () => {
  const defs = buildResearchToolDefs({ deep: true });

  it('empty policy is the identity (the no-op default)', () => {
    expect(filterToolDefs(defs, [])).toEqual(defs);
    expect(filterToolDefs(defs, undefined)).toEqual(defs);
    expect(filterToolDefs(defs, ['', '  '])).toEqual(defs);
  });

  it('intersects, drops unknown names, and preserves lane order', () => {
    const out = filterToolDefs(defs, [
      'create_artifact',
      'web_search',
      'not_a_tool',
    ]);
    expect(out.map((d) => d.name)).toEqual(['web_search', 'create_artifact']);
  });

  it('policy narrows but never WIDENS the lane', () => {
    // A policy asking for deep tools on a standard session gets nothing.
    const standard = buildResearchToolDefs({
      deep: false,
      policy: [...DEEP_TOOL_NAMES],
    });
    expect(standard).toHaveLength(0);
    // The same policy on a deep session gets exactly the deep three.
    const deep = buildResearchToolDefs({
      deep: true,
      policy: [...DEEP_TOOL_NAMES],
    });
    expect(deep.map((d) => d.name)).toEqual([...DEEP_TOOL_NAMES]);
  });

  it('buildResearchToolDefs without policy is unchanged (8 core / 11 deep)', () => {
    expect(buildResearchToolDefs()).toHaveLength(CORE_COUNT);
    expect(buildResearchToolDefs({ deep: true })).toHaveLength(
      CORE_COUNT + DEEP_TOOL_NAMES.length,
    );
  });
});

describe('expertAllowsArtifact', () => {
  const expert = (artifactTypes: string[]): ResearchExpert => ({
    ...DEFAULT_RESEARCH_EXPERT,
    name: 'Wren',
    artifactTypes,
  });

  it('an empty contract allows every type (the research default)', () => {
    expect(expertAllowsArtifact(expert([]), 'offer-brief').allowed).toBe(true);
  });

  it('a set contract rejects with a readable, model-correctable reason', () => {
    const check = expertAllowsArtifact(expert(['notes']), 'offer-brief');
    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toContain('Wren');
      expect(check.reason).toContain('offer-brief');
      expect(check.reason).toContain('notes');
    }
  });
});

describe('persona roleOverride', () => {
  const session: ResearchSession = {
    id: 's1',
    title: 't',
    offerSlug: '',
    contextRefs: [],
    intake: blankIntake(),
    status: 'active',
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
  };

  it('replaces the ROLE but keeps the house contracts', () => {
    const sys = buildResearchSystemPrompt({
      session,
      packs: [],
      roleOverride: 'You are Wren, the copy expert.',
    });
    expect(sys.startsWith('You are Wren, the copy expert.')).toBe(true);
    expect(sys).not.toContain('You are the MotherMode Research Lab agent');
    // The contracts ride along: artifacts, query discipline, evidence mode.
    expect(sys).toContain('ARTIFACTS.');
    expect(sys).toContain('NEVER search the offer or product NAME');
    expect(sys).toContain('EVIDENCE MODE: AUTO');
  });

  it('blank override is byte-identical to no override', () => {
    const a = buildResearchSystemPrompt({ session, packs: [] });
    const b = buildResearchSystemPrompt({
      session,
      packs: [],
      roleOverride: '   ',
    });
    expect(b).toBe(a);
  });

  it('the house voice rules survive a persona swap (1.5 crew honesty)', () => {
    const sys = buildResearchSystemPrompt({
      session,
      packs: [],
      roleOverride: 'You are Wren, the copy expert.',
    });
    expect(sys).toContain('No em dashes or en dashes anywhere');
    expect(sys).toContain('HOUSE VOICE');
  });
});

describe('the seeded crew (1.5)', () => {
  const registryNames = new Set(
    buildResearchToolDefs({ deep: true }).map((d) => d.name),
  );

  it('is the full crew, unique slugs, in order (3.5)', () => {
    expect(EXPERT_SEEDS.map((s) => s.slug)).toEqual([
      'research',
      'strategist',
      'copy',
      'leadmagnet',
      'email',
      'design',
      'compliance',
      'analyst',
    ]);
    expect(new Set(EXPERT_SEEDS.map((s) => s.slug)).size).toBe(
      EXPERT_SEEDS.length,
    );
  });

  it('the research seed is the no-op default in row form', () => {
    const e = seedToExpert(EXPERT_SEEDS[0]);
    expect(e.persona).toBe('');
    expect(e.tools).toEqual([]);
    expect(e.artifactTypes).toEqual([]);
    expect(e.model).toBe('');
  });

  it('every seeded tool name exists in the registry', () => {
    for (const seed of EXPERT_SEEDS) {
      for (const tool of seed.tools) {
        expect(
          registryNames.has(tool),
          `${seed.slug} grants unknown tool "${tool}"`,
        ).toBe(true);
      }
    }
  });

  it('every seeded artifact type (contract + manners) is a real type', () => {
    for (const seed of EXPERT_SEEDS) {
      for (const t of [
        ...seed.artifactTypes,
        ...seed.accepts,
        ...seed.emits,
      ]) {
        expect(
          (RESEARCH_ARTIFACT_TYPES as readonly string[]).includes(t),
          `${seed.slug} names unknown artifact type "${t}"`,
        ).toBe(true);
      }
    }
  });

  it('non-research seeds carry real personas that name their actual lane', () => {
    for (const seed of EXPERT_SEEDS.slice(1)) {
      expect(seed.persona.length).toBeGreaterThan(200);
      for (const tool of seed.tools) {
        expect(seed.persona).toContain(tool);
      }
    }
    // The copy expert never touches the paid scrapers.
    const copy = EXPERT_SEEDS[2];
    expect(copy.tools).not.toContain('social_search');
    expect(copy.tools).not.toContain('voice_deep_dive');
  });
});
