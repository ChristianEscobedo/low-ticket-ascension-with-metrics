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
import { captionDefFor, CAPTION_ANIMS } from './captions';
// clone.ts imports nothing from this file, so this value import creates no
// runtime cycle (same reasoning as the captions import above).
import { normalizeClonePlan } from './clone';

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

/**
 * A per-word style mark — the "this word does its own thing" slot.
 *
 * Words are transcript DATA (they carry start/end), so a word is the one place
 * per-beat styling may live: rows are derived (they'd drift) and letters are
 * derived (they'd orphan). The mark is optional and additive — a word without
 * one inherits the preset, so every existing reel keeps working. The caption
 * layer renders it (`CaptionWordMark` mirrors this shape there, structurally,
 * because the render worker doesn't vendor this file).
 */
/** The persistent per-word effects (rendered frame-driven in the caption layer). */
export const WORD_FX = [
  'glow',
  'gradient',
  'shine',
  'pulse',
  'underline',
  'marker',
  'tilt',
  'outline',
  'strike',
  'blink',
  'jelly',
] as const;
export type ReelWordFx = (typeof WORD_FX)[number];

/** The font families a word can switch to — the catalog the presets draw from.
 *  The render plan ships any marked family in plan.fonts so the worker loads
 *  it too (a font nobody fetches renders as a fallback face in the MP4). */
export const WORD_FONTS = [
  'Anton',
  'Archivo Black',
  'Bebas Neue',
  'Inter',
  'Poppins',
  'Georgia',
  'Playfair Display',
  'Courier Prime',
  'Rubik Mono One',
] as const;

export interface ReelWordMark {
  /**
   * Hide this word from the caption layer (phrase mute). Timing stays so
   * the transcript/editor still shows it dimmed.
   */
  hidden?: boolean;
  /**
   * Phrase stack card membership. Contiguous words sharing the same card.id
   * render as one stacked page (build&hold or karaoke) with optional local
   * rows/wordsPerRow/anim — the MILLIONAIRES-style phrase block.
   */
  card?: {
    id: string;
    mode: 'build' | 'page';
    rows?: number;
    wordsPerRow?: number;
    /** Default entrance for words in this card (overridden by mark.anim). */
    anim?: string;
  };
  /** Entrance anim for THIS word instead of the preset's. */
  anim?: string;
  /** Color override — the word carries it even when idle. */
  color?: string;
  /** Extra scale multiplier for THIS word (the "shout" beat). */
  scale?: number;
  /** Per-letter cascade delay in seconds for THIS word. */
  stagger?: number;
  /** Ambient motion while the word is on screen: a gentle bob / soft sway. */
  ambient?: 'float' | 'wiggle';
  /** A persistent effect for THIS word (glow / gradient fill / shine sweep /
   *  pulse / underline draw-on / marker swipe). Omit = none. */
  fx?: ReelWordFx;
  /** The fx color (glow halo, underline, marker, gradient anchor). Default:
   *  the active caption color. */
  fxColor?: string;
  /** The fx intensity multiplier (0.2–3, default 1): glow radius, pulse
   *  amplitude, marker opacity, underline/strike thickness, shine band,
   *  jelly squash. One honest dial instead of six knobs. */
  fxAmount?: number;
  /** The fx DENSITY (0.2–3, default 1): extra glow layers, more shine bands,
   *  faster pulse/blink/jelly frequencies. Amount owns SIZE, density owns
   *  HOW MUCH of it happens. */
  fxDensity?: number;
  /** A second fx color: the gradient's end and the shine band's light.
   *  Default white. */
  fxColor2?: string;
  /** A different FONT for THIS word (one of WORD_FONTS). The render plan
   *  ships the family in plan.fonts so the worker loads it too. */
  font?: string;
  /** A one-shot sound fired when the word starts — rendered as an <Audio> at
   *  the word's frame, so preview and MP4 agree by construction. */
  sfx?: { url: string; volume?: number };
}

/** One spoken word with its timing inside a clip (Whisper word granularity). */
export interface ReelWord {
  word: string;
  start: number;
  end: number;
  /** Optional per-word styling (see ReelWordMark). */
  mark?: ReelWordMark;
}

/**
 * Per-cue styling — where the fly-in sits and how it's framed. Every field is
 * optional; a cue without one renders the house default (the top-right card:
 * 34% wide at x=60/y=16, 16px rounded, shadowed). Percents are of the frame,
 * px are at 1080 wide (the render scales with the frame).
 */
export interface ReelMediaCueStyle {
  /** Box width as % of frame width. Default 34. */
  widthPct?: number;
  /** Box top-left position, % of frame. Defaults x=60, y=16 (the house top-right). */
  xPct?: number;
  yPct?: number;
  /** Corner radius px at 1080w. Default 16. */
  radiusPx?: number;
  /** Outline color (CSS) + width px. Omit = no outline. */
  borderColor?: string;
  borderPx?: number;
  /** Drop shadow on/off (the house card has one). Default on. */
  shadow?: boolean;
  /**
   * Z-order against the CAPTION layer: 'below' (the house default) paints the
   * cue UNDER the caption text; 'above' paints it ON TOP of the captions.
   * This is a layer, not a position — x/y still place the box.
   */
  z?: 'above' | 'below';
  /**
   * Ambient motion while the cue is on screen (frame-driven, like the caption
   * `float` blockFx): 'float' = a gentle vertical bob, 'wiggle' = a soft
   * rotational sway. Omit = still. Composes ON TOP of the entrance and any
   * motion track, and eases in/out with the cue so it never pops.
   */
  ambient?: 'float' | 'wiggle';
}

/**
 * A word-triggered media cue: an image that flies in when a specific word is
 * SAID (the Submagic/Opus b-roll beat). The cue keys on (clipId, wordIndex) —
 * the stable, transcript-derived address — and the render plan resolves it to
 * frame timings from the word's own start/end, so a trim or split re-times the
 * cue automatically instead of stranding it.
 */
export interface ReelMediaCue {
  id: string;
  /** The clip whose transcript holds the trigger word. */
  clipId: string;
  /** Index into captions[clipId] of the trigger word. */
  wordIndex: number;
  /**
   * How long the cue holds after its trigger word ends, in seconds. Omit =
   * the house default (MEDIA_CUE_HOLD_SEC, 1.0s). The window stays
   * word-derived — this is the "time on screen" dial, still clamped to the
   * clip's surviving window at plan time, so a trim can shorten it.
   */
  holdSec?: number;
  /** Public http(s) image URL (from the Media Library). */
  url: string;
  /** Optional look (size/position/frame). Omit = the house card. */
  style?: ReelMediaCueStyle;
  /** A one-shot sound fired as the cue flies in (a whoosh, a pop). Omit =
   *  silent. Rendered as an <Audio> at the cue's first frame. */
  sfx?: { url: string; volume?: number };
  /**
   * Keyframed motion — the SAME MotionKey[] shape clips use, sampled by the
   * same per-frame interpolation. Times are CUE-RELATIVE seconds, and the
   * cue's window is word-derived: a trim that shortens the window plays less
   * of the track (same honest behavior as clips). Omit = the default
   * rise+scale entrance + fade exit.
   */
  motion?: import('./motion').MotionKey[];
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
  /** Word-triggered media cues (image fly-ins keyed to spoken words). */
  mediaCues?: ReelMediaCue[];
  /** AI Clone: the per-reel clone manifest (clone, beats, gate, cost basis). */
  clonePlan?: import('./clone').ClonePlan;
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

/**
 * The ONE motion-track clamp, shared by clips and media cues: t ≥ 0, scale
 * 0.2–4, pan ±50, rotate ±45, capped at 40 keys. Returns undefined for
 * anything shorter than two keys (a single key can't interpolate, so the
 * default/static case owns it) — the same rule normalizeReelClip always had.
 */
function normalizeMotionKeys(raw: unknown): import('./motion').MotionKey[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const keys = raw
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
    .slice(0, 40);
  return keys.length >= 2 ? keys : undefined;
}

/**
 * Per-cue style: clamp each field, drop keys that aren't usable, and when
 * nothing survived drop the whole style (the cue then renders the house
 * card). Border needs BOTH a color and a width — a lone width is dropped,
 * a lone color keeps the default 2px so the pick is never invisible.
 *
 * Exported for the reel-cues handoff (the recipe's style hints ride the same
 * clamp the studio's editor writes through).
 */
export function normalizeMediaCueStyle(raw: unknown): ReelMediaCueStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: ReelMediaCueStyle = {};
  if (typeof o.widthPct === 'number' && Number.isFinite(o.widthPct)) {
    out.widthPct = Math.max(10, Math.min(90, o.widthPct));
  }
  if (typeof o.xPct === 'number' && Number.isFinite(o.xPct)) {
    out.xPct = Math.max(0, Math.min(95, o.xPct));
  }
  if (typeof o.yPct === 'number' && Number.isFinite(o.yPct)) {
    out.yPct = Math.max(0, Math.min(95, o.yPct));
  }
  if (typeof o.radiusPx === 'number' && Number.isFinite(o.radiusPx)) {
    out.radiusPx = Math.max(0, Math.min(80, o.radiusPx));
  }
  if (typeof o.borderColor === 'string' && o.borderColor.trim()) {
    out.borderColor = o.borderColor.trim().slice(0, 40);
  }
  if (typeof o.borderPx === 'number' && Number.isFinite(o.borderPx)) {
    out.borderPx = Math.max(0, Math.min(12, o.borderPx));
  }
  if (out.borderColor && out.borderPx === undefined) out.borderPx = 2;
  if (typeof o.shadow === 'boolean') out.shadow = o.shadow;
  if (o.z === 'above' || o.z === 'below') out.z = o.z;
  if (o.ambient === 'float' || o.ambient === 'wiggle') out.ambient = o.ambient;
  return Object.keys(out).length ? out : undefined;
}

export function normalizeReelClip(raw: unknown): ReelClip | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const url = asString(o.url).trim();
  if (!isHttpUrl(url)) return null;
  const durationSec = Math.max(0, asNumber(o.durationSec, 0));
  if (durationSec <= 0) return null;
  const motion = normalizeMotionKeys(o.motion);
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

/** A one-shot sound: a real http(s) URL, volume clamped 0–1 (omit = full). */
function normalizeCueSfx(raw: unknown): { url: string; volume?: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const url = asString(o.url).trim();
  if (!isHttpUrl(url)) return undefined;
  const volume = asNumber(o.volume, NaN);
  return {
    url,
    ...(Number.isFinite(volume) ? { volume: Math.max(0, Math.min(1, volume)) } : {}),
  };
}

/** A one-line readout of a word's mark for hover tooltips in the subtitle
 *  list ("glow · fx #ffd400 → #ff6b6b · ×2 · density 1.5 · Anton · float ·
 *  sfx"). Empty string when the word carries nothing — the tooltip omits. */
export function wordMarkSummary(mark: ReelWordMark | undefined): string {
  if (!mark) return '';
  const parts: string[] = [];
  if (mark.hidden) parts.push('muted');
  if (mark.xPct != null && mark.yPct != null) parts.push('placed');
  if (mark.card) parts.push(`card ${mark.card.mode}`);
  if (mark.fx) parts.push(mark.fx);
  if (mark.anim) parts.push(`anim ${mark.anim}`);
  if (mark.color) parts.push(mark.color);
  if (mark.fxColor) parts.push(`fx ${mark.fxColor}${mark.fxColor2 ? ` → ${mark.fxColor2}` : ''}`);
  if (mark.fxAmount && mark.fxAmount !== 1) parts.push(`×${mark.fxAmount}`);
  if (mark.fxDensity && mark.fxDensity !== 1) parts.push(`density ${mark.fxDensity}`);
  if (mark.scale) parts.push(`scale ${mark.scale}`);
  if (mark.font) parts.push(mark.font);
  if (mark.ambient) parts.push(mark.ambient);
  if (mark.stagger) parts.push(`cascade ${mark.stagger}s`);
  if (mark.sfx) parts.push('sfx ✓');
  return parts.join(' · ');
}

/**
 * Seed free-place positions for a stack-card phrase.
 * Spreads words into `rows` × words-per-row around the frame centre,
 * matching the caption box's bottom-origin y axis.
 */
export function defaultStackLayout(
  count: number,
  opts?: { rows?: number; wordsPerRow?: number; baseYPct?: number; baseXPct?: number },
): { xPct: number; yPct: number }[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const rows = Math.max(1, Math.min(4, Math.round(opts?.rows ?? Math.min(3, n))));
  const perRow = Math.max(
    1,
    Math.min(8, Math.round(opts?.wordsPerRow ?? Math.ceil(n / rows))),
  );
  const baseX = opts?.baseXPct ?? 50;
  const baseY = opts?.baseYPct ?? 42;
  const rowGap = 9; // % of frame between rows (bottom → top)
  const colGap = 14; // % between word centres
  const out: { xPct: number; yPct: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const rowLen = Math.min(perRow, n - r * perRow);
    const rowWidth = (rowLen - 1) * colGap;
    const x0 = baseX - rowWidth / 2;
    // First row is lowest (closest to baseY); later rows stack upward.
    const y = Math.max(6, Math.min(88, baseY + r * rowGap));
    const x = Math.max(8, Math.min(92, x0 + c * colGap));
    out.push({ xPct: Math.round(x * 10) / 10, yPct: Math.round(y * 10) / 10 });
  }
  return out;
}


/** Validate one word mark. Unknown anims DROP the key (the word then inherits
 *  the preset) — never a silent substitution onto 'pop'. Same rule for fx. */
function normalizeWordMark(raw: unknown): ReelWordMark | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: ReelWordMark = {};
  if (typeof o.anim === 'string' && (CAPTION_ANIMS as string[]).includes(o.anim)) {
    out.anim = o.anim;
  }
  if (typeof o.color === 'string' && o.color.trim()) out.color = o.color.trim().slice(0, 40);
  if (typeof o.scale === 'number' && Number.isFinite(o.scale)) {
    out.scale = Math.max(0.5, Math.min(3, o.scale));
  }
  if (typeof o.stagger === 'number' && Number.isFinite(o.stagger) && o.stagger > 0) {
    out.stagger = Math.max(0.005, Math.min(0.5, o.stagger));
  }
  if (o.ambient === 'float' || o.ambient === 'wiggle') out.ambient = o.ambient;
  if (typeof o.fx === 'string' && (WORD_FX as readonly string[]).includes(o.fx)) {
    out.fx = o.fx as ReelWordFx;
  }
  if (typeof o.fxColor === 'string' && o.fxColor.trim()) {
    out.fxColor = o.fxColor.trim().slice(0, 40);
  }
  if (typeof o.fxAmount === 'number' && Number.isFinite(o.fxAmount)) {
    out.fxAmount = Math.max(0.2, Math.min(3, o.fxAmount));
  }
  if (typeof o.fxDensity === 'number' && Number.isFinite(o.fxDensity)) {
    out.fxDensity = Math.max(0.2, Math.min(3, o.fxDensity));
  }
  if (typeof o.fxColor2 === 'string' && o.fxColor2.trim()) {
    out.fxColor2 = o.fxColor2.trim().slice(0, 40);
  }
  if (typeof o.font === 'string' && (WORD_FONTS as readonly string[]).includes(o.font)) {
    out.font = o.font;
  }
  const sfx = normalizeCueSfx(o.sfx);
  if (sfx) out.sfx = sfx;
  return Object.keys(out).length ? out : undefined;
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
      const mark = normalizeWordMark(o.mark);
      return { word: word.slice(0, 60), start, end, ...(mark ? { mark } : {}) };
    })
    .filter((w): w is ReelWord => !!w);
}

/** Media cues: keep only entries that point at a real word of a real clip. */
function normalizeMediaCues(raw: unknown, captions: Record<string, ReelWord[]>): ReelMediaCue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const o = c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
      const url = asString(o.url).trim();
      const clipId = asString(o.clipId);
      const wordIndex = Math.round(asNumber(o.wordIndex, -1));
      if (!isHttpUrl(url) || !clipId) return null;
      const words = captions[clipId];
      if (!words || wordIndex < 0 || wordIndex >= words.length) return null;
      const style = normalizeMediaCueStyle(o.style);
      const motion = normalizeMotionKeys(o.motion);
      const holdSec = asNumber(o.holdSec, NaN);
      const sfx = normalizeCueSfx(o.sfx);
      return {
        id: asString(o.id) || makeClipId(),
        clipId,
        wordIndex,
        url,
        ...(Number.isFinite(holdSec) ? { holdSec: Math.max(0.2, Math.min(8, holdSec)) } : {}),
        ...(style ? { style } : {}),
        ...(motion ? { motion } : {}),
        ...(sfx ? { sfx } : {}),
      };
    })
    .filter((c): c is ReelMediaCue => !!c)
    .slice(0, 60);
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
  mediaCues?: ReelMediaCue[];
  clonePlan?: import('./clone').ClonePlan;
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
  const mediaCues = normalizeMediaCues(o.mediaCues, captions);
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
    ...(mediaCues.length ? { mediaCues } : {}),
    ...(normalizeClonePlanField(o.clonePlan)
      ? { clonePlan: normalizeClonePlanField(o.clonePlan) }
      : {}),
  };
}

/** The "returns undefined when unusable" shape the spread above needs. */
function normalizeClonePlanField(raw: unknown): import('./clone').ClonePlan | undefined {
  return normalizeClonePlan(raw) ?? undefined;
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
    ...(json.mediaCues ? { mediaCues: json.mediaCues } : {}),
    ...(json.clonePlan ? { clonePlan: json.clonePlan } : {}),
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
  mediaCues?: ReelMediaCue[];
  clonePlan?: import('./clone').ClonePlan;
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
    ...(project.mediaCues && project.mediaCues.length ? { mediaCues: project.mediaCues } : {}),
    ...(project.clonePlan ? { clonePlan: project.clonePlan } : {}),
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


