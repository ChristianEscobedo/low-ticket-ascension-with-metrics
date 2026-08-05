/**
 * Money Map v1 (roadmap Phase 2, "proof it pays"): the per-run join
 *
 *   recipe run → step artifacts → handed-off assets → tracked links →
 *   clicks / leads / sales
 *
 * so a run can answer "12 cards, 2 kits → 218 clicks → 31 leads → $412
 * attributed" without the owner opening four screens.
 *
 * THE JOIN KEYS (all conventions established by the handoff layer)
 * ----------------------------------------------------------------
 * 1. Planner cards handed off from an artifact get DETERMINISTIC piece ids:
 *    `research_<suffix>_<n>` (planner-cards handoff) and
 *    `research_system_<suffix>_<n>` (the Full System fan-out), where
 *    <suffix> is the artifact id's first 8 non-dash characters
 *    (handoff.ts `suffixOf`). Tracked links carry that piece id as
 *    `utm_content`, and lead rows copy `utm_content` from the URL — so one
 *    prefix match joins cards, links, clicks, AND money to the artifact.
 * 2. Kits and funnels are single-row handoffs stamped on the artifact's
 *    `handed_off_to` ({kind, id}); links minted against those funnels carry
 *    `funnel_id` / `optin_funnel_id`, so their CLICKS join by id. The Full
 *    System fan-out persists its parts on `structured.systemManifest`.
 * 3. Leads and revenue join by `utm_content` ONLY. A lead captured inside a
 *    handed-off funnel still carries the utm_content of the piece that
 *    brought the visitor, so funnel-id matching applies to clicks and never
 *    to money — that is what keeps a sale attributed to the CARD that
 *    earned it, not the funnel that closed it.
 *
 * PURITY
 * ------
 * No server imports (the recipes run-row and the run detail page are both
 * client components). Inputs are minimal structural types; the server
 * composition in `recipes/runDetail.ts` maps the real store rows in.
 *
 * NULL DISCIPLINE (the system-wide rule: 0 is a fact, null is its absence)
 * -----------------------------------------------------------------------
 * Three reads feed this map, and each fails independently: the link
 * registry (clicks), the lead attribution join (leads/revenue), and the
 * planner board (card counts). A failed read yields nulls — rendered `n/a`
 * — never 0, because "the attribution join failed" and "this run earned
 * nothing" are opposite claims and only one of them is knowable.
 */
import { formatCents } from '@/lib/mothermode/planner/adMetrics';

/* ------------------------------------------------------------------ *
 * Inputs (structural — mapped from store rows by the server read)
 * ------------------------------------------------------------------ */

/** The handoff stamp carried on the artifact (subset of HandedOffRef). */
export interface MoneyMapHandoff {
  kind: string;
  /** Kit / funnel row id ('' for multi-row handoffs: planner-cards, system). */
  id: string;
  label: string;
  /** Rows created (planner-cards) or parts built (system). */
  count?: number;
}

/** One part of a Full System fan-out (structured.systemManifest). */
export interface MoneyMapSystemPart {
  kind: string;
  id: string;
  label: string;
  href: string;
}

/** A run's artifact, reduced to what the join needs. */
export interface MoneyMapArtifactInput {
  id: string;
  title: string;
  type: string;
  /** The run step that emitted it (null when the artifact predates steps). */
  stepIndex: number | null;
  handedOffTo: MoneyMapHandoff | null;
  /** Full System parts, when the handoff was the fan-out. */
  systemManifest?: MoneyMapSystemPart[] | null;
}

/** A tracked link, reduced to the join keys + the all-time counter. */
export interface MoneyMapLinkLike {
  id: string;
  utmContent: string;
  pieceId: string;
  funnelId: string | null;
  optinFunnelId: string | null;
  /** All-time human clicks (the counter — authoritative, never windowed). */
  clickCount: number;
}

/** One attributed-results bucket (subset of the planner's AttributionSlice). */
export interface MoneyMapAttributionSlice {
  optins: number;
  purchases: number;
  revenueCents: number;
}

/* ------------------------------------------------------------------ *
 * The join keys
 * ------------------------------------------------------------------ */

/**
 * The artifact's handoff suffix — MUST match `suffixOf` in
 * `research/handoff.ts` (the handoff layer owns the naming; this mirror
 * exists because moneyMap stays import-free for client bundles). If the
 * handoff ever changes its piece-id scheme, change both or the join dies.
 */
export function artifactSuffix(artifactId: string): string {
  return (artifactId || '').replace(/-/g, '').slice(0, 8) || 'x';
}

/**
 * The piece-id prefixes an artifact's planner cards can carry. Both are
 * emitted by the handoff layer: `research_<suffix>_` for planner-cards
 * handoffs, `research_system_<suffix>_` for the Full System fan-out.
 */
export function piecePrefixesForArtifact(artifactId: string): [string, string] {
  const suffix = artifactSuffix(artifactId);
  return [`research_${suffix}_`, `research_system_${suffix}_`];
}

/**
 * Does a utm_content / piece id belong to this artifact's cards?
 *
 * Prefix-overlap note: two different artifacts collide only if their ids
 * share the first 8 non-dash chars (uuid prefix), in which case their cards
 * were already overwriting each other at handoff time (upsert-on-conflict
 * on the same piece ids) — the money map inherits that collision, it does
 * not create it.
 */
export function pieceKeyBelongsToArtifact(
  artifactId: string,
  pieceKey: string,
): boolean {
  const key = (pieceKey || '').trim();
  if (!key) return false;
  const [cards, system] = piecePrefixesForArtifact(artifactId);
  return key.startsWith(cards) || key.startsWith(system);
}

/** The funnel-row ids an artifact's handoffs created (click join only). */
function funnelIdsOf(artifact: MoneyMapArtifactInput): {
  funnelIds: string[];
  optinFunnelIds: string[];
} {
  const funnelIds: string[] = [];
  const optinFunnelIds: string[] = [];
  const push = (kind: string, id: string) => {
    const clean = (id || '').trim();
    if (!clean) return;
    if (kind === 'sales-funnel' && !funnelIds.includes(clean)) {
      funnelIds.push(clean);
    }
    if (kind === 'optin-funnel' && !optinFunnelIds.includes(clean)) {
      optinFunnelIds.push(clean);
    }
  };
  if (artifact.handedOffTo) push(artifact.handedOffTo.kind, artifact.handedOffTo.id);
  for (const part of artifact.systemManifest ?? []) push(part.kind, part.id);
  return { funnelIds, optinFunnelIds };
}

/**
 * Does a tracked link belong to this artifact — by its piece key (cards) or
 * by pointing at a funnel the artifact's handoff created?
 */
export function linkBelongsToArtifact(
  artifact: MoneyMapArtifactInput,
  link: MoneyMapLinkLike,
): boolean {
  const pieceKey = (link.utmContent || link.pieceId || '').trim();
  if (pieceKey && pieceKeyBelongsToArtifact(artifact.id, pieceKey)) return true;
  const { funnelIds, optinFunnelIds } = funnelIdsOf(artifact);
  if (link.funnelId && funnelIds.includes(link.funnelId)) return true;
  if (link.optinFunnelId && optinFunnelIds.includes(link.optinFunnelId)) {
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Output
 * ------------------------------------------------------------------ */

/** One run artifact's row in the map. */
export interface MoneyMapArtifact {
  artifactId: string;
  title: string;
  type: string;
  stepIndex: number | null;
  /** What it became, e.g. '12 planner cards', 'The Offload Map nurture'. */
  handedOffLabel: string | null;
  handedOffKind: string | null;
  /** Editor link for single-row handoffs; null for multi-row ones. */
  handedOffHref: string | null;
  /** Full System parts, when the fan-out built several things. */
  systemParts: MoneyMapSystemPart[];
  /**
   * Planner cards on the board from this artifact, or null when unknown
   * (not a card producer, or the board read failed with no count to fall
   * back on). Current rows win over the handoff's created-count, because
   * the owner can delete cards — the map reports what EXISTS.
   */
  cards: number | null;
  /** Distinct tracked links tied to this artifact (0 when links unknown). */
  linkCount: number;
  /** All-time human clicks on those links. Null = the link read failed. */
  clicks: number | null;
  /** Leads attributed via this artifact's card piece ids. Null = unknown. */
  optins: number | null;
  purchases: number | null;
  /** Attributed revenue in cents (a floor — tracked links only). */
  revenueCents: number | null;
}

export interface MoneyMapTotals {
  /** Run artifacts that handed off to something. */
  artifactsHandedOff: number;
  /** Cards on the board; null when any producer's count is unknown. */
  cards: number | null;
  /** Lead-gen + email kits created (incl. Full System parts). */
  kits: number;
  /** Sales + opt-in funnels created (incl. Full System parts). */
  funnels: number;
  /** Distinct links across every artifact (never double-counted). Null when
   *  the link registry read failed — same discipline as clicks. */
  links: number | null;
  clicks: number | null;
  optins: number | null;
  purchases: number | null;
  revenueCents: number | null;
}

export interface RunMoneyMap {
  totals: MoneyMapTotals;
  /** Only artifacts that handed off (a research brief that stayed a brief
   *  has nothing to attribute — it appears in the run's step list, not
   *  here). Newest step first is NOT assumed; rows follow step order. */
  perArtifact: MoneyMapArtifact[];
  /** False when the lead/revenue join failed — every lead number is n/a. */
  attributionKnown: boolean;
  /** The floor caveat, worded for a run (see note on the constant). */
  caveat: string;
}

/**
 * Why the money is a floor, worded for the run scope. The account-level
 * sibling is ATTRIBUTED_REVENUE_FLOOR_NOTE in planner/adMetrics.ts — keep
 * the two saying the same thing (never add attributed + Stripe totals).
 */
export const MONEY_MAP_CAVEAT =
  'Attributed results count only what arrived through tracked links minted ' +
  'for this run’s cards and funnels — a floor. Direct traffic and sales ' +
  'from untracked links are real money that never shows up here.';

/* ------------------------------------------------------------------ *
 * Derivation
 * ------------------------------------------------------------------ */

/** Editor href for a single-row handoff (multi-row targets return null). */
export function handoffHref(handoff: MoneyMapHandoff | null): string | null {
  if (!handoff) return null;
  switch (handoff.kind) {
    case 'leadgen-kit':
      return handoff.id ? `/admin/lead-gen?kit=${handoff.id}` : '/admin/lead-gen';
    case 'email-kit':
      return handoff.id
        ? `/admin/email-marketing?kit=${handoff.id}`
        : '/admin/email-marketing';
    case 'sales-funnel':
      return '/admin/sales-funnels';
    case 'planner-cards':
      return '/admin/planner';
    default:
      return null; // system: several parts, each with its own href
  }
}

/** Cards this artifact produced, or null when unknowable (see field doc). */
function cardsFor(
  artifact: MoneyMapArtifactInput,
  planPieceIds: string[] | null,
): number | null {
  const kind = artifact.handedOffTo?.kind;
  if (kind !== 'planner-cards' && kind !== 'system') return null;
  if (planPieceIds) {
    let count = 0;
    for (const pieceId of planPieceIds) {
      if (pieceKeyBelongsToArtifact(artifact.id, pieceId)) count += 1;
    }
    return count;
  }
  // The board read failed. The planner-cards handoff recorded how many rows
  // it created — a stale but honest floor. The system fan-out did not (its
  // count is PARTS, not cards), so its card count is simply unknown.
  return kind === 'planner-cards'
    ? (artifact.handedOffTo?.count ?? null)
    : null;
}

/** Kit / funnel counts one artifact contributed (system parts included). */
function assetCountsOf(artifact: MoneyMapArtifactInput): {
  kits: number;
  funnels: number;
} {
  let kits = 0;
  let funnels = 0;
  const count = (kind: string) => {
    if (kind === 'leadgen-kit' || kind === 'email-kit') kits += 1;
    if (kind === 'sales-funnel' || kind === 'optin-funnel') funnels += 1;
  };
  if (artifact.handedOffTo) count(artifact.handedOffTo.kind);
  for (const part of artifact.systemManifest ?? []) count(part.kind);
  return { kits, funnels };
}

/**
 * Compose the map. Pure: every read happens upstream and arrives here as
 * data (or null, which propagates to the matching metrics).
 */
export function buildRunMoneyMap(input: {
  artifacts: MoneyMapArtifactInput[];
  /** Null = the link registry read failed (clicks unknown, NOT zero). */
  links: MoneyMapLinkLike[] | null;
  /** Null = the lead attribution join failed (leads/revenue unknown). */
  attribution: ReadonlyMap<string, MoneyMapAttributionSlice> | null;
  /** The planner board's piece ids. Null = the board read failed. */
  planPieceIds: string[] | null;
}): RunMoneyMap {
  const artifacts = (input.artifacts ?? []).filter((a) => a && a.id);
  const links = input.links;
  const attribution = input.attribution ?? null;

  const perArtifact: MoneyMapArtifact[] = [];

  // Totals accumulate across artifacts with link-id dedupe: a boosted card
  // and its organic twin are TWO links (both counted), but a link matching
  // an artifact twice (piece key AND funnel id) is ONE.
  const countedLinkIds = new Set<string>();
  let totalClicks = 0;
  let totalOptins = 0;
  let totalPurchases = 0;
  let totalRevenueCents = 0;
  let totalKits = 0;
  let totalFunnels = 0;
  let handedOffCount = 0;
  let totalCards = 0;
  let cardsUnknown = false;

  for (const artifact of artifacts) {
    if (!artifact.handedOffTo) continue; // stayed a brief — nothing to map
    handedOffCount += 1;

    // Clicks: this artifact's links (by piece key or funnel id).
    let clicks: number | null = null;
    let linkCount = 0;
    if (links) {
      clicks = 0;
      for (const link of links) {
        if (!linkBelongsToArtifact(artifact, link)) continue;
        linkCount += 1;
        clicks += Math.max(0, Math.floor(link.clickCount || 0));
        if (!countedLinkIds.has(link.id)) {
          countedLinkIds.add(link.id);
          totalClicks += Math.max(0, Math.floor(link.clickCount || 0));
        }
      }
    }

    // Leads/revenue: utm_content keys carrying this artifact's prefix. Every
    // key is visited here AND counted in the totals below (a key matches at
    // most one artifact's prefixes — see pieceKeyBelongsToArtifact).
    let optins: number | null = null;
    let purchases: number | null = null;
    let revenueCents: number | null = null;
    if (attribution) {
      optins = 0;
      purchases = 0;
      revenueCents = 0;
      attribution.forEach((slice, key) => {
        if (!pieceKeyBelongsToArtifact(artifact.id, key)) return;
        optins! += slice.optins || 0;
        purchases! += slice.purchases || 0;
        revenueCents! += slice.revenueCents || 0;
      });
    }

    const cards = cardsFor(artifact, input.planPieceIds);
    if (cards === null) {
      if (
        artifact.handedOffTo.kind === 'planner-cards' ||
        artifact.handedOffTo.kind === 'system'
      ) {
        cardsUnknown = true;
      }
    } else {
      totalCards += cards;
    }

    const counts = assetCountsOf(artifact);
    totalKits += counts.kits;
    totalFunnels += counts.funnels;

    perArtifact.push({
      artifactId: artifact.id,
      title: artifact.title,
      type: artifact.type,
      stepIndex: artifact.stepIndex,
      handedOffLabel: artifact.handedOffTo.label || null,
      handedOffKind: artifact.handedOffTo.kind,
      handedOffHref: handoffHref(artifact.handedOffTo),
      systemParts: artifact.systemManifest ?? [],
      cards,
      linkCount,
      clicks,
      optins,
      purchases,
      revenueCents,
    });
  }

  // Run-level money: one pass over the attribution map, so a key is summed
  // exactly once regardless of how per-artifact rows are shaped later.
  if (attribution) {
    attribution.forEach((slice, key) => {
      const owned = artifacts.some((a) => pieceKeyBelongsToArtifact(a.id, key));
      if (!owned) return;
      totalOptins += slice.optins || 0;
      totalPurchases += slice.purchases || 0;
      totalRevenueCents += slice.revenueCents || 0;
    });
  }

  return {
    totals: {
      artifactsHandedOff: handedOffCount,
      cards: cardsUnknown ? null : totalCards,
      kits: totalKits,
      funnels: totalFunnels,
      links: links ? countedLinkIds.size : null,
      clicks: links ? totalClicks : null,
      optins: attribution ? totalOptins : null,
      purchases: attribution ? totalPurchases : null,
      revenueCents: attribution ? totalRevenueCents : null,
    },
    perArtifact,
    attributionKnown: attribution !== null,
    caveat: MONEY_MAP_CAVEAT,
  };
}

/* ------------------------------------------------------------------ *
 * The headline sentence
 * ------------------------------------------------------------------ */

function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : (many ?? `${one}s`);
}

/**
 * "12 cards · 2 kits → 218 clicks → 31 leads → $412.00 attributed".
 *
 * Returns null when there is literally nothing to say (no handoffs, no
 * links, no attribution) so a feed row can omit the line entirely instead
 * of printing a string of zeros that reads as "this run failed to earn".
 * Unknowns skip their segment rather than printing "n/a" inside the chain —
 * the caveat line under it carries why.
 */
export function moneyMapSummary(map: RunMoneyMap | null | undefined): string | null {
  if (!map) return null;
  const { totals } = map;

  const assetParts: string[] = [];
  if (typeof totals.cards === 'number' && totals.cards > 0) {
    assetParts.push(`${totals.cards} ${plural(totals.cards, 'card')}`);
  }
  if (totals.kits > 0) assetParts.push(`${totals.kits} ${plural(totals.kits, 'kit')}`);
  if (totals.funnels > 0) {
    assetParts.push(`${totals.funnels} ${plural(totals.funnels, 'funnel')}`);
  }

  const chainParts: string[] = [];
  if (typeof totals.clicks === 'number' && totals.clicks > 0) {
    chainParts.push(`${totals.clicks.toLocaleString()} ${plural(totals.clicks, 'click')}`);
  }
  if (typeof totals.optins === 'number' && totals.optins > 0) {
    chainParts.push(`${totals.optins.toLocaleString()} ${plural(totals.optins, 'lead')}`);
  }
  if (typeof totals.revenueCents === 'number' && totals.revenueCents > 0) {
    chainParts.push(`${formatCents(totals.revenueCents)} attributed`);
  }

  const assets = assetParts.join(' · ');
  const chain = chainParts.join(' → ');
  if (assets && chain) return `${assets} → ${chain}`;
  if (chain) return chain;
  if (assets) return assets;
  return null;
}
