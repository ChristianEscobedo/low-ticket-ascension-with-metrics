import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { ingestHookClip, syncHookToVault } from '@/lib/mothermode/reel/hookBank';
import {
  buildHookReactionPrompt,
  hookReactionPreset,
} from '@/lib/mothermode/reel/hookReactions';
import { CLONE_SEEDANCE_MODELS } from '@/lib/mothermode/reel/cloneGenerate';
import { isSeedanceConfigured, renderSeedanceClip } from '@/utils/integrations/muapi-seedance';
import { uploadVideoBuffer } from '@/utils/mothermode/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A Seedance render + rehost can run past a minute — give the route room.
export const maxDuration = 300;

/**
 * Hook Bank phase 3 — the AI reaction sheet. Admin-only.
 *
 * POST { sheetUrl, preset, note? }
 *
 * A hook sheet = a character sheet (the twin's @image1) + a reaction preset.
 * This renders a silent 1-2s reaction clip of the SAME character through
 * Seedance (no voice, no storyboard gate — a hook is a visual beat, not
 * talking content), rehosts it to our storage (provider URLs expire), and
 * ingests it into the bank as source='generated' with rights='owned' (your
 * twin, your likeness) and the preset's reaction. The vault mirror rides the
 * normal ingest path, so a generated hook reaches the studio's reaction rail
 * like any other.
 */

/** Download the provider clip and re-host it in our own bucket. */
async function rehostVideo(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Could not download the rendered clip (${res.status})`);
  const contentType = res.headers.get('content-type') || 'video/mp4';
  const buffer = Buffer.from(await res.arrayBuffer());
  return uploadVideoBuffer(buffer, contentType, 'hook-generated');
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const sheetUrl = typeof body.sheetUrl === 'string' ? body.sheetUrl.trim() : '';
  const presetId = typeof body.preset === 'string' ? body.preset.trim() : '';
  const note = typeof body.note === 'string' ? body.note : undefined;

  if (!/^https?:\/\//i.test(sheetUrl)) {
    return NextResponse.json(
      { success: false, error: 'A character sheet image URL is required (sheetUrl).' },
      { status: 400 },
    );
  }
  const preset = hookReactionPreset(presetId);
  if (!preset) {
    return NextResponse.json(
      { success: false, error: `Unknown reaction preset: ${presetId}` },
      { status: 400 },
    );
  }
  if (!isSeedanceConfigured()) {
    return NextResponse.json(
      { success: false, error: 'MUAPI_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  try {
    const rendered = await renderSeedanceClip({
      prompt: buildHookReactionPrompt({ preset, note }),
      imageUrl: sheetUrl,
      aspectRatio: '9:16',
      // The provider floor is ~5s; the preset's 2s target is the intent, and
      // the studio trim tightens to the punch. Render at the floor.
      durationSec: Math.max(5, preset.durationSec),
      model: process.env.MUAPI_SEEDANCE_MODEL?.trim() || CLONE_SEEDANCE_MODELS['seedance-2.0'],
      referenceImages: [sheetUrl],
    });
    if (!rendered.ok) {
      return NextResponse.json(
        { success: false, error: rendered.error.slice(0, 300) },
        { status: rendered.status },
      );
    }

    const hosted = await rehostVideo(rendered.data.videoUrl);

    const hook = await ingestHookClip({
      name: `${preset.label} reaction`,
      url: hosted,
      source: 'generated',
      reaction: preset.reaction,
      rights: 'owned', // your twin, your likeness — always paid-safe
      sheetRef: sheetUrl,
      durationSec: Math.max(5, preset.durationSec),
      tags: ['generated', preset.id, preset.reaction],
      notes: note ?? null,
    });
    if (!hook) {
      return NextResponse.json(
        { success: false, error: 'The clip rendered but did not save — is the hook_bank migration applied?' },
        { status: 500 },
      );
    }
    // Mirror into the clipping vault so the studio's reaction rail picks it up.
    await syncHookToVault(hook);

    return NextResponse.json({ success: true, hook });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message.slice(0, 300) : 'Generation failed' },
      { status: 502 },
    );
  }
}
