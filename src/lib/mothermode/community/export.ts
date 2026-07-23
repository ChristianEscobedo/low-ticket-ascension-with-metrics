/**
 * Pure text/markdown renderers for a CommunityKit.
 *
 * Used by the admin editor to (a) copy an individual section to the clipboard
 * and (b) build a full document that a print window turns into a PDF. Kept pure
 * and DOM-free so it can be unit tested and reused server-side later.
 */
import type {
  CommunityKit,
  CommunityType,
  KitSection,
  QualifyingQuestion,
} from './types';
import { htmlToPromptText } from '../richtext';

/** Human labels for each section (also used by the wizard + section cards). */
export const SECTION_LABELS: Record<KitSection, string> = {
  names: 'Name options',
  description: 'Public description',
  qualifyingQuestions: 'Qualifying questions',
  dmScript: 'DM script',
  salesCall: 'Sales-call script',
  ad: 'Ad concept',
  leadForm: 'Lead form (Facebook / Meta)',
  pinnedPost: 'First pinned post',
};

/** One-line description per section for the wizard. */
export const SECTION_HINTS: Record<KitSection, string> = {
  names: '5 name options and your chosen pick',
  description: 'The public-facing community description',
  qualifyingQuestions: 'Exactly 3 join questions per audience',
  dmScript: 'Welcome, qualify, invite, and re-engage DMs',
  salesCall: 'A full phase-by-phase call script',
  ad: 'Ad angle, primary text, headline, description, image prompt',
  leadForm: 'Paste-ready Meta lead-form copy',
  pinnedPost: "The community's first pinned post",
};

/** Which sections apply to a given community type (sales call is paid-only). */
export function sectionsForType(type: CommunityType): KitSection[] {
  return (Object.keys(SECTION_LABELS) as KitSection[]).filter((s) =>
    s === 'salesCall' ? type !== 'free' : true,
  );
}

function renderQuestion(q: QualifyingQuestion, i: number): string {
  const lines = [`${i + 1}. ${q.prompt} (${q.type}${q.required ? ', required' : ''})`];
  if (q.type === 'multiple_choice' && q.options?.length) {
    for (const opt of q.options) lines.push(`   - ${opt}`);
  }
  return lines.join('\n');
}

/** Render a single section to a labeled markdown block. Returns '' if empty. */
export function sectionToText(
  kit: CommunityKit,
  section: KitSection,
  type: CommunityType,
): string {
  const heading = `## ${SECTION_LABELS[section]}`;
  switch (section) {
    case 'names': {
      if (!kit.chosenName && kit.nameOptions.length === 0) return '';
      const opts = kit.nameOptions.map((o) => `- ${o}`).join('\n');
      return `${heading}\n\nChosen: ${kit.chosenName}\n\nOptions:\n${opts}`;
    }
    case 'description':
      return kit.description
        ? `${heading}\n\n${htmlToPromptText(kit.description)}`
        : '';
    case 'qualifyingQuestions': {
      const audiences: Array<'paid' | 'free'> =
        type === 'both' ? ['paid', 'free'] : [type];
      const blocks = audiences
        .map((aud) => {
          const qs = kit.qualifyingQuestions[aud];
          if (!qs.length) return '';
          return `### ${aud} group\n${qs.map(renderQuestion).join('\n')}`;
        })
        .filter(Boolean);
      return blocks.length ? `${heading}\n\n${blocks.join('\n\n')}` : '';
    }
    case 'dmScript': {
      if (!kit.dmScript.stages.length) return '';
      const body = kit.dmScript.stages
        .map((s) => `### ${s.label || s.key}\n${htmlToPromptText(s.message)}`)
        .join('\n\n');
      return `${heading}\n\n${body}`;
    }
    case 'salesCall': {
      if (type === 'free' || !kit.salesCallScript.phases.length) return '';
      const body = kit.salesCallScript.phases
        .map(
          (p) =>
            `### ${p.label || p.key}\n${p.lines.map(htmlToPromptText).join('\n')}`,
        )
        .join('\n\n');
      return `${heading}\n\n${body}`;
    }
    case 'ad': {
      const a = kit.ad;
      if (!a.concept && !a.primaryText && !a.headline) return '';
      return [
        heading,
        '',
        `Concept: ${a.concept}`,
        '',
        `Primary text:\n${htmlToPromptText(a.primaryText)}`,
        '',
        `Headline: ${a.headline}`,
        `Description: ${htmlToPromptText(a.description)}`,
        '',
        `Image prompt:\n${a.imagePrompt}`,
      ].join('\n');
    }
    case 'leadForm': {
      const f = kit.leadForm;
      if (!f.headline && !f.description) return '';
      const qs = f.questions.filter(Boolean);
      return [
        heading,
        '',
        `Intro headline: ${f.headline}`,
        `Intro description:\n${htmlToPromptText(f.description)}`,
        qs.length ? `\nPre-qualify questions:\n${qs.map((q) => `- ${q}`).join('\n')}` : '',
        `\nCompletion headline: ${f.completionHeadline}`,
        `Completion description:\n${htmlToPromptText(f.completionDescription)}`,
        `Button: ${f.callToAction}`,
        `Group URL: ${f.groupUrl}`,
      ]
        .filter((l) => l !== '')
        .join('\n');
    }
    case 'pinnedPost':
      return kit.pinnedPost
        ? `${heading}\n\n${htmlToPromptText(kit.pinnedPost)}`
        : '';
    default:
      return '';
  }
}

/** Render the entire kit to a single markdown document. */
export function kitToText(
  kit: CommunityKit,
  type: CommunityType,
  title?: string,
): string {
  const parts = sectionsForType(type)
    .map((s) => sectionToText(kit, s, type))
    .filter(Boolean);
  const header = `# ${title || kit.chosenName || 'Community Launch Kit'}`;
  return [header, ...parts].join('\n\n');
}

/** Convert the markdown-ish document to minimal printable HTML for a PDF. */
export function kitToPrintableHtml(
  kit: CommunityKit,
  type: CommunityType,
  title?: string,
): string {
  const text = kitToText(kit, type, title);
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = text
    .split('\n')
    .map((line) => {
      if (line.startsWith('### ')) return `<h3>${esc(line.slice(4))}</h3>`;
      if (line.startsWith('## ')) return `<h2>${esc(line.slice(3))}</h2>`;
      if (line.startsWith('# ')) return `<h1>${esc(line.slice(2))}</h1>`;
      if (line.startsWith('- ')) return `<li>${esc(line.slice(2))}</li>`;
      if (line.trim() === '') return '<br/>';
      return `<p>${esc(line)}</p>`;
    })
    .join('\n');
  const docTitle = esc(title || kit.chosenName || 'Community Launch Kit');
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${docTitle}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; max-width: 720px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  h1 { font-size: 24px; border-bottom: 2px solid #b08d57; padding-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 28px; color: #7a5c2e; }
  h3 { font-size: 15px; margin-top: 18px; color: #444; }
  p { margin: 4px 0; white-space: pre-wrap; }
  li { margin-left: 20px; }
</style></head><body>${body}</body></html>`;
}
