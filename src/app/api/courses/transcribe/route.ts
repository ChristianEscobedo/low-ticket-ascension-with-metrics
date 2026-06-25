import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

export const runtime = 'nodejs';
export const maxDuration = 300;

const WHISPER_MAX_SIZE = 25 * 1024 * 1024;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

async function transcribeWithAssemblyAI(
  videoUrl: string,
  apiKey: string
): Promise<{ text: string; segments: TranscriptSegment[]; duration: number }> {
  const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: videoUrl, auto_chapters: false })
  });
  if (!submitRes.ok) {
    throw new Error(`AssemblyAI submit failed: ${await submitRes.text()}`);
  }
  const { id: transcriptId } = await submitRes.json();

  let transcript: any = null;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { Authorization: apiKey } }
    );
    transcript = await pollRes.json();
    if (transcript?.status === 'completed') break;
    if (transcript?.status === 'error')
      throw new Error(`AssemblyAI error: ${transcript.error}`);
  }
  if (transcript?.status !== 'completed')
    throw new Error('AssemblyAI transcription timed out');

  const segments: TranscriptSegment[] = [];
  let cur: { startMs: number; endMs: number; text: string } | null = null;
  const SEGMENT_DURATION = 5000;
  for (const w of (transcript.words ?? []) as Array<{
    start: number;
    end: number;
    text: string;
  }>) {
    if (!cur || w.start - cur.startMs > SEGMENT_DURATION) {
      if (cur)
        segments.push({
          start: cur.startMs / 1000,
          end: cur.endMs / 1000,
          text: cur.text
        });
      cur = { startMs: w.start, endMs: w.end, text: w.text };
    } else {
      cur.endMs = w.end;
      cur.text += ' ' + w.text;
    }
  }
  if (cur)
    segments.push({
      start: cur.startMs / 1000,
      end: cur.endMs / 1000,
      text: cur.text
    });

  return {
    text: transcript.text || '',
    segments,
    duration: transcript.audio_duration || 0
  };
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { lessonId, videoUrl } = (await request.json()) as {
      lessonId?: string;
      videoUrl?: string;
    };
    if (!lessonId || !videoUrl) {
      return NextResponse.json(
        { success: false, error: 'lessonId and videoUrl are required' },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const assemblyKey = process.env.ASSEMBLYAI_API_KEY;
    if (!openaiKey && !assemblyKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No transcription provider configured (OPENAI_API_KEY or ASSEMBLYAI_API_KEY)'
        },
        { status: 501 }
      );
    }

    await (supabase as any).from('lesson_transcriptions').upsert(
      {
        lesson_id: lessonId,
        full_text: '',
        segments: [],
        status: 'processing'
      },
      { onConflict: 'lesson_id' }
    );

    let videoSizeBytes = 0;
    try {
      const head = await fetch(videoUrl, { method: 'HEAD' });
      if (head.ok) {
        const cl = head.headers.get('content-length');
        if (cl) videoSizeBytes = parseInt(cl, 10);
      }
    } catch {
      // ignore – we'll discover size on download
    }

    let fullText = '';
    let segments: TranscriptSegment[] = [];
    let language = 'en';
    let duration = 0;
    let model = 'whisper-1';

    const useAssembly =
      videoSizeBytes > WHISPER_MAX_SIZE || !openaiKey;

    if (useAssembly) {
      if (!assemblyKey) {
        await (supabase as any)
          .from('lesson_transcriptions')
          .update({
            status: 'failed',
            error_message: 'Video > 25MB and ASSEMBLYAI_API_KEY not set'
          })
          .eq('lesson_id', lessonId);
        return NextResponse.json(
          {
            success: false,
            error: 'Video exceeds 25MB; configure ASSEMBLYAI_API_KEY for large files.'
          },
          { status: 501 }
        );
      }
      const r = await transcribeWithAssemblyAI(videoUrl, assemblyKey);
      fullText = r.text;
      segments = r.segments;
      duration = r.duration;
      model = 'assemblyai';
    } else {
      const dl = await fetch(videoUrl);
      if (!dl.ok)
        throw new Error(`Failed to download video: ${dl.status}`);
      const buf = await dl.arrayBuffer();
      videoSizeBytes = buf.byteLength;

      if (videoSizeBytes > WHISPER_MAX_SIZE && assemblyKey) {
        const r = await transcribeWithAssemblyAI(videoUrl, assemblyKey);
        fullText = r.text;
        segments = r.segments;
        duration = r.duration;
        model = 'assemblyai';
      } else {
        const fd = new FormData();
        fd.append('file', new Blob([buf], { type: 'video/mp4' }), 'video.mp4');
        fd.append('model', 'whisper-1');
        fd.append('response_format', 'verbose_json');
        fd.append('timestamp_granularities[]', 'segment');

        const wr = await fetch(
          'https://api.openai.com/v1/audio/transcriptions',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${openaiKey}` },
            body: fd
          }
        );
        if (!wr.ok) throw new Error(`Whisper API error: ${wr.status}`);
        const wd = (await wr.json()) as {
          text: string;
          segments?: Array<{ start: number; end: number; text: string }>;
          language?: string;
          duration?: number;
        };
        fullText = wd.text;
        segments = (wd.segments ?? []).map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text.trim()
        }));
        language = wd.language || 'en';
        duration = wd.duration || 0;
      }
    }

    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const { error: dbError } = await (supabase as any)
      .from('lesson_transcriptions')
      .upsert(
        {
          lesson_id: lessonId,
          full_text: fullText,
          segments,
          language,
          duration_seconds: duration,
          word_count: wordCount,
          status: 'completed',
          transcription_model: model,
          error_message: null
        },
        { onConflict: 'lesson_id' }
      );
    if (dbError) {
      console.error('[transcribe] DB error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to save transcription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transcription: {
        lessonId,
        fullText,
        segments,
        language,
        duration,
        wordCount,
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('[transcribe] Error:', error);
    const msg = error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get('lessonId');
  if (!lessonId) {
    return NextResponse.json(
      { success: false, error: 'lessonId is required' },
      { status: 400 }
    );
  }
  const { data, error } = await (supabase as any)
    .from('lesson_transcriptions')
    .select('*')
    .eq('lesson_id', lessonId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ success: true, transcription: null });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transcription' },
      { status: 500 }
    );
  }
  return NextResponse.json({
    success: true,
    transcription: {
      lessonId: data.lesson_id,
      fullText: data.full_text,
      segments: data.segments,
      language: data.language,
      duration: data.duration_seconds,
      wordCount: data.word_count,
      status: data.status,
      error: data.error_message
    }
  });
}
