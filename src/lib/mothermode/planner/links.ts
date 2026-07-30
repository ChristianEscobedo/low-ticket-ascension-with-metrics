/**
 * UTM link registry store: the read/write half of `/go/<code>`, plus the admin
 * half that mints the links and reports on them.
 *
 * Service-role only, like the rest of the planner. Note the asymmetry called out
 * in 20261005000000_planner_funnel_links_and_utm.sql: `mothermode_utm_links` has
 * no anon SELECT policy, yet `/go/<code>` must resolve for anonymous visitors.
 * That works precisely because the redirect route runs on the server through
 * this module — the table stays unreadable to the public even though its
 * redirects are not.
 *
 * TWO ERROR POLICIES, DELIBERATELY
 * --------------------------------
 * The *public* half (resolveShortLink / recordLinkClick) degrades to "not found"
 * and never throws. A short link is a public URL printed in someone's Instagram
 * bio; if the database is briefly unreachable the correct behaviour is a clean
 * 404, not a stack trace rendered to a buyer. This is also what kept the route
 * working before the migration was applied: the tables were missing, every query
 * errored, and /go/<code> simply 404'd instead of 500ing.
 *
 * The *admin* half throws. Silence is the wrong default for a surface whose only
 * job is to report numbers: someone reading "0 clicks" has to be able to tell
 * "nobody clicked" from "the query failed". Swallowing errors there would
 * recreate exactly the ambiguity that made the unapplied migration so hard to
 * notice in the first place.
 */
import { createClient } from '@supabase/supabase-js';
import { buildUtmUrl, newShortCode, slugifyUtm } from './utm';
// Safe to import here despite this module being service-role only: adMetrics has
// no imports of its own, so nothing is dragged into a client bundle by it.
import {
  emptyTrafficSplit,
  sumAttributedSlices,
  sumTrafficSplits,
  trafficType,
  type AttributedSlice,
  type TrafficSplit,
  type TrafficType
} from './adMetrics';


const UTM_LINKS = 'mothermode_utm_links';
const LINK_CLICKS = 'mothermode_link_clicks';
const SALES_LEADS = 'mothermode_sales_funnel_leads';
const OPTIN_LEADS = 'mothermode_optin_leads';

const LINK_COLUMNS =
  'id, plan_id, funnel_id, optin_funnel_id, funnel_page, piece_id, label, base_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, full_url, short_code, click_count, last_clicked_at, created_at, updated_at, created_by';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** The minimum a redirect needs: which row to log against, and where to send. */
export interface ResolvedShortLink {
  id: string;
  /** Vetted destination — already passed `safeDestination`. */
  destination: string;
  clickCount: number;
}

/**
 * Reject anything that isn't an ordinary http(s) URL or a same-origin path.
 *
 * The destination comes from our own table, so this is not defending against a
 * caller-supplied `?to=` (there isn't one — see the NO OPEN REDIRECT invariant).
 * It defends against a *stored* value that would turn a redirect into something
 * else: `javascript:`, `data:`, and protocol-relative `//evil.com` (which reads
 * like a path but leaves the site). A bad row should break its own link, not
 * become a vector.
 */
export function safeDestination(url: string | null | undefined): string | null {
  const value = (url || '').trim();
  if (!value) return null;
  // Same-origin path. `//host` is protocol-relative, i.e. off-site.
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

/**
 * Look up a short code.
 *
 * `full_url` is preferred over `base_url` because it is the materialized string
 * that actually carries the UTM params; falling back to `base_url` keeps a link
 * alive (pointing at the un-tagged page) rather than 404ing when full_url was
 * never written.
 */
export async function resolveShortLink(
  code: string,
): Promise<ResolvedShortLink | null> {
  const key = (code || '').trim();
  if (!key) return null;

  try {
    const { data, error } = await (serviceClient() as any)
      .from(UTM_LINKS)
      .select('id, full_url, base_url, click_count')
      .eq('short_code', key)
      .maybeSingle();
    if (error || !data) return null;

    const destination =
      safeDestination(data.full_url) ?? safeDestination(data.base_url);
    if (!destination) return null;

    return {
      id: data.id as string,
      destination,
      clickCount: typeof data.click_count === 'number' ? data.click_count : 0,
    };
  } catch {
    return null;
  }
}

export interface RecordClickInput {
  linkId: string;
  /** Hashed upstream — this module never sees a raw address. */
  ipHash?: string | null;
  uaFamily?: string;
  referrer?: string | null;
  /** Current counter value, so the bump doesn't need a second read. */
  clickCount?: number;
  /**
   * Whether this click should move the visible counter. Bots (link-preview
   * fetches from Slack/iMessage/Meta hit every new link within seconds) get a
   * row but not a count, so day-one numbers aren't inflated on every post.
   */
  countable?: boolean;
}

/**
 * Log one click. Never throws — a redirect must not fail because analytics did.
 *
 * The counter is a read-modify-write like the funnel counters in sales/store.ts,
 * so two simultaneous clicks can collapse into one increment. That is accepted:
 * `mothermode_link_clicks` holds one row per click and is the number to trust,
 * while `click_count` exists only so list views don't need an aggregate query.
 */
export async function recordLinkClick(input: RecordClickInput): Promise<void> {
  try {
    const client = serviceClient() as any;

    await client.from(LINK_CLICKS).insert({
      link_id: input.linkId,
      ip_hash: input.ipHash || null,
      ua_family: input.uaFamily || '',
      // Referrers are long and occasionally carry query junk; the column is for
      // "did this come from where I posted it", not forensics.
      referrer: input.referrer ? input.referrer.slice(0, 500) : null,
    });

    if (input.countable === false) return;

    await client
      .from(UTM_LINKS)
      .update({
        click_count: (input.clickCount ?? 0) + 1,
        last_clicked_at: new Date().toISOString(),
      })
      .eq('id', input.linkId);
  } catch {
    // non-fatal by design
  }
}

// ---------------------------------------------------------------------------
// Admin: the registry surface
// ---------------------------------------------------------------------------

export interface UtmLinkRecord {
  id: string;
  /** NULL for a link minted from the funnel side with no content card behind it. */
  planId: string | null;
  funnelId: string | null;
  /** Lead-magnet destination. Mutually exclusive with funnelId (DB CHECK). */
  optinFunnelId: string | null;
  funnelPage: string;
  pieceId: string;
  label: string;
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  fullUrl: string;
  shortCode: string | null;
  clickCount: number;
  lastClickedAt: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function rowToUtmLink(row: Record<string, any>): UtmLinkRecord {
  return {
    id: row.id as string,
    planId: (row.plan_id as string) ?? null,
    funnelId: (row.funnel_id as string) ?? null,
    optinFunnelId: (row.optin_funnel_id as string) ?? null,
    funnelPage: str(row.funnel_page),
    pieceId: str(row.piece_id),
    label: str(row.label),
    baseUrl: str(row.base_url),
    utmSource: str(row.utm_source),
    utmMedium: str(row.utm_medium),
    utmCampaign: str(row.utm_campaign),
    utmContent: str(row.utm_content),
    utmTerm: str(row.utm_term),
    fullUrl: str(row.full_url),
    shortCode: (row.short_code as string) ?? null,
    clickCount: typeof row.click_count === 'number' ? row.click_count : 0,
    lastClickedAt: (row.last_clicked_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
  };
}

/**
 * Every link, newest first. Optionally scoped to one plan card (the drawer) or
 * one funnel (the funnel-side view) — the same table serving both entry points,
 * which is the whole reason `plan_id` is nullable.
 */
export async function listUtmLinks(opts?: {
  planId?: string | null;
  funnelId?: string | null;
  optinFunnelId?: string | null;
  limit?: number;
}): Promise<UtmLinkRecord[]> {
  let query = (serviceClient() as any)
    .from(UTM_LINKS)
    .select(LINK_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 500);
  if (opts?.planId) query = query.eq('plan_id', opts.planId);
  if (opts?.funnelId) query = query.eq('funnel_id', opts.funnelId);
  if (opts?.optinFunnelId)
    query = query.eq('optin_funnel_id', opts.optinFunnelId);

  const { data, error } = await query;
  if (error) throw new Error(`listUtmLinks failed: ${error.message}`);
  return ((data ?? []) as Record<string, any>[]).map(rowToUtmLink);
}

export interface CreateUtmLinkInput {
  planId?: string | null;
  funnelId?: string | null;
  /** Lead-magnet destination. Pass this OR funnelId, never both. */
  optinFunnelId?: string | null;
  funnelPage?: string;
  pieceId?: string;
  label?: string;
  /** Funnel page URL or a pasted external URL. */
  baseUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** Defaults to pieceId — the convention that makes attribution per-piece. */
  utmContent?: string;
  utmTerm?: string;
  /** Mint a /go/<code> short link as well as the plain tagged URL. */
  withShortLink?: boolean;
  createdBy?: string | null;
}

/** Raised when the unique-combo index rejects a duplicate. Carries the existing row. */
export class DuplicateUtmLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateUtmLinkError';
  }
}

/**
 * Mint a link.
 *
 * Three things are load-bearing here:
 *
 * 1. **source/medium/campaign are slugified; utm_content is not.** The first
 *    three are report dimensions, and `Instagram` vs `instagram` silently splits
 *    one channel's numbers in two. `utm_content` is an opaque piece id that must
 *    match the lead row byte for byte — slugifying it would break the very join
 *    it exists to enable.
 * 2. **full_url is materialized, not recomputed on read.** This exact string is
 *    what gets pasted into the wild; rebuilding it later (after a slug rename,
 *    say) would misreport what was actually published.
 * 3. **Short-code collisions retry.** `short_code` is UNIQUE, so uniqueness is
 *    the database's job and randomness is only an optimization. Retrying a
 *    handful of times is what makes that guarantee usable.
 */
export async function createUtmLink(
  input: CreateUtmLinkInput,
): Promise<UtmLinkRecord> {
  const base = (input.baseUrl || '').trim();
  if (!base) throw new Error('A destination URL is required');

  // A tracked link is a permanent, publishable artifact. Minting one against
  // localhost bakes an unreachable host into base_url/full_url, and /go/<code>
  // redirects to the stored full_url -- so this cannot be corrected later by
  // fixing the env. Set NEXT_PUBLIC_SITE_URL to the real domain instead.
  // ALLOW_LOCALHOST_TRACKED_LINKS=true opts local testing back in deliberately.
  if (
    isLoopbackUrl(base) &&
    (process.env.ALLOW_LOCALHOST_TRACKED_LINKS || '').toLowerCase() !== 'true'
  ) {
    throw new Error(
      'Refusing to mint a tracked link pointing at ' +
        base +
        ' — base_url and full_url are stored permanently and /go/ redirects to ' +
        'them, so this link would be dead everywhere but this machine. Set ' +
        'NEXT_PUBLIC_SITE_URL to your real domain (or set ' +
        'ALLOW_LOCALHOST_TRACKED_LINKS=true if you are only testing).',
    );
  }
  if (!safeDestination(base)) {
    // Refused here rather than at redirect time: a link that can never resolve
    // should fail while someone is looking at the form, not silently 404 for
    // every visitor weeks later.
    throw new Error(
      'Destination must be an http(s) URL or a same-origin path starting with /',
    );
  }

  const pieceId = (input.pieceId || '').trim();
  const utm = {
    source: slugifyUtm(input.utmSource || ''),
    medium: slugifyUtm(input.utmMedium || ''),
    campaign: slugifyUtm(input.utmCampaign || ''),
    content: (input.utmContent ?? pieceId).trim(),
    term: slugifyUtm(input.utmTerm || ''),
  };

  const fullUrl = buildUtmUrl(base, utm);

  // Fail here rather than at the DB. The CHECK constraint would raise a
  // Postgres error that surfaces to the admin as an opaque 500; a link with two
  // destinations is a caller bug worth naming.
  if (input.funnelId && input.optinFunnelId) {
    throw new Error(
      'A link points at one destination: pass funnelId or optinFunnelId, not both',
    );
  }

  const row: Record<string, unknown> = {
    plan_id: input.planId ?? null,
    funnel_id: input.funnelId ?? null,
    optin_funnel_id: input.optinFunnelId ?? null,
    funnel_page: input.funnelPage ?? '',
    piece_id: pieceId,
    label: (input.label || '').trim(),
    base_url: base,
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
    utm_content: utm.content,
    utm_term: utm.term,
    full_url: fullUrl,
    created_by: input.createdBy ?? null,
  };

  const attempts = input.withShortLink ? 5 : 1;
  for (let i = 0; i < attempts; i += 1) {
    const candidate = input.withShortLink
      ? { ...row, short_code: newShortCode() }
      : row;

    const { data, error } = await (serviceClient() as any)
      .from(UTM_LINKS)
      .insert(candidate)
      .select(LINK_COLUMNS)
      .single();

    if (!error && data) return rowToUtmLink(data as Record<string, any>);
    if (!error) throw new Error('createUtmLink failed: no row returned');

    const message = error.message || '';
    const isUnique = error.code === '23505' || /duplicate key/i.test(message);

    // Two different UNIQUE constraints, two different meanings. A short_code
    // collision is bad luck and should be retried silently; a combo collision is
    // the user minting the same link twice, which must surface as an error --
    // two rows with identical UTMs would split one piece's stats across both.
    if (isUnique && /short_code/i.test(message)) continue;
    if (isUnique && /unique_combo/i.test(message)) {
      throw new DuplicateUtmLinkError(
        'A link with these exact UTM values already exists for this destination. ' +
          'Reuse it rather than minting a second one, or change utm_content.',
      );
    }
    throw new Error(`createUtmLink failed: ${message}`);
  }

  throw new Error(
    'createUtmLink failed: could not find an unused short code after 5 attempts',
  );
}

export async function deleteUtmLink(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(UTM_LINKS)
    .delete()
    .eq('id', id);
  if (error) throw new Error(`deleteUtmLink failed: ${error.message}`);
}

/** Per-link click detail beyond the hot counter. */
export interface LinkClickStats {
  /** Human clicks in the window. Excludes bots, so it agrees with click_count. */
  recent: number;
  /** Bot hits in the window — shown separately so the gap is explainable. */
  bots: number;
  /**
   * Distinct hashed IPs behind `recent`, kept as a Set rather than a count.
   *
   * It has to stay a Set until the final aggregation. A piece can own several
   * links, and one person who clicks two of them is still one person — summing
   * per-link unique counts would double them. Only a union answers "how many
   * people", so the union has to happen after this map is assembled, which means
   * the members must survive this far.
   *
   * Never serialised to a client. It is a salted hash, but it is still a
   * per-person identifier, and the only thing any surface needs is `.size`.
   */
  uniqueIps: Set<string>;
  /**
   * Human clicks in the window that carried no `ip_hash` at all.
   *
   * Not a rare edge case: local dev has no `x-forwarded-for` header to hash, so
   * every click on a dev box lands here. Counted separately because these clicks
   * are real but unassignable, which makes `uniqueIps.size` a FLOOR rather than
   * an answer — and a floor of 0 sitting next to 40 clicks has to be rendered as
   * "unknown", never as "nobody".
   */
  noIpHash: number;
  firstClickAt: string | null;
  lastClickAt: string | null;
}


/** A click-log read, plus the shape of the window it came out of. */
export interface ClickLogRead {
  stats: Map<string, LinkClickStats>;
  /** Days of history the window covers. */
  sinceDays: number;
  /**
   * True when the read hit its row cap, so the window silently covers less than
   * `sinceDays`. Uniques are then a floor for the period, and the UI has to stop
   * claiming the number describes the whole 30 days.
   */
  truncated: boolean;
}

/**
 * Read the click log and fold it into per-link stats.
 *
 * Split out from `getLinkClickStats` for one reason: uniques need the window's
 * metadata (how many days, was it truncated) and a `Map` return type has nowhere
 * to put it. Rather than change a signature two callers already depend on, the
 * read returns the metadata and `getLinkClickStats` throws it away.
 *
 * Bots are excluded from `recent` on purpose. `/go/<code>` logs a bot hit but
 * does not increment `click_count`, so counting rows naively here would produce
 * a second, larger "clicks" number on the same screen as the counter — and two
 * disagreeing numbers is worse than one imperfect one. They are returned in
 * their own field instead, which explains the difference rather than hiding it.
 *
 * The row cap matters: this reads the most recent N clicks, not all of history.
 * All-time totals come from `click_count`. Past the cap the window silently
 * shortens, which is acceptable for a "what happened lately" panel and is why
 * these two numbers are labelled differently in the UI.
 */
export async function readClickLog(opts?: {
  sinceDays?: number;
  rowCap?: number;
}): Promise<ClickLogRead> {
  const sinceDays = opts?.sinceDays ?? 30;
  const rowCap = opts?.rowCap ?? 5000;
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

  const { data, error } = await (serviceClient() as any)
    .from(LINK_CLICKS)
    // ip_hash is selected for `count(distinct)` and nothing else. It never
    // leaves this module: only set sizes are returned upward. It is already a
    // salted hash, but it is still a per-person identifier and there is no
    // reason for one to reach a browser.
    .select('link_id, clicked_at, ua_family, ip_hash')
    .gte('clicked_at', since)
    .order('clicked_at', { ascending: false })
    .limit(rowCap);
  if (error) throw new Error(`getLinkClickStats failed: ${error.message}`);

  const rows = (data ?? []) as Record<string, any>[];
  const out = new Map<string, LinkClickStats>();
  for (const raw of rows) {
    const id = raw.link_id as string;
    const at = (raw.clicked_at as string) ?? null;
    const entry =
      out.get(id) ??
      ({
        recent: 0,
        bots: 0,
        uniqueIps: new Set<string>(),
        noIpHash: 0,
        firstClickAt: null,
        lastClickAt: null,
      } as LinkClickStats);

    if (raw.ua_family === 'bot') {
      entry.bots += 1;
    } else {
      entry.recent += 1;
      // Uniques exclude bots for the same reason `recent` does — and here it
      // matters more: a crawler fleet arrives from many addresses, so counting
      // bot IPs would put "people" above the click count on the same row.
      const hash = typeof raw.ip_hash === 'string' ? raw.ip_hash.trim() : '';
      if (hash) entry.uniqueIps.add(hash);
      else entry.noIpHash += 1;
    }

    // Rows arrive newest-first, so the first one seen is the latest and the last
    // one seen is the earliest.
    if (at) {
      if (!entry.lastClickAt) entry.lastClickAt = at;
      entry.firstClickAt = at;
    }
    out.set(id, entry);
  }

  // `>=` not `===`: PostgREST can return the cap exactly, and either way the
  // honest reading is "there may be more".
  return { stats: out, sinceDays, truncated: rows.length >= rowCap };
}

/** Per-link click stats for callers that don't care about the window's shape. */
export async function getLinkClickStats(opts?: {
  sinceDays?: number;
  rowCap?: number;
}): Promise<Map<string, LinkClickStats>> {
  const { stats } = await readClickLog(opts);
  return stats;
}


/**
 * Map of `utm_content` (= piece id) → the URL to publish for that piece.
 *
 * Feeds `linkByPieceId` in the content export so a CSV ships tracked links
 * instead of the bare offer URL.
 *
 * Two rules worth keeping:
 * - The short `/go/<code>` form is preferred when an origin is known, because
 *   it's what survives being retyped off a screenshot. Falls back to the full
 *   UTM URL, which always works even with no origin configured.
 * - When a piece has several links, the **most recently created** one wins.
 *   Editing a minted link isn't supported (see `PLANNER_LINK_TRACKING_SYSTEM_PORT.md`),
 *   so re-minting is how an admin replaces one — the newest is the intent.
 *   Ordering is explicit rather than relying on however PostgREST returns rows.
 */
export async function getLinkUrlByPieceId(opts?: {
  origin?: string | null;
}): Promise<Record<string, string>> {
  const links = await listUtmLinks();
  const origin = (opts?.origin || '').replace(/\/+$/, '');

  const newestFirst = [...links].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  );

  const out: Record<string, string> = {};
  for (const link of newestFirst) {
    const key = (link.utmContent || '').trim();
    if (!key || out[key]) continue;
    const url =
      origin && link.shortCode
        ? `${origin}/go/${link.shortCode}`
        : link.fullUrl;
    if (url) out[key] = url;
  }
  return out;
}

/** One bucket of attributed results — the whole piece, or one traffic type of it. */
export interface AttributionSlice {
  optins: number;
  purchases: number;
  /**
   * Attributed revenue in cents.
   *
   * NOT the same number as the "Total revenue" card on /admin/funnel-stats, and
   * deliberately never labelled just "revenue". That card sums `funnel_purchases`
   * (written by the Stripe webhook — authoritative money, but the table carries
   * no UTM columns at all, so it cannot be attributed to a piece). This sums
   * `purchase_amount_cents` on the lead row, which is the only revenue figure
   * that knows which content produced it. The two will not match: any sale from
   * direct traffic, or from a link minted before utm_content shipped, lands in
   * the Stripe total and not here. Attributed revenue is therefore a FLOOR on
   * what a piece earned.
   */
  revenueCents: number;
}

/** Opt-ins, purchases and revenue attributed to one utm_content value. */
export interface PieceAttribution extends AttributionSlice {
  utmContent: string;
  /**
   * The same figures split by traffic type — the piece's paid results separated
   * from its organic ones.
   *
   * WHY THIS IS NOT A DIFFERENT MAP KEY
   * -----------------------------------
   * A boosted post and its organic twin carry the SAME utm_content, because
   * utm_content is the piece id and both are the same piece. So the top-level
   * numbers above are a blend of the two, and re-keying the Map on
   * `content|medium` would have silently changed the meaning of every existing
   * caller's lookup. The split lives inside the entry instead: the total stays
   * where it was, and callers that care about paid-vs-organic opt in.
   *
   * WHY THE BLEND MUST NOT BE USED FOR RATES
   * ----------------------------------------
   * Organic traffic is warm and converts several times better than paid. A
   * blended conversion rate is therefore a weighted average that moves when the
   * BUDGET changes rather than when the page does — so a break-even CPL derived
   * from it is inflated by organic and will authorise a bid that loses money.
   * Cost and bid-ceiling metrics must be derived from `byTrafficType.paid`.
   */
  byTrafficType: Record<TrafficType, AttributionSlice>;
}

function emptySlice(): AttributionSlice {
  return { optins: 0, purchases: 0, revenueCents: 0 };
}


/**
 * Clicks → opt-ins, joined on `utm_content`.
 *
 * This is the point of the whole exercise: content that gets clicks but no
 * opt-ins is otherwise invisible.
 *
 * The join happens in memory rather than in SQL because PostgREST cannot join
 * two tables that have no foreign key between them, and `utm_content` is a
 * convention rather than a constraint — deliberately, since the lead's value is
 * a copy of whatever was in the URL and must survive the plan card being
 * deleted. Two bounded reads and a Map is the honest shape of that.
 *
 * Both lead tables are counted. Only sales leads carry `purchased` and
 * `purchase_amount_cents`, so optin leads contribute opt-ins and never purchases
 * or revenue — an opt-in funnel has no checkout to report.
 *
 * `utm_medium` is read alongside so the same pass can split paid from organic.
 * It is a pre-existing column on both lead tables (it predates the planner
 * migration), so this needs no schema change.
 */
export async function getPieceAttribution(opts?: {
  limit?: number;
}): Promise<Map<string, PieceAttribution>> {
  const limit = opts?.limit ?? 5000;
  const client = serviceClient() as any;

  const [sales, optin] = await Promise.all([
    client
      .from(SALES_LEADS)
      .select('utm_content, utm_medium, purchased, purchase_amount_cents')
      .not('utm_content', 'is', null)
      .limit(limit),
    client
      .from(OPTIN_LEADS)
      .select('utm_content, utm_medium')
      .not('utm_content', 'is', null)
      .limit(limit),
  ]);


  // Surfaced, not swallowed. If utm_content is missing the admin must see why
  // the column reads zero -- that is the exact failure this feature is prone to.
  if (sales.error) {
    throw new Error(`getPieceAttribution failed (sales): ${sales.error.message}`);
  }
  if (optin.error) {
    throw new Error(`getPieceAttribution failed (optin): ${optin.error.message}`);
  }

  const out = new Map<string, PieceAttribution>();

  const bump = (
    content: unknown,
    medium: unknown,
    purchased: boolean,
    revenueCents: unknown,
  ) => {
    const key = typeof content === 'string' ? content.trim() : '';
    if (!key) return;

    const entry: PieceAttribution =
      out.get(key) ??
      {
        utmContent: key,
        optins: 0,
        purchases: 0,
        revenueCents: 0,
        byTrafficType: {
          paid: emptySlice(),
          organic: emptySlice(),
          unattributed: emptySlice(),
        },
      };

    /*
     * Revenue is only taken from rows that actually purchased.
     *
     * `purchase_amount_cents` is NOT NULL with a 0 default, so a non-buyer's row
     * carries 0 and summing unconditionally would happen to work today. It is
     * gated on `purchased` anyway, because the day a partial refund or an
     * abandoned-checkout amount gets written to that column, an ungated sum
     * would quietly start counting money that was never collected.
     */
    const amount =
      purchased && typeof revenueCents === 'number' && Number.isFinite(revenueCents)
        ? Math.max(0, revenueCents)
        : 0;

    // The blended totals — correct as totals, wrong as rate denominators.
    entry.optins += 1;
    if (purchased) entry.purchases += 1;
    entry.revenueCents += amount;

    // The same event, also recorded against its traffic type. Classified by the
    // shared `trafficType`, so an untagged lead lands in `unattributed` rather
    // than being counted as organic.
    const slice = entry.byTrafficType[trafficType(
      typeof medium === 'string' ? medium : null,
    )];
    slice.optins += 1;
    if (purchased) slice.purchases += 1;
    slice.revenueCents += amount;

    out.set(key, entry);
  };

  for (const row of (sales.data ?? []) as Record<string, any>[]) {
    bump(
      row.utm_content,
      row.utm_medium,
      Boolean(row.purchased),
      row.purchase_amount_cents,
    );
  }
  for (const row of (optin.data ?? []) as Record<string, any>[]) {
    // An opt-in funnel lead has no purchase and no amount, by construction.
    bump(row.utm_content, row.utm_medium, false, 0);
  }
  return out;
}

/**
 * Attribution that cannot take a page down, mirroring `getClickRollupsSafe`.
 *
 * The dashboards read money and clicks side by side, and the two reads fail for
 * different reasons (a missing planner migration vs a missing lead column). One
 * returning null must leave the other's numbers on screen, and null must render
 * as `n/a` — never as `$0.00`, which would report a selling funnel as dead.
 */
export async function getPieceAttributionSafe(): Promise<Map<
  string,
  PieceAttribution
> | null> {
  try {
    return await getPieceAttribution();
  } catch {
    return null;
  }
}

/** Account-wide attributed results: the blend, and the same split three ways. */
export interface AttributionTotals extends AttributedSlice {
  byTrafficType: TrafficSplit;
  /** How many distinct `utm_content` values contributed. */
  pieces: number;
}

/**
 * Sum an attribution map.
 *
 * Pure and exported so it can be tested without a database, and so the two
 * dashboards that show an account-level total cannot disagree about what
 * "attributed revenue" includes.
 *
 * Iterating the Map's VALUES is what makes this safe to sum: the per-piece
 * entries are already de-duplicated by `utm_content`, so a piece with a boosted
 * link and an organic link contributes its leads once. Summing a list of table
 * rows instead — one row per link — would double-count exactly those pieces.
 */
export function sumPieceAttribution(
  attribution: Map<string, PieceAttribution> | null | undefined
): AttributionTotals {
  if (!attribution) {
    return {
      ...sumAttributedSlices([]),
      byTrafficType: emptyTrafficSplit(),
      pieces: 0
    };
  }

  // forEach, not for..of: this tsconfig's target predates Map iteration without
  // --downlevelIteration (same reason the route uses forEach).
  const entries: PieceAttribution[] = [];
  attribution.forEach((value) => entries.push(value));

  return {
    ...sumAttributedSlices(entries),
    byTrafficType: sumTrafficSplits(entries.map((e) => e.byTrafficType)),
    pieces: entries.length
  };
}


/**
 * True when a URL points at this machine rather than the public internet.
 *
 * Covers the hosts a dev environment actually produces: localhost, the IPv4 and
 * IPv6 loopbacks, 0.0.0.0, and `*.local`. Anything unparseable is treated as
 * NOT loopback -- a malformed URL is a different error, and swallowing it here
 * would block minting for the wrong reason.
 */
export function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    );
  } catch {
    return false;
  }
}

/** Click totals rolled up for dashboard surfaces. */
export interface ClickRollups {
  /** All-time human clicks, summed from the `click_count` counter. */
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
  /**
   * All-time clicks per piece, split by the LINK's `utm_medium`.
   *
   * Why it exists: a break-even CPC is a bid ceiling, and a bid ceiling may only
   * divide PAID revenue by PAID clicks. Without this, the only available
   * denominator is the blend, and a piece whose organic reach dwarfs its ad
   * traffic would report a break-even CPC several times higher than an ad can
   * actually pay.
   *
   * NAMING WARNING, and the reason this is a nested map rather than a third
   * `*ByPieceId` field: `unattributedClicks` / `unattributedByPieceId` above
   * mean "clicks with no IP hash" (we do not know WHO), while `unattributed`
   * here means "no utm_medium" (we do not know WHERE FROM). Two unrelated
   * unknowns, and a flat `unattributedMediumByPieceId` sitting next to
   * `unattributedByPieceId` would be read as the same number by everyone.
   *
   * All-time, from the counter, so it pairs with `byPieceId` and with all-time
   * attribution — never with the 30-day window fields below.
   */
  mediumSplitByPieceId: Record<string, Record<TrafficType, number>>;
  /** The same split, account-wide. */
  clicksByTrafficType: Record<TrafficType, number>;

  // -- Window-scoped, and named so they can never be mistaken for the above ---
  //
  // Everything below comes from the click LOG, not the counter, so it describes
  // `uniqueWindowDays` of history and nothing more. The naming is deliberate:
  // `byPieceId` (all-time) and `uniqueByPieceId` (30d) must never be divided by
  // one another, and a reader who has to guess which is which will eventually do
  // exactly that.

  /**
   * Distinct people (hashed IP) across every link in the window.
   *
   * A union, not a sum of per-link uniques: one person who clicked three
   * different links is one person. Summing would report three.
   */
  uniqueClicks: number;
  /**
   * Window clicks that carried no `ip_hash`, so they belong to nobody.
   *
   * Its presence is what makes `uniqueClicks` a floor rather than a count. On a
   * dev box this equals `recentClicks` and `uniqueClicks` is 0 — which is why no
   * surface may render a bare 0 here as "no people".
   */
  unattributedClicks: number;
  /** Window human clicks per piece — the like-for-like partner of the next field. */
  recentByPieceId: Record<string, number>;
  /** Distinct people per piece, in the window. Unioned across the piece's links. */
  uniqueByPieceId: Record<string, number>;
  /** Window clicks per piece with no hash behind them. */
  unattributedByPieceId: Record<string, number>;
  /** The window the three fields above describe, so a label can say so. */
  uniqueWindowDays: number;
  /** The log hit its row cap: the window is shorter than advertised. */
  uniqueWindowTruncated: boolean;
}


/**
 * Pure roll-up of links + per-link click stats.
 *
 * TWO NUMBERS, DELIBERATELY NOT ONE.
 * `totalClicks` comes from the `click_count` counter, which is all-time and
 * authoritative. `recentClicks` comes from the click rows, which are windowed
 * *and* row-capped. Adding them together, or using rows as "the" total, would
 * make a dashboard number shrink as the window slides — the classic metric that
 * quietly disagrees with itself between two screens.
 *
 * The per-key breakdowns use the all-time counter for the same reason: a funnel's
 * click number should not drop because a click aged out of a 30-day window.
 *
 * Bots are kept in their own field. `/go/<code>` logs a bot hit without
 * incrementing `click_count`, so counting rows naively would produce a larger
 * "clicks" figure sitting next to the counter with no explanation.
 *
 * UNIQUES ARE A THIRD KIND OF NUMBER, NOT A VARIANT OF THE FIRST TWO.
 * They can only come from the click log, so they inherit the log's window — and
 * that makes them incomparable to `totalClicks` by construction. "40 clicks from
 * 3 people" built from an all-time counter and a 30-day unique count describes a
 * link with 40 clicks last year and 3 visitors this month; it is arithmetic
 * nonsense that reads as insight. So the window-scoped fields are returned
 * alongside their own numerator (`recentByPieceId`) and every surface pairs
 * uniques with that, never with the counter.
 */
export function rollupClicks(
  links: UtmLinkRecord[],
  stats: Map<string, LinkClickStats>,
  window?: { sinceDays?: number; truncated?: boolean },
): ClickRollups {
  const byFunnelId: Record<string, number> = {};
  const byOptinFunnelId: Record<string, number> = {};
  const byPieceId: Record<string, number> = {};
  const mediumSplitByPieceId: Record<string, Record<TrafficType, number>> = {};
  const clicksByTrafficType: Record<TrafficType, number> = {
    paid: 0,
    organic: 0,
    unattributed: 0,
  };
  const recentByPieceId: Record<string, number> = {};
  const uniqueByPieceId: Record<string, number> = {};
  const unattributedByPieceId: Record<string, number> = {};

  // Sets survive until after the loop so the per-piece and global figures can be
  // UNIONS. Counting per link and adding would report one person who clicked two
  // of a piece's links as two people.
  const pieceIps = new Map<string, Set<string>>();
  const allIps = new Set<string>();

  let totalClicks = 0;
  let recentClicks = 0;
  let botClicks = 0;
  let unattributedClicks = 0;
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
      unattributedClicks += s.noIpHash || 0;
      // forEach, not for..of: this tsconfig targets ES5, where iterating a Set
      // needs --downlevelIteration. Not worth a compiler flag for one union.
      s.uniqueIps.forEach((hash) => allIps.add(hash));
    }

    // Prefer the link's own counter timestamp; fall back to the stats window.
    const seen = link.lastClickedAt || s?.lastClickAt || null;
    if (seen && (!lastClickAt || seen > lastClickAt)) lastClickAt = seen;

    // Keyed on utm_content, falling back to piece_id: utm_content is what the
    // lead row carries, so this is the key that can be joined to attribution.
    const pieceKey = link.utmContent || link.pieceId;

    if (count > 0) {
      if (link.funnelId) {
        byFunnelId[link.funnelId] = (byFunnelId[link.funnelId] || 0) + count;
      }
      if (link.optinFunnelId) {
        byOptinFunnelId[link.optinFunnelId] =
          (byOptinFunnelId[link.optinFunnelId] || 0) + count;
      }
      if (pieceKey) {
        byPieceId[pieceKey] = (byPieceId[pieceKey] || 0) + count;
      }

      /*
       * Classified by the LINK's medium, not the lead's.
       *
       * These are the same buckets `getPieceAttribution` uses for leads, and
       * they line up because a lead's utm_medium is a copy of the medium in the
       * URL it arrived through. They can still disagree in one direction: a link
       * minted before mediums were set contributes untagged clicks, so the paid
       * bucket is a floor on both sides rather than an estimate on either.
       */
      const type = trafficType(link.utmMedium);
      clicksByTrafficType[type] += count;
      if (pieceKey) {
        const split =
          mediumSplitByPieceId[pieceKey] ||
          ({ paid: 0, organic: 0, unattributed: 0 } as Record<TrafficType, number>);
        split[type] += count;
        mediumSplitByPieceId[pieceKey] = split;
      }
    }

    /*
     * The window-scoped breakdown is keyed independently of `count > 0`.
     *
     * Not just tidiness: `click_count` is a read-modify-write, so two concurrent
     * clicks can collapse into one increment, and the counter write can fail
     * outright while the click row is already inserted. Gating the log-derived
     * numbers on the counter would make those clicks vanish from the one place
     * that recorded them correctly.
     */
    if (pieceKey && s && (s.recent || s.noIpHash)) {
      recentByPieceId[pieceKey] = (recentByPieceId[pieceKey] || 0) + (s.recent || 0);
      unattributedByPieceId[pieceKey] =
        (unattributedByPieceId[pieceKey] || 0) + (s.noIpHash || 0);

      let set = pieceIps.get(pieceKey);
      if (!set) {
        set = new Set<string>();
        pieceIps.set(pieceKey, set);
      }
      const target = set;
      s.uniqueIps.forEach((hash) => target.add(hash));
    }
  }

  // Zero-size sets are omitted rather than written as 0, matching the rule the
  // all-time breakdowns already follow: an explicit 0 reads as "measured and
  // nobody", and here that would be a lie whenever the clicks were unhashed.
  pieceIps.forEach((set, key) => {
    if (set.size) uniqueByPieceId[key] = set.size;
  });

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
    mediumSplitByPieceId,
    clicksByTrafficType,
    uniqueClicks: allIps.size,
    unattributedClicks,
    recentByPieceId,
    uniqueByPieceId,
    unattributedByPieceId,
    uniqueWindowDays: window?.sinceDays ?? 30,
    uniqueWindowTruncated: window?.truncated ?? false,
  };
}

/**
 * Fetches the roll-up. Composes the two existing reads rather than adding a
 * third query shape, so every surface agrees with the planner's Tracking tab.
 *
 * Reads through `readClickLog` rather than `getLinkClickStats` so the window's
 * own description (days covered, whether it was truncated) reaches the roll-up.
 * Without it the uniques would be labelled "last 30 days" on a read that had
 * silently been cut to three by the row cap.
 */
export async function getClickRollups(opts?: {
  sinceDays?: number;
}): Promise<ClickRollups> {
  const [links, log] = await Promise.all([
    listUtmLinks(),
    readClickLog({ sinceDays: opts?.sinceDays ?? 30 }),
  ]);
  return rollupClicks(links, log.stats, {
    sinceDays: log.sinceDays,
    truncated: log.truncated,
  });
}


/**
 * Click rollups that cannot take a page down.
 *
 * Clicks are a secondary metric on pages whose primary job is revenue, and the
 * planner migration may legitimately not be applied on a given database. So a
 * failure returns null — which every caller renders as "n/a" (honestly unknown)
 * rather than 0 (a claim that nobody clicked).
 *
 * Shared rather than re-implemented per surface: three pages each inventing a
 * fallback is how one screen ends up showing 0 while another shows n/a from the
 * same failure.
 */
export async function getClickRollupsSafe(): Promise<ClickRollups | null> {
  try {
    return await getClickRollups();
  } catch {
    return null;
  }
}
