import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin download proxy.
 *
 * The browser refuses to treat cross-origin `<a download>` links as real
 * downloads (it navigates/opens them instead), and a client-side blob fetch
 * fails whenever the remote host (fal CDN, Supabase Storage, OpenAI, etc.) does
 * not send permissive CORS headers — which then falls back to opening the file
 * and produces the Windows "cannot find \\?\C:\…\Downloads\<name>" shell error.
 *
 * This route fetches the asset server-side (no CORS constraints) and streams it
 * back from our own origin with `Content-Disposition: attachment`, so every
 * browser performs a genuine download with the intended filename.
 *
 * Usage: GET /api/mothermode/download?url=<encoded remote url>&name=<filename>
 */

export const runtime = 'nodejs';

/** Reject anything that isn't a plain public http(s) URL to avoid SSRF. */
function isSafeRemoteUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.toLowerCase();
  // Block loopback / link-local / private ranges (basic SSRF guard).
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return null;
  }
  return parsed;
}

/** Filesystem-safe filename with a sensible fallback. */
function sanitizeName(name: string | null): string {
  const cleaned = (name || 'download')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'download';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const target = isSafeRemoteUrl(rawUrl);
  if (!target) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  const filename = sanitizeName(searchParams.get('name'));

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      // Follow redirects (CDNs often 302), no credentials.
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream ${upstream.status}` },
      { status: 502 },
    );
  }

  const contentType =
    upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length') ?? undefined;

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
      filename,
    )}`,
  );
  headers.set('Cache-Control', 'private, no-store');
  if (contentLength) headers.set('Content-Length', contentLength);

  return new NextResponse(upstream.body, { status: 200, headers });
}
