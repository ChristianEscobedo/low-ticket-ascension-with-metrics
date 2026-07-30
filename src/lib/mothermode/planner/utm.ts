/**
 * UTM link building for content -> funnel attribution.
 *
 * Pure functions only: no Supabase, no fetch, no `window`. Everything here is a
 * string transform, which is why it can be unit tested directly and reused
 * identically by the planner card drawer and the funnel Tracking tab. The store
 * layer (planner/store.ts) persists what these functions produce.
 *
 * The convention that makes attribution *deep* rather than merely present:
 *
 *     utm_content = pieceId
 *
 * utm_campaign tells you the funnel earned the lead. utm_content tells you
 * *which of the twelve posts* did it. The lead tables carry a matching
 * utm_content column so the join actually closes.
 */

/** Funnel pages a piece of content can point at. */
export const FUNNEL_PAGES = [
  'optin',
  'sales',
  'vsl',
  'checkout',
  'upsell1',
  'upsell2',
  'upsell3',
  'upsell4',
  'success',
  'access'
] as const;

export type FunnelPage = (typeof FUNNEL_PAGES)[number];

export type UtmParams = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
};

export const EMPTY_UTM: UtmParams = {
  source: '',
  medium: '',
  campaign: '',
  content: '',
  term: ''
};

/**
 * Normalize a value for use inside a UTM parameter.
 *
 * Lowercased with `_` separators. Analytics tools treat `Instagram` and
 * `instagram` as two different sources, which silently splits one channel's
 * numbers in half -- so normalizing on the way in is the only reliable fix.
 */
export function slugifyUtm(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Path for a funnel page.
 *
 * Mirrors the real routes under `src/app/funnel/[slug]/` and `src/app/optin/`.
 * Note the two irregularities this has to absorb:
 *   - 'optin' is the funnel index (`/funnel/<slug>`), not `/funnel/<slug>/optin`.
 *   - upsells are `upsell`, `upsell-2`, `upsell-3`, `upsell-4` on disk, so
 *     `upsell1` maps to the unsuffixed path.
 * Getting either wrong produces a link that 404s only in production, so they
 * are encoded here once rather than rebuilt at each call site.
 */
export function funnelPagePath(
  slug: string,
  page: FunnelPage | string
): string {
  const s = (slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!s) return '';
  switch (page) {
    case 'optin':
    case '':
      return `/funnel/${s}`;
    case 'upsell1':
      return `/funnel/${s}/upsell`;
    case 'upsell2':
      return `/funnel/${s}/upsell-2`;
    case 'upsell3':
      return `/funnel/${s}/upsell-3`;
    case 'upsell4':
      return `/funnel/${s}/upsell-4`;
    default:
      return `/funnel/${s}/${page}`;
  }
}

/** Absolute URL for a funnel page, given a site origin. */
export function funnelPageUrl(
  origin: string,
  slug: string,
  page: FunnelPage | string
): string {
  const path = funnelPagePath(slug, page);
  if (!path) return '';
  return `${(origin || '').replace(/\/+$/, '')}${path}`;
}

/** Human label for a funnel page, for dropdowns and card badges. */
export function funnelPageLabel(page: FunnelPage | string): string {
  const labels: Record<string, string> = {
    optin: 'Opt-in',
    sales: 'Sales Page',
    vsl: 'VSL',
    checkout: 'Checkout',
    upsell1: 'Upsell 1',
    upsell2: 'Upsell 2',
    upsell3: 'Upsell 3',
    upsell4: 'Upsell 4',
    success: 'Success',
    access: 'Access'
  };
  return labels[page] || page || 'Not linked';
}

/**
 * Append UTM params to a URL.
 *
 * Merges rather than concatenates: base URLs frequently already carry a query
 * string (`?ref=partner`), and naive `+ '?utm_source='` produces a double-`?`
 * URL that silently drops every parameter after the second one. Empty values are
 * omitted entirely -- `utm_term=` is noise in every report that reads it.
 */
export function buildUtmUrl(
  baseUrl: string,
  params: Partial<UtmParams>
): string {
  const base = (baseUrl || '').trim();
  if (!base) return '';

  const [withoutHash, hash] = splitHash(base);
  const [path, existingQuery] = splitQuery(withoutHash);

  const pairs: [string, string][] = [];
  // Preserve pre-existing params, minus any utm_* we are about to set, so
  // re-building a link twice doesn't accumulate duplicate keys.
  if (existingQuery) {
    for (const part of existingQuery.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      const key = eq === -1 ? part : part.slice(0, eq);
      const value = eq === -1 ? '' : part.slice(eq + 1);
      if (/^utm_/i.test(key)) continue;
      pairs.push([key, value]);
    }
  }

  const utm: [string, string | undefined][] = [
    ['utm_source', params.source],
    ['utm_medium', params.medium],
    ['utm_campaign', params.campaign],
    ['utm_content', params.content],
    ['utm_term', params.term]
  ];
  for (const [key, raw] of utm) {
    const value = (raw || '').trim();
    if (!value) continue;
    pairs.push([key, encodeURIComponent(value)]);
  }

  if (!pairs.length) return base;
  return `${path}?${pairs.map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join('&')}${hash}`;
}

function splitHash(url: string): [string, string] {
  const i = url.indexOf('#');
  return i === -1 ? [url, ''] : [url.slice(0, i), url.slice(i)];
}

function splitQuery(url: string): [string, string] {
  const i = url.indexOf('?');
  return i === -1 ? [url, ''] : [url.slice(0, i), url.slice(i + 1)];
}

/** Read UTM params back off a URL. Inverse of buildUtmUrl, for display/tests. */
export function parseUtmFromUrl(url: string): UtmParams {
  const out: UtmParams = { ...EMPTY_UTM };
  const [withoutHash] = splitHash(url || '');
  const [, query] = splitQuery(withoutHash);
  if (!query) return out;
  for (const part of query.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).toLowerCase();
    const value = safeDecode(part.slice(eq + 1));
    if (key === 'utm_source') out.source = value;
    else if (key === 'utm_medium') out.medium = value;
    else if (key === 'utm_campaign') out.campaign = value;
    else if (key === 'utm_content') out.content = value;
    else if (key === 'utm_term') out.term = value;
  }
  return out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed escape sequence shouldn't take down a whole admin table.
    return value;
  }
}

/**
 * Map a content format to a UTM medium.
 *
 * Deliberately coarse. Mediums are meant to group channels ("did organic social
 * beat email?"); pushing per-format detail in here would make every report a
 * long tail of one-row buckets. Format detail lives in utm_content instead.
 */
export function mediumForFormat(format: string): string {
  const f = slugifyUtm(format);
  if (!f) return 'organic_social';

  /*
   * WHOLE WORDS for the short markers, substrings only for the long ones.
   *
   * `f.includes('ad')` was the original test and it silently classified the
   * `thread` format as `paid_social` — "thre-AD" — along with anything
   * containing "lead", "roadmap" or "headline". Every organic X thread was
   * therefore counted as PAID traffic, which is the worst available direction
   * for this particular mistake: organic converts better, so it inflated the
   * paid opt-in rate and the paid EPC, and the paid EPC is the bid ceiling.
   * The whole paid/blended split exists to keep organic out of a bid, and a
   * two-letter substring was letting it back in upstream of all of it.
   *
   * `dm` gets the same treatment: two letters, and a substring match would
   * catch any future format with "dm" inside it.
   */
  const words = f.split(/[^a-z0-9]+/i).filter(Boolean);
  const hasWord = (...candidates: string[]) =>
    candidates.some((c) => words.includes(c));

  if (f.includes('email') || f.includes('newsletter')) return 'email';
  if (hasWord('ad', 'ads', 'advert', 'promo', 'promoted', 'boosted', 'sponsored') ||
      f.includes('paid')) {
    return 'paid_social';
  }
  if (f.includes('blog') || f.includes('article') || f.includes('seo'))
    return 'organic_search';
  if (hasWord('dm') || f.includes('message')) return 'direct_message';
  if (f.includes('bio') || f.includes('profile')) return 'bio_link';
  return 'organic_social';
}


/** Input shape for suggestUtm: the fields it actually needs, nothing more. */
export type UtmSuggestionInput = {
  platform?: string | null;
  format?: string | null;
  pieceId?: string | null;
  funnelSlug?: string | null;
  campaignOverride?: string | null;
};

/**
 * Sensible UTM defaults for a card + funnel pairing.
 *
 * These are suggestions, not rules: the builder pre-fills them and the admin can
 * overwrite anything. The value is consistency -- hand-typed UTMs drift into
 * `ig`/`insta`/`Instagram` within a week, and inconsistent params are
 * indistinguishable from missing ones once they reach a report.
 */
export function suggestUtm(input: UtmSuggestionInput): UtmParams {
  return {
    source: slugifyUtm(input.platform || '') || 'direct',
    medium: mediumForFormat(input.format || ''),
    campaign:
      slugifyUtm(input.campaignOverride || input.funnelSlug || '') || 'general',
    // The piece id is intentionally NOT slugified: it is an opaque key
    // ('gen_<batch>_<n>', 'plan_<uuid>') that must match the lead row byte for
    // byte, and mangling it would break the very join it exists to enable.
    content: (input.pieceId || '').trim(),
    term: ''
  };
}

/**
 * Alphabet for short codes: no vowels (so no accidental real words, including
 * offensive ones) and no 0/O/1/l/I (so a code can be read aloud or retyped from
 * a screenshot without ambiguity).
 */
const SHORT_CODE_ALPHABET = 'bcdfghjkmnpqrstvwxyz23456789';

/**
 * Generate a short code for /go/<code>.
 *
 * Uniqueness is enforced by the DB (`short_code` is UNIQUE); callers should
 * retry on conflict rather than trusting randomness. 8 chars of this alphabet is
 * ~38 bits, which is far past guessable for a link that isn't secret anyway.
 */
export function newShortCode(
  length = 8,
  random: () => number = Math.random
): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out +=
      SHORT_CODE_ALPHABET[Math.floor(random() * SHORT_CODE_ALPHABET.length)];
  }
  return out;
}

/** Absolute /go/<code> URL. */
export function shortLinkUrl(origin: string, code: string): string {
  if (!code) return '';
  return `${(origin || '').replace(/\/+$/, '')}/go/${code}`;
}

/**
 * Piece id for a plan card typed straight onto the board, with no piece in the
 * content library behind it.
 *
 * A plan card's `piece_id` is the join key for the export bridge
 * (`scheduleByPieceId`) and for `utm_content`. A card created with a blank id is
 * invisible to attribution forever and cannot be exported, so the add-card form
 * generates one of these and *shows* it rather than hiding it — the admin can
 * overwrite it with a real hub piece id if the card represents one.
 *
 * The `manual_` prefix is deliberate: it makes the origin of the id legible in a
 * UTM report, where it will appear verbatim as `utm_content=manual_...`. It is
 * NOT slugified downstream (see `suggestUtm`), so it deliberately contains only
 * characters that survive a URL untouched.
 */
export function newManualPieceId(
  now: Date = new Date(),
  random: () => number = Math.random
): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  return `manual_${stamp}_${newShortCode(5, random)}`;
}

/**
 * Coarse UA family for click logging.
 *
 * Bots are classified but still worth recording, because link-preview fetches
 * from Slack/iMessage/Meta hit every new link immediately -- counting them as
 * humans would inflate day-one numbers on every single piece of content. The
 * caller decides whether a 'bot' click increments the visible counter.
 */
export function uaFamily(userAgent: string | null | undefined): string {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return 'unknown';
  if (
    /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|telegram|discord|twitterbot|linkedinbot|embedly|curl|wget|headless/.test(
      ua
    )
  ) {
    return 'bot';
  }
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

// ============================================================================
// Lead-magnet (optin funnel) destinations
//
// Kept separate from FUNNEL_PAGES on purpose: the two vocabularies are NOT
// interchangeable. A sales funnel has checkout/upsell1..4; an optin funnel has
// an OTO and a thank-you. Merging them into one list would offer steps that
// don't exist for the chosen funnel and mint links to 404s.
// ============================================================================

/** Steps of an optin funnel, in the order a lead walks them. */
export const OPTIN_PAGES = ['optin', 'oto', 'thank-you'] as const;

export type OptinPage = (typeof OPTIN_PAGES)[number];

/**
 * Path for an optin funnel step.
 *
 * Mirrors funnelPagePath's one irregularity: step 1 IS the funnel index
 * (/optin/<slug>), not /optin/<slug>/optin. The routes are
 * src/app/optin/[slug]/{page.tsx, oto, thank-you}, so anything else 404s.
 */
export function optinPagePath(slug: string, page: OptinPage | string): string {
  const s = (slug || '').trim();
  if (!s) return '';
  const p = (page || 'optin').trim();
  return p === 'optin' || p === '' ? `/optin/${s}` : `/optin/${s}/${p}`;
}

/** Absolute URL for an optin funnel step, given a site origin. */
export function optinPageUrl(
  origin: string,
  slug: string,
  page: OptinPage | string
): string {
  const path = optinPagePath(slug, page);
  if (!path) return '';
  return `${(origin || '').replace(/\/$/, '')}${path}`;
}

/** Human label for an optin step, for dropdowns and card badges. */
export function optinPageLabel(page: OptinPage | string): string {
  const labels: Record<string, string> = {
    optin: 'Opt-in page',
    oto: 'OTO (one-time offer)',
    'thank-you': 'Thank you / delivery'
  };
  return labels[page] || page;
}
