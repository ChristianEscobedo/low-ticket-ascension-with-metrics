import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { BASE_PROMPTS, type ContentType } from '@/utils/courses/content-prompts';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface GenerateContentRequest {
  lessonId: string;
  contentType: ContentType;
  customPrompt?: string;
  model?: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * POST: Generate HTML content for a lesson from its transcription.
 * Persists to lesson_generated_content (versioned, latest is is_active=true).
 * Admin-only. Requires GEMINI_API_KEY.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY not configured' },
        { status: 501 }
      );
    }

    const body = (await request.json()) as GenerateContentRequest;
    const { lessonId, contentType, customPrompt, model } = body;

    if (!lessonId || !contentType) {
      return NextResponse.json(
        { success: false, error: 'lessonId and contentType are required' },
        { status: 400 }
      );
    }

    if (contentType === 'course_lesson') {
      return NextResponse.json(
        {
          success: false,
          error: 'course_lesson content type is not implemented in this build'
        },
        { status: 501 }
      );
    }

    const { data: trans } = await (supabase as any)
      .from('lesson_transcriptions')
      .select('full_text, status')
      .eq('lesson_id', lessonId)
      .single();

    if (!trans || trans.status !== 'completed' || !trans.full_text) {
      return NextResponse.json(
        {
          success: false,
          error: 'No completed transcription for this lesson. Transcribe the video first.'
        },
        { status: 400 }
      );
    }

    let systemPrompt: string;
    let userPrompt: string;
    let maxTokens = 4096;

    if (contentType === 'custom') {
      if (!customPrompt) {
        return NextResponse.json(
          { success: false, error: 'customPrompt is required for content_type=custom' },
          { status: 400 }
        );
      }
      systemPrompt =
        'You are an expert course content creator. Output rich inline-styled HTML for a dark theme. No markdown, no code fences.';
      userPrompt = `${customPrompt}\n\nTRANSCRIPT:\n${trans.full_text}`;
    } else {
      const tpl = BASE_PROMPTS[contentType];
      systemPrompt = tpl.system;
      userPrompt = tpl.user.replace('{transcript}', trans.full_text);
      if (tpl.maxTokens) maxTokens = tpl.maxTokens;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model || DEFAULT_MODEL,
      contents: userPrompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        systemInstruction: systemPrompt
      }
    });
    const generated = (response.text || '')
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    if (!generated) {
      return NextResponse.json(
        { success: false, error: 'Generation returned empty content' },
        { status: 500 }
      );
    }

    const { data: existing } = await (supabase as any)
      .from('lesson_generated_content')
      .select('version')
      .eq('lesson_id', lessonId)
      .eq('content_type', contentType)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion =
      ((existing as { version: number }[] | null)?.[0]?.version ?? 0) + 1;

    await (supabase as any)
      .from('lesson_generated_content')
      .update({ is_active: false })
      .eq('lesson_id', lessonId)
      .eq('content_type', contentType);

    const { data: inserted, error: insertError } = await (supabase as any)
      .from('lesson_generated_content')
      .insert({
        lesson_id: lessonId,
        content_type: contentType,
        content: generated,
        prompt_used: contentType === 'custom' ? customPrompt : null,
        model_used: model || DEFAULT_MODEL,
        version: nextVersion,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('[generate-content] Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save generated content' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, content: inserted });
  } catch (error) {
    console.error('[generate-content] Error:', error);
    const msg = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * GET: Fetch active generated content for a lesson. Optional ?contentType filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get('lessonId');
  const contentType = searchParams.get('contentType');
  if (!lessonId) {
    return NextResponse.json(
      { success: false, error: 'lessonId is required' },
      { status: 400 }
    );
  }
  let query = (supabase as any)
    .from('lesson_generated_content')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (contentType) query = query.eq('content_type', contentType);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, content: data ?? [] });
}
