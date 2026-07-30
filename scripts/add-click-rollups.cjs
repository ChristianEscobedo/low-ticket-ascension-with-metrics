/**
 * Adds getClickRollups()/rollupClicks() — the one aggregation the overview
 * dashboard, the funnel dashboard and per-post metrics all need.
 *
 * Built as a pure function plus a thin async wrapper so the arithmetic is
 * testable without a database. Three surfaces reading three different ad-hoc
 * sums is how you end up with three different click numbers on three screens.
 */
const fs = require('fs');

const file = 'src/lib/mothermode/planner/links.ts';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

if (src.includes('rollupClicks')) {
  console.log('already applied — no changes');
  process.exit(0);
}

src += `
/** Click totals rolled up for dashboard surfaces. */
export interface ClickRollups {
  /** All-time human clicks, summed from the \`click_count\` counter. */
  totalClicks: number;
  /** Human clicks inside the stats window (default 30d, row-capped). */
  recentClicks: number;
  /** Bot / link-preview hits in the window. Never folded into the above. */
  botClicks: number;
  linkCount: number;
  linksWithClicks: number;
  lastClickAt: string | null;
  /** All-time clicks per sales funnel id. */
  byFunnelId: Record<string, number>;
  /** All-time clicks per lead-magnet (opt-in funnel) id. */
  byOptinFunnelId: Record<string, number>;
  /** All-time clicks per piece id — the per-post number. */
  byPieceId: Record<string, number>;
}

/**
 * Pure roll-up of links + per-link click stats.
 *
 * TWO NUMBERS, DELIBERATELY NOT ONE.
 * \`totalClicks\` comes from the \`click_count\` counter, which is all-time and
 * authoritative. \`recentClicks\` comes from the click rows, which are windowed
 * *and* row-capped. Adding them together, or using rows as "the" total, would
 * make a dashboard number shrink as the window slides — the classic metric that
 * quietly disagrees with itself between two screens.
 *
 * The per-key breakdowns use the all-time counter for the same reason: a funnel's
 * click number should not drop because a click aged out of a 30-day window.
 *
 * Bots are kept in their own field. \`/go/<code>\` logs a bot hit without
 * incrementing \`click_count\`, so counting rows naively would produce a larger
 * "clicks" figure sitting next to the counter with no explanation.
 */
export function rollupClicks(
  links: UtmLinkRecord[],
  stats: Map<string, LinkClickStats>,
): ClickRollups {
  const byFunnelId: Record<string, number> = {};
  const byOptinFunnelId: Record<string, number> = {};
  const byPieceId: Record<string, number> = {};

  let totalClicks = 0;
  let recentClicks = 0;
  let botClicks = 0;
  let linksWithClicks = 0;
  let lastClickAt: string | null = null;

  for (const link of links) {
    const count = link.clickCount || 0;
    totalClicks += count;
    if (count > 0) linksWithClicks += 1;

    const s = stats.get(link.id);
    if (s) {
      recentClicks += s.recent || 0;
      botClicks += s.bots || 0;
    }

    // Prefer the link's own counter timestamp; fall back to the stats window.
    const seen = link.lastClickedAt || s?.lastClickAt || null;
    if (seen && (!lastClickAt || seen > lastClickAt)) lastClickAt = seen;

    if (count > 0) {
      if (link.funnelId) {
        byFunnelId[link.funnelId] = (byFunnelId[link.funnelId] || 0) + count;
      }
      if (link.optinFunnelId) {
        byOptinFunnelId[link.optinFunnelId] =
          (byOptinFunnelId[link.optinFunnelId] || 0) + count;
      }
      // Keyed on utm_content, falling back to piece_id: utm_content is what the
      // lead row carries, so this is the key that can be joined to attribution.
      const pieceKey = link.utmContent || link.pieceId;
      if (pieceKey) {
        byPieceId[pieceKey] = (byPieceId[pieceKey] || 0) + count;
      }
    }
  }

  return {
    totalClicks,
    recentClicks,
    botClicks,
    linkCount: links.length,
    linksWithClicks,
    lastClickAt,
    byFunnelId,
    byOptinFunnelId,
    byPieceId,
  };
}

/**
 * Fetches the roll-up. Composes the two existing reads rather than adding a
 * third query shape, so every surface agrees with the planner's Tracking tab.
 */
export async function getClickRollups(opts?: {
  sinceDays?: number;
}): Promise<ClickRollups> {
  const [links, stats] = await Promise.all([
    listUtmLinks(),
    getLinkClickStats({ sinceDays: opts?.sinceDays ?? 30 }),
  ]);
  return rollupClicks(links, stats);
}
`;

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log('added click rollups to', file);
