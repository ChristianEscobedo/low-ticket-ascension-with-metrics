import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { getReelProject } from '@/lib/mothermode/reel/store';
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
 * GET                       → is rendering available, and why not.
 * POST { id, aspect?, fps? } → build the plan, start a Lambda render, return ids.
 * POST { renderId, bucketName } → progress (0–1) and the finished URL.
 *
 * The request returns in well under a second in every case. That's deliberate:
 * the old compose route tried to finish a render inside the HTTP request and
 * died on the function timeout for anything longer than a few seconds.
 */
export const maxDuration = 60;

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

  // ---- Progress poll -----------------------------------------------------
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

  const project = await getReelProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: 'Reel not found' }, { status: 404 });
  }

  const aspect = body.aspect === 'square' || body.aspect === 'landscape' ? body.aspect : 'vertical';
  const size = RENDER_SIZES[aspect];
  const fps = typeof body.fps === 'number' && body.fps > 0 ? body.fps : undefined;

  const plan = buildRenderPlan(project, { ...size, fps });

  // Validate BEFORE spending a render — a bad plan costs money and 10 minutes.
  const errors = renderPlanErrors(plan);
  if (errors.length) {
    return NextResponse.json({ success: false, error: errors.join(' ') }, { status: 400 });
  }

  // POST to the render worker (Railway/Fly Docker container with Chromium + ffmpeg)
  const workerRes = await fetch(`${workerUrl.replace(/\/$/, '')}/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan, reelId: id }),
  });
  const workerJson = await workerRes.json();
  if (!workerJson.success) {
    return NextResponse.json(
      { success: false, error: workerJson.error || 'Render worker failed' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    url: workerJson.url,
    renderId: workerJson.renderId,
    durationSec: estimateRenderSeconds(plan),
    words: plan.words.length,
    clips: plan.clips.length,
  });
}


