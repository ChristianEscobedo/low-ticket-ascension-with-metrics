import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

export const maxDuration = 60;

interface Body {
  type: 'course' | 'lesson';
  title?: string;
  existingDescription?: string;
  transcriptText?: string;
  lessonTitles?: string[];
}

/**
 * POST: Generate a short course/lesson description from supplied context.
 * Returns plain text suitable for the admin form description field.
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

    const body = (await request.json()) as Body;
    const { type, title, existingDescription, transcriptText, lessonTitles } = body;

    if (!type || !['course', 'lesson'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "course" or "lesson"' },
        { status: 400 }
      );
    }

    let contextInfo = '';
    if (title) contextInfo += `Title: ${title}\n`;
    if (existingDescription)
      contextInfo += `Current description: ${existingDescription}\n`;
    if (lessonTitles?.length)
      contextInfo += `Lessons: ${lessonTitles.join(', ')}\n`;
    if (transcriptText) {
      const truncated = transcriptText.slice(0, 3000);
      contextInfo += `Transcript excerpt: ${truncated}${transcriptText.length > 3000 ? '...' : ''}\n`;
    }

    if (!contextInfo.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'No context provided. Add a title, transcript, or lesson titles first.'
        },
        { status: 400 }
      );
    }

    const prompt =
      type === 'course'
        ? `You are an expert course creator. Write a compelling, concise course description (2-3 sentences, max 200 characters) based on this context:

${contextInfo}

Requirements:
- Be specific about what students will learn
- Use active, engaging language
- Focus on outcomes and benefits
- Do NOT use generic phrases like "comprehensive guide" or "everything you need"
- Do NOT include the course title in the description
- Output ONLY the description text, nothing else`
        : `You are an expert course creator. Write a brief, engaging lesson description (1-2 sentences, max 150 characters) based on this context:

${contextInfo}

Requirements:
- Describe what this specific lesson covers
- Be concise and specific
- Focus on the key takeaway or skill
- Do NOT repeat the lesson title
- Output ONLY the description text, nothing else`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.7, maxOutputTokens: 512 }
    });
    const description = (response.text || '').trim();

    if (!description) {
      return NextResponse.json(
        { success: false, error: 'Generation returned empty content' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, description });
  } catch (error) {
    console.error('[generate-description] Error:', error);
    const msg = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
