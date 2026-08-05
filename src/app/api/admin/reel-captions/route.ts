import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import type { ReelWord } from '@/lib/mothermode/reel/types';
import { isAssemblyAiConfigured, transcribeUrl } from '@/utils/integrations/assemblyai';
import { getOpenAiKey } from '@/utils/integrations/runtime-config';

export const maxDuration = 300;

/**
 * Word-timings for one clip — the karaoke captions layer.
 *
 * POST { url } → { success, words: ReelWord[], provider }
 *
 * DEFAULT pipeline: AssemblyAI (sharper word timings + punctuation + speaker
 * labels, and NO 25MB cap — AssemblyAI fetches the public clip URL itself).
 * When ASSEMBLYAI_API_KEY isn't set we fall back to OpenAI Whisper (word
 * granularity, 25MB cap). Either way the client stores the flat ReelWord[]
 * on the reel project (captions ride the same JSONB blob — no migration).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ success: false, error: 'A public clip URL is required.' }, { status: 400 });
  }

  // -- DEFAULT: AssemblyAI (no size cap, better timings) -----------------------
  if (isAssemblyAiConfigured()) {
    try {
      const words = await transcribeUrl(url);
      return NextResponse.json({ success: true, words, provider: 'assemblyai' });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'AssemblyAI failed' },
        { status: 500 },
      );
    }
  }

  // -- FALLBACK: OpenAI Whisper (25MB cap) --------------------------------------
  // Resolve through runtime-config, NOT process.env directly: admins can save
  // the OpenAI key at /admin/integrations and it lives in the `integrations`
  // table, not the environment. Reading env here made a dashboard-configured
  // key invisible and returned a bogus "no key" 503.
  const apiKey = (await getOpenAiKey())?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          'No transcription key. Add an OpenAI key at /admin/integrations, or set ASSEMBLYAI_API_KEY (recommended — no 25MB cap) in your environment.',
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch the clip (${res.status})`);
    const blob = await res.blob();
    if (blob.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: `Clip is ${(blob.size / 1048576).toFixed(0)}MB — Whisper caps at 25MB (AssemblyAI has no cap; set ASSEMBLYAI_API_KEY). Split the scene first (S), then transcribe the parts.`,
        },
        { status: 413 },
      );
    }

    const form = new FormData();
    form.append('file', blob, 'clip.mp4');
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const json = await whisperRes.json().catch(() => null);
    if (!whisperRes.ok) {
      throw new Error(
        (json && (json.error?.message as string)) || `Whisper failed (${whisperRes.status})`,
      );
    }

    const rawWords = Array.isArray(json?.words) ? (json.words as unknown[]) : [];
    const words: ReelWord[] = rawWords
      .map((w) => {
        const o = w && typeof w === 'object' ? (w as Record<string, unknown>) : {};
        const word = typeof o.word === 'string' ? o.word.trim() : '';
        const start = typeof o.start === 'number' ? o.start : 0;
        const end = typeof o.end === 'number' ? o.end : start;
        if (!word || end < start) return null;
        return { word: word.slice(0, 60), start, end };
      })
      .filter((w): w is ReelWord => !!w);

    return NextResponse.json({ success: true, words, provider: 'whisper' });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Transcription failed' },
      { status: 500 },
    );
  }
}
