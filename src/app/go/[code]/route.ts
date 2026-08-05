import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { recordLinkClick, resolveShortLink } from '@/lib/mothermode/planner/links';
import { uaFamily } from '@/lib/mothermode/planner/utm';

// A redirect that reads the database and hashes an IP can never be static, and
// must never be cached at the framework layer either — see the 302 note below.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /go/<code> — first-party short link.
 *
 * The four advertising-compliance invariants from
 * 20261005000000_planner_funnel_links_and_utm.sql are enforced *here*, so they
 * are worth restating where they can actually be broken:
 *
 *   * NO CLOAKING. The destination is a pure function of the code. Nothing in
 *     this handler branches on user-agent, geo, referrer or time — `uaFamily`
 *     is read for the click *log* only and never reaches the Location header.
 *     An ad reviewer and a buyer land on the identical page.
 *   * NO OPEN REDIRECT. The destination comes from the row, never from the
 *     query string. There is deliberately no `?to=` parameter to honour, and
 *     `safeDestination` additionally rejects a stored value that isn't an
 *     http(s) URL or a same-origin path.
 *   * 302, NOT 301. A 301 is cached by the browser forever: the second click
 *     from the same person never reaches us (flatlining the count) and a
 *     changed destination can never be rolled out. `no-store` closes the same
 *     hole for intermediate caches.
 *   * NO RAW PII. Only a salted hash of the IP is stored, using the same salt
 *     and 32-char truncation as the lead capture routes.
 *
 * Unknown or malformed codes get a plain 404. Falling back to the homepage
 * would be friendlier, but it would also mean a typo'd or retired link silently
 * "works", which is how a dead campaign keeps looking alive in a report.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = (params.code || '').trim();

  const link = await resolveShortLink(code);
  if (!link) return notFoundResponse();

  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim() || '';
  const ipHash =
    ip && ip !== 'unknown'
      ? createHash('sha256')
          .update(ip + (process.env.OPTIN_IP_SALT || 'mothermode'))
          .digest('hex')
          .slice(0, 32)
      : null;

  const family = uaFamily(request.headers.get('user-agent'));

  // Awaited, not fire-and-forget: on serverless the instance can be frozen the
  // moment the response is returned, which would drop a floating promise and
  // lose the click. `recordLinkClick` swallows its own errors, so this can slow
  // the redirect down but never break it.
  await recordLinkClick({
    linkId: link.id,
    ipHash,
    uaFamily: family,
    referrer: request.headers.get('referer'),
    clickCount: link.clickCount,
    // Link-preview crawlers (Slack, iMessage, Meta) hit every new link within
    // seconds. They are logged so the traffic is explainable, but they must not
    // move the number a human reads as "clicks".
    countable: family !== 'bot',
  });

  return NextResponse.redirect(new URL(link.destination, request.url), {
    status: 302,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

/** Minimal, unbranded 404 — no layout, because this route renders no page. */
function notFoundResponse() {
  return new NextResponse('Link not found.', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
