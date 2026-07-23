import { describe, it, expect } from 'vitest';
import { normalizeEmail, blankSequence, type EmailSequence } from '@/lib/mothermode/email/types';
import {
  sequenceToFlowGraph,
  layoutFlowGraph,
  flowNodeLabel,
  FLOW_NODE_WIDTH,
  FLOW_NODE_HEIGHT,
  FLOW_TRIGGER_ID,
  type FlowGraph,
} from '@/lib/mothermode/email/flow';

/** Build a sequence from partial email inputs (ids preserved). */
function seq(
  emails: Array<Record<string, unknown>>,
  extra: Partial<EmailSequence> = {},
): EmailSequence {
  return { ...blankSequence(), ...extra, emails: emails.map(normalizeEmail) };
}

/** Only the email nodes (excludes the entry trigger + any A/B split nodes). */
function emailNodes(g: FlowGraph) {
  return g.nodes.filter((n) => n.kind === 'email');
}
/** Only trunk + branch edges (excludes the trigger edge + split edges). */
function bodyEdges(g: FlowGraph) {
  return g.edges.filter((e) => e.kind === 'trunk' || e.kind === 'branch');
}

describe('sequenceToFlowGraph', () => {
  it('(d) empty sequence → empty graph (no trigger node)', () => {
    expect(sequenceToFlowGraph(blankSequence())).toEqual({ nodes: [], edges: [] });
    expect(sequenceToFlowGraph(null)).toEqual({ nodes: [], edges: [] });
    expect(sequenceToFlowGraph(undefined)).toEqual({ nodes: [], edges: [] });
  });

  it('(a) linear sequence → N email nodes, N-1 trunk edges + a trigger entry', () => {
    const s = seq([
      { id: 'a', role: 'welcome', subject: 'Hi', branch: 'always' },
      { id: 'b', role: 'nurture', subject: 'More', branch: 'always' },
      { id: 'c', role: 'offer', subject: 'Buy', branch: 'always' },
    ]);
    const g = sequenceToFlowGraph(s);
    expect(emailNodes(g)).toHaveLength(3);
    const trunk = bodyEdges(g);
    expect(trunk).toHaveLength(2);
    expect(trunk.every((e) => e.kind === 'trunk')).toBe(true);
    expect(trunk.map((e) => `${e.source}->${e.target}`)).toEqual(['a->b', 'b->c']);
    // A single trigger node + edge to the first email.
    expect(g.nodes.filter((n) => n.kind === 'trigger')).toHaveLength(1);
    const trig = g.edges.filter((e) => e.kind === 'trigger');
    expect(trig).toHaveLength(1);
    expect(trig[0]).toMatchObject({ source: FLOW_TRIGGER_ID, target: 'a' });
  });

  it('trigger node reflects the sequence trigger (defaults to optin)', () => {
    const dflt = sequenceToFlowGraph(seq([{ id: 'a', branch: 'always' }]));
    expect(dflt.nodes.find((n) => n.kind === 'trigger')?.trigger).toBe('optin');
    const purchase = sequenceToFlowGraph(
      seq([{ id: 'a', branch: 'always' }], { trigger: 'purchase' }),
    );
    const trg = purchase.nodes.find((n) => n.kind === 'trigger');
    expect(trg?.trigger).toBe('purchase');
    expect(trg?.label).toContain('Purchase');
  });

  it('(b) a branch email → a labeled branch edge from its parentId', () => {
    const s = seq([
      { id: 'a', role: 'welcome', branch: 'always' },
      { id: 'b', role: 'nurture', branch: 'always' },
      { id: 'c', role: 'offer', branch: 'clicked', parentId: 'a' },
    ]);
    const g = sequenceToFlowGraph(s);
    const branchEdges = g.edges.filter((e) => e.kind === 'branch');
    expect(branchEdges).toHaveLength(1);
    expect(branchEdges[0]).toMatchObject({
      source: 'a',
      target: 'c',
      label: 'clicked',
      kind: 'branch',
    });
  });

  it('(c) parentId:null branch → edge from the prior trunk email', () => {
    const s = seq([
      { id: 'a', role: 'welcome', branch: 'always' },
      { id: 'b', role: 'nurture', branch: 'always' },
      { id: 'c', role: 'offer', branch: 'opened', parentId: null },
    ]);
    const g = sequenceToFlowGraph(s);
    const branchEdges = g.edges.filter((e) => e.kind === 'branch');
    expect(branchEdges).toHaveLength(1);
    expect(branchEdges[0]).toMatchObject({ source: 'b', target: 'c', label: 'opened' });
  });

  it('falls back to the last trunk when parentId points at a missing email', () => {
    const s = seq([
      { id: 'a', role: 'welcome', branch: 'always' },
      { id: 'c', role: 'offer', branch: 'not-opened', parentId: 'ghost' },
    ]);
    const g = sequenceToFlowGraph(s);
    const branchEdges = g.edges.filter((e) => e.kind === 'branch');
    expect(branchEdges[0]).toMatchObject({ source: 'a', target: 'c' });
  });

  it('a leading branch email still gets a trigger edge but no branch edge', () => {
    const s = seq([{ id: 'a', role: 'offer', branch: 'clicked', parentId: null }]);
    const g = sequenceToFlowGraph(s);
    expect(emailNodes(g)).toHaveLength(1);
    expect(bodyEdges(g)).toHaveLength(0);
    // The trigger always links to the first email regardless of its branch.
    expect(g.edges.filter((e) => e.kind === 'trigger')).toHaveLength(1);
  });

  it('flags nodes that carry images', () => {
    const s = seq([
      { id: 'a', role: 'welcome', branch: 'always', images: ['https://x/a.png'] },
      { id: 'b', role: 'nurture', branch: 'always', images: [] },
    ]);
    const g = sequenceToFlowGraph(s);
    expect(g.nodes.find((n) => n.id === 'a')?.hasImages).toBe(true);
    expect(g.nodes.find((n) => n.id === 'b')?.hasImages).toBe(false);
  });

  it('emits split nodes + edges for an active A/B test (>= 2 variants)', () => {
    const s = seq([
      {
        id: 'a',
        role: 'offer',
        branch: 'always',
        abTest: {
          enabled: true,
          metric: 'open',
          variants: [
            { id: 'v1', label: 'A', subject: 'Curiosity', weight: 60 },
            { id: 'v2', label: 'B', subject: 'Benefit', weight: 40 },
          ],
        },
      },
    ]);
    const g = sequenceToFlowGraph(s);
    const splits = g.nodes.filter((n) => n.kind === 'split');
    expect(splits).toHaveLength(2);
    expect(splits.map((n) => n.weight)).toEqual([60, 40]);
    const splitEdges = g.edges.filter((e) => e.kind === 'split');
    expect(splitEdges.map((e) => e.label)).toEqual(['60%', '40%']);
    // The parent email is flagged with the variant count.
    expect(g.nodes.find((n) => n.id === 'a')?.abVariantCount).toBe(2);
  });

  it('ignores a disabled or single-variant A/B test', () => {
    const disabled = sequenceToFlowGraph(
      seq([
        {
          id: 'a',
          branch: 'always',
          abTest: {
            enabled: false,
            metric: 'open',
            variants: [
              { id: 'v1', label: 'A', subject: 'x', weight: 50 },
              { id: 'v2', label: 'B', subject: 'y', weight: 50 },
            ],
          },
        },
      ]),
    );
    expect(disabled.nodes.filter((n) => n.kind === 'split')).toHaveLength(0);

    const single = sequenceToFlowGraph(
      seq([
        {
          id: 'a',
          branch: 'always',
          abTest: {
            enabled: true,
            metric: 'open',
            variants: [{ id: 'v1', label: 'A', subject: 'x', weight: 100 }],
          },
        },
      ]),
    );
    expect(single.nodes.filter((n) => n.kind === 'split')).toHaveLength(0);
  });
});

describe('flowNodeLabel', () => {
  it('combines role and subject, truncating long subjects', () => {
    expect(flowNodeLabel({ role: 'offer', subject: 'Grab it' })).toBe('offer · Grab it');
    expect(flowNodeLabel({ role: 'welcome', subject: '' })).toBe('welcome');
    const long = 'x'.repeat(80);
    expect(flowNodeLabel({ role: 'nurture', subject: long }).endsWith('…')).toBe(true);
  });
});

describe('layoutFlowGraph', () => {
  it('places the trunk on a vertical spine below the trigger (rank increases y)', () => {
    const s = seq([
      { id: 'a', role: 'welcome', branch: 'always' },
      { id: 'b', role: 'nurture', branch: 'always' },
    ]);
    const g = sequenceToFlowGraph(s);
    const trig = g.nodes.find((n) => n.kind === 'trigger')!;
    const a = g.nodes.find((n) => n.id === 'a')!;
    const b = g.nodes.find((n) => n.id === 'b')!;
    // Trigger is the root; a sits one rank below it, b one below a.
    expect(trig.y).toBe(0);
    expect(a.y).toBe(FLOW_NODE_HEIGHT + 64);
    expect(b.y).toBe((FLOW_NODE_HEIGHT + 64) * 2);
  });

  it('spreads siblings sharing a rank horizontally', () => {
    const s = seq([
      { id: 'a', role: 'welcome', branch: 'always' },
      { id: 'b', role: 'nurture', branch: 'always' },
      { id: 'c', role: 'offer', branch: 'clicked', parentId: 'a' },
    ]);
    const g = sequenceToFlowGraph(s);
    const b = g.nodes.find((n) => n.id === 'b')!;
    const c = g.nodes.find((n) => n.id === 'c')!;
    expect(b.y).toBe(c.y); // same rank
    expect(b.x).not.toBe(c.x); // spread apart
    expect(Math.abs(b.x - c.x)).toBe(FLOW_NODE_WIDTH + 56);
  });

  it('is a no-op for an empty graph', () => {
    const empty: FlowGraph = { nodes: [], edges: [] };
    expect(layoutFlowGraph(empty)).toEqual(empty);
  });
});
