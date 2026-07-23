import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  generateSpeechWithTimestamps,
  isElevenLabsConfigured,
  listVoices,
} from '@/utils/integrations/elevenlabs';
import { uploadAudioBuffer } from '@/utils/mothermode/storage';
import {
  alignmentDurationSec,
  beatMarksFromAlignment,
  buildCombinedVoText,
  type VoBeatInput,
} from '@/lib/mothermode/content/voiceover';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** The "not configured" message we surface as a clear 400 on either verb. */
const NOT_CONFIGURED =
  'ElevenLabs is not configured. Add ELEVENLABS_API_KEY (and a default ELEVENLABS_VOICE_ID) to enable voiceover generation.';

/** Round a number of seconds to the millisecond for stable JSON. */
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Coerce a request body's beats into clean `{ index, text }[]`. */
function readBeats(raw: unknown): VoBeatInput[] {
  if (!Array.isArray(raw)) return [];
  const out: VoBeatInput[] = [];
  raw.forEach((b, i) => {
    const o = (b ?? {}) as Record<string, unknown>;
    const index = typeof o.index === 'number' ? o.index : i;
    const text = typeof o.text === 'string' ? o.text : '';
    out.push({ index, text });
  });
  return out;
}

/** Read an optional 0..1 number from the body, undefined when absent/invalid. */
function readUnit(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * List the account's ElevenLabs voices for the picker. Returns a clear 400 when
 * the integration is unconfigured so the UI can fall back to a manual voice-ID
 * field. Admin-only.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { ok: false, error: NOT_CONFIGURED },
      { status: 400 },
    );
  }

  try {
    const voices = await listVoices();
    return NextResponse.json({ ok: true, voices });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load voices';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * Generate ElevenLabs voiceover for a video script. Admin-only.
 *
 * Body: { mode: 'combined'|'sections', beats: {index, text}[], voiceId?,
 * modelId?, stability?, similarityBoost?, style? }.
 *
 * - combined: join every beat into one track, generate once with timestamps,
 *   upload the mp3, and return the hosted URL, total duration, and per-beat time
 *   marks resolved from the character alignment.
 * - sections: generate one clip per beat, upload each, and return
 *   [{ index, url, durationSec }] so the caller can stash each on its beat.
 *
 * Both paths use the with-timestamps endpoint so durations/marks are reliable.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { ok: false, error: NOT_CONFIGURED },
      { status: 400 },
    );
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

  const mode = body.mode === 'sections' ? 'sections' : 'combined';
  const beats = readBeats(body.beats).filter((b) => b.text.trim() !== '');
  if (beats.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No voiceover text to synthesize' },
      { status: 400 },
    );
  }

  const voiceId = typeof body.voiceId === 'string' ? body.voiceId : undefined;
  const modelId = typeof body.modelId === 'string' ? body.modelId : undefined;
  const opts = {
    voiceId,
    modelId,
    stability: readUnit(body.stability),
    similarityBoost: readUnit(body.similarityBoost),
    style: readUnit(body.style),
  };

  try {
    if (mode === 'sections') {
      // One clip per beat: the alignment's last end time is each clip's exact
      // spoken length, which the UI shows against the beat's planned window.
      const clips: Array<{ index: number; url: string; durationSec: number }> =
        [];
      for (const beat of beats) {
        const speech = await generateSpeechWithTimestamps(beat.text, opts);
        const buf = Buffer.from(speech.audioBase64, 'base64');
        const url = await uploadAudioBuffer(buf, speech.mimeType);
        clips.push({
          index: beat.index,
          url,
          durationSec: round(alignmentDurationSec(speech.alignment)),
        });
      }
      return NextResponse.json({
        ok: true,
        mode,
        clips,
        voiceId,
        model: modelId,
        generatedAt: new Date().toISOString(),
      });
    }

    // Combined: concatenate every beat, generate once, then map each beat's
    // recorded character offset back to seconds via the alignment.
    const { text, offsets } = buildCombinedVoText(beats);
    const speech = await generateSpeechWithTimestamps(text, opts);
    const buf = Buffer.from(speech.audioBase64, 'base64');
    const url = await uploadAudioBuffer(buf, speech.mimeType);
    const rawMarks = beatMarksFromAlignment(offsets, speech.alignment);
    // Re-attach the caller's real beat indices (offsets are positional).
    const beatMarks = rawMarks.map((m, i) => ({
      index: beats[i]?.index ?? m.index,
      startSec: m.startSec,
      endSec: m.endSec,
    }));

    return NextResponse.json({
      ok: true,
      mode,
      audioUrl: url,
      durationSec: round(alignmentDurationSec(speech.alignment)),
      beatMarks,
      voiceId,
      model: modelId,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[mothermode/content/voiceover] generation failed', err);
    const msg = err instanceof Error ? err.message : 'Voiceover generation failed';
    // ElevenLabs-config problems read as bad input; everything else is a 500.
    const status = /not configured|no elevenlabs voice/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
