/**
 * Adapters for the two "inline" context kinds — link and text — whose content
 * lives directly on the ref (`value`) instead of being fetched from a store.
 *
 * Pure: no network, no server imports. The resolver calls these with the ref as
 * it was saved; empty payloads yield null so they drop out of the prompt.
 */
import type { ContextPack, ContextRef } from './types';

/** An ad-hoc URL the copy should point the reader toward. */
export function fromLink(ref: ContextRef): ContextPack | null {
  const url = (ref.value ?? '').trim();
  if (!url) return null;
  const label = (ref.label ?? '').trim() || 'Reference link';
  const lines = [
    `${label}.`,
    `Point the reader toward this URL (use it verbatim for links/CTAs): ${url}`,
  ];
  return {
    kind: 'link',
    id: ref.id || url,
    title: label,
    summary: url,
    prompt: lines.join(' '),
  };
}

/** Free-form notes the owner pasted in (positioning, facts, do/don't). */
export function fromText(ref: ContextRef): ContextPack | null {
  const body = (ref.value ?? '').trim();
  if (!body) return null;
  const label = (ref.label ?? '').trim() || 'Reference notes';
  return {
    kind: 'text',
    id: ref.id || label,
    title: label,
    summary: body.length > 120 ? `${body.slice(0, 117)}…` : body,
    prompt: body,
  };
}
