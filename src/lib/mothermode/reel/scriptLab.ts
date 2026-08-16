/**
 * Script Lab — variation scripts from the reel's OWN transcript.
 *
 * The reel's Whisper words (project.captions, per clip) are the grounding:
 * every variant the lab generates is a rewrite of what is ACTUALLY said, not
 * a hallucinated script about the topic. These helpers build that transcript
 * (and its hook) as pure functions so the panel and the tests share them.
 */
import type { ReelProject } from './types';

/**
 * The reel's full transcript: every clip's words joined, in timeline order.
 * Untranscribed clips contribute nothing (a reel with no captions at all
 * returns '' — the panel gates on that and offers Transcribe first).
 */
export function transcriptForProject(
  project: Pick<ReelProject, 'clips' | 'captions'>,
): string {
  const parts: string[] = [];
  for (const clip of project.clips) {
    const words = project.captions[clip.id] ?? [];
    const line = words
      .map((w) => w.word)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (line) parts.push(line);
  }
  return parts.join('\n').trim();
}

/**
 * The hook the transcript opens with — the first ~14 words. This is what the
 * hook variants rewrite (a hook is a beat, not the whole first sentence —
 * 14 words is about one spoken breath).
 */
export function transcriptHook(transcript: string): string {
  return transcript.split(/\s+/).filter(Boolean).slice(0, 14).join(' ');
}

/**
 * The tail of the transcript — the last ~14 words, where the CTA lives. The
 * CTA variants rewrite THIS (not the hook), so the ask stays in the reel's
 * own voice.
 */
export function transcriptCta(transcript: string): string {
  const words = transcript.split(/\s+/).filter(Boolean);
  return words.slice(Math.max(0, words.length - 14)).join(' ');
}

/** The grounding block every variant call shares (kept under the model's
 *  comfort zone — a long transcript trims to the first ~1800 chars, which is
 *  where the hook + the first beats live anyway). */
export function scriptLabGuides(transcript: string): string {
  return (
    "The reel's spoken transcript (ground EVERY variant in what is actually " +
    'said — keep the beats and the meaning, change the words; never invent ' +
    'new claims, numbers, or topics):\n' +
    transcript.slice(0, 1800)
  );
}

// ---------------------------------------------------------------------------
// Steering — the sophistication dial + free notes, appended to the guides.
// ---------------------------------------------------------------------------

/** How the variants should SOUND. 'sharp' is the house default (no line). */
export type Sophistication = 'everyday' | 'sharp' | 'expert';

export const SOPHISTICATION_LEVELS: {
  id: Sophistication;
  label: string;
  hint: string;
  /** The guide line appended to the prompt ('sharp' = none — the default). */
  guide: string;
}[] = [
  {
    id: 'everyday',
    label: 'Everyday',
    hint: 'plain words, short sentences',
    guide:
      'Write at a 6th-grade reading level: plain everyday words, short ' +
      'sentences, zero jargon — anyone scrolling half-asleep gets it.',
  },
  {
    id: 'sharp',
    label: 'Sharp',
    hint: 'conversational but precise (default)',
    guide: '',
  },
  {
    id: 'expert',
    label: 'Expert',
    hint: 'talks like a peer to peers',
    guide:
      'Write for an audience that already knows the space: use the ' +
      "industry's vocabulary precisely, skip the beginner explanations, " +
      'and let the nuance carry the credibility.',
  },
];

/**
 * The guides WITH steering: the transcript grounding + the sophistication
 * line + the owner's free notes ("make it punchier", "more personal",
 * "add a story beat"). Notes cap at 300 chars so they steer, not swamp.
 */
export function steeredGuides(
  transcript: string,
  opts: { sophistication?: Sophistication; notes?: string } = {},
): string {
  const parts = [scriptLabGuides(transcript)];
  const level = SOPHISTICATION_LEVELS.find((l) => l.id === opts.sophistication);
  if (level?.guide) parts.push(level.guide);
  const notes = (opts.notes ?? '').trim().slice(0, 300);
  if (notes) parts.push(`Direction from the creator (honor it in every variant): ${notes}`);
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Export — the script as a recordable artifact (.txt + the teleprompter).
// ---------------------------------------------------------------------------

/** The four sections the lab fills. */
export interface ScriptSections {
  full: string[];
  hooks: string[];
  body: string[];
  ctas: string[];
}

/**
 * The whole lab as ONE .txt download — the full scripts first (the recordable
 * ones), then the hook / body / CTA variants as reference. Plain text with
 * clear section markers so it reads clean in any editor or print dialog.
 */
export function scriptToText(sections: ScriptSections, theme: string): string {
  const out: string[] = [
    `SCRIPT LAB — ${theme || 'Untitled reel'}`,
    `exported ${new Date().toLocaleString()} — every variant grounded in the reel's transcript`,
    '',
  ];
  const section = (label: string, items: string[]) => {
    if (!items.length) return;
    out.push('='.repeat(48));
    out.push(label.toUpperCase());
    out.push('='.repeat(48));
    items.forEach((t, i) => {
      out.push('');
      out.push(`— ${label} ${i + 1} ${'—'.repeat(Math.max(2, 40 - label.length - String(i + 1).length))}`);
      out.push(t.trim());
    });
    out.push('');
  };
  section('Full script', sections.full);
  section('Hook', sections.hooks);
  section('Body', sections.body);
  section('CTA', sections.ctas);
  return out.join('\n').trim() + '\n';
}
