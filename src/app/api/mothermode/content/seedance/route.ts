import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  getSeedanceStatus,
  isSeedanceConfigured,
  renderSeedanceClip,
  submitSeedanceRender,
  type SeedanceRenderInput,
} from '@/utils/integrations/muapi-seedance';
import { uploadVideoBuffer } from '@/utils/mothermode/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A blocking render (POST with wait) can poll for up to the MUAPI timeout, so
// give the route room. GET polls are quick.
export const maxDuration = 300;

/** The "not configured" message surfaced as a clear 400 on either verb. */
const NOT_CONFIGURED =
  'Seedance video is not configured. Add MUAPI_API_KEY (and optionally MUAPI_BASE_URL / MUAPI_SEEDANCE_MODEL) to enable clip rendering.';

/**
 * Download a provider-hosted clip and re-host it in our own Storage bucket so
 * the URL is stable, same-origin, and survives the provider expiring its temp
 * links. Returns the public URL. Throws on a failed fetch or upload.
 */
async function rehostVideo(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Could not download the rendered clip (${res.status})`);
  }
  const contentType = res.headers.get('content-type') || 'video/mp4';
  const buffer = Buffer.from(await res.arrayBuffer());
  return uploadVideoBuffer(buffer, contentType);
}

/** Coerce a finite number from the body, undefined when absent/invalid. */
function readNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Poll a Seedance render task. Admin-only.
 *
 * Query: ?taskId=... . Returns the normalized lifecycle state. Once the task
 * succeeds we download the provider clip and re-host it, returning our own
 * public `videoUrl` so the caller can stash it on the board and it never rots.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  if (!isSeedanceConfigured()) {
    return NextResponse.json({ ok: false, error: NOT_CONFIGURED }, { status: 400 });
  }

  const taskId = request.nextUrl.searchParams.get('taskId')?.trim();
  if (!taskId) {
    return NextResponse.json(
      { ok: false, error: 'A taskId is required' },
      { status: 400 },
    );
  }

  const result = await getSeedanceStatus(taskId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  const status = result.data;
  if (status.status === 'succeeded' && status.videoUrl) {
    try {
      const hosted = await rehostVideo(status.videoUrl);
      return NextResponse.json({
        ok: true,
        taskId,
        status: 'succeeded',
        videoUrl: hosted,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to host the clip';
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({
    ok: true,
    taskId,
    status: status.status,
    error: status.error,
  });
}

/**
 * Submit a Seedance image-to-video render. Admin-only.
 *
 * Body: { prompt, imageUrl, aspectRatio?, durationSec?, seed?, wait? }.
 *
 * - default (non-blocking): submit the task and return its taskId so the client
 *   polls GET ?taskId=... until it succeeds.
 * - wait: true (blocking): submit and poll here until the render finishes, then
 *   re-host the clip and return the hosted `videoUrl` in one round trip.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  if (!isSeedanceConfigured()) {
    return NextResponse.json({ ok: false, error: NOT_CONFIGURED }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Expected a JSON body' },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  if (!prompt) {
    return NextResponse.json(
      { ok: false, error: 'A prompt is required' },
      { status: 400 },
    );
  }
  if (!/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json(
      { ok: false, error: 'A public image URL is required to animate' },
      { status: 400 },
    );
  }

  const input: SeedanceRenderInput = {
    prompt,
    imageUrl,
    aspectRatio:
      typeof body.aspectRatio === 'string' ? body.aspectRatio : undefined,
    durationSec: readNumber(body.durationSec),
    seed: readNumber(body.seed),
  };

  try {
    // Blocking: render fully and hand back a hosted URL in one request.
    if (body.wait === true) {
      const rendered = await renderSeedanceClip(input);
      if (!rendered.ok) {
        return NextResponse.json(
          { ok: false, error: rendered.error },
          { status: rendered.status },
        );
      }
      // renderSeedanceClip only resolves ok once the clip exists, so data
      // already carries a final videoUrl; just re-host and return it.
      const hosted = await rehostVideo(rendered.data.videoUrl);
      return NextResponse.json({
        ok: true,
        taskId: rendered.data.taskId,
        status: 'succeeded',
        videoUrl: hosted,
      });
    }

    // Non-blocking: submit and let the client poll GET ?taskId=... .
    const submitted = await submitSeedanceRender(input);
    if (!submitted.ok) {
      return NextResponse.json(
        { ok: false, error: submitted.error },
        { status: submitted.status },
      );
    }
    return NextResponse.json({
      ok: true,
      taskId: submitted.data.taskId,
      status: 'pending',
    });
  } catch (err) {
    console.error('[mothermode/content/seedance] render failed', err);
    const msg = err instanceof Error ? err.message : 'Seedance render failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
