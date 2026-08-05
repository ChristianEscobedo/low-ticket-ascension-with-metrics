import { describe, it, expect } from 'vitest';

import {
  buildRunRecap,
  redactSecrets,
} from '@/lib/mothermode/research/recipes/recap';

import type { RunDetail } from '@/lib/mothermode/research/recipes/runDetail';
import type {
  Recipe,
  RecipeRun,
} from '@/lib/mothermode/research/recipes/types';
import type {
  ResearchArtifact,
  ResearchMessage,
} from '@/lib/mothermode/research/types';
import type { RunMoneyMap } from '@/lib/mothermode/research/moneyMap';
import {
  generateShareToken,
  rowToRunShare,
  shareRunUrl,
} from '@/lib/mothermode/research/recipes/shares';
import {
  rowToRunEvent,
  RUN_EVENT_KINDS,
} from '@/lib/mothermode/research/recipes/store';

/**
 * The Share Run recap (Phase 3), pinned: the public payload carries the
 * story (play, steps, crew, cost, money map, build maps, transcript) and
 * NONE of the things that make an unauthenticated surface dangerous — no
 * internal ids, no /admin links, no scraped-card payloads, no credential
 * shapes. This file is the executable form of recap.ts's posture header.
 */

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

describe('redactSecrets', () => {
  it('masks OpenAI-style keys', () => {
    const out = redactSecrets('my key is [fake-key] ok');
    expect(out).not.toContain('[fake-key]');
    expect(out).toContain('[redacted]');
  });

  it('masks Stripe secret + publishable keys', () => {
    expect(redactSecrets('sk_live_4eC39HqLyjWDarjtT1zdp7dc')).toBe('[redacted]');
    expect(redactSecrets('pk_live_4eC39HqLyjWDarjtT1zdp7dc')).toBe('[redacted]');
  });

  it('masks Bearer/Basic header values whole', () => {
    expect(redactSecrets('Authorization: Bearer abcdef1234567890')).toBe(
      'Authorization: [redacted]',
    );
  });

  it('masks AWS access key ids', () => {
    expect(redactSecrets('aws: [fake-key] here')).toBe(
      'aws: [redacted] here',
    );
  });

  it('masks Slack webhook URLs (the URL is the secret)', () => {
    const out = redactSecrets(
      'send to https://hooks.slack.com/services/' +
        ['T00000000', 'B00000000', 'X'.repeat(24)].join('/') +
        ' please',
    );
    expect(out).not.toContain('hooks.slack.com/services/T');
    expect(out).toContain('[redacted]');
  });

  it('masks PEM private key blocks', () => {
    const pem =
      '-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----';
    const out = redactSecrets(`cert: ${pem} done`);
    expect(out).not.toContain('MIIEvwIBADANBgkqhkiG9w0BAQEFAASC');
    expect(out).toContain('[redacted]');
  });

  it('masks credential URL params but keeps the field name and the rest of the query', () => {
    const out = redactSecrets('https://api.x.com/v1?key=supersecret123&q=test');
    expect(out).not.toContain('supersecret123');
    expect(out).toContain('?key=[redacted]');
    expect(out).toContain('q=test');
  });

  it('masks key:value credential pairs, keeping the field readable', () => {
    const out = redactSecrets('api_key: "supersecretvalue123"');
    expect(out).not.toContain('supersecretvalue123');
    expect(out).toContain('api_key: [redacted]');
  });

  it('masks GitHub + Slack token shapes', () => {
    expect(redactSecrets('[fake-key]')).toBe('[redacted]');
    expect(redactSecrets('[fake-key]')).toBe('[redacted]');
  });

  it('leaves ordinary prose, percentages, and clean URLs untouched', () => {
    const clean =
      'The offer converts at 12% on https://example.com/page?utm_source=ig — a token of appreciation for r/momlife';
    expect(redactSecrets(clean)).toBe(clean);
  });

  it('never throws on empty input', () => {
    expect(redactSecrets('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The composer (the posture, end to end)
// ---------------------------------------------------------------------------

const EXPERTS = [
  { slug: 'atlas', name: 'Atlas', tagline: '' },
  { slug: 'wren', name: 'Wren', tagline: '' },
];

function recipe(): Recipe {
  return {
    id: 'RECIPE-SENTINEL',
    slug: 'test-play',
    name: 'Test Play',
    description: '',
    steps: [
      {
        expert: 'atlas',
        instruction: 'sweep',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'wren',
        instruction: 'build',
        inputFrom: 'previous',
        outputArtifact: 'offer-brief',
        gate: 'auto',
        handoff: { target: 'system', generate: true },
      },
    ],
    budgetEstCents: 150,
    status: 'active',
    createdAt: null,
    updatedAt: null,
  };
}

function run(): RecipeRun {
  return {
    id: 'RUN-SENTINEL',
    recipeId: 'RECIPE-SENTINEL',
    sessionId: 'SESSION-SENTINEL',
    status: 'done',
    currentStep: 1,
    stepsState: [
      { status: 'done', artifactId: 'ART1-SENTINEL', note: 'receipts 8/12', at: null },
      { status: 'done', artifactId: 'ART2-SENTINEL', note: '', at: null },
    ],
    estCostCents: 143,
    createdAt: '2026-07-30T12:00:00.000Z',
    updatedAt: null,
  };
}

function message(over: Partial<ResearchMessage>): ResearchMessage {
  return {
    id: 'MSG-SENTINEL',
    sessionId: 'SESSION-SENTINEL',
    role: 'assistant',
    content: 'content',
    toolCalls: [],
    model: '',
    expertSlug: '',
    recipeRunId: 'RUN-SENTINEL',
    recipeStepIndex: null,
    createdAt: null,
    ...over,
  };
}

function artifact(over: Partial<ResearchArtifact>): ResearchArtifact {
  return {
    id: 'ART-SENTINEL',
    sessionId: 'SESSION-SENTINEL',
    type: 'research-brief',
    title: 'T',
    markdown: 'md',
    structured: {},
    status: 'handed-off',
    handedOffTo: null,
    version: 1,
    parentId: '',
    createdBy: 'agent',
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

function moneyMapFixture(): RunMoneyMap {
  return {
    totals: {
      artifactsHandedOff: 1,
      cards: 12,
      kits: 1,
      funnels: 1,
      links: 3,
      clicks: 218,
      optins: 31,
      purchases: 4,
      revenueCents: 41200,
    },
    perArtifact: [
      {
        artifactId: 'ART2-SENTINEL',
        title: 'The Offload Map',
        type: 'offer-brief',
        stepIndex: 1,
        handedOffLabel: 'Full system (5 parts)',
        handedOffKind: 'system',
        handedOffHref: null,
        systemParts: [
          {
            kind: 'leadgen-kit',
            id: 'KIT-SENTINEL',
            label: 'Offload Kit (drafted)',
            href: '/admin/lead-gen?kit=KIT-SENTINEL',
          },
        ],
        cards: 12,
        linkCount: 3,
        clicks: 218,
        optins: 31,
        purchases: 4,
        revenueCents: 41200,
      },
    ],
    attributionKnown: true,
    caveat: 'the floor caveat',
  };
}

function detailFixture(): RunDetail {
  const brief = artifact({ id: 'ART1-SENTINEL', title: 'The brief' });
  const offer = artifact({
    id: 'ART2-SENTINEL',
    type: 'offer-brief',
    title: 'The Offload Map',
    structured: {
      systemManifest: [
        {
          kind: 'leadgen-kit',
          id: 'KIT-SENTINEL',
          label: 'Offload Kit (drafted)',
          href: '/admin/lead-gen?kit=KIT-SENTINEL',
        },
        { kind: 'planner-cards', id: '', label: '12 planner cards', href: '/admin/planner' },
      ],
    },
    handedOffTo: { kind: 'system', id: '', label: 'Full system (5 parts)', count: 5, at: '' },
  });
  return {
    run: run(),
    recipe: recipe(),
    sessionTitle: 'SESSION TITLE SENTINEL',
    events: [],
    transcript: [
      message({
        id: 'MSG1-SENTINEL',
        role: 'user',
        recipeStepIndex: 0,
        content: 'Sweep r/momlife for the $17 offer — [fake-key]',
      }),
      message({
        id: 'MSG2-SENTINEL',
        role: 'assistant',
        recipeStepIndex: 0,
        expertSlug: 'atlas',
        model: 'kimi-k3',
        content: 'Brief drafted. (scratch: Bearer abcdefgh12345678)',
        toolCalls: [
          {
            id: 'c1',
            name: 'search_reddit',
            inputSummary: 'x: "mom burnout" limit 10',
            status: 'ok',
            resultSummary: '47 posts · top theme: time scarcity · token: hunter2hunter2',
            ms: 120,
            cards: [
              {
                kind: 'post',
                title: 'SCRAPED CARD SENTINEL',
                url: 'https://reddit.com/x',
                handle: '@someone',
              } as never,
            ],
          },
        ],
      }),
    ],
    artifacts: [
      { artifact: brief, stepIndex: 0 },
      { artifact: offer, stepIndex: 1 },
    ],
    moneyMap: moneyMapFixture(),
    share: null,
  };
}

describe('buildRunRecap', () => {
  const recap = buildRunRecap({
    detail: detailFixture(),
    experts: EXPERTS,
    sharedAt: '2026-07-31T12:00:00.000Z',
  });
  const json = JSON.stringify(recap);

  it('carries the story: play, status, steps, crew, cost, timing', () => {
    expect(recap.version).toBe(1);
    expect(recap.recipeName).toBe('Test Play');
    expect(recap.status).toBe('done');
    expect(recap.stepsDone).toBe(2);
    expect(recap.stepCount).toBe(2);
    expect(recap.estCostCents).toBe(143);
    expect(recap.startedAt).toBe('2026-07-30T12:00:00.000Z');
    expect(recap.sharedAt).toBe('2026-07-31T12:00:00.000Z');
    expect(recap.crew).toEqual(['Atlas', 'Wren']);
    expect(recap.steps.map((s) => s.expertName)).toEqual(['Atlas', 'Wren']);
    expect(recap.steps[0].outputArtifact).toBe('research-brief');
    expect(recap.steps[0].note).toBe('receipts 8/12');
  });

  it('leaks NO internal ids anywhere in the payload', () => {
    for (const sentinel of [
      'RUN-SENTINEL',
      'SESSION-SENTINEL',
      'RECIPE-SENTINEL',
      'ART1-SENTINEL',
      'ART2-SENTINEL',
      'MSG1-SENTINEL',
      'MSG2-SENTINEL',
      'KIT-SENTINEL',
    ]) {
      expect(json).not.toContain(sentinel);
    }
  });

  it('leaks no /admin links and no session title', () => {
    expect(json).not.toContain('/admin');
    expect(json).not.toContain('SESSION TITLE SENTINEL');
  });

  it('redacts credential shapes in turn content and tool summaries', () => {
    expect(json).not.toContain('[fake-key]');
    expect(json).not.toContain('abcdefgh12345678');
    expect(json).not.toContain('hunter2hunter2');
    expect(json).toContain('[redacted]');
  });

  it('keeps the slim tool trace and drops the scraped-card payloads', () => {
    const tools = recap.transcript[1].tools;
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_reddit');
    expect(tools[0].inputSummary).toBe('x: "mom burnout" limit 10');
    expect('cards' in tools[0]).toBe(false);
    expect(json).not.toContain('SCRAPED CARD SENTINEL');
  });

  it('names speakers honestly (step instruction, expert display name)', () => {
    expect(recap.transcript[0].speaker).toBe('step 1 instruction');
    expect(recap.transcript[1].speaker).toBe('Atlas');
    expect(recap.transcript[1].model).toBe('kimi-k3');
    expect(recap.transcript[1].stepIndex).toBe(0);
  });

  it('carries the money map numbers, stripped of ids and hrefs', () => {
    expect(recap.moneyMap.totals.clicks).toBe(218);
    expect(recap.moneyMap.totals.revenueCents).toBe(41200);
    const row = recap.moneyMap.perArtifact[0];
    expect(row.artifactId).toBe('');
    expect(row.handedOffHref).toBeNull();
    expect(row.systemParts[0].id).toBe('');
    expect(row.systemParts[0].href).toBe('');
    expect(row.clicks).toBe(218);
  });

  it('builds funnel maps only for artifacts with handoff state, nodes stripped', () => {
    expect(recap.funnelMaps).toHaveLength(1);
    const map = recap.funnelMaps[0];
    expect(map.root.title).toBe('The Offload Map');
    for (const lane of map.lanes) {
      for (const node of lane.nodes) {
        expect(node.href).toBe('');
        expect(node.id).toBe('');
        expect(node.label).not.toContain('(drafted)');
      }
    }
  });

  it('recaps honestly when the recipe row is gone', () => {
    const detail = detailFixture();
    const gone = buildRunRecap({
      detail: { ...detail, recipe: null },
      experts: EXPERTS,
      sharedAt: null,
    });
    expect(gone.recipeName).toBe('A play');
    expect(gone.crew).toEqual([]);
    expect(gone.steps[0].expertName).toBe('');
    expect(gone.steps).toHaveLength(2);
    expect(gone.transcript).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// The share store's pure surface + the new event kinds
// ---------------------------------------------------------------------------

describe('share tokens', () => {
  it('mints shr_-prefixed base64url tokens, never the same twice', () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).toMatch(/^shr_[A-Za-z0-9_-]{32}$/);
    expect(b).toMatch(/^shr_[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
  });

  it('maps rows defensively and builds the public path', () => {
    expect(
      rowToRunShare({
        id: 's1',
        run_id: ' r1 ',
        token: ' shr_abc ',
        created_at: '2026-07-31T00:00:00.000Z',
      }),
    ).toEqual({
      id: 's1',
      runId: 'r1',
      token: 'shr_abc',
      createdAt: '2026-07-31T00:00:00.000Z',
    });
    expect(shareRunUrl('shr_abc')).toBe('/share/run/shr_abc');
  });
});

describe('share run events', () => {
  it('exposure beats are first-class event kinds', () => {
    expect(RUN_EVENT_KINDS).toContain('share-created');
    expect(RUN_EVENT_KINDS).toContain('share-revoked');
    const e = rowToRunEvent({
      id: 'e1',
      run_id: 'r1',
      kind: 'share-created',
      step_index: null,
      text: 'Public recap link created',
      created_at: null,
    });
    expect(e.kind).toBe('share-created');
  });
});
