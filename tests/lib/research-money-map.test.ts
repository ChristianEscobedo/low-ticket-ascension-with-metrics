/**
 * Money Map v1 (research/moneyMap.ts): the per-run join from artifacts to
 * handed-off assets to clicks/leads/revenue. Pure tests — the join keys are
 * the handoff layer's naming conventions, so these pin THAT contract too:
 * if the piece-id scheme ever changes, these fail before the money does.
 */
import { describe, expect, it } from 'vitest';
import {
  artifactSuffix,
  buildRunMoneyMap,
  handoffHref,
  linkBelongsToArtifact,
  moneyMapSummary,
  pieceKeyBelongsToArtifact,
  piecePrefixesForArtifact,
  type MoneyMapArtifactInput,
  type MoneyMapAttributionSlice,
  type MoneyMapLinkLike,
} from '@/lib/mothermode/research/moneyMap';

// Artifact ids are uuids; the handoff suffix is the first 8 non-dash chars.
const ART_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'; // suffix aaaaaaaa
const ART_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'; // suffix bbbbbbbb

function link(partial: Partial<MoneyMapLinkLike> & { id: string }): MoneyMapLinkLike {
  return {
    utmContent: '',
    pieceId: '',
    funnelId: null,
    optinFunnelId: null,
    clickCount: 0,
    ...partial,
  };
}

function slice(optins: number, purchases = 0, revenueCents = 0): MoneyMapAttributionSlice {
  return { optins, purchases, revenueCents };
}

const PLANNER_ARTIFACT: MoneyMapArtifactInput = {
  id: ART_A,
  title: 'March angles',
  type: 'content-plan',
  stepIndex: 1,
  handedOffTo: { kind: 'planner-cards', id: '', label: '3 planner cards', count: 3 },
};

const SYSTEM_ARTIFACT: MoneyMapArtifactInput = {
  id: ART_B,
  title: 'Offload Map offer brief',
  type: 'offer-brief',
  stepIndex: 2,
  handedOffTo: { kind: 'system', id: '', label: 'Full system: 5 parts', count: 5 },
  systemManifest: [
    { kind: 'leadgen-kit', id: 'kit1', label: 'Offload Map Starter Guide (drafted)', href: '/admin/lead-gen?kit=kit1' },
    { kind: 'optin-funnel', id: 'of1', label: 'Offload Map opt-in', href: '/admin/funnels' },
    { kind: 'email-kit', id: 'kit2', label: 'Offload Map nurture (drafted)', href: '/admin/email-marketing?kit=kit2' },
    { kind: 'sales-funnel', id: 'sf1', label: 'Offload Map', href: '/admin/sales-funnels' },
    { kind: 'planner-cards', id: '', label: '4 planner cards', href: '/admin/planner' },
  ],
};

describe('artifactSuffix / piecePrefixesForArtifact', () => {
  it('matches the handoff layer’s naming (handoff.ts suffixOf)', () => {
    expect(artifactSuffix(ART_A)).toBe('aaaaaaaa');
    expect(piecePrefixesForArtifact(ART_A)).toEqual([
      'research_aaaaaaaa_',
      'research_system_aaaaaaaa_',
    ]);
  });
});

describe('pieceKeyBelongsToArtifact', () => {
  it('joins planner-cards and system pieces to their artifact', () => {
    expect(pieceKeyBelongsToArtifact(ART_A, 'research_aaaaaaaa_1')).toBe(true);
    expect(pieceKeyBelongsToArtifact(ART_A, 'research_aaaaaaaa_12')).toBe(true);
    expect(pieceKeyBelongsToArtifact(ART_B, 'research_system_bbbbbbbb_3')).toBe(true);
  });

  it('rejects other artifacts’ pieces and unrelated ids', () => {
    expect(pieceKeyBelongsToArtifact(ART_A, 'research_bbbbbbbb_1')).toBe(false);
    expect(pieceKeyBelongsToArtifact(ART_A, 'research_system_bbbbbbbb_1')).toBe(false);
    expect(pieceKeyBelongsToArtifact(ART_A, 'piece_123')).toBe(false);
    expect(pieceKeyBelongsToArtifact(ART_A, '')).toBe(false);
    // A piece merely CONTAINING the suffix is not enough — it must carry the
    // handoff scheme's prefix.
    expect(pieceKeyBelongsToArtifact(ART_A, 'manual_aaaaaaaa_1')).toBe(false);
  });
});

describe('linkBelongsToArtifact', () => {
  it('matches by piece key, by sales-funnel id, and by opt-in funnel id', () => {
    expect(
      linkBelongsToArtifact(PLANNER_ARTIFACT, link({ id: 'l1', utmContent: 'research_aaaaaaaa_2' })),
    ).toBe(true);
    expect(
      linkBelongsToArtifact(SYSTEM_ARTIFACT, link({ id: 'l2', funnelId: 'sf1' })),
    ).toBe(true);
    expect(
      linkBelongsToArtifact(SYSTEM_ARTIFACT, link({ id: 'l3', optinFunnelId: 'of1' })),
    ).toBe(true);
    expect(
      linkBelongsToArtifact(SYSTEM_ARTIFACT, link({ id: 'l4', funnelId: 'someone-else' })),
    ).toBe(false);
  });

  it('falls back to pieceId when utmContent is empty (the rollup convention)', () => {
    expect(
      linkBelongsToArtifact(PLANNER_ARTIFACT, link({ id: 'l5', pieceId: 'research_aaaaaaaa_1' })),
    ).toBe(true);
  });
});

describe('buildRunMoneyMap', () => {
  const links: MoneyMapLinkLike[] = [
    // Artifact A's cards: a boosted link and an organic twin (TWO links).
    link({ id: 'l1', utmContent: 'research_aaaaaaaa_1', clickCount: 100 }),
    link({ id: 'l2', utmContent: 'research_aaaaaaaa_1', clickCount: 50 }),
    link({ id: 'l3', utmContent: 'research_aaaaaaaa_3', clickCount: 18 }),
    // Artifact B's system card, ALSO pointing at the handed-off funnel —
    // one link, one count, however many rules match it.
    link({ id: 'l4', utmContent: 'research_system_bbbbbbbb_1', funnelId: 'sf1', clickCount: 40 }),
    // A link minted against B's sales funnel with no piece key at all.
    link({ id: 'l5', funnelId: 'sf1', clickCount: 10 }),
    // Not the run's: another run's artifact (ffffffff is nobody here) and an
    // untracked-era link.
    link({ id: 'l6', utmContent: 'research_ffffffff_1', clickCount: 999 }),
    link({ id: 'l7', utmContent: 'summer-promo', clickCount: 77 }),
  ];

  const attribution = new Map<string, MoneyMapAttributionSlice>([
    ['research_aaaaaaaa_1', slice(5, 2, 41200)],
    // A lead whose link row is gone still counts — attribution joins on the
    // utm_content the lead CARRIES, not on the registry.
    ['research_aaaaaaaa_9', slice(2)],
    ['research_system_bbbbbbbb_1', slice(1)],
    ['research_ffffffff_1', slice(99, 9, 99900)],
  ]);

  const plans = [
    'research_aaaaaaaa_1',
    'research_aaaaaaaa_2',
    'research_aaaaaaaa_3',
    'research_system_bbbbbbbb_1',
    'unrelated_piece',
  ];

  const map = buildRunMoneyMap({
    artifacts: [
      // A brief that was never handed off contributes nothing and is not a row.
      { id: 'cccccccc-3333-4333-8333-cccccccccccc', title: 'sweep brief', type: 'research-brief', stepIndex: 0, handedOffTo: null },
      PLANNER_ARTIFACT,
      SYSTEM_ARTIFACT,
    ],
    links,
    attribution,
    planPieceIds: plans,
  });

  it('joins cards, clicks, leads and revenue to the run', () => {
    expect(map.totals.artifactsHandedOff).toBe(2);
    expect(map.totals.cards).toBe(4); // 3 planner + 1 system card on the board
    expect(map.totals.kits).toBe(2); // leadgen + email parts of the fan-out
    expect(map.totals.funnels).toBe(2); // sales + opt-in parts
    expect(map.totals.links).toBe(5); // l1..l5, deduped, others excluded
    expect(map.totals.clicks).toBe(218); // 100+50+18+40+10
    expect(map.totals.optins).toBe(8); // 5+2+1
    expect(map.totals.purchases).toBe(2);
    expect(map.totals.revenueCents).toBe(41200);
    expect(map.attributionKnown).toBe(true);
  });

  it('keeps per-artifact rows honest and deduped', () => {
    expect(map.perArtifact).toHaveLength(2);
    const [a, b] = map.perArtifact;
    expect(a.artifactId).toBe(ART_A);
    expect(a.cards).toBe(3);
    expect(a.linkCount).toBe(3);
    expect(a.clicks).toBe(168);
    expect(a.optins).toBe(7);
    expect(a.revenueCents).toBe(41200);
    expect(a.handedOffHref).toBe('/admin/planner');

    expect(b.artifactId).toBe(ART_B);
    expect(b.cards).toBe(1);
    // l4 matches twice (piece key AND funnel id) but is ONE link.
    expect(b.linkCount).toBe(2);
    expect(b.clicks).toBe(50);
    expect(b.optins).toBe(1);
    expect(b.handedOffHref).toBeNull(); // system: parts carry their own hrefs
    expect(b.systemParts).toHaveLength(5);
  });

  it('the headline reads like the roadmap example', () => {
    expect(moneyMapSummary(map)).toBe(
      '4 cards · 2 kits · 2 funnels → 218 clicks → 8 leads → $412.00 attributed',
    );
  });

  it('nulls the click family when the link read fails (never a confident 0)', () => {
    const broken = buildRunMoneyMap({
      artifacts: [PLANNER_ARTIFACT],
      links: null,
      attribution,
      planPieceIds: plans,
    });
    expect(broken.totals.links).toBeNull();
    expect(broken.totals.clicks).toBeNull();
    expect(broken.perArtifact[0].clicks).toBeNull();
    // …while the money family still reads fine.
    expect(broken.totals.optins).toBe(7);
    expect(broken.attributionKnown).toBe(true);
  });

  it('nulls the money family when the attribution join fails', () => {
    const broken = buildRunMoneyMap({
      artifacts: [PLANNER_ARTIFACT],
      links,
      attribution: null,
      planPieceIds: plans,
    });
    expect(broken.attributionKnown).toBe(false);
    expect(broken.totals.optins).toBeNull();
    expect(broken.totals.purchases).toBeNull();
    expect(broken.totals.revenueCents).toBeNull();
    expect(broken.totals.clicks).toBe(168);
  });

  it('falls back to the handoff’s created-count when the board read fails', () => {
    const broken = buildRunMoneyMap({
      artifacts: [PLANNER_ARTIFACT],
      links,
      attribution,
      planPieceIds: null,
    });
    expect(broken.perArtifact[0].cards).toBe(3); // handedOffTo.count
    expect(broken.totals.cards).toBe(3);
  });

  it('…but a system artifact has no created-count, so its cards go unknown', () => {
    const broken = buildRunMoneyMap({
      artifacts: [PLANNER_ARTIFACT, SYSTEM_ARTIFACT],
      links,
      attribution,
      planPieceIds: null,
    });
    expect(broken.perArtifact[1].cards).toBeNull();
    // One producer unknown nulls the TOTAL rather than understating it.
    expect(broken.totals.cards).toBeNull();
  });

  it('says nothing when a run has produced nothing', () => {
    const empty = buildRunMoneyMap({
      artifacts: [],
      links: [],
      attribution: new Map(),
      planPieceIds: [],
    });
    expect(moneyMapSummary(empty)).toBeNull();
    expect(empty.perArtifact).toHaveLength(0);
  });

  it('prints the chain without assets when a producer’s cards are gone', () => {
    // Cards deleted from the board after the run: links + money remain.
    const gone = buildRunMoneyMap({
      artifacts: [PLANNER_ARTIFACT],
      links,
      attribution,
      planPieceIds: [],
    });
    expect(gone.totals.cards).toBe(0);
    expect(moneyMapSummary(gone)).toBe('168 clicks → 7 leads → $412.00 attributed');
  });
});

describe('handoffHref', () => {
  it('deep-links single-row handoffs, lists multi-row ones', () => {
    expect(handoffHref({ kind: 'leadgen-kit', id: 'k1', label: '' })).toBe(
      '/admin/lead-gen?kit=k1',
    );
    expect(handoffHref({ kind: 'email-kit', id: 'e1', label: '' })).toBe(
      '/admin/email-marketing?kit=e1',
    );
    expect(handoffHref({ kind: 'sales-funnel', id: 'f1', label: '' })).toBe(
      '/admin/sales-funnels',
    );
    expect(handoffHref({ kind: 'planner-cards', id: '', label: '' })).toBe(
      '/admin/planner',
    );
    expect(handoffHref({ kind: 'system', id: '', label: '' })).toBeNull();
    expect(handoffHref(null)).toBeNull();
  });
});
