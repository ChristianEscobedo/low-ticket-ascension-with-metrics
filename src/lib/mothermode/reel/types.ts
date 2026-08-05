/**
 * Reel Studio domain types + pure row mappers.
 *
 * A Reel Studio project is a light editing timeline: an ordered list of
 * source clips (Seedance renders, uploads, any hosted MP4) with per-clip
 * trim, plus an optional audio track laid over the cut at an offset. The
 * compose backend (fal ffmpeg-api/compose, see fal-ffmpeg.ts) lays clips end
 * to end and supports per-keyframe output duration — so v1 trim semantics
 * are TRIM-END ONLY (cut the tail). The model keeps the honest shape:
 * `durationSec` is the source runtime, `trimEndSec` is cut from the end.
 *
 * The whole project rides one JSONB column so the timeline can grow
 * (transitions, trim-start when fal supports in-points) without migrations.
 * Mappers are pure and defensive, house style.
 */

// The caption preset registry. This is a VALUE import, while captions.ts imports
// only TYPES from this file (`import type { CaptionPreset, ReelWord }`) — type
// imports are erased, so there is no runtime cycle.
import { captionDefFor } from './captions';

// ---------------------------------------------------------------------------
// Clips + audio
// ---------------------------------------------------------------------------

export interface ReelClip {
  /** Stable id for reorder/trim operations. */
  id: string;
  /** Human label shown on the timeline card. */
  name: string;
  /** Public http(s) URL of the source clip. */
  url: string;
  /** Source runtime in seconds (client-probed on add, or known for renders). */
  durationSec: number;
  /** Seconds cut from the END of the clip. 0 = full clip. */
  trimEndSec: number;
  /**
   * R25: seconds cut from the START (the in-point). Client-side and instant —
   * this is what makes split + left-edge drag feel like a real editor instead
   * of a server round-trip. Compose materializes it via the ffmpeg worker.
   */
  trimStartSec?: number;
  /** R15 Motion Lab: keyframed scale/pan/rotate (preset-expanded). Omit = static. */
  motion?: import('./motion').MotionKey[];
}

/** R25: an overlay (b-roll) clip laid ON TOP of the main track at a timeline offset. */
export interface ReelOverlayClip extends ReelClip {
  /** Timeline seconds where the overlay starts (it plays over the main track). */
  offsetSec: number;
}

/** Optional audio bed (voiceover / music) laid over the composed cut. */
export interface ReelAudioTrack {
  /** Public http(s) URL of the audio file. */
  url: string;
  /** Human label (e.g. "ElevenLabs VO — Loni"). */
  name: string;
  /** Seconds into the reel where the audio starts. 0 = from the top. */
  offsetSec: number;
  /** Audio runtime when known; null = let it span the whole reel. */
  durationSec: number | null;
}

/** One spoken word with its timing inside a clip (Whisper word granularity). */
export interface ReelWord {
  word: string;
  start: number;
  end: number;
}

/**
 * R3 caption presets — the on-stage caption layer's look (rides the project JSON).
 *
 * This is a preset *id*, not a closed union, because the gallery in captions.ts is
 * the registry and it grows. It used to be the union
 * `'karaoke' | 'beast' | 'hormozi' | 'minimal'` with a matching four-item
 * whitelist below, and that combination silently destroyed every other preset —
 * see normalizeCaptionPreset.
 */
export type CaptionPreset = string;

/**
 * Defensive: unknown/missing values fall back to the default karaoke look.
 *
 * THE BUG THIS FIXES
 * ------------------
 * This used to validate against a hardcoded four-id set:
 *
 *   new Set(['karaoke', 'beast', 'hormozi', 'minimal'])
 *
 * `CAPTION_STYLE_DEFS` has **41** presets. So 38 of them — every Hormozi
 * variant, every creator look, every modern animation (`hormozi3`, `devin`,
 * `neon-pulse`, `bounce-box`, …) — failed the check and were rewritten to
 * `'karaoke'`.
 *
 * That ran on both sides of the caption pipeline:
 *   - `projectToJson` → so picking a preset SAVED 'karaoke' to the database;
 *   - `normalizeProjectJson`, which `/api/admin/reel-render` runs over the
 *     posted project → so the RenderPlan got 'karaoke' too.
 *
 * The studio stage never called it — it renders `captionDefFor(project.captionStyle)`
 * off live state — so the preview showed the preset you picked while the export
 * showed karaoke, every single time, on every reel. That is the "render keeps
 * using the same style even though the preview changed" report, and it was NOT
 * the caption layer: the layer faithfully drew the style it was handed.
 *
 * The fix is to stop maintaining a second, hand-written list of preset ids. The
 * registry in captions.ts is the only list; anything in it (or reachable through
 * its legacy-id aliases) round-trips unchanged. The import is type-only in the
 * other direction, so this does not create a runtime cycle.
 */
export function normalizeCaptionPreset(raw: unknown): CaptionPreset {
  if (typeof raw !== 'string' || !raw) return 'karaoke';
  // captionDefFor resolves real ids AND legacy aliases, and falls back to
  // karaoke. Comparing its result's id to karaoke tells us whether `raw` was
  // actually recognized, without duplicating the id list here.
  const resolved = captionDefFor(raw);
  return resolved.id === 'karaoke' && raw !== 'karaoke' ? 'karaoke' : raw;
}

export interface ReelProject {
  id: string;
  name: string;
  clips: ReelClip[];
  audio: ReelAudioTrack | null;
  /** Last successful composed output. */
  composedUrl: string;
  composedAt: string | null;
  /** Per-clip word timings for the karaoke captions layer (clipId → words). */
  captions: Record<string, ReelWord[]>;
  /** R3: which caption preset the karaoke layer renders with. */
  captionStyle: CaptionPreset;
  /** R17c: per-reel caption customizer overrides (position/size/colors). */
  captionOverrides?: import('./captions').CaptionOverrides;
  /** R25: overlay (b-roll) layers on top of the main track. */
  overlays?: ReelOverlayClip[];
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}


/** Raw DB row shape (snake_case). */
export interface ReelProjectRow {
  id: string;
  name: string | null;
  project: unknown;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

// ---------------------------------------------------------------------------
// Normalizers (pure, never throw)
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

/** Simple, dependency-free stable id generator for clips. */
export function makeClipId(): string {
  return `clip-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeReelClip(raw: unknown): ReelClip | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const url = asString(o.url).trim();
  if (!isHttpUrl(url)) return null;
  const durationSec = Math.max(0, asNumber(o.durationSec, 0));
  if (durationSec <= 0) return null;
  const motion = Array.isArray(o.motion)
    ? o.motion
        .map((k) => {
          const m = k && typeof k === 'object' ? (k as Record<string, unknown>) : {};
          return {
            t: Math.max(0, asNumber(m.t, 0)),
            scale: Math.max(0.2, Math.min(4, asNumber(m.scale, 1))),
            panX: Math.max(-50, Math.min(50, asNumber(m.panX, 0))),
            panY: Math.max(-50, Math.min(50, asNumber(m.panY, 0))),
            rotateDeg: Math.max(-45, Math.min(45, asNumber(m.rotateDeg, 0))),
          };
        })
        .slice(0, 40)
    : undefined;
  return {
    id: asString(o.id) || makeClipId(),
    name: asString(o.name).slice(0, 120) || 'Clip',
    url,
    durationSec,
    trimEndSec: Math.max(0, Math.min(asNumber(o.trimEndSec, 0), durationSec)),
    ...(asNumber(o.trimStartSec, 0) > 0
      ? { trimStartSec: Math.max(0, Math.min(asNumber(o.trimStartSec, 0), durationSec)) }
      : {}),
    ...(motion && motion.length >= 2 ? { motion } : {}),
  };
}

/** R25 overlay normalizer: a clip + its timeline offset. */
export function normalizeReelOverlay(raw: unknown): ReelOverlayClip | null {
  const clip = normalizeReelClip(raw);
  if (!clip) return null;
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { ...clip, offsetSec: Math.max(0, asNumber(o.offsetSec, 0)) };
}

export function normalizeReelAudio(raw: unknown): ReelAudioTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = asString(o.url).trim();
  if (!isHttpUrl(url)) return null;
  const dur = asNumber(o.durationSec, 0);
  return {
    url,
    name: asString(o.name).slice(0, 120) || 'Audio',
    offsetSec: Math.max(0, asNumber(o.offsetSec, 0)),
    durationSec: dur > 0 ? dur : null,
  };
}

function normalizeReelWords(raw: unknown): ReelWord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      const o = w && typeof w === 'object' ? (w as Record<string, unknown>) : {};
      const word = asString(o.word).trim();
      if (!word) return null;
      const start = asNumber(o.start, 0);
      const end = asNumber(o.end, start);
      if (end < start) return null;
      return { word: word.slice(0, 60), start, end };
    })
    .filter((w): w is ReelWord => !!w);
}

/** Project-level fields live at top level; clips/audio/captions ride the JSONB. */
export function normalizeProjectJson(raw: unknown): {
  clips: ReelClip[];
  audio: ReelAudioTrack | null;
  composedUrl: string;
  composedAt: string | null;
  captions: Record<string, ReelWord[]>;
  captionStyle: CaptionPreset;
  captionOverrides?: import('./captions').CaptionOverrides;
  overlays?: ReelOverlayClip[];
} {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const clips = (Array.isArray(o.clips) ? o.clips : [])
    .map(normalizeReelClip)
    .filter((c): c is ReelClip => !!c);
  const overlays = (Array.isArray(o.overlays) ? o.overlays : [])
    .map(normalizeReelOverlay)
    .filter((c): c is ReelOverlayClip => !!c);
  const captions: Record<string, ReelWord[]> = {};
  if (o.captions && typeof o.captions === 'object' && !Array.isArray(o.captions)) {
    for (const [key, words] of Object.entries(o.captions as Record<string, unknown>)) {
      const normalized = normalizeReelWords(words);
      if (normalized.length) captions[key] = normalized;
    }
  }
  return {
    clips,
    audio: normalizeReelAudio(o.audio),
    composedUrl: isHttpUrl(o.composedUrl) ? asString(o.composedUrl).trim() : '',
    composedAt: asString(o.composedAt) || null,
    captions,
    captionStyle: normalizeCaptionPreset(o.captionStyle),
    ...(o.captionOverrides && typeof o.captionOverrides === 'object'
      ? { captionOverrides: o.captionOverrides as import('./captions').CaptionOverrides }
      : {}),
    ...(overlays.length ? { overlays } : {}),
  };
}

export function rowToReelProject(row: ReelProjectRow): ReelProject {
  const json = normalizeProjectJson(row.project);
  return {
    id: row.id,
    name: row.name ?? '',
    clips: json.clips,
    audio: json.audio,
    composedUrl: json.composedUrl,
    composedAt: json.composedAt,
    captions: json.captions,
    captionStyle: json.captionStyle,
    ...(json.captionOverrides ? { captionOverrides: json.captionOverrides } : {}),
    ...(json.overlays ? { overlays: json.overlays } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Serialize a project for the JSONB column. */
export function projectToJson(project: {
  clips: ReelClip[];
  audio: ReelAudioTrack | null;
  composedUrl?: string;
  composedAt?: string | null;
  captions?: Record<string, ReelWord[]>;
  captionStyle?: CaptionPreset;
  captionOverrides?: import('./captions').CaptionOverrides;
  overlays?: ReelOverlayClip[];
}): Record<string, unknown> {
  return {
    clips: project.clips,
    audio: project.audio,
    composedUrl: project.composedUrl || '',
    composedAt: project.composedAt ?? null,
    captions: project.captions ?? {},
    captionStyle: normalizeCaptionPreset(project.captionStyle),
    ...(project.captionOverrides ? { captionOverrides: project.captionOverrides } : {}),
    ...(project.overlays && project.overlays.length ? { overlays: project.overlays } : {}),
  };
}


export function blankReelProject(name = 'Untitled reel'): ReelProject {
  return {
    id: '',
    name,
    clips: [],
    audio: null,
    composedUrl: '',
    composedAt: null,
    captions: {},
    captionStyle: 'karaoke',
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
  };
}


