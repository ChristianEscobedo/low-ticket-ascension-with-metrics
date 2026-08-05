import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { getReelProject } from '@/lib/mothermode/reel/store';
import { normalizeProjectJson } from '@/lib/mothermode/reel/types';
import {
  buildRenderPlan,
  estimateRenderSeconds,
  renderPlanErrors,
  RENDER_SIZES,
} from '@/lib/mothermode/reel/render/plan';
import { reelRenderProgress } from '@/utils/integrations/remotion-render';

/**
 * The render endpoint — start + poll, never block.
 *
 * GET                        → is rendering available, and why not.
 * POST { id, aspect?, fps? }  → build the plan, start the render, return a jobId.
 * POST { jobId }              → progress (0–1), stage, and the finished URL.
 *
 * The request returns in well under a second in every case. That's deliberate:
 * a render takes minutes, and no HTTP request survives that. The worker keeps
 * the job; this route only starts it and reports on it.

 */
export const maxDuration = 60;

/**
 * Railway and Fly both DISPLAY the worker domain without a scheme, so pasting
 * it verbatim into RENDER_WORKER_URL is the natural thing to do — and then
 * fetch() dies with "Failed to parse URL from <host>/render" before a single
 * byte leaves the process. That reads like the worker is down when the worker
 * is perfectly healthy. Normalize instead: a bare host gets https://, except
 * loopback, which is plain http in local dev.
 */
function workerBase(raw: string): string {
  const bareHost = !/^https?:\/\//i.test(raw);
  const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(raw);
  const base = bareHost ? `${isLoopback ? 'http' : 'https'}://${raw}` : raw;
  return base.replace(/\/$/, '');
}


export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  // Report on what POST actually uses: the render worker. This previously
  // reported isRemotionConfigured() — the five REMOTION_AWS_* Lambda vars —
  // which is dead weight now that rendering goes through the self-hosted
  // worker. It told admins to deploy an AWS Lambda nothing calls, while the
  // one value that IS required (RENDER_WORKER_URL) went unmentioned.
  const workerUrl = (process.env.RENDER_WORKER_URL || '').trim();
  return NextResponse.json({
    success: true,
    configured: !!workerUrl,
    hint: workerUrl
      ? null
      : 'Rendering is not configured — deploy render-worker/ (Railway or Fly) and set RENDER_WORKER_URL to its public URL. See docs/RENDER_WORKER_RAILWAY_SETUP.md.',
  });
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

  // ---- Progress poll (render worker job) ---------------------------------
  // The worker renders in the background and reports progress per frame. This
  // branch is a thin proxy onto GET /render/:jobId.
  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
  if (jobId) {
    const url = (process.env.RENDER_WORKER_URL || '').trim();
    if (!url) {
      return NextResponse.json({ success: false, error: 'RENDER_WORKER_URL is not set.' }, { status: 400 });
    }

    let pollRes: Response;
    try {
      pollRes = await fetch(`${workerBase(url)}/render/${encodeURIComponent(jobId)}`, {
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // A dropped poll is not a failed render. Report "still working" so the
      // client keeps watching instead of declaring a healthy render dead.
      return NextResponse.json({ success: true, done: false, progress: null, stage: 'waiting' });
    }

    if (pollRes.status === 404) {
      return NextResponse.json({
        success: true,
        done: true,
        errorMessage: 'The render worker restarted and lost this job. Start the render again.',
      });
    }

    const job = (await pollRes.json().catch(() => null)) as {
      status?: string;
      progress?: number;
      stage?: string;
      url?: string | null;
      error?: string | null;
      elapsedSec?: number;
    } | null;

    if (!job) {
      return NextResponse.json({ success: true, done: false, progress: null, stage: 'waiting' });
    }

    return NextResponse.json({
      success: true,
      done: job.status === 'done',
      progress: typeof job.progress === 'number' ? job.progress : 0,
      videoUrl: job.url || '',
      errorMessage: job.status === 'failed' ? job.error || 'Render failed.' : '',
      stage: job.stage || '',
      elapsedSec: job.elapsedSec ?? 0,
    });
  }

  // ---- Progress poll (legacy Lambda path) --------------------------------
  const renderId = typeof body.renderId === 'string' ? body.renderId.trim() : '';

  const bucketName = typeof body.bucketName === 'string' ? body.bucketName.trim() : '';
  if (renderId && bucketName) {
    const prog = await reelRenderProgress({ renderId, bucketName });
    if (!prog.ok) return NextResponse.json({ success: false, error: prog.error }, { status: 502 });
    return NextResponse.json({ success: true, ...prog.data });
  }

  // ---- Start a render ----------------------------------------------------
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  const workerUrl = (process.env.RENDER_WORKER_URL || '').trim();
  if (!workerUrl) {
    return NextResponse.json(
      { success: false, error: 'RENDER_WORKER_URL is not set. Deploy the render-worker (Railway/Fly) and set its URL.' },
      { status: 400 },
    );
  }

  const saved = await getReelProject(id);
  if (!saved) {
    return NextResponse.json({ success: false, error: 'Reel not found' }, { status: 404 });
  }

  /**
   * Render what the EDITOR is showing, not what the database last saw.
   *
   * This used to build the plan from `saved` alone. But the studio's timeline
   * and its Remotion preview both call buildRenderPlan() against the *live*
   * in-memory project, while this route called it against the *persisted* row.
   * Same function, different input — so the comments claiming "preview ===
   * render, by construction" were true of the code path and false of the data.
   *
   * The visible result: split a clip, hit Render, and the MP4 came back as the
   * pre-split reel with captions ending where the old timeline ended. Any edit
   * not yet flushed to the DB — a split, a trim, a reorder, a caption restyle —
   * was silently dropped from the export, which is why chasing this inside the
   * caption layer never found it.
   *
   * So the client now posts its project and we render THAT, normalized through
   * the same parser the store uses (never trusted raw). We merge over the saved
   * row so server-owned fields survive, and fall back to the row when no
   * project is sent, which keeps older callers working unchanged.
   */
  const postedRaw = body.project && typeof body.project === 'object' ? body.project : null;
  const project = postedRaw ? { ...saved, ...normalizeProjectJson(postedRaw) } : saved;

  const aspect = body.aspect === 'square' || body.aspect === 'landscape' ? body.aspect : 'vertical';
  const size = RENDER_SIZES[aspect];
  const fps = typeof body.fps === 'number' && body.fps > 0 ? body.fps : undefined;

  const plan = buildRenderPlan(project, { ...size, fps });

  // Validate BEFORE spending a render — a bad plan costs money and 10 minutes.
  const errors = renderPlanErrors(plan);
  if (errors.length) {
    return NextResponse.json({ success: false, error: errors.join(' ') }, { status: 400 });
  }

  // POST to the render worker (Railway/Fly Docker container with Chromium + ffmpeg).
  //
  // Everything below is defensive on purpose. An unreachable worker makes
  // fetch() *throw* rather than return a response, and a worker that answers
  // with an HTML gateway page (Railway 502, cold start, sleeping container)
  // makes .json() throw. Unguarded, either one escapes as a bare 500 with no
  // body — which is what "Could not reach the render service" was hiding. The
  // caller can't tell "not deployed" from "asleep" from "crashed", so surface
  // the actual reason and keep the status codes meaningful.
  const endpoint = `${workerBase(workerUrl)}/render`;

  // This call now only *starts* the render — the worker registers a job and
  // answers in milliseconds, so 45s of patience is no longer needed to cover
  // the render itself. It only has to cover a cold start.
  let workerRes: Response;
  try {
    workerRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan, reelId: id }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'TimeoutError'
        ? `The render worker did not respond within 45s (${endpoint}). It may be cold-starting — try again in a moment.`
        : `Could not reach the render worker at ${endpoint}: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json({ success: false, error: reason }, { status: 502 });
  }

  const raw = await workerRes.text();
  let workerJson: { success?: boolean; error?: string; jobId?: string };

  try {
    workerJson = JSON.parse(raw);
  } catch {
    // Not JSON — almost always a proxy/gateway error page. Include a snippet
    // and the status so the failure is diagnosable from the toast alone.
    return NextResponse.json(
      {
        success: false,
        error: `The render worker returned ${workerRes.status} ${workerRes.statusText} with a non-JSON body: ${raw.slice(0, 200)}`,
      },
      { status: 502 },
    );
  }

  if (!workerRes.ok || !workerJson.success) {
    return NextResponse.json(
      {
        success: false,
        error: workerJson.error || `Render worker failed with ${workerRes.status} ${workerRes.statusText}`,
      },
      { status: 502 },
    );
  }


  if (!workerJson.jobId) {
    return NextResponse.json(
      { success: false, error: 'The render worker did not return a job id. It may be running an old build.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    jobId: workerJson.jobId,
    durationSec: estimateRenderSeconds(plan),
    words: plan.words.length,
    clips: plan.clips.length,
  });

}


