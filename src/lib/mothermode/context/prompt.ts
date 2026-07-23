/**
 * Prompt-join helpers for context packs. Pure (no server imports) so the
 * generators, the API boundary, and the tests can all share one clamp policy.
 *
 * Two caps keep injected context from crowding out the actual brief:
 *   - PACK_CHAR_CAP:  max characters for any single pack's prompt body.
 *   - TOTAL_CHAR_CAP: max characters across every injected pack combined.
 * Clamping is deterministic (truncate on a word boundary, then add an ellipsis)
 * so tests can assert exact behavior.
 */
import type { ContextPack } from './types';
import { htmlToPromptText } from '../richtext';

export const PACK_CHAR_CAP = 1500;
export const TOTAL_CHAR_CAP = 6000;

/** Collapse whitespace and strip dashes so injected text stays voice-safe. */
export function tidy(text: string): string {
  return text
    .replace(/[–—]/g, ', ') // en/em dash -> comma (house style: no dashes)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Truncate to `cap` chars on a word boundary, appending an ellipsis if cut. */
function truncate(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const slice = text.slice(0, cap);
  const lastSpace = slice.lastIndexOf(' ');
  const body = lastSpace > cap * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${body.trimEnd()}…`;
}

/** Clamp a single pack's prompt body to PACK_CHAR_CAP. */
export function clampPack(pack: ContextPack): ContextPack {
  // Kit fields may be authored as rich HTML; flatten to readable text first so
  // no markup leaks into the model prompt.
  const prompt = truncate(tidy(htmlToPromptText(pack.prompt)), PACK_CHAR_CAP);
  return { ...pack, prompt };
}

/**
 * Clamp a list: each pack to PACK_CHAR_CAP, then drop packs once the running
 * total would exceed TOTAL_CHAR_CAP. Order is preserved; the last pack that
 * would overflow is truncated to fit rather than dropped when it is the first.
 */
export function clampPacks(packs: ContextPack[]): ContextPack[] {
  const out: ContextPack[] = [];
  let used = 0;
  for (const raw of packs) {
    const pack = clampPack(raw);
    const remaining = TOTAL_CHAR_CAP - used;
    if (remaining <= 0) break;
    if (pack.prompt.length <= remaining) {
      out.push(pack);
      used += pack.prompt.length;
    } else {
      out.push({ ...pack, prompt: truncate(pack.prompt, remaining) });
      used = TOTAL_CHAR_CAP;
      break;
    }
  }
  return out;
}

/**
 * Render packs into a single system-prompt block. Returns '' when there are no
 * packs so callers can inject unconditionally. `role` tailors the framing line:
 *   - 'kit':     the packs are owner assets the kit is being built AROUND.
 *   - 'content': the packs are resources the content should PROMOTE.
 */
export function contextPacksToPromptBlock(
  packs: ContextPack[],
  role: 'kit' | 'content',
): string {
  const clamped = clampPacks(packs);
  if (clamped.length === 0) return '';

  const intro =
    role === 'kit'
      ? 'OWNER CONTEXT (authoritative — build this kit AROUND these assets; keep names, prices, and promises consistent):'
      : 'PROMOTED RESOURCES (authoritative — this content should point the reader toward these; keep names, prices, and promises consistent):';

  const blocks = clamped.map(
    (p, i) => `### Context ${i + 1}: ${p.title}\n${p.prompt}`,
  );
  return [intro, '', ...blocks].join('\n');
}
