/**
 * Shared "context bridge" abstraction for the MotherMode content suite.
 *
 * A single normalized, prompt-ready ContextPack that any entity (a front-end
 * offer, an offer's bonus stack, or one of the three admin kits) can emit, plus
 * a cheap ContextRef pointer that is stored on an intake or a content batch and
 * resolved into a pack only at generation time.
 *
 * This lets every generator in the suite accept "0..N extra context packs"
 * without special-casing each pairing:
 *   - Offers/bonuses -> Kits   (build a kit AROUND an owner asset)
 *   - Kits/offers    -> Content (write content that PROMOTES a resource)
 *
 * Types only. Adapters (fromOffer / fromKits), the server-only resolver
 * (resolve.ts), and the prompt-join helper (prompt.ts) live beside this file.
 */

export type ContextSourceKind =
  | 'offer' // whole front-end offer
  | 'offer-bonuses' // just the bonus stack of a front-end offer
  | 'community-kit'
  | 'high-ticket-kit'
  | 'lead-gen-kit'
  | 'email-kit'
  | 'link' // an ad-hoc URL the copy should point at (inline value)
  | 'text'; // free-form notes pasted in by the owner (inline value)

/** The set, for defensive normalization at the JSONB / request boundary. */
export const CONTEXT_SOURCE_KINDS: ContextSourceKind[] = [
  'offer',
  'offer-bonuses',
  'community-kit',
  'high-ticket-kit',
  'lead-gen-kit',
  'email-kit',
  'link',
  'text',
];

/**
 * Kinds whose content is carried INLINE on the ref (`value`) rather than fetched
 * from a store at resolve time. These need no picker lookup and are the same on
 * the client and server.
 */
export const INLINE_CONTEXT_KINDS: ContextSourceKind[] = ['link', 'text'];

/** True when a kind stores its content inline on the ref (link / text). */
export function isInlineContextKind(kind: ContextSourceKind): boolean {
  return INLINE_CONTEXT_KINDS.includes(kind);
}

/**
 * A concrete, selectable source surfaced to the editor so the UI can show the
 * real name of each offer / kit instead of asking for a raw slug or id. Built
 * server-side (the offer catalog + kit stores) and passed to the client picker.
 */
export interface ContextSourceOption {
  kind: ContextSourceKind;
  /** offer slug or kit id. */
  id: string;
  /** Human name shown in the dropdown. */
  label: string;
  /** Optional one-line hint (price, audience, status). */
  hint?: string;
}


/**
 * A saved pointer to a context source. Cheap to store on an intake or a content
 * batch; resolved to a ContextPack only at generation time so injected facts
 * always reflect the live source of truth (and cannot be spoofed by the client).
 */
export interface ContextRef {
  kind: ContextSourceKind;
  /**
   * offer slug, or kit id/slug depending on kind. For inline kinds (link/text)
   * this is a synthetic id and the real content lives in `value`.
   */
  id: string;
  /** Optional label cached for display so the UI need not re-fetch. */
  label?: string;
  /** Inline payload for link (the URL) and text (the pasted notes) kinds. */
  value?: string;
}


/**
 * A resolved, prompt-ready block. `title` + `summary` are for the UI; `prompt`
 * is what actually goes into the system prompt (already compact + voice-safe).
 */
export interface ContextPack {
  kind: ContextSourceKind;
  id: string;
  title: string;
  /** One-line human summary for chips/cards. */
  summary: string;
  /** The authoritative text injected into the generator. Plain text, no HTML. */
  prompt: string;
}

/** True when a value is a usable ContextSourceKind. */
export function isContextSourceKind(v: unknown): v is ContextSourceKind {
  return typeof v === 'string' && (CONTEXT_SOURCE_KINDS as string[]).includes(v);
}

/**
 * Coerce arbitrary JSON (a persisted intake field or a request body) into a
 * clean ContextRef[]. Drops anything malformed rather than throwing so
 * generation never fails on bad stored data.
 */
export function normalizeContextRefs(value: unknown): ContextRef[] {
  if (!Array.isArray(value)) return [];
  const out: ContextRef[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const kind = rec.kind;
    if (!isContextSourceKind(kind)) continue;

    const id = typeof rec.id === 'string' ? rec.id.trim() : '';
    const val = typeof rec.value === 'string' ? rec.value.trim() : '';

    if (isInlineContextKind(kind)) {
      // Inline kinds (link/text) are keyed by their pasted value; drop if empty.
      if (!val) continue;
      const ref: ContextRef = { kind, id: id || val, value: val };
      if (typeof rec.label === 'string' && rec.label.trim()) {
        ref.label = rec.label.trim();
      }
      out.push(ref);
      continue;
    }

    // Store-backed kinds need a real pointer.
    if (!id) continue;
    const ref: ContextRef = { kind, id };
    if (typeof rec.label === 'string' && rec.label.trim()) {
      ref.label = rec.label.trim();
    }
    out.push(ref);
  }
  return out;

}
