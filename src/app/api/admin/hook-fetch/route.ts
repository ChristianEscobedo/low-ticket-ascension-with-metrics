import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

/**
 * Hook Bank fetch-and-clip — a thin proxy onto the render worker's
 * /fetch-clip. The worker (Railway, yt-dlp + ffmpeg, stable IP) does the
 * download; this route only starts the job and reports on it.
 *
 * POST { url }    → start a fetch, returns { jobId }
 * POST { jobId }  → poll: { done, url, spriteUrl, durationSec, title, error }
 *
 * Mirrors /api/admin/reel-render's start+poll shape — no request blocks on a
 * multi-minute download.
 */
export const maxDuration = 60;

/** Railway/Fly display the worker domain without a scheme — normalize it. */
function workerBase(raw: string): string {
  const bareHost = !/^https?:\/\//i.test(raw);
  const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(raw);
  const base = bareHost ? `${isLoopback ? 'http' : 'https'}://${raw}` : raw;
  return base.replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const workerUrl = (process.env.RENDER_WORKER_URL || '').trim();
  if (!workerUrl) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Fetch-and-clip runs on the render worker. Deploy render-worker/ and set RENDER_WORKER_URL. See docs/RENDER_WORKER_RAILWAY_SETUP.md.',
      },
      { status: 400 },
    );
  }
  const base = workerBase(workerUrl);

  // ---- Poll ---------------------------------------------------------------
  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
  if (jobId) {
    let pollRes: Response;
    try {
      pollRes = await fetch(`${base}/fetch-clip/${encodeURIComponent(jobId)}`, {
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // A dropped poll is not a failed fetch — report "still working".
      return NextResponse.json({ success: true, done: false, stage: 'waiting' });
    }
    if (pollRes.status === 404) {
      return NextResponse.json({
        success: true,
        done: true,
        errorMessage: 'The worker restarted and lost this fetch. Run it again.',
      });
    }
    const job = (await pollRes.json().catch(() => null)) as {
      status?: string;
      stage?: string;
      url?: string | null;
      spriteUrl?: string | null;
      durationSec?: number | null;
      title?: string | null;
      error?: string | null;
    } | null;
    if (!job) return NextResponse.json({ success: true, done: false, stage: 'waiting' });
    return NextResponse.json({
      success: true,
      done: job.status === 'done',
      stage: job.stage || '',
      url: job.url || '',
      spriteUrl: job.spriteUrl || '',
      durationSec: job.durationSec ?? null,
      title: job.title || '',
      errorMessage: job.status === 'failed' ? job.error || 'Fetch failed.' : '',
    });
  }

  // ---- Start a fetch ------------------------------------------------------
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { success: false, error: 'Paste a public http(s) link (TikTok, IG, YouTube, …).' },
      { status: 400 },
    );
  }

  let workerRes: Response;
  try {
    workerRes = await fetch(`${base}/fetch-clip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'The worker did not respond within 45s — it may be cold-starting. Try again in a moment.'
        : `Could not reach the render worker: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json({ success: false, error: reason }, { status: 502 });
  }

  const raw = await workerRes.text();
  let workerJson: { success?: boolean; error?: string; jobId?: string };
  try {
    workerJson = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: `The worker returned ${workerRes.status} with a non-JSON body: ${raw.slice(0, 200)}`,
      },
      { status: 502 },
    );
  }

  if (!workerRes.ok || !workerJson.success || !workerJson.jobId) {
    return NextResponse.json(
      { success: false, error: workerJson.error || `The worker failed with ${workerRes.status}.` },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, jobId: workerJson.jobId });
}
