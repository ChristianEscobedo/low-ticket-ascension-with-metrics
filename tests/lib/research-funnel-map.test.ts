import { describe, it, expect } from 'vitest';

import { buildFunnelMap } from '@/lib/mothermode/research/funnelMap';
import type {
  HandedOffRef,
  ResearchArtifact,
} from '@/lib/mothermode/research/types';

/**
 * The Funnel Map builder, pinned: the system manifest becomes lanes of
 * status-stamped, editor-linked nodes; a single handoff becomes a mini
 * map; junk and empty payloads degrade to null, never a crash.
 */

function artifact(over: Partial<ResearchArtifact>): ResearchArtifact {
  return {
    id: 'a1',
    sessionId: 's1',
    type: 'offer-brief',
    title: 'The Offload Map',
    markdown: 'md',
    structured: { priceCents: 2700 },
    status: 'handed-off',
    handedOffTo: null,
    version: 1,
    parentId: '',
    createdBy: 'strategist',
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

describe('buildFunnelMap — the system manifest', () => {
  const manifest = [
    { kind: 'leadgen-kit', id: 'k1', label: 'The Offload Map Starter Guide (drafted)', href: '/admin/lead-gen?kit=k1' },
    { kind: 'optin-funnel', id: 'o1', label: 'The Offload Map opt-in', href: '/admin/funnels' },
    { kind: 'email-kit', id: 'e1', label: 'The Offload Map nurture (draft, generation failed)', href: '/admin/email-marketing?kit=e1' },
    { kind: 'sales-funnel', id: 'f1', label: 'The Offload Map', href: '/admin/sales-funnels' },
    { kind: 'planner-cards', id: '', label: '5 planner cards', href: '/admin/planner' },
  ];

  it('groups parts into lanes, strips state suffixes, stamps statuses + links', () => {
    const map = buildFunnelMap({
      artifact: artifact({ structured: { priceCents: 2700, systemManifest: manifest } }),
    })!;
    expect(map).not.toBeNull();
    // Lane order: Lead path -> Nurture -> Sales path -> Traffic.
    expect(map.lanes.map((l) => l.title)).toEqual([
      'Lead path',
      'Nurture',
      'Sales path',
      'Traffic',
    ]);
    const lead = map.lanes[0];
    expect(lead.nodes).toHaveLength(2);
    expect(lead.nodes[0]).toEqual({
      id: 'k1',
      kind: 'leadgen-kit',
      label: 'The Offload Map Starter Guide',
      status: 'built',
      href: '/admin/lead-gen?kit=k1',
    });
    expect(lead.nodes[1].status).toBe('draft');
    // The failed kit is honest, and its label suffix is stripped too.
    const nurture = map.lanes[1];
    expect(nurture.nodes[0].status).toBe('failed');
    expect(nurture.nodes[0].label).toBe('The Offload Map nurture');
    // Planner cards are real the moment they're written.
    expect(map.lanes[3].nodes[0].status).toBe('built');
    // The root carries the artifact + its price.
    expect(map.root.title).toBe('The Offload Map');
    expect(map.root.priceLabel).toBe('$27');
  });

  it('resolves the parent brief title for the root lane', () => {
    const parent = artifact({ id: 'p1', title: 'Niche research', type: 'research-brief' });
    const map = buildFunnelMap({
      artifact: artifact({
        parentId: 'p1',
        structured: { systemManifest: manifest },
      }),
      artifacts: [parent],
    })!;
    expect(map.root.parentTitle).toBe('Niche research');
  });

  it('junk manifests defend: no label, no node; no manifest, no map', () => {
    const map = buildFunnelMap({
      artifact: artifact({
        structured: { systemManifest: ['junk', { noLabel: true }, null] },
      }),
    });
    // Nothing drawable survived — and no handoff either, so null.
    expect(map).toBeNull();
  });
});

describe('buildFunnelMap — the single handoff mini map', () => {
  it('an email-kit handoff draws one built node with the kit link', () => {
    const handedOffTo: HandedOffRef = {
      kind: 'email-kit',
      id: 'e9',
      label: 'The nurture kit (drafted)',
      at: 't',
    };
    const map = buildFunnelMap({
      artifact: artifact({ handedOffTo }),
    })!;
    expect(map.lanes).toHaveLength(1);
    expect(map.lanes[0].title).toBe('Nurture');
    expect(map.lanes[0].nodes[0]).toEqual({
      id: 'e9',
      kind: 'email-kit',
      label: 'The nurture kit',
      status: 'built',
      href: '/admin/email-marketing?kit=e9',
    });
  });

  it('a plain funnel draft reads as draft; planner cards read as built', () => {
    const funnel = buildFunnelMap({
      artifact: artifact({
        handedOffTo: { kind: 'sales-funnel', id: 'f2', label: 'F', at: 't' },
      }),
    })!;
    expect(funnel.lanes[0].nodes[0].status).toBe('draft');
    expect(funnel.lanes[0].nodes[0].href).toBe('/admin/sales-funnels');
    const cards = buildFunnelMap({
      artifact: artifact({
        handedOffTo: { kind: 'planner-cards', id: '', label: '7 planner cards', at: 't' },
      }),
    })!;
    expect(cards.lanes[0].nodes[0].status).toBe('built');
  });

  it('no handoff state at all -> null', () => {
    expect(buildFunnelMap({ artifact: artifact({}) })).toBeNull();
  });
});
