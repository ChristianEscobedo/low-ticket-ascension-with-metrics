/**
 * Pure adapter: BrandBible -> ContextPack.
 *
 * Turns an admin-editable Brand Bible into a compact, prompt-ready block that
 * the Reel Director / Seedance engine injects as a context source. No I/O, no
 * store access — deterministic and unit-testable. The Supabase-backed store +
 * `resolve.ts` case fetch the record; this file only shapes it.
 */
import type { ContextPack } from './types';
import type { BrandBible } from '@/lib/mothermode/brandbible/types';

/** One-line summary for chips/cards. */
function summarize(bible: BrandBible): string {
  const bits = [bible.emotion, bible.colorLanguage].filter(Boolean) as string[];
  const tail = bits.length ? ` — ${bits.join('; ')}` : '';
  return `Brand Bible: ${bible.name}${tail}`;
}

/** Build the authoritative, plain-text prompt block (no HTML). */
function toPrompt(bible: BrandBible): string {
  const lines: string[] = [`BRAND BIBLE — ${bible.name}`];
  if (bible.visualDirection) lines.push(`Visual direction: ${bible.visualDirection}`);
  if (bible.colorLanguage) lines.push(`Color language: ${bible.colorLanguage}`);
  if (bible.emotion) lines.push(`Emotion to evoke: ${bible.emotion}`);
  if (bible.camera) lines.push(`Camera grammar: ${bible.camera}`);
  if (bible.negatives && bible.negatives.length) {
    lines.push(`Never: ${bible.negatives.join(', ')}`);
  }
  lines.push(
    'Apply this identity to every storyboard frame and rendered clip without ' +
      'overriding the creative brief.',
  );
  return lines.join('\n');
}

/** Adapt a Brand Bible record into a prompt-ready ContextPack. */
export function fromBrandBible(bible: BrandBible): ContextPack {
  return {
    kind: 'brand-bible',
    id: bible.id,
    title: bible.name,
    summary: summarize(bible),
    prompt: toPrompt(bible),
  };
}
