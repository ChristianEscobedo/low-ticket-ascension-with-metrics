// Prompt templates used by /api/courses/generate-content. Ported verbatim
// (less the formatting embellishments that were trimmed for brevity) from
// the storyflow-canvas-enhanced reference so generated HTML matches the
// dark-theme renderer in the course player.

export type ContentType =
  | 'description'
  | 'sop'
  | 'key_points'
  | 'quiz'
  | 'summary'
  | 'longform'
  | 'custom'
  | 'course_lesson';

export interface PromptTemplate {
  system: string;
  user: string;
  maxTokens?: number;
}

export const BASE_PROMPTS: Record<
  Exclude<ContentType, 'custom' | 'course_lesson'>,
  PromptTemplate
> = {
  description: {
    system: `You are an elite course content creator who writes compelling, high-converting educational content using rich inline-styled HTML for a dark theme.`,
    user: `Transform this video transcript into a powerful, SHORT lesson description that hooks readers and makes them excited to learn.

REQUIREMENTS:
- Keep it SHORT: 2-3 paragraphs maximum
- Paragraph 1: Hook the reader with a bold opening — why this matters NOW
- Paragraph 2: The core concepts and techniques they'll master
- Paragraph 3: The transformation — what they'll be able to DO after this

USE THESE INLINE HTML STYLES (dark theme, NO CSS classes):
- Wrap in: <div style="background: #0d1117; border: 1px solid #30363d; border-radius: 12px; padding: 1.5rem; margin: 1rem 0;">
- Opening hook: <p style="font-size: 1.1rem; line-height: 1.8; color: #f0f6fc; margin: 0 0 1rem 0;"><strong style="color: #f59e0b;">[Hook]</strong> text</p>
- Body paragraphs: <p style="line-height: 1.8; color: #c9d1d9; margin: 0 0 1rem 0;">text</p>
- Bold terms: <strong style="color: #f0f6fc;">term</strong>

TRANSCRIPT:
{transcript}`,
    maxTokens: 2048
  },
  sop: {
    system: `You are a world-class systems architect who creates bulletproof Standard Operating Procedures using rich inline-styled HTML for a dark theme. Make it COMPREHENSIVE and LONG.`,
    user: `Create a comprehensive, detailed SOP from this transcript that someone could follow step-by-step to get results. Use numbered steps, pro-tip boxes, warning boxes, prerequisites lists, comparison tables when relevant, and a success/expected-result box at the end. Use ONLY inline styles on a dark theme (#0d1117 backgrounds, #c9d1d9 body text, #f59e0b accent for tips, #f85149 for warnings, #7ee787 for success). Wrap in a top-level div. Make it long and thorough.

TRANSCRIPT:
{transcript}`,
    maxTokens: 8192
  },
  key_points: {
    system: `You are an expert at distilling complex information into powerful, memorable insights using rich inline-styled HTML for a dark theme.`,
    user: `Extract the 5-8 most valuable, actionable insights from this transcript. Each insight = a card with a 1.5rem emoji icon (use different icons per card: 💡🎯⚡🔑✨🚀💰🎓), a bold title in #f0f6fc, and a short explanation in #c9d1d9. Wrap the whole list in a div with a gradient header titled "🎯 Key Takeaways" using linear-gradient(135deg, #10b981 0%, #06b6d4 100%). Use ONLY inline styles, NO CSS classes.

TRANSCRIPT:
{transcript}`,
    maxTokens: 2048
  },
  quiz: {
    system: `You are a master instructional designer who creates visually rich assessments using inline-styled HTML for a dark theme.`,
    user: `Create 7-10 thought-provoking multiple-choice questions testing application (not memorization) of this transcript. Each question card: dark #0d1117 background, #30363d border, purple #8b5cf6 accent for "Q1." prefix, 4 plausible options (A-D), and a green answer-reveal box (#7ee787 accent) with an explanation that teaches. End with a "🏆 Quiz Complete" card. Use ONLY inline styles.

TRANSCRIPT:
{transcript}`,
    maxTokens: 6144
  },
  summary: {
    system: `You are an executive communications specialist who distills complex content into powerful summaries using inline-styled HTML for a dark theme.`,
    user: `Write a SHORT executive summary (2-3 paragraphs MAX) of this transcript. Lead with the single most important insight. Open with a "The Bottom Line:" box using linear-gradient(135deg, #f59e0b 0%, #ef4444 100%). Body paragraphs in #c9d1d9. Wrap in #0d1117 dark card. Use ONLY inline styles.

TRANSCRIPT:
{transcript}`,
    maxTokens: 1536
  },
  longform: {
    system: `You are a senior course content strategist who creates comprehensive, publication-ready educational material using rich inline-styled HTML for a dark theme. Make it LONG and detailed.`,
    user: `Create a long, comprehensive professional document from this transcript with ALL of these sections: (1) Executive Summary in a #f59e0b→#ef4444 gradient header card. (2) About This Lesson info box. (3) Key Takeaways — 5-10 insight cards with emoji icons. (4) Step-by-Step Guide — numbered ordered list with pro-tip and warning callouts. (5) Comparison Table if relevant. (6) Resources & Links box with real URLs. (7) Next Steps success box (#7ee787 border). All dark theme #0d1117 backgrounds, #c9d1d9 body, ONLY inline styles, NO CSS classes.

TRANSCRIPT:
{transcript}`,
    maxTokens: 8192
  }
};
