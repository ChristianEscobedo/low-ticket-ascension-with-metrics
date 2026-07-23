/**
 * Brand Bible — the admin-editable "visual identity" record that reskins the
 * entire Reel Director / Seedance cinematic pipeline without touching the
 * engine. A Brand Bible is a specialized, store-backed context source: swapping
 * the selected bible changes color language, camera grammar, emotional tone and
 * the negative prompt for every generated storyboard + clip.
 *
 * Types + defensive normalization only. The pure prompt adapter lives at
 * `context/fromBrandBible.ts`; the Supabase-backed store + admin editor wire on
 * top of this shape.
 */

export interface BrandBible {
  /** Stable id (uuid) used as the ContextRef pointer. */
  id: string;
  /** Human name shown in the picker (e.g. "MotherMode — Warm Documentary"). */
  name: string;
  /**
   * Optional owning scope so the same engine can serve MotherMode / Omega /
   * Mass by filtering the list. Free-form; empty means "global".
   */
  scope?: string;
  /** Overall look: film stock, era, lighting, grade, texture. */
  visualDirection?: string;
  /** Palette + how color is used emotionally (e.g. "amber highs, teal shadows"). */
  colorLanguage?: string;
  /** The feeling every frame should evoke (e.g. "quiet, earned confidence"). */
  emotion?: string;
  /** Camera grammar: lenses, movement, framing, pacing. */
  camera?: string;
  /** Hard "never do this" list, joined into the Seedance negative prompt. */
  negatives?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/** A trimmed string or undefined when empty. */
function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

/** Coerce arbitrary JSON into a clean string[] (trims, drops empties, dedupes). */
export function normalizeNegatives(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]/)
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = typeof item === 'string' ? item.trim() : '';
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Coerce arbitrary JSON (a persisted row or a request body) into a clean
 * BrandBible. Returns null when there is no usable id + name, so callers can
 * drop malformed rows rather than throwing.
 */
export function normalizeBrandBible(value: unknown): BrandBible | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  const id = str(rec.id);
  const name = str(rec.name);
  if (!id || !name) return null;
  const bible: BrandBible = { id, name };
  const scope = str(rec.scope);
  if (scope) bible.scope = scope;
  const visualDirection = str(rec.visualDirection);
  if (visualDirection) bible.visualDirection = visualDirection;
  const colorLanguage = str(rec.colorLanguage);
  if (colorLanguage) bible.colorLanguage = colorLanguage;
  const emotion = str(rec.emotion);
  if (emotion) bible.emotion = emotion;
  const camera = str(rec.camera);
  if (camera) bible.camera = camera;
  const negatives = normalizeNegatives(rec.negatives);
  if (negatives.length) bible.negatives = negatives;
  const createdAt = str(rec.createdAt);
  if (createdAt) bible.createdAt = createdAt;
  const updatedAt = str(rec.updatedAt);
  if (updatedAt) bible.updatedAt = updatedAt;
  return bible;
}
