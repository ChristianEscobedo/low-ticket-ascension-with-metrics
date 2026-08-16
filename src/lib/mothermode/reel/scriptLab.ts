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
