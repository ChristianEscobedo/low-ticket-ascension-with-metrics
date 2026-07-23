/**
 * Film Bible: the accumulating continuity object for the Reel Director. Every
 * creative decision a board locks (characters, wardrobe, locations, camera
 * rules, emotional beats) folds into one bible that later boards and shots read
 * back so the reel never resets its world. This module is pure and testable:
 * no network, no storage. The merge math unions by id and dedupes, so folding
 * the same board twice is idempotent.
 *
 * It upgrades today's per-board `lookbackSummary` string into a structured,
 * injection-ready continuity record. See SEEDANCE_VIDEO_PIPELINE_TASK.md.
 */
import type { ReelStory, StoryboardBoard } from './review';

/** A recurring on-screen character the reel must keep consistent. */
export interface ContinuityCharacter {
  /** Stable id used to union the same character across boards. */
  id: string;
  /** Display name / label ("the mother", "the toddler"). */
  name: string;
  /** Physical description held constant across clips. */
  description?: string;
  /** Wardrobe locked for continuity. */
  wardrobe?: string;
  /** Anything else that must not drift (age, hair, distinguishing marks). */
  notes?: string;
}

/** A recurring location/environment the reel must keep consistent. */
export interface ContinuityLocation {
  /** Stable id used to union the same location across boards. */
  id: string;
  /** Display name ("the kitchen", "the car at dawn"). */
  name: string;
  /** Environment description held constant across clips. */
  description?: string;
  /** Anything else that must not drift (time of day, props, weather). */
  notes?: string;
}

/**
 * The accumulating continuity object. `film` and `brand` are set once from the
 * story + brand bible; the arrays grow as boards are folded in.
 */
export interface FilmBible {
  film: { title: string; genre: string; aspectRatio: string; runtime: string };
  brand: { visualStyle: string; colorPalette: string; cameraLanguage: string };
  characters: ContinuityCharacter[];
  locations: ContinuityLocation[];
  cameraRules: string[];
  continuity: string[];
  /** e.g. ["Hook","Recognition","Release","Invitation"]. */
  emotionalArc: string[];
}

/** A partial continuity update folded into the bible (a board's decisions). */
export interface ContinuityDelta {
  characters?: ContinuityCharacter[];
  locations?: ContinuityLocation[];
  cameraRules?: string[];
  continuity?: string[];
  emotionalArc?: string[];
}

/** The seed a fresh bible starts from: brand + story facts. */
export interface FilmBibleSeed {
  title?: string;
  genre?: string;
  aspectRatio?: string;
  runtime?: string;
  visualStyle?: string;
  colorPalette?: string;
  cameraLanguage?: string;
  emotionalArc?: string[];
}

function cleanStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Append new strings to a list, dropping blanks and case-insensitive dupes. */
function appendUnique(base: string[], extra: string[] | undefined): string[] {
  const out = base.slice();
  const seen = new Set(out.map((s) => s.trim().toLowerCase()));
  for (const raw of extra ?? []) {
    const s = cleanStr(raw);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Union a list of id-keyed records: same id merges (delta wins non-empty). */
function unionById<T extends { id: string }>(base: T[], extra: T[] | undefined): T[] {
  const byId = new Map<string, T>();
  for (const item of base) {
    if (item && cleanStr(item.id)) byId.set(item.id, item);
  }
  for (const item of extra ?? []) {
    const id = cleanStr(item?.id);
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, item);
      continue;
    }
    // Merge: a non-empty field on the delta overrides the base.
    const merged: Record<string, unknown> = { ...prev };
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'string' ? v.trim() !== '' : v != null) merged[k] = v;
    }
    byId.set(id, merged as T);
  }
  return Array.from(byId.values());
}

/** Start a fresh Film Bible from the brand + story facts. */
export function emptyFilmBible(seed?: FilmBibleSeed): FilmBible {
  return {
    film: {
      title: cleanStr(seed?.title),
      genre: cleanStr(seed?.genre) || 'social short film',
      aspectRatio: cleanStr(seed?.aspectRatio) || '9:16',
      runtime: cleanStr(seed?.runtime),
    },
    brand: {
      visualStyle: cleanStr(seed?.visualStyle),
      colorPalette: cleanStr(seed?.colorPalette),
      cameraLanguage: cleanStr(seed?.cameraLanguage),
    },
    characters: [],
    locations: [],
    cameraRules: [],
    continuity: [],
    emotionalArc: appendUnique([], seed?.emotionalArc),
  };
}

/**
 * Fold a board's Continuity Object into the bible: union characters/locations
 * by id, append+dedupe rule/continuity/arc lines. Pure: returns a new bible and
 * never mutates the input. Idempotent for identical deltas.
 */
export function mergeContinuity(
  bible: FilmBible,
  delta: ContinuityDelta,
): FilmBible {
  return {
    film: { ...bible.film },
    brand: { ...bible.brand },
    characters: unionById(bible.characters, delta.characters),
    locations: unionById(bible.locations, delta.locations),
    cameraRules: appendUnique(bible.cameraRules, delta.cameraRules),
    continuity: appendUnique(bible.continuity, delta.continuity),
    emotionalArc: appendUnique(bible.emotionalArc, delta.emotionalArc),
  };
}

/**
 * Extract a continuity delta from a planned board. Today's boards carry a
 * `lookbackSummary` string and a `videoPrompt`; we lift those into structured
 * continuity + camera lines so the bible grows as boards are planned.
 */
export function continuityFromBoard(board: StoryboardBoard): ContinuityDelta {
  const continuity: string[] = [];
  const title = cleanStr(board.title);
  const lookback = cleanStr(board.lookbackSummary);
  if (lookback) {
    continuity.push(title ? `${title}: ${lookback}` : lookback);
  }
  const cameraRules: string[] = [];
  const videoPrompt = cleanStr(board.videoPrompt);
  if (videoPrompt) cameraRules.push(videoPrompt);
  return { continuity, cameraRules };
}

/** Seed a bible's emotional arc + film facts from a generated story. */
export function filmBibleFromStory(
  story: ReelStory,
  seed?: FilmBibleSeed,
): FilmBible {
  const arc = [
    ...(seed?.emotionalArc ?? []),
    ...story.chapters
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((c) => cleanStr(c.emotionalState))
      .filter(Boolean),
  ];
  return emptyFilmBible({
    ...seed,
    title: seed?.title || cleanStr(story.title),
    emotionalArc: arc,
  });
}

/**
 * Render the bible as a compact, injection-ready text block. Empty sections are
 * omitted so the block stays tight when the bible is still sparse.
 */
export function filmBibleToPromptBlock(bible: FilmBible): string {
  const lines: string[] = ['FILM BIBLE (continuity — keep all of this consistent):'];
  const f = bible.film;
  const filmBits = [
    f.title ? `title "${f.title}"` : '',
    f.genre ? `genre ${f.genre}` : '',
    f.aspectRatio ? `aspect ${f.aspectRatio}` : '',
    f.runtime ? `runtime ${f.runtime}` : '',
  ].filter(Boolean);
  if (filmBits.length) lines.push(`Film: ${filmBits.join(', ')}.`);

  const b = bible.brand;
  const brandBits = [
    b.visualStyle ? `visual style ${b.visualStyle}` : '',
    b.colorPalette ? `palette ${b.colorPalette}` : '',
    b.cameraLanguage ? `camera ${b.cameraLanguage}` : '',
  ].filter(Boolean);
  if (brandBits.length) lines.push(`Brand: ${brandBits.join(', ')}.`);

  if (bible.characters.length) {
    lines.push('Characters:');
    for (const c of bible.characters) {
      const bits = [c.description, c.wardrobe, c.notes].filter(Boolean).join('; ');
      lines.push(`- ${c.name || c.id}${bits ? `: ${bits}` : ''}`);
    }
  }
  if (bible.locations.length) {
    lines.push('Locations:');
    for (const l of bible.locations) {
      const bits = [l.description, l.notes].filter(Boolean).join('; ');
      lines.push(`- ${l.name || l.id}${bits ? `: ${bits}` : ''}`);
    }
  }
  if (bible.cameraRules.length) {
    lines.push('Camera rules:');
    for (const r of bible.cameraRules) lines.push(`- ${r}`);
  }
  if (bible.continuity.length) {
    lines.push('Continuity so far:');
    for (const c of bible.continuity) lines.push(`- ${c}`);
  }
  if (bible.emotionalArc.length) {
    lines.push(`Emotional arc: ${bible.emotionalArc.join(' -> ')}.`);
  }
  return lines.join('\n');
}
