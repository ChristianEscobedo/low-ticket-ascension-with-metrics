import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  createUtmLink,
  deleteUtmLink,
  getClickRollupsSafe,
  getLinkClickStats,
  getLinkUrlByPieceId,
  getPieceAttribution,
  getPieceAttributionSafe,
  listUtmLinks,
  DuplicateUtmLinkError
} from '@/lib/mothermode/planner/links';
import type { PieceAttribution } from '@/lib/mothermode/planner/links';
import type { TrafficSplit, TrafficType } from '@/lib/mothermode/planner/adMetrics';




import { funnelPageUrl, optinPageUrl } from '@/lib/mothermode/planner/utm';
import { getScheduleByPieceId } from '@/lib/mothermode/planner/store';
import { listFunnelsForAdmin } from '@/lib/mothermode/sales/store';
import { listFunnelsForAdmin as listOptinFunnelsForAdmin } from '@/lib/mothermode/optin/store';

/**
 * The UTM link registry's admin endpoint.
 *
 * WHY THIS IS NOT PART OF /api/admin/mothermode-planner
 * -----------------------------------------------------
 * The planner route bundles boards + plan + leads because every planner surface
 * needs all three at once. Links are a different noun with a different audience:
 * the planner's card drawer needs them, but so will the funnel editor, and that
 * surface has no interest in kanban columns or the lead board. Folding links
 * into the planner payload would make the funnel editor fetch a whole planner to
 * read three rows.
 *
 * It does keep the planner's *shape*: one GET returns everything a tracking
 * surface needs already joined, POST dispatches on an `action` discriminator.
 *
 * WHY THE JOIN HAPPENS HERE
 * -------------------------
 * Links, clicks and opt-ins live in three tables with no shared foreign key
 * (clicks join by link_id, opt-ins by the utm_content *convention*). Doing that
 * stitching server-side means the client renders a flat row list instead of
 * re-implementing the join in React — and means "clicks but no opt-ins", the
 * number this whole feature exists to expose, is computed in exactly one place.
 */

/**
 * Origin for generated links.
 *
 * NEXT_PUBLIC_SITE_URL wins over the request origin because a link minted while
 * someone is on a vercel preview domain must still point at production — the
 * URL is about to be pasted into an Instagram bio, where a preview host would be
 * both wrong and, once the deployment is torn down, dead. Falling back to the
 * request origin only matters for local development.
 */
function siteOrigin(request: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return request.nextUrl.origin;
}

/** One row of the Tracking tab: the link, its clicks, and what they produced. */
interface TrackingRow {
  id: string;
  planId: string | null;
  funnelId: string | null;
  funnelPage: string;
  pieceId: string;
  label: string;
  fullUrl: string;
  shortCode: string | null;
  shortUrl: string | null;
  /** All-time, from the hot counter. Bot hits never moved it. */
  clicks: number;
  /** Human clicks inside the stats window. */
  recentClicks: number;
  /** Bot hits inside the window — logged, never counted as clicks. */
  botClicks: number;
  /**
   * Distinct people inside the window. Pairs with `recentClicks`, NOT `clicks`:
   * `clicks` is the all-time counter, so `clicks / uniqueClicks` would divide
   * two different periods and produce a confident wrong ratio.
   */
  uniqueClicks: number;
  /** Window clicks with no IP hash, which makes `uniqueClicks` a floor. */
  unattributedClicks: number;
  lastClickedAt: string | null;

  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  /** Null (not 0) when the opt-in join could not run — see `warnings`. */
  optins: number | null;
  purchases: number | null;
  /**
   * Attributed revenue in cents for the PIECE this link points at, not for the
   * link.
   *
   * There is no per-link revenue and there cannot be: a lead row records the
   * `utm_content` it arrived with, which is the piece id shared by every link on
   * that piece. So two links on one post BOTH carry the post's whole figure —
   * already true of `optins` above, and far more consequential with money on the
   * row. Totalling this column down the table therefore double-counts those
   * pieces; `summarizeLinkRows` in adMetrics.ts is the only sanctioned way to
   * add it up, and it sums over distinct `utmContent`.
   *
   * Null (not 0) when the join failed, same rule as `optins`.
   */
  revenueCents: number | null;
  createdAt: string | null;
}


export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const funnelId = url.searchParams.get('funnelId');

  /*
   * ?format=byPiece — the map the content export needs, and nothing else.
   *
   * This is a separate shape rather than a field on the full payload because the
   * full payload costs a click-stats read and an opt-in join that the exporter
   * has no use for. It returns early, before either of those run.
   *
   * It exists at all because `runExport` is CLIENT-side (see
   * `exportClient.ts`): /api/mothermode/content/export only converts an
   * already-built CSV, so there is no server seam to inject `linkByPieceId`
   * into. The browser has to be able to ask for the map, which is what this is.
   *
   * `funnels` rides along because the same fetch feeds the hub's per-post
   * "create tracked link" control, and that control needs somewhere to point.
   * One request serves both -- see CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md.
   */
  if (url.searchParams.get('format') === 'byPiece') {
    try {
      const origin = siteOrigin(request);
      const offerSlug = url.searchParams.get('offerSlug');
      // Both maps the exporter can inject, in one round trip. They are fetched
      // together because they are consumed together -- `runExport` takes both,
      // and a client that loaded only one would produce a CSV with tracked
      // links but no planner dates (or the reverse) depending on which fetch
      // won. `scheduleByPieceId` is scoped by offerSlug because a piece may be
      // planned once per offer on different dates.
      const [linkByPieceId, scheduleByPieceId, funnels, optinFunnels] =
        await Promise.all([
          getLinkUrlByPieceId({ origin }),
          getScheduleByPieceId(offerSlug),
          listFunnelsForAdmin(),
          listOptinFunnelsForAdmin()
        ]);
      return NextResponse.json({
        success: true,
        origin,
        linkByPieceId,
        scheduleByPieceId,
        funnels: funnels.map((f) => ({
          id: f.id,
          slug: f.slug,
          name: f.name,
          status: f.status
        })),
        // Lead magnets are a SEPARATE list, not merged into `funnels`: their step
        // vocabulary differs ('oto' / 'thank-you' vs 'checkout' / 'upsell1'), so a
        // merged list would let the UI offer a step the destination doesn't have.
        optinFunnels: optinFunnels.map((f) => ({
          id: f.id,
          slug: f.slug,
          name: f.name,
          status: f.status
        }))
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Link map load failed';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }

  /*
   * ?format=pieceMetrics — clicks and opt-ins per piece id, and nothing else.
   *
   * A SEPARATE format from byPiece on purpose. byPiece is on the export path and
   * is documented as deliberately skipping the click read and the opt-in join,
   * which are the two most expensive things this route can do; folding metrics
   * into it would make every CSV preview pay for numbers the CSV never carries.
   * The content hub's link panel asks for this one instead.
   *
   * It NEVER returns a non-200. Both reads degrade independently and the
   * availability flags travel with the payload, because the client has to be
   * able to render "n/a" rather than "0" — an unapplied planner migration must
   * not read as "nobody clicked this post". Same rule as the /admin overview.
   */
  if (url.searchParams.get('format') === 'pieceMetrics') {
    const [rollups, attribution] = await Promise.all([
      // Already-safe: returns null instead of throwing.
      getClickRollupsSafe(),
      // Opt-ins are a separate question from clicks, so a failed join must not
      // hide click numbers that are still true (the Tracking tab's rule).
      getPieceAttributionSafe()
    ]);

    const optinsByPieceId: Record<string, number> = {};
    const purchasesByPieceId: Record<string, number> = {};
    const revenueCentsByPieceId: Record<string, number> = {};
    /*
     * The lead-side split, shipped per piece so the browser can derive a PAID
     * break-even instead of a blended one.
     *
     * It is nested (`{ paid: {...}, organic: {...}, unattributed: {...} }`)
     * rather than three flat `*ByPieceId` maps for the same reason the roll-ups
     * keep `mediumSplitByPieceId` nested: `unattributedClicksByPieceId` already
     * means "no IP hash" (we don't know WHO), and a sibling map whose
     * `unattributed` means "no utm_medium" (we don't know WHERE FROM) would be
     * read as the same number by everybody.
     */
    const trafficSplitByPieceId: Record<string, TrafficSplit> = {};
    if (attribution) {
      // forEach, not for..of: this tsconfig's target predates Map iteration
      // without --downlevelIteration, and a route file is not the place to
      // change a compiler flag for the whole project.
      attribution.forEach((value, key) => {
        // Zero-optin keys are skipped for the same reason the roll-ups skip
        // zero-click links: an explicit 0 reads as "measured and failed", and
        // the client's `?? 0` handles a genuinely absent key identically.
        if (value.optins) optinsByPieceId[key] = value.optins;
        if (value.purchases) purchasesByPieceId[key] = value.purchases;
        if (value.revenueCents) revenueCentsByPieceId[key] = value.revenueCents;
        // Only pieces that actually have leads. A piece with no leads has an
        // all-zero split, and shipping those triples the payload to say nothing.
        if (value.optins) trafficSplitByPieceId[key] = value.byTrafficType;
      });
    }

    /*
     * Clicks split by the LINK's utm_medium, all-time.
     *
     * This is the denominator that makes a paid EPC possible at all: a bid
     * ceiling may only divide paid revenue by paid clicks. Without it the client
     * would have to reuse the blended click count, and a post whose organic
     * reach dwarfs its ad traffic would report a break-even CPC several times
     * higher than an ad can actually pay.
     */
    const clickMediumSplitByPieceId: Record<
      string,
      Record<TrafficType, number>
    > = rollups?.mediumSplitByPieceId ?? {};

    return NextResponse.json({
      success: true,
      clicksAvailable: rollups !== null,
      attributionAvailable: attribution !== null,
      // Keyed on utm_content (falling back to piece_id inside rollupClicks) —
      // the only key that joins a click to a captured lead.
      clicksByPieceId: rollups?.byPieceId ?? {},
      optinsByPieceId,
      purchasesByPieceId,
      /*
       * Money, and the two splits that decide which ratios the client may show.
       *
       * `revenueCentsByPieceId` is ATTRIBUTED revenue: it sums
       * `purchase_amount_cents` on lead rows, so it is a floor on what a piece
       * earned and must never be labelled just "revenue" — see
       * ATTRIBUTED_REVENUE_FLOOR_NOTE, which is the one wording every surface
       * uses for the gap against Stripe's totals.
       */
      revenueCentsByPieceId,
      trafficSplitByPieceId,
      clickMediumSplitByPieceId,


      /*
       * People, and the window they were measured in.
       *
       * `windowClicksByPieceId` ships alongside the uniques and is NOT the same
       * number as `clicksByPieceId`: the first is windowed rows from the click
       * log, the second is the all-time counter. The client needs both because
       * "how many people" is only meaningful against clicks from the same
       * period — dividing the all-time counter by 30-day uniques is the one
       * mistake this payload is shaped to make impossible.
       */
      uniqueClicksByPieceId: rollups?.uniqueByPieceId ?? {},
      windowClicksByPieceId: rollups?.recentByPieceId ?? {},
      unattributedClicksByPieceId: rollups?.unattributedByPieceId ?? {},
      clickWindowDays: rollups?.uniqueWindowDays ?? 30,
      clickWindowTruncated: rollups?.uniqueWindowTruncated ?? false
    });

  }

  try {
    const origin = siteOrigin(request);
    const warnings: string[] = [];

    const [links, clickStats, funnels] = await Promise.all([
      listUtmLinks({ planId: planId || null, funnelId: funnelId || null }),

      getLinkClickStats(),
      listFunnelsForAdmin()
    ]);

    // The one place this route tolerates a failure instead of 500ing. Clicks and
    // opt-ins are independent questions: if the lead-side join breaks, the click
    // numbers are still true and still worth showing. What must NOT happen is
    // rendering 0 opt-ins, which is indistinguishable from "this piece converts
    // nobody" -- so the count goes null and the reason goes in `warnings`.
    // Typed with the full `PieceAttribution` (rather than the two fields this
    // branch used to read) so the money column below cannot be added without
    // the type admitting where it came from.
    let attribution: Map<string, PieceAttribution> | null = null;

    try {
      attribution = await getPieceAttribution();
    } catch (err) {
      warnings.push(
        `Opt-in attribution unavailable: ${
          err instanceof Error ? err.message : 'unknown error'
        }`
      );
    }

    const rows: TrackingRow[] = links.map((link) => {
      const stats = clickStats.get(link.id);
      const attr = attribution?.get(link.utmContent);
      return {
        id: link.id,
        planId: link.planId,
        funnelId: link.funnelId,
        funnelPage: link.funnelPage,
        pieceId: link.pieceId,
        label: link.label,
        fullUrl: link.fullUrl,
        shortCode: link.shortCode,
        shortUrl: link.shortCode ? `${origin}/go/${link.shortCode}` : null,
        clicks: link.clickCount,
        recentClicks: stats?.recent ?? 0,
        botClicks: stats?.bots ?? 0,
        // `.size` only — the hashes themselves stay server-side.
        uniqueClicks: stats?.uniqueIps.size ?? 0,
        unattributedClicks: stats?.noIpHash ?? 0,
        lastClickedAt: link.lastClickedAt,

        utmSource: link.utmSource,
        utmMedium: link.utmMedium,
        utmCampaign: link.utmCampaign,
        utmContent: link.utmContent,
        optins: attribution ? (attr?.optins ?? 0) : null,
        purchases: attribution ? (attr?.purchases ?? 0) : null,
        // Piece-level, by construction — see the field's comment. Null tracks
        // `optins`: both come from the same join, so they fail together.
        revenueCents: attribution ? (attr?.revenueCents ?? 0) : null,
        createdAt: link.createdAt

      };
    });

    return NextResponse.json({
      success: true,
      admin: true,
      origin,
      rows,
      warnings,
      // Sales funnels only in THIS payload. Lead magnets are linkable now
      // (mothermode_utm_links.optin_funnel_id, added 20261006000000) and the
      // ?format=byPiece branch returns them; the planner's link table just
      // hasn't grown a picker for them yet.
      funnels: funnels.map((f) => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        status: f.status
      }))
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Link load failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST { action, ... }
 *
 *   createLink { planId?, funnelId?, funnelPage?, pieceId?, label?,
 *                destinationUrl?, utmSource?, utmMedium?, utmCampaign?,
 *                utmContent?, utmTerm?, withShortLink? }
 *   deleteLink { id }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const createdBy =
    ((guard as unknown as { email?: string | null }).email ?? null) || null;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const text = (key: string) =>
    typeof body[key] === 'string' ? (body[key] as string) : '';

  try {
    switch (action) {
      case 'createLink': {
        const funnelId = text('funnelId') || null;
        const optinFunnelId = text('optinFunnelId') || null;
        const funnelPage = text('funnelPage');
        const pasted = text('destinationUrl').trim();

        // One destination per link. The DB enforces it too, but a 400 naming the
        // problem beats a CHECK violation surfacing as a 500.
        if (funnelId && optinFunnelId) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Pick one destination: a sales funnel or a lead magnet, not both'
            },
            { status: 400 }
          );
        }

        // Resolve the destination server-side. The client sends a funnel id and
        // a page name, never a URL it built itself: funnelPagePath encodes two
        // irregularities (optin is the funnel index; upsell1 has no suffix) that
        // a client-built URL would eventually get wrong, and the resulting link
        // would 404 only in production, only after being published.
        let baseUrl = pasted;
        if (funnelId) {
          const funnels = await listFunnelsForAdmin();
          const funnel = funnels.find((f) => f.id === funnelId);
          if (!funnel) {
            return NextResponse.json(
              { success: false, error: 'Funnel not found' },
              { status: 400 }
            );
          }
          baseUrl = funnelPageUrl(
            siteOrigin(request),
            funnel.slug,
            funnelPage || 'optin'
          );
        }

        // Lead-magnet steps go through optinPageUrl for the same reason sales
        // steps go through funnelPageUrl: step 1 IS the funnel index
        // (/optin/<slug>), and a client-built path gets that wrong eventually.
        if (optinFunnelId) {
          const optins = await listOptinFunnelsForAdmin();
          const optin = optins.find((f) => f.id === optinFunnelId);
          if (!optin) {
            return NextResponse.json(
              { success: false, error: 'Lead magnet not found' },
              { status: 400 }
            );
          }
          baseUrl = optinPageUrl(
            siteOrigin(request),
            optin.slug,
            funnelPage || 'optin'
          );
        }

        if (!baseUrl) {
          return NextResponse.json(
            {
              success: false,
              error: 'Pick a funnel or paste a destination URL'
            },
            { status: 400 }
          );
        }

        const record = await createUtmLink({
          planId: text('planId') || null,
          funnelId,
          optinFunnelId,
          funnelPage,
          pieceId: text('pieceId'),
          label: text('label'),
          baseUrl,
          utmSource: text('utmSource'),
          utmMedium: text('utmMedium'),
          utmCampaign: text('utmCampaign'),
          // Only override the piece-id default when the caller actually sent
          // something, so `''` doesn't blank out the attribution key.
          utmContent: text('utmContent') || undefined,
          utmTerm: text('utmTerm'),
          withShortLink: body.withShortLink !== false,
          createdBy
        });

        return NextResponse.json({ success: true, record });
      }

      case 'deleteLink': {
        const id = text('id');
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'id is required' },
            { status: 400 }
          );
        }
        await deleteUtmLink(id);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action || '(none)'}` },
          { status: 400 }
        );
    }
  } catch (err) {
    // A duplicate is a user mistake, not a server fault: 409 so the drawer can
    // say "you already made this one" instead of showing a generic failure.
    if (err instanceof DuplicateUtmLinkError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : 'Link write failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
