/**
 * AI Clone Video — the clone asset, the beat manifest, and the cost tables.
 *
 * THE SHAPE
 * ---------
 * A ReelClone is a saved cast member: 3–5 reference photos (or a generated
 * character sheet), an ElevenLabs voice, and a LOOK BIBLE — one locked
 * string (wardrobe, backdrop, lighting, lens) that every downstream prompt
 * quotes verbatim. That string is the character-consistency anchor: the
 * avatar model gets the same ref image, Seedance gets the same refs, and
 * the voice id never changes, beat over beat.
 *
 * A ClonePlan is the per-reel manifest riding the project JSON (a
 * `clonePlan` field on ReelProject, normalized here like mediaCues): the
 * clone, the video type + framework, and the beats — each beat carrying
 * its script line, voice programming, storyboard shot, @reference slots,
 * and (after generation) the generation ids + output URLs. Extend/look-back
 * and re-roll-one-beat are manifest operations, so the manifest is the
 * single source of truth.
 *
 * COST HONESTY
 * ------------
 * Nothing spends without a number on screen. CLONE_COSTS is the ONE table —
 * per-second avatar + Seedance rates, ElevenLabs $/1k chars, and the
 * one-time-per-character sheet image. Update it from muapi's live pricing;
 * every readout in the studio derives from it (same pattern as
 * veedPresets.ts's veedCostEstimate).
 */

// ---------------------------------------------------------------------------
// The clone (the asset)
// ---------------------------------------------------------------------------

/** The locked look string — quoted verbatim in every image/video prompt. */
export interface CloneLookBible {
  wardrobe: string;
  backdrop: string;
  lighting: string;
  lens: string;
}

/** The clone's voice: an ElevenLabs id (clone or stock) + display name. */
export interface CloneVoice {
  voiceId: string;
  name: string;
  /**
   * Baseline ElevenLabs voice settings (0–1). Per-beat voice programming
   * overrides these; the baseline is the clone's "neutral read".
   */
  stability: number;
  similarityBoost: number;
  style: number;
}

export interface ReelClone {
  id: string;
  name: string;
  /** 3–5 reference photos (hosted URLs). May be cells cut from the sheet. */
  refPhotos: string[];
  /** The master character sheet URL (GPT Image 2 turnaround), when forged. */
  sheetUrl?: string;
  lookBible: CloneLookBible;
  voice: CloneVoice;
  createdAt: string | null;
}

/** One locked line, built from the look bible — quoted verbatim downstream. */
export function lookBibleString(look: CloneLookBible): string {
  const parts = [
    look.wardrobe.trim() && `Wardrobe: ${look.wardrobe.trim()}`,
    look.backdrop.trim() && `Backdrop: ${look.backdrop.trim()}`,
    look.lighting.trim() && `Lighting: ${look.lighting.trim()}`,
    look.lens.trim() && `Lens: ${look.lens.trim()}`,
  ].filter(Boolean) as string[];
  return parts.join('. ');
}

// ---------------------------------------------------------------------------
// The character-sheet foundry (GPT Image 2)
// ---------------------------------------------------------------------------

/** The image model that forges sheets — one call per character, not per video. */
export const CLONE_SHEET_MODEL = 'gpt-image-2';

/**
 * The sheet layout: a 2×2 turnaround grid (front / three-quarter / profile /
 * close-up) plus an expression strip (neutral, excited, serious), with an
 * optional full-body cell for walking shots. Cells become the clone's
 * reference photos; the sheet is the master.
 */
export const SHEET_CELLS = [
  'front',
  'three-quarter',
  'profile',
  'close-up',
  'neutral',
  'excited',
  'serious',
  'full-body',
] as const;
export type SheetCell = (typeof SHEET_CELLS)[number];

/** Cells in the DEFAULT sheet (no full-body — added on demand for b-roll). */
export const DEFAULT_SHEET_CELLS: SheetCell[] = [
  'front',
  'three-quarter',
  'profile',
  'close-up',
  'neutral',
  'excited',
  'serious',
];

/**
 * Build the ONE GPT Image 2 prompt that forges a character sheet. The look
 * bible is quoted verbatim; the description names the person. Deterministic
 * for the same inputs (modulo the model), so re-forging is a re-roll.
 */
export function characterSheetPrompt(opts: {
  description: string;
  lookBible: CloneLookBible;
  includeFullBody?: boolean;
}): string {
  const bible = lookBibleString(opts.lookBible);
  const cells = opts.includeFullBody
    ? 'a 2x2 turnaround grid (front view, three-quarter view, profile view, close-up headshot), a strip of three expressions (neutral, excited, serious), and one full-body walking pose'
    : 'a 2x2 turnaround grid (front view, three-quarter view, profile view, close-up headshot) and a strip of three expressions (neutral, excited, serious)';
  return [
    'A single locked character reference sheet of ONE person, consistent face and identity in every cell:',
    `${opts.description.trim()}.`,
    `The sheet contains ${cells}. Same face, same hairstyle, same wardrobe in every cell.`,
    bible ? `${bible}.` : '',
    'Clean neutral studio backdrop, even soft lighting, photorealistic, sharp focus, no text, no watermark, no logos.',
  ]
    .filter(Boolean)
    .join(' ');
}

// ---------------------------------------------------------------------------
// Video types + frameworks
// ---------------------------------------------------------------------------

export interface CloneVideoType {
  id: string;
  label: string;
  hint: string;
  /** Default beat length grid for this type (seconds per beat). */
  beatSec: number;
  /** Default number of beats. */
  beats: number;
  /** The framework ids this type defaults to (see CLONE_FRAMEWORKS). */
  framework: string;
}

/** The 5/10/15s grid is honest — a beat is ~25 words ≈ 10s of speech. */
export const CLONE_BEAT_GRID_SEC = [5, 10, 15] as const;
export const CLONE_BEAT_MAX_WORDS = 25;
/** ≈2.5 words per second of natural speech — the word-count → seconds rule. */
export const CLONE_WORDS_PER_SEC = 2.5;

export interface CloneFramework {
  id: string;
  label: string;
  /** The beat roles, in order — the script writer executes this skeleton. */
  beats: string[];
}

export const CLONE_FRAMEWORKS: CloneFramework[] = [
  {
    id: 'pas',
    label: 'PAS',
    beats: ['problem', 'agitate', 'solve', 'cta'],
  },
  {
    id: 'aida',
    label: 'AIDA',
    beats: ['attention', 'interest', 'desire', 'action'],
  },
  {
    id: 'hook-story-offer',
    label: 'Hook · Story · Offer',
    beats: ['hook', 'story', 'offer', 'cta'],
  },
  {
    id: 'vsl',
    label: 'VSL (Mindshift structure)',
    beats: ['hook', 'problem', 'mechanism', 'proof', 'offer', 'cta'],
  },
];

export const CLONE_VIDEO_TYPES: CloneVideoType[] = [
  { id: 'hook-ad', label: 'Hook ad', hint: '5/10/15s scroll-stopper', beatSec: 5, beats: 3, framework: 'hook-story-offer' },
  { id: 'ugc', label: 'UGC testimonial', hint: 'First-person proof beat', beatSec: 10, beats: 3, framework: 'pas' },
  { id: 'vsl', label: 'VSL', hint: 'Long-form sales argument', beatSec: 15, beats: 6, framework: 'vsl' },
  { id: 'tutorial', label: 'Tutorial', hint: 'Teach one thing well', beatSec: 10, beats: 4, framework: 'aida' },
  { id: 'announcement', label: 'Announcement', hint: 'One piece of news, fast', beatSec: 5, beats: 2, framework: 'hook-story-offer' },
];

export function cloneVideoTypeFor(id: string): CloneVideoType {
  return CLONE_VIDEO_TYPES.find((t) => t.id === id) ?? CLONE_VIDEO_TYPES[0];
}

export function cloneFrameworkFor(id: string): CloneFramework {
  return CLONE_FRAMEWORKS.find((f) => f.id === id) ?? CLONE_FRAMEWORKS[0];
}

/** Seconds of speech a line needs — the word-count honesty rule. */
export function beatDurationForWords(words: number): number {
  return Math.max(1, Math.ceil(words / CLONE_WORDS_PER_SEC));
}

/** Snap a word count to the honest 5/10/15 grid. */
export function beatGridForWords(words: number): 5 | 10 | 15 {
  const need = beatDurationForWords(words);
  if (need <= 5) return 5;
  if (need <= 10) return 10;
  return 15;
}

export function beatWordCount(line: string): number {
  return line.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Voice programming (per beat → ElevenLabs per-beat params)
// ---------------------------------------------------------------------------

export type CloneBeatEnergy = 'low' | 'medium' | 'high';
export type CloneBeatPace = 'slow' | 'natural' | 'fast';

/**
 * The per-beat direction: pace, energy, emphasis words, pause placement.
 * Resolves to ElevenLabs settings per beat (one call per beat = per-beat
 * emotion). Emphasis + pauses are woven into the text the TTS receives
 * (pause = "…" beat breaks), the knobs ride the request.
 */
export interface CloneVoiceDirection {
  pace: CloneBeatPace;
  energy: CloneBeatEnergy;
  /** Words to stress (rendered UPPERCASE-adjacent emphasis in the prompt). */
  emphasis?: string[];
  /** Insert a beat pause AFTER this many words (0 = no pause). */
  pauseAfterWord?: number;
}

/** ElevenLabs per-beat request knobs, resolved from the direction. */
export interface CloneBeatVoiceParams {
  stability: number;
  similarityBoost: number;
  style: number;
  /** ElevenLabs speed: 0.7–1.2. Pace owns it. */
  speed: number;
}

const ENERGY_STYLE: Record<CloneBeatEnergy, number> = { low: 0.15, medium: 0.45, high: 0.8 };
const ENERGY_STABILITY: Record<CloneBeatEnergy, number> = { low: 0.7, medium: 0.5, high: 0.35 };
const PACE_SPEED: Record<CloneBeatPace, number> = { slow: 0.85, natural: 1, fast: 1.15 };

/**
 * Resolve a beat's direction + the clone's baseline into ElevenLabs params.
 * Energy drives style (higher energy = more expressive = more style, less
 * stability); pace drives speed; the clone's similarityBoost never moves.
 */
export function resolveBeatVoiceParams(
  voice: CloneVoice,
  direction?: CloneVoiceDirection,
): CloneBeatVoiceParams {
  const energy = direction?.energy ?? 'medium';
  const pace = direction?.pace ?? 'natural';
  // Blend the clone baseline with the energy shift, clamped to 0–1.
  const clamp01 = (n: number) => Math.max(0, Math.min(1, Math.round(n * 100) / 100));
  return {
    stability: clamp01((voice.stability + ENERGY_STABILITY[energy]) / 2),
    similarityBoost: clamp01(voice.similarityBoost),
    style: clamp01((voice.style + ENERGY_STYLE[energy]) / 2),
    speed: PACE_SPEED[pace],
  };
}

/**
 * The text the TTS actually receives: emphasis words wrapped in caps, a
 * pause ("…") woven after the Nth word. Pure string in, string out.
 */
export function beatLineForTts(line: string, direction?: CloneVoiceDirection): string {
  let words = line.trim().split(/\s+/).filter(Boolean);
  if (direction?.emphasis?.length) {
    const marks = new Set(direction.emphasis.map((w) => w.trim().toLowerCase()));
    words = words.map((w) => (marks.has(w.replace(/[^\w']/g, '').toLowerCase()) ? w.toUpperCase() : w));
  }
  const pauseAfter = Math.round(direction?.pauseAfterWord ?? 0);
  if (pauseAfter > 0 && pauseAfter < words.length) {
    words = [...words.slice(0, pauseAfter), '…', ...words.slice(pauseAfter)];
  }
  return words.join(' ');
}

// ---------------------------------------------------------------------------
// Beats + the plan manifest
// ---------------------------------------------------------------------------

export type CloneBeatKind = 'avatar' | 'broll';
export type CloneShotAngle = 'close' | 'medium' | 'wide';
export type CloneBeatStatus = 'planned' | 'voiced' | 'generated' | 'failed';

export interface CloneBeat {
  id: string;
  index: number;
  kind: CloneBeatKind;
  /** The script line (≤25 words for avatar beats; b-roll may be visual-only). */
  line: string;
  /** Voice programming for this line. */
  voice?: CloneVoiceDirection;
  /** Storyboard: the shot for this beat. */
  shot: CloneShotAngle;
  /** Beat length on the 5/10/15 grid. */
  durationSec: number;
  /**
   * The @reference slots: slot 1 is ALWAYS the character sheet (or the
   * clone's primary ref), slot 2 is the optional variant (wardrobe change,
   * location still, product-in-hand). B-roll beats ride these so the same
   * character shows up INSIDE the footage.
   */
  refs: string[];
  /** Optional b-roll visual prompt (kind=broll). */
  brollPrompt?: string;
  /** Which Seedance tier renders this beat's b-roll (2.0 default, 2.5 hero). */
  seedanceTier?: SeedanceTier;
  status: CloneBeatStatus;
  /** Generation outputs (filled by the generate step). */
  audioUrl?: string;
  videoUrl?: string;
  /** Provider request ids for audit/re-roll. */
  voiceRequestId?: string;
  videoRequestId?: string;
  /** Last frame of the previous beat, for look-back continuation. */
  continuesFrom?: string;
  error?: string;
}

export type SeedanceTier = 'seedance-2.0' | 'seedance-2.5';

/** The per-reel manifest — rides the project JSON as `clonePlan`. */
export interface ClonePlan {
  clone: ReelClone;
  videoType: string;
  framework: string;
  beats: CloneBeat[];
  /** The storyboard gate: null = not yet approved, ISO once approved. */
  approvedAt: string | null;
  /** Default Seedance tier for b-roll beats (the 2.0↔2.5 toggle). */
  seedanceTier: SeedanceTier;
  createdAt: string | null;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Cost tables — the ONE place pricing lives (veedPresets pattern)
// ---------------------------------------------------------------------------

/**
 * THE cost table. Estimates grounded at build time (Aug 2026) — muapi's
 * pricing page is JS-rendered, so update these from the live dashboard when
 * the integration lands. Everything the storyboard shows derives from here.
 */
export const CLONE_COSTS = {
  /** muapi OmniHuman-1-class talking-head avatar, $/second of output. */
  avatarPerSec: 0.15,
  /** Seedance b-roll, $/second, per tier. 2.0 default, 2.5 hero shots. */
  seedancePerSec: { 'seedance-2.0': 0.12, 'seedance-2.5': 0.24 } as Record<SeedanceTier, number>,
  /** ElevenLabs TTS, $ per 1k characters. */
  elevenlabsPer1kChars: 0.3,
  /** One GPT Image 2 character sheet — ONCE per character, not per video. */
  characterSheetImage: 0.08,
} as const;

export interface CloneBeatCost {
  beatId: string;
  voice: number;
  video: number;
  total: number;
}

/** Per-beat cost: ElevenLabs chars + avatar or Seedance seconds. */
export function cloneBeatCost(beat: CloneBeat, planTier: SeedanceTier): CloneBeatCost {
  const voice = (beatLineForTts(beat.line, beat.voice).length / 1000) * CLONE_COSTS.elevenlabsPer1kChars;
  const secs = Math.max(0, beat.durationSec);
  const video =
    beat.kind === 'broll'
      ? secs * CLONE_COSTS.seedancePerSec[beat.seedanceTier ?? planTier]
      : secs * CLONE_COSTS.avatarPerSec;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { beatId: beat.id, voice: round(voice), video: round(video), total: round(voice + video) };
}

export interface ClonePlanCost {
  beats: CloneBeatCost[];
  videoTotal: number;
  voiceTotal: number;
  /** The sheet line — $0 when the clone already has one (once per character). */
  sheet: number;
  total: number;
}

/** Full plan readout, with the sheet honesty line folded in. */
export function clonePlanCost(plan: ClonePlan): ClonePlanCost {
  const beats = plan.beats.map((b) => cloneBeatCost(b, plan.seedanceTier));
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const voiceTotal = round(beats.reduce((s, b) => s + b.voice, 0));
  const videoTotal = round(beats.reduce((s, b) => s + b.video, 0));
  const sheet = plan.clone.sheetUrl ? 0 : CLONE_COSTS.characterSheetImage;
  return {
    beats,
    voiceTotal,
    videoTotal,
    sheet,
    total: round(voiceTotal + videoTotal + sheet),
  };
}

// ---------------------------------------------------------------------------
// Normalizers (pure, never throw — same house style as types.ts)
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

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function makeCloneId(): string {
  return `clone-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeBeatId(): string {
  return `beat-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeLookBible(raw: unknown): CloneLookBible {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    wardrobe: asString(o.wardrobe).slice(0, 200),
    backdrop: asString(o.backdrop).slice(0, 200),
    lighting: asString(o.lighting).slice(0, 200),
    lens: asString(o.lens).slice(0, 120),
  };
}

function normalizeVoice(raw: unknown): CloneVoice {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    voiceId: asString(o.voiceId).slice(0, 120),
    name: asString(o.name).slice(0, 80) || 'Voice',
    stability: clamp01(asNumber(o.stability, 0.5)),
    similarityBoost: clamp01(asNumber(o.similarityBoost, 0.75)),
    style: clamp01(asNumber(o.style, 0.3)),
  };
}

export function normalizeClone(raw: unknown): ReelClone | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o.name).trim().slice(0, 80);
  if (!name) return null;
  const refPhotos = (Array.isArray(o.refPhotos) ? o.refPhotos : [])
    .filter((u): u is string => isHttpUrl(u))
    .slice(0, 8);
  return {
    id: asString(o.id) || makeCloneId(),
    name,
    refPhotos,
    ...(isHttpUrl(o.sheetUrl) ? { sheetUrl: asString(o.sheetUrl).trim() } : {}),
    lookBible: normalizeLookBible(o.lookBible),
    voice: normalizeVoice(o.voice),
    createdAt: asString(o.createdAt) || null,
  };
}

const BEAT_ENERGIES: CloneBeatEnergy[] = ['low', 'medium', 'high'];
const BEAT_PACES: CloneBeatPace[] = ['slow', 'natural', 'fast'];
const SHOT_ANGLES: CloneShotAngle[] = ['close', 'medium', 'wide'];
const SEEDANCE_TIERS: SeedanceTier[] = ['seedance-2.0', 'seedance-2.5'];

function normalizeVoiceDirection(raw: unknown): CloneVoiceDirection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: CloneVoiceDirection = {
    pace: BEAT_PACES.includes(o.pace as CloneBeatPace) ? (o.pace as CloneBeatPace) : 'natural',
    energy: BEAT_ENERGIES.includes(o.energy as CloneBeatEnergy) ? (o.energy as CloneBeatEnergy) : 'medium',
  };
  if (Array.isArray(o.emphasis)) {
    const words = o.emphasis
      .filter((w): w is string => typeof w === 'string')
      .map((w) => w.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 6);
    if (words.length) out.emphasis = words;
  }
  const pause = Math.round(asNumber(o.pauseAfterWord, 0));
  if (pause > 0 && pause <= 40) out.pauseAfterWord = pause;
  return out;
}

export function normalizeCloneBeat(raw: unknown, index: number): CloneBeat | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const line = asString(o.line).trim().slice(0, 300);
  const kind: CloneBeatKind = o.kind === 'broll' ? 'broll' : 'avatar';
  // Avatar beats must speak; b-roll beats may be visual-only.
  if (kind === 'avatar' && !line) return null;
  const durationSec = asNumber(o.durationSec, 10);
  const status: CloneBeatStatus = ['planned', 'voiced', 'generated', 'failed'].includes(
    asString(o.status),
  )
    ? (asString(o.status) as CloneBeatStatus)
    : 'planned';
  const refs = (Array.isArray(o.refs) ? o.refs : [])
    .filter((u): u is string => isHttpUrl(u))
    .slice(0, 4);
  const voice = normalizeVoiceDirection(o.voice);
  return {
    id: asString(o.id) || makeBeatId(),
    index: Number.isFinite(asNumber(o.index, NaN)) ? Math.max(0, Math.round(asNumber(o.index))) : index,
    kind,
    line,
    ...(voice ? { voice } : {}),
    shot: SHOT_ANGLES.includes(o.shot as CloneShotAngle) ? (o.shot as CloneShotAngle) : 'medium',
    durationSec: Math.max(1, Math.min(15, durationSec)),
    refs,
    ...(asString(o.brollPrompt).trim() ? { brollPrompt: asString(o.brollPrompt).slice(0, 500) } : {}),
    ...(SEEDANCE_TIERS.includes(o.seedanceTier as SeedanceTier)
      ? { seedanceTier: o.seedanceTier as SeedanceTier }
      : {}),
    status,
    ...(isHttpUrl(o.audioUrl) ? { audioUrl: asString(o.audioUrl).trim() } : {}),
    ...(isHttpUrl(o.videoUrl) ? { videoUrl: asString(o.videoUrl).trim() } : {}),
    ...(asString(o.voiceRequestId) ? { voiceRequestId: asString(o.voiceRequestId).slice(0, 120) } : {}),
    ...(asString(o.videoRequestId) ? { videoRequestId: asString(o.videoRequestId).slice(0, 120) } : {}),
    ...(isHttpUrl(o.continuesFrom) ? { continuesFrom: asString(o.continuesFrom).trim() } : {}),
    ...(asString(o.error) ? { error: asString(o.error).slice(0, 300) } : {}),
  };
}

/** The manifest normalizer — defensive, never throws, drops unusable plans. */
export function normalizeClonePlan(raw: unknown): ClonePlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const clone = normalizeClone(o.clone);
  if (!clone) return null;
  const beats = (Array.isArray(o.beats) ? o.beats : [])
    .map((b, i) => normalizeCloneBeat(b, i))
    .filter((b): b is CloneBeat => !!b)
    .sort((a, b) => a.index - b.index)
    .slice(0, 60);
  return {
    clone,
    videoType: asString(o.videoType) || CLONE_VIDEO_TYPES[0].id,
    framework: asString(o.framework) || CLONE_FRAMEWORKS[0].id,
    beats,
    approvedAt: asString(o.approvedAt) || null,
    seedanceTier: SEEDANCE_TIERS.includes(o.seedanceTier as SeedanceTier)
      ? (o.seedanceTier as SeedanceTier)
      : 'seedance-2.0',
    createdAt: asString(o.createdAt) || null,
    updatedAt: asString(o.updatedAt) || null,
  };
}

/** A fresh plan around a clone — zero beats, unapproved, 2.0 default. */
export function blankClonePlan(clone: ReelClone): ClonePlan {
  const now = new Date().toISOString();
  return {
    clone,
    videoType: CLONE_VIDEO_TYPES[0].id,
    framework: CLONE_VIDEO_TYPES[0].framework,
    beats: [],
    approvedAt: null,
    seedanceTier: 'seedance-2.0',
    createdAt: now,
    updatedAt: now,
  };
}
