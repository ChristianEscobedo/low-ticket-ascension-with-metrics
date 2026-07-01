/**
 * Pure assembly helpers for the Version Composer. They turn picked hooks,
 * bodies, and CTAs into whole post versions: the cartesian product, a stable
 * signature for de-duplication, and the plain-text render. Client-safe and
 * side-effect free, so they are unit tested apart from the React tray.
 */

/** One assembled post version: one hook, one body (paragraphs), one CTA, and an
 *  optional hosted image URL that overrides the piece's default visual. */
export interface VersionParts {
  hook: string;
  body: string[];
  cta: string;
  /** Hosted (public) image URL for this version, when imagery is an axis. */
  image?: string;
}

/**
 * How the image axis combines with the text axes. `multiply` makes images a true
 * fourth axis (every text version against every image). `pair` keeps the text
 * count and cycles one image per version, so counts stay tame near the cap.
 */
export type AxisMode = 'multiply' | 'pair';

/** Split a pooled body string into paragraphs on blank lines. */
export function splitParas(s: string): string[] {
  return (s ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** The full version as one copy-pasteable block, blank line between parts. */
export function versionText(v: VersionParts): string {
  return [v.hook, v.body.join('\n\n'), v.cta].filter(Boolean).join('\n\n');
}

/** A stable signature for a version, used to skip duplicate combinations. The
 *  image (when present) joins the signature so the same copy with two different
 *  visuals counts as two versions; text-only signatures are unchanged. */
export function versionSignature(v: VersionParts): string {
  return v.image ? `${versionText(v)}\n@img:${v.image}` : versionText(v);
}

/**
 * An axis with nothing picked falls back to its original value, so the math and
 * the build always have at least one of each part. An empty fallback (no
 * original) yields an empty axis, which collapses the whole count to zero.
 */
export function withFallback<T>(picked: T[], fallback: T[]): T[] {
  return picked.length ? picked : fallback;
}

/**
 * How many versions a given set of axes will produce. With no images it is the
 * three text axes multiplied. With images, `multiply` adds them as a fourth axis
 * while `pair` keeps the text count (one cycled image per version).
 */
export function versionCount(
  hooks: unknown[],
  bodies: unknown[],
  ctas: unknown[],
  images: unknown[] = [],
  mode: AxisMode = 'multiply',
): number {
  const text = hooks.length * bodies.length * ctas.length;
  if (images.length === 0) return text;
  return mode === 'pair' ? text : text * images.length;
}

/**
 * Every combination across the axes, in a stable nested order. Without images it
 * is hook x body x cta. In `multiply` mode each text combo is repeated once per
 * image; in `pair` mode one image is cycled across the text combos.
 */
export function cartesian(
  hooks: string[],
  bodies: string[][],
  ctas: string[],
  images: string[] = [],
  mode: AxisMode = 'multiply',
): VersionParts[] {
  const base: VersionParts[] = [];
  for (const hook of hooks)
    for (const body of bodies)
      for (const cta of ctas) base.push({ hook, body, cta });
  if (images.length === 0) return base;
  if (mode === 'pair')
    return base.map((v, i) => ({ ...v, image: images[i % images.length] }));
  const out: VersionParts[] = [];
  for (const v of base)
    for (const image of images) out.push({ ...v, image });
  return out;
}

/**
 * Build the new versions for these axes, skipping any whose signature already
 * exists, so re-running the build never adds a duplicate already in the tray.
 */
export function buildVersions(
  hooks: string[],
  bodies: string[][],
  ctas: string[],
  existing: VersionParts[] = [],
  images: string[] = [],
  mode: AxisMode = 'multiply',
): VersionParts[] {
  const seen = new Set(existing.map(versionSignature));
  const made: VersionParts[] = [];
  for (const v of cartesian(hooks, bodies, ctas, images, mode)) {
    const sig = versionSignature(v);
    if (seen.has(sig)) continue;
    seen.add(sig);
    made.push(v);
  }
  return made;
}

/** Split a paragraph into sentences on terminal punctuation, whitespace
 *  collapsed. A run with no terminator stays one sentence. */
export function splitSentences(text: string): string[] {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return out ? out.map((s) => s.trim()).filter(Boolean) : [t];
}

/**
 * Reflow body paragraphs so no block runs longer than `maxSentences` sentences,
 * keeping reading digestible. Each original paragraph is chunked in order, so a
 * four-sentence paragraph becomes two two-sentence blocks. Empty paragraphs drop.
 */
export function readableParagraphs(
  body: string[],
  maxSentences = 2,
): string[] {
  const out: string[] = [];
  for (const para of body ?? []) {
    const sentences = splitSentences(para);
    for (let i = 0; i < sentences.length; i += maxSentences) {
      out.push(sentences.slice(i, i + maxSentences).join(' '));
    }
  }
  return out;
}

/** Whether a version's part matches the original or was rewritten. */
export type PartChange = 'changed' | 'kept';

/** Per-part comparison of a built version against the source piece's parts. */
export interface VersionDiff {
  hook: PartChange;
  body: PartChange;
  cta: PartChange;
}

/** Normalize copy for comparison: whitespace collapsed, case-folded, trimmed. */
function normalize(s: string): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Compare a version to the original parts, flagging which axes were rewritten,
 *  so the UI can highlight exactly what each variation changed. */
export function diffVersion(
  original: VersionParts,
  version: VersionParts,
): VersionDiff {
  const cmp = (a: string, b: string): PartChange =>
    normalize(a) === normalize(b) ? 'kept' : 'changed';
  return {
    hook: cmp(original.hook, version.hook),
    body: cmp(original.body.join('\n\n'), version.body.join('\n\n')),
    cta: cmp(original.cta, version.cta),
  };
}
