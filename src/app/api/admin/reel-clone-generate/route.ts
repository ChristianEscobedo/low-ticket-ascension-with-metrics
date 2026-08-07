import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { getReelProject } from '@/lib/mothermode/reel/store';
import {
  beatLineForTts,
  normalizeClonePlan,
  resolveBeatVoiceParams,
} from '@/lib/mothermode/reel/clone';
import {
  CLONE_ASPECT_RATIO,
  CLONE_AVATAR_MODEL,
  CLONE_SEEDANCE_MODELS,
  cloneAvatarPrompt,
  cloneBrollPrompt,
  cloneGenStep,
  cloneGenerationBlockers,
  cloneRefImagesFor,
} from '@/lib/mothermode/reel/cloneGenerate';
import {
  generateSpeechWithTimestamps,
  isElevenLabsConfigured,
} from '@/utils/integrations/elevenlabs';
import { isSeedanceConfigured, renderSeedanceClip } from '@/utils/integrations/muapi-seedance';
import { isMuapiAvatarConfigured, renderMuapiAvatar } from '@/utils/integrations/muapi';
import { extractFrameBuffer } from '@/utils/integrations/ffmpeg-worker';
import {
  uploadAudioBuffer,
  uploadImageDataUrl,
  uploadVideoBuffer,
} from '@/utils/mothermode/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A beat renders voice then video with provider polls — give the route room.
export const maxDuration = 300;

/**
 * AI Clone — per-beat generation (wizard step 5). Admin-only.
 *
 * POST { projectId, beatId }
 *
 * One call renders ONE beat end to end and returns the patch the client
 * saves onto the manifest:
 *   voice — any beat with a spoken line → ElevenLabs with THAT beat's voice
 *           programming → hosted mp3 (status 'voiced').
 *   video — avatar beats: muapi OmniHuman-class talking head (@1 + audio);
 *           b-roll beats: Seedance with the @reference images riding
 *           (status 'generated').
 *
 * THE GATE: the plan must be storyboard-approved and still clean
 * (cloneGenerationBlockers) — nothing spends without the stamp. Provider
 * clips are re-hosted to our storage before the URL ever lands on the
 * manifest (muapi URLs expire).
 */

/** Download a provider clip and re-host it in our own bucket. */
async function rehostVideo(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Could not download the rendered clip (${res.status})`);
  const contentType = res.headers.get('content-type') || 'video/mp4';
  const buffer = Buffer.from(await res.arrayBuffer());
  return uploadVideoBuffer(buffer, contentType, 'clone-beats');
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const beatId = typeof body.beatId === 'string' ? body.beatId.trim() : '';
  if (!projectId || !beatId) {
    return NextResponse.json(
      { ok: false, error: 'projectId and beatId are required' },
      { status: 400 },
    );
  }

  const project = await getReelProject(projectId);
  if (!project) return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });

  const plan = normalizeClonePlan(project.clonePlan ?? null);
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: 'This reel has no clone plan — build the clone first.' },
      { status: 400 },
    );
  }
  const beat = plan.beats.find((b) => b.id === beatId);
  if (!beat) {
    return NextResponse.json({ ok: false, error: 'Beat not found' }, { status: 404 });
  }

  // THE GATE — the storyboard stamp is the spend check.
  const blockers = cloneGenerationBlockers(plan);
  if (blockers.length) {
    return NextResponse.json({ ok: false, error: blockers.join(' ') }, { status: 409 });
  }

  const step = cloneGenStep(beat);
  if (step === 'done') {
    return NextResponse.json({
      ok: true,
      patch: { status: 'generated' as const, audioUrl: beat.audioUrl, videoUrl: beat.videoUrl },
      alreadyDone: true,
    });
  }

  // -- voice (ElevenLabs, per-beat programming) --------------------------------
  if (step === 'voice') {
    if (!isElevenLabsConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'ELEVENLABS_API_KEY is not configured.' },
        { status: 503 },
      );
    }
    try {
      const params = resolveBeatVoiceParams(plan.clone.voice, beat.voice);
      const speech = await generateSpeechWithTimestamps(beatLineForTts(beat.line, beat.voice), {
        voiceId: plan.clone.voice.voiceId,
        stability: params.stability,
        similarityBoost: params.similarityBoost,
        style: params.style,
      });
      const url = await uploadAudioBuffer(
        Buffer.from(speech.audioBase64, 'base64'),
        'audio/mpeg',
        'clone-voice',
      );
      return NextResponse.json({
        ok: true,
        patch: { status: 'voiced' as const, audioUrl: url },
      });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          patch: {
            status: 'failed' as const,
            error: err instanceof Error ? err.message.slice(0, 300) : 'Voice generation failed',
          },
        },
        { status: 502 },
      );
    }
  }

  // -- video (muapi avatar | Seedance b-roll) ----------------------------------
  if (!isMuapiAvatarConfigured() || !isSeedanceConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'MUAPI_API_KEY is not configured.' },
      { status: 503 },
    );
  }
  if (beat.kind === 'avatar' && !beat.audioUrl) {
    return NextResponse.json(
      { ok: false, error: 'An avatar beat needs its voice first.' },
      { status: 409 },
    );
  }
  const slots = cloneRefImagesFor(beat, plan.clone);
  const primary = slots[0];
  if (!primary) {
    return NextResponse.json(
      { ok: false, error: 'No @reference 1 — forge the character sheet first.' },
      { status: 409 },
    );
  }

  try {
    if (beat.kind === 'avatar') {
      const rendered = await renderMuapiAvatar({
        imageUrl: primary,
        audioUrl: beat.audioUrl ?? '',
        prompt: cloneAvatarPrompt(beat, plan.clone),
        durationSec: beat.durationSec,
        model: process.env.MUAPI_AVATAR_MODEL?.trim() || CLONE_AVATAR_MODEL,
      });
      if (!rendered.ok) {
        return NextResponse.json(
          {
            ok: false,
            patch: { status: 'failed' as const, error: rendered.error.slice(0, 300) },
          },
          { status: rendered.status },
        );
      }
      const hosted = await rehostVideo(rendered.data.videoUrl);
      return NextResponse.json({
        ok: true,
        patch: {
          status: 'generated' as const,
          videoUrl: hosted,
          videoRequestId: rendered.data.taskId,
        },
      });
    }

    // b-roll — Seedance with the @reference images INSIDE the footage.
    // Look-back: a continuing beat starts from the PREVIOUS beat's last frame
    // (image-to-video continuity) when we can grab it — the clone refs still
    // ride as omni-references either way.
    let startFrame = primary;
    if (beat.continuesFrom) {
      const prev = plan.beats.find((x) => x.videoUrl === beat.continuesFrom);
      try {
        const atSec = Math.max(0.1, (prev?.durationSec ?? beat.durationSec) - 0.1);
        const frame = await extractFrameBuffer({ url: beat.continuesFrom, atSec });
        startFrame = await uploadImageDataUrl(
          `data:image/jpeg;base64,${frame.toString('base64')}`,
        );
      } catch {
        /* no frame — @1 stays the start frame */
      }
    }
    const tier = beat.seedanceTier ?? plan.seedanceTier;
    const rendered = await renderSeedanceClip({
      prompt: cloneBrollPrompt(beat, plan.clone),
      imageUrl: startFrame,
      aspectRatio: CLONE_ASPECT_RATIO,
      durationSec: beat.durationSec,
      model:
        tier === 'seedance-2.5'
          ? process.env.MUAPI_SEEDANCE_25_MODEL?.trim() || CLONE_SEEDANCE_MODELS['seedance-2.5']
          : process.env.MUAPI_SEEDANCE_MODEL?.trim() || CLONE_SEEDANCE_MODELS['seedance-2.0'],
      referenceImages: slots,
    });
    if (!rendered.ok) {
      return NextResponse.json(
        {
          ok: false,
          patch: { status: 'failed' as const, error: rendered.error.slice(0, 300) },
        },
        { status: rendered.status },
      );
    }
    const hosted = await rehostVideo(rendered.data.videoUrl);
    return NextResponse.json({
      ok: true,
      patch: {
        status: 'generated' as const,
        videoUrl: hosted,
        videoRequestId: rendered.data.taskId,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        patch: {
          status: 'failed' as const,
          error: err instanceof Error ? err.message.slice(0, 300) : 'Video generation failed',
        },
      },
      { status: 502 },
    );
  }
}
