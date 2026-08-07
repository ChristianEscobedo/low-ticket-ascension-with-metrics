import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  cloneVoiceFromAudio,
  isElevenLabsConfigured,
} from '@/utils/integrations/elevenlabs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * AI Twins — record-your-voice → ElevenLabs Instant Voice Clone. Admin-only.
 *
 * POST { audioUrl, name } — the audio is a hosted clip from the browser
 * recorder (uploaded via the signed-URL flow). We fetch it, hand it to
 * ElevenLabs /v1/voices/add, and return the new voice id so the twin form
 * fills its voice field with YOUR voice.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'ElevenLabs is not configured (ELEVENLABS_API_KEY).' },
      { status: 501 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!/^https?:\/\//i.test(audioUrl)) {
    return NextResponse.json(
      { ok: false, error: 'audioUrl must be a hosted http(s) URL' },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
  }

  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`Could not load the recording (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 4000) throw new Error('The recording is too short — give it a full read.');
    // Video uploads (a clip of you talking) are welcome — ElevenLabs IVC
    // extracts the audio track from common containers (mp4/mov/webm).
    if (buf.byteLength > 60 * 1024 * 1024) throw new Error('The file is too large (60MB max).');
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg';
    const fileName = audioUrl.split('/').pop()?.split('?')[0] || 'sample.mp3';
    const voiceId = await cloneVoiceFromAudio({ name, audio: buf, mime, fileName });
    return NextResponse.json({ ok: true, voiceId, voiceName: name });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Voice clone failed' },
      { status: 502 },
    );
  }
}
