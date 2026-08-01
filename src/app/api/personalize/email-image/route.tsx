import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import {
  EMAIL_IMAGE_HEIGHT,
  EMAIL_IMAGE_WIDTH,
  MAX_HEADLINE_LEN,
  MAX_NAME_LEN,
  MAX_SUB_LEN,
  parseCampaignKey,
  sanitizeImageText,
  toEmailImageTemplate,
  verifyEmailImageSignature,
} from '@/lib/mothermode/personalize/emailImage';
import { getPersonalizationSettings } from '@/lib/mothermode/personalize/store';

/**
 * Per-recipient dynamic email image (Hyperise-style, zero per-send cost).
 *
 * An email's <img> src points here with the recipient's name as a query param
 * filled by the ESP at send time. Every opener gets a PNG rendered with
 * THEIR name — generated at request time, cached hard at the CDN.
 *
 * Access model (all four must pass):
 *   1. Valid signature over (campaign, template) — minted in /admin/personalization.
 *      The dynamic text is deliberately NOT signed (the ESP supplies it).
 *   2. The funnel's email_image_enabled flag — default CLOSED.
 *   3. Per-IP rate limit (an open renderer is a free CDN for someone
 *      otherwise).
 *   4. Length + charset caps on all dynamic text.
 *
 * Failure philosophy: an email image must never break the email. Any render
 * error degrades to a 1x1 transparent GIF, never a 500 with a body an <img>
 * tag can't render.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Editorial Warm (tailwind.config.js) — duplicated as literals because this
// route renders outside the Tailwind pipeline.
const BONE = '#F5F1EB';
const INK = '#1A1816';
const MODE = '#532B3C';
const MODE_DEEP = '#3D1F2D';
const BRASS = '#A88B5C';

// ---------------------------------------------------------------------------
// tiny in-memory rate limiter (same shape as the capture-route one)
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // renders per minute per IP

function rateOk(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// fallback: 1x1 transparent GIF (an <img> must never 500)
// ---------------------------------------------------------------------------

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function emptyImage(status = 200): Response {
  return new Response(TRANSPARENT_GIF, {
    status,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store',
    },
  });
}

// ---------------------------------------------------------------------------
// templates
// ---------------------------------------------------------------------------

function backgroundImage(url: string) {
  // Remote cover image. A fetch failure here throws at render time and is
  // caught by the caller's fallback chain — the card still renders without it.
  return (
    <img
      src={url}
      alt=""
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: EMAIL_IMAGE_WIDTH,
        height: EMAIL_IMAGE_HEIGHT,
        objectFit: 'cover',
      }}
    />
  );
}

function NameCard({ name, baseImageUrl }: { name: string; baseImageUrl: string }) {
  const display = name || 'friend';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: BONE,
        position: 'relative',
        fontFamily: 'Georgia, serif',
      }}
    >
      {baseImageUrl ? backgroundImage(baseImageUrl) : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '48px 72px',
          background: baseImageUrl ? 'rgba(26, 24, 22, 0.55)' : 'transparent',
          borderRadius: 24,
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: baseImageUrl ? BONE : BRASS,
            marginBottom: 18,
          }}
        >
          A note for
        </div>
        <div
          style={{
            fontSize: display.length > 14 ? 84 : 110,
            fontWeight: 600,
            color: baseImageUrl ? '#FFFFFF' : INK,
            lineHeight: 1.05,
            maxWidth: 1000,
            textAlign: 'center',
          }}
        >
          {display}
        </div>
        <div
          style={{
            marginTop: 28,
            height: 2,
            width: 120,
            background: BRASS,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 34,
          left: 48,
          fontSize: 18,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: baseImageUrl ? 'rgba(255,255,255,0.85)' : MODE,
        }}
      >
        MotherMode
      </div>
    </div>
  );
}

function NoteCard({
  name,
  headline,
  sub,
  baseImageUrl,
}: {
  name: string;
  headline: string;
  sub: string;
  baseImageUrl: string;
}) {
  const display = name || 'friend';
  const hl = headline || 'This one was made with you in mind.';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: MODE_DEEP,
        position: 'relative',
        fontFamily: 'Georgia, serif',
      }}
    >
      {baseImageUrl ? backgroundImage(baseImageUrl) : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          width: 980,
          padding: '56px 64px',
          background: 'rgba(245, 241, 235, 0.97)',
          borderRadius: 20,
          border: `2px solid ${BRASS}`,
        }}
      >
        <div
          style={{
            fontSize: 20,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: MODE,
            marginBottom: 16,
          }}
        >
          For {display}
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 600,
            color: INK,
            lineHeight: 1.15,
          }}
        >
          {hl}
        </div>
        {sub ? (
          <div style={{ marginTop: 18, fontSize: 26, color: '#6b6257', lineHeight: 1.4 }}>
            {sub}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 30,
            fontSize: 16,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: BRASS,
          }}
        >
          MotherMode
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const campaign = parseCampaignKey(sp.get('c'));
    const template = toEmailImageTemplate(sp.get('tpl'));
    if (!campaign || !template) return emptyImage(404);

    if (!verifyEmailImageSignature(sp.get('c') || '', template, sp.get('sig'))) {
      return emptyImage(403);
    }

    const forwarded = request.headers.get('x-forwarded-for') || '';
    const ip = forwarded.split(',')[0]?.trim() || 'unknown';
    if (!rateOk(ip)) return emptyImage(429);

    // Default CLOSED: the funnel must explicitly enable the endpoint.
    const settings = await getPersonalizationSettings(campaign.kind, campaign.funnelId);
    if (!settings || settings.emailImageEnabled !== true) return emptyImage(403);

    const name = sanitizeImageText(sp.get('name'), MAX_NAME_LEN);
    const headline = sanitizeImageText(sp.get('hl'), MAX_HEADLINE_LEN);
    const sub = sanitizeImageText(sp.get('sub'), MAX_SUB_LEN);
    const baseImageUrl = settings.baseImageUrl || '';

    try {
      const image =
        template === 'name-card' ? (
          <NameCard name={name} baseImageUrl={baseImageUrl} />
        ) : (
          <NoteCard name={name} headline={headline} sub={sub} baseImageUrl={baseImageUrl} />
        );
      return new ImageResponse(image, {
        width: EMAIL_IMAGE_WIDTH,
        height: EMAIL_IMAGE_HEIGHT,
        headers: {
          // Unique per recipient URL → cache hard; the image for a given URL
          // never changes.
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        },
      });
    } catch (err) {
      // The branded background is the usual suspect (unreachable/expired
      // URL). Retry once without it before giving up to the blank pixel.
      if (baseImageUrl) {
        try {
          const image =
            template === 'name-card' ? (
              <NameCard name={name} baseImageUrl="" />
            ) : (
              <NoteCard name={name} headline={headline} sub={sub} baseImageUrl="" />
            );
          return new ImageResponse(image, {
            width: EMAIL_IMAGE_WIDTH,
            height: EMAIL_IMAGE_HEIGHT,
            headers: {
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
            },
          });
        } catch {
          /* fall through to the blank pixel */
        }
      }
      console.error('[personalize/email-image] render failed:', err);
      return emptyImage();
    }
  } catch (err) {
    console.error('[personalize/email-image] request failed:', err);
    return emptyImage();
  }
}
