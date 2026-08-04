import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { getReelProject } from '@/lib/mothermode/reel/store';
import {
  buildRenderPlan,
  estimateRenderSeconds,
  renderPlanErrors,
  RENDER_SIZES,
} from '@/lib/mothermode/reel/render/plan';
import {
  isRemotionConfigured,
  reelRenderProgress,
  remotionSetupHint,
  startReelRender,
} from '@/utils/integrations/remotion-render';

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
  return NextResponse.json({
    success: true,
    configured: isRemotionConfigured(),
    hint: remotionSetupHint(),
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
  if (!isRemotionConfigured()) {
    return NextResponse.json({ success: false, error: remotionSetupHint() }, { status: 400 });
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

  const started = await startReelRender(plan);
  if (!started.ok) {
    return NextResponse.json({ success: false, error: started.error }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    renderId: started.data.renderId,
    bucketName: started.data.bucketName,
    region: started.data.region,
    durationSec: estimateRenderSeconds(plan),
    words: plan.words.length,
    clips: plan.clips.length,
  });
}
