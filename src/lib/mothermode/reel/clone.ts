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

/** One sheet style: the art-direction block the foundry quotes. */
export interface CloneSheetStyle {
  id: string;
  label: string;
  hint: string;
  direction: string;
}

/**
 * The foundry speaks the VIDEO's language: the sheet for a UGC testimonial
 * must look like a camera roll, the sheet for a VSL like an expert press
 * kit, and the cinematic board like a Netflix production contact sheet.
 * The locked cell layout (turnaround + expressions) never changes — only
 * the art direction does.
 */
export const CLONE_SHEET_STYLES: CloneSheetStyle[] = [
  {
    id: 'cinematic',
    label: 'Cinematic board',
    hint: 'The production contact sheet — film-grade, every frame distinct',
    direction: [
      'ART DIRECTION — a premium cinematic multi-panel storyboard contact sheet, like a Netflix production board or a luxury commercial previsualization:',
      'ultra realistic cinematic photography — film-grade motivated lighting (practicals, window light, atmospheric shadow), real-world environments, natural skin texture, natural fabric folds and wear, soft depth of field, cinematic color grading, atmospheric realism — never AI-looking, never cartoonish, never over-polished CGI.',
      'Every panel is intentionally art directed and visually DISTINCT: a natural mix of close-ups, medium shots, wide shots, over-the-shoulder, profile, and environmental framing — never a symmetrical grid, never the same angle or composition twice, each panel a frame from a real film with believable emotional continuity between them.',
      'Layout: cinematic production-board aesthetic — black matte spacing between panels, slightly asymmetrical composition, premium studio pitch-board design.',
    ].join(' '),
  },
  {
    id: 'ugc',
    label: 'UGC / organic',
    hint: "Phone-real — a real person's camera roll, never a production",
    direction: [
      "ART DIRECTION — an ORGANIC UGC contact sheet that reads as a real person's phone photos, never a production:",
      'front-camera selfie perspective and mirror checks, everyday real settings (a desk, a car seat, a kitchen counter, a gym floor), mixed natural indoor light, slight phone-photo noise, imperfect handheld framing — no studio backdrop, no color grade, no polish.',
      'Panels vary like a camera roll: a direct selfie, a mirror check, a candid mid-sentence, a looking-away laugh — natural, imperfect, believable.',
    ].join(' '),
  },
  {
    id: 'vsl',
    label: 'VSL / authority',
    hint: 'The polished expert press kit — trusted inside three seconds',
    direction: [
      'ART DIRECTION — a polished expert press-kit sheet:',
      'confident direct-to-camera gaze, premium but human — soft commercial key light, clean seamless backdrop, one prop of authority at the edge (a notebook, a laptop, a whiteboard).',
      'Direct-response energy: the person you trust within three seconds. Panels vary between direct-address portrait, thoughtful three-quarter, and mid-explanation gesture.',
    ].join(' '),
  },
  {
    id: 'editorial',
    label: 'Editorial / clean',
    hint: 'Magazine-neutral — even daylight, clean wall, natural poses',
    direction: [
      'ART DIRECTION — a clean editorial lookbook sheet:',
      'even soft daylight, a simple textured wall, relaxed natural poses, quiet premium catalog spacing — unfussy and real.',
    ].join(' '),
  },
];

export function cloneSheetStyleFor(id?: string): CloneSheetStyle {
  return CLONE_SHEET_STYLES.find((s) => s.id === id) ?? CLONE_SHEET_STYLES[0];
}

/**
 * Build the ONE GPT Image 2 prompt that forges a character sheet. The look
 * bible is quoted verbatim; the description names the person; the STYLE
 * picks the art direction (cinematic board / UGC camera roll / VSL press
 * kit / editorial). Deterministic for the same inputs (modulo the model),
 * so re-forging is a re-roll.
 */
export function characterSheetPrompt(opts: {
  description: string;
  lookBible: CloneLookBible;
  includeFullBody?: boolean;
  /** A CLONE_SHEET_STYLES id — unknown/empty resolves to the cinematic board. */
  styleId?: string;
}): string {
  const bible = lookBibleString(opts.lookBible);
  const style = cloneSheetStyleFor(opts.styleId);
  const cells = opts.includeFullBody
    ? 'a 2x2 turnaround grid (front view, three-quarter view, profile view, close-up headshot), a strip of three expressions (neutral, excited, serious), and one full-body walking pose'
    : 'a 2x2 turnaround grid (front view, three-quarter view, profile view, close-up headshot) and a strip of three expressions (neutral, excited, serious)';
  return [
    'A single locked character reference sheet of ONE person, consistent face and identity in every cell:',
    `${opts.description.trim()}.`,
    style.direction,
    `The sheet contains ${cells}. Same face, same hairstyle, same wardrobe in every cell.`,
    bible ? `${bible}.` : '',
    'CHARACTER CONSISTENCY (STRICT): identical facial structure, hairstyle, and body proportions in every cell; only natural variations (expression, subtle lighting, realistic movement) — like a real actor captured across one day.',
    'Photorealistic, sharp focus, no text, no watermark, no logos.',
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
  /**
   * The FINAL render prompt, hand-edited on the run card (the last human
   * checkpoint). When set, generation sends THIS — not the derived one.
   */
  finalPrompt?: string;
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
  /**
   * The beat's window on the video timeline (seconds). Stamped by the
   * normalizer from order + durationSec — always right after any save.
   */
  startSec?: number;
  endSec?: number;
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
  /**
   * THE SCENE SHEET — one multi-panel board forged FROM the script (a panel
   * per beat, the character inside each scene, same style as the character
   * sheet). B-roll beats render with it riding as an omni-reference, so the
   * world is pre-decided, not re-invented per render. ~$0.08 once per
   * script revision.
   */
  sceneSheetUrl?: string;
  /** When the scene sheet was forged — older than updatedAt = stale. */
  sceneSheetAt?: string | null;
  /**
   * ALL the scene sheets, in order — longer videos forge several (each
   * covers a slice of the scenes, forged with the previous sheet riding as
   * the lookback reference). Beat k renders with sheet floor(k/sheetPanels).
   */
  sceneSheetUrls?: string[];
  /** How many scene panels each sheet covers (the slice size). */
  sheetPanels?: number;
  /**
   * SHEETS BY WORLD — the scene indices each sheet covers, in sheet order
   * (uneven by construction: the gym sheet covers scenes 1–4, the office tag
   * scene 5). Beat k renders with the sheet whose list contains k. When
   * absent, the floor(index/sheetPanels) math is the fallback.
   */
  sheetScenes?: number[][];
  /** What the script was grounded in (an offer / lead magnet / notes). */
  contextLabel?: string;
  /**
   * THE PRODUCT — an image of the thing being sold (the app screenshot, the
   * box, the dashboard). It rides b-roll refs and the scene-sheet prompts,
   * so the product shows up INSIDE the footage, not just talked about.
   */
  productImageUrl?: string;
  /** The caption preset the Producer's style picked — the assemble note names it. */
  captionPreset?: string;
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
  /** The scene sheet line — $0.08 until one is forged for this script, then $0. */
  sceneSheet: number;
  total: number;
}

/** Full plan readout, with the sheet honesty line folded in. */
export function clonePlanCost(plan: ClonePlan): ClonePlanCost {
  const beats = plan.beats.map((b) => cloneBeatCost(b, plan.seedanceTier));
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const voiceTotal = round(beats.reduce((s, b) => s + b.voice, 0));
  const videoTotal = round(beats.reduce((s, b) => s + b.video, 0));
  const sheet = plan.clone.sheetUrl ? 0 : CLONE_COSTS.characterSheetImage;
  // The scene sheet rides the same once-per-revision honesty: it prices in
  // only while beats exist and none is forged yet.
  const sceneSheet = beats.length > 0 && !plan.sceneSheetUrl ? CLONE_COSTS.characterSheetImage : 0;
  return {
    beats,
    voiceTotal,
    videoTotal,
    sheet,
    sceneSheet,
    total: round(voiceTotal + videoTotal + sheet + sceneSheet),
  };
}

/** The live 2.0↔2.5 delta for the toggle: total(2.5) − total(2.0). */
export function cloneTierCostDelta(plan: ClonePlan): number {
  const at = (tier: SeedanceTier) => clonePlanCost({ ...plan, seedanceTier: tier }).total;
  return Math.round((at('seedance-2.5') - at('seedance-2.0')) * 1000) / 1000;
}

/** Total runtime the beats add up to — the storyboard's context line. */
export function clonePlanDurationSec(plan: ClonePlan): number {
  return plan.beats.reduce((s, b) => s + Math.max(0, b.durationSec), 0);
}

// ---------------------------------------------------------------------------
// The storyboard gate (approve before a dollar is spent)
// ---------------------------------------------------------------------------

/**
 * The @reference 1 resolver: the character sheet wins, then the first ref
 * photo. This is THE consistency anchor — every avatar/Seedance call quotes
 * it, so a beat with no explicit slot 1 still rides the master.
 */
export function cloneMasterRef(clone: ReelClone): string | null {
  return clone.sheetUrl ?? clone.refPhotos[0] ?? null;
}

export interface CloneBeatRefSlots {
  /** @reference 1 — the beat override, else the master (sheet → first ref). */
  primary: string | null;
  /** @reference 2 — the optional variant (wardrobe / location / product). */
  variant: string | null;
}

/** Resolve a beat's two @reference slots for the storyboard + generation. */
export function cloneBeatRefSlots(beat: CloneBeat, clone: ReelClone): CloneBeatRefSlots {
  return {
    primary: beat.refs[0] ?? cloneMasterRef(clone),
    variant: beat.refs[1] ?? null,
  };
}

/**
 * Set (or clear, url=null) one @reference slot on a beat. Slot 0 = primary,
 * slot 1 = the variant. Clearing the primary falls back to the master at
 * resolve time, so a beat is never truly reference-less while the clone has
 * refs. Junk URLs are treated as clears; the array stays dense.
 */
export function withBeatRefSlot(
  beat: CloneBeat,
  clone: ReelClone,
  slot: 0 | 1,
  url: string | null,
): CloneBeat {
  const refs = [...beat.refs];
  const clean = typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
  if (clean) {
    if (slot === 1 && !refs[0]) {
      const master = cloneMasterRef(clone);
      if (master) refs[0] = master;
    }
    refs[slot] = clean;
  } else {
    refs.splice(slot, 1);
  }
  return { ...beat, refs: refs.filter(Boolean).slice(0, 4) };
}

/**
 * The gate's honesty rules — every issue blocks approval until fixed. The
 * storyboard UI lists these verbatim; the generate step refuses an
 * unapproved plan. The 5/10/15 grid stays honest: a line that can't fit
 * its beat's seconds is an issue, not a suggestion.
 */
export function storyboardIssues(plan: ClonePlan): string[] {
  const issues: string[] = [];
  if (plan.beats.length === 0) {
    issues.push('No beats yet — write the script first (step 2).');
    return issues;
  }
  plan.beats.forEach((b, i) => {
    const n = `Beat ${i + 1}`;
    if (!cloneBeatRefSlots(b, plan.clone).primary) {
      issues.push(`${n}: no @reference 1 — forge the character sheet or add a ref photo.`);
    }
    const words = beatWordCount(b.line);
    if (b.kind === 'avatar' && words === 0) {
      issues.push(`${n}: an avatar beat needs a spoken line.`);
    }
    // A hand-written final prompt (the run card's override) counts as the visual.
    if (b.kind === 'broll' && !(b.brollPrompt ?? '').trim() && !(b.finalPrompt ?? '').trim()) {
      issues.push(`${n}: a b-roll beat needs a visual prompt.`);
    }
    if (words > 0 && beatGridForWords(words) > b.durationSec) {
      issues.push(
        `${n}: ${words} words can't fit ${b.durationSec}s — lengthen the beat or trim the line.`,
      );
    }
  });
  return issues;
}

export function clonePlanApprovable(plan: ClonePlan): boolean {
  return storyboardIssues(plan).length === 0;
}

/** Approve the gate. Any later edit re-opens it (approvedAt → null upstream). */
export function approveClonePlan(plan: ClonePlan, now = new Date().toISOString()): ClonePlan {
  return { ...plan, approvedAt: now, updatedAt: now };
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
    ...(asString(o.finalPrompt).trim() ? { finalPrompt: asString(o.finalPrompt).slice(0, 2000) } : {}),
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
    ...(Number.isFinite(asNumber(o.startSec, NaN)) ? { startSec: asNumber(o.startSec) } : {}),
    ...(Number.isFinite(asNumber(o.endSec, NaN)) ? { endSec: asNumber(o.endSec) } : {}),
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
  // THE TIMESTAMP STAMP: every beat carries its timeline window, derived
  // from order + duration — always right, after any edit, by construction.
  let cursor = 0;
  for (const b of beats) {
    b.startSec = cursor;
    b.endSec = cursor + b.durationSec;
    cursor = b.endSec;
  }
  return {
    clone,
    videoType: asString(o.videoType) || CLONE_VIDEO_TYPES[0].id,
    framework: asString(o.framework) || CLONE_FRAMEWORKS[0].id,
    beats,
    approvedAt: asString(o.approvedAt) || null,
    seedanceTier: SEEDANCE_TIERS.includes(o.seedanceTier as SeedanceTier)
      ? (o.seedanceTier as SeedanceTier)
      : 'seedance-2.0',
    ...(isHttpUrl(o.sceneSheetUrl) ? { sceneSheetUrl: asString(o.sceneSheetUrl).trim() } : {}),
    ...(Array.isArray(o.sceneSheetUrls)
      ? {
          sceneSheetUrls: (o.sceneSheetUrls as unknown[])
            .filter((u): u is string => isHttpUrl(u))
            .slice(0, 8),
        }
      : {}),
    ...(Number.isFinite(asNumber(o.sheetPanels, NaN))
      ? { sheetPanels: Math.max(1, Math.min(12, Math.round(asNumber(o.sheetPanels)))) }
      : {}),
    ...(Array.isArray(o.sheetScenes)
      ? {
          sheetScenes: (o.sheetScenes as unknown[])
            .map((g) =>
              (Array.isArray(g) ? g : [])
                .map((n) => Math.round(asNumber(n, -1)))
                .filter((n) => n >= 0)
                .slice(0, 24),
            )
            .filter((g) => g.length > 0)
            .slice(0, 8),
        }
      : {}),
    ...(asString(o.sceneSheetAt) ? { sceneSheetAt: asString(o.sceneSheetAt) } : {}),
    ...(asString(o.contextLabel).trim()
      ? { contextLabel: asString(o.contextLabel).trim().slice(0, 120) }
      : {}),
    ...(asString(o.captionPreset).trim()
      ? { captionPreset: asString(o.captionPreset).trim().slice(0, 60) }
      : {}),
    ...(isHttpUrl(o.productImageUrl)
      ? { productImageUrl: asString(o.productImageUrl).trim() }
      : {}),
    createdAt: asString(o.createdAt) || null,
    updatedAt: asString(o.updatedAt) || null,
  };
}

/**
 * The scene-sheet forge prompt: ONE multi-panel board, a panel per beat —
 * the character inside each beat's scene, in the picked style, the look
 * bible quoted. This is the congruence contract: the world is decided ONCE,
 * here, and every render quotes it.
 */
export function sceneSheetPrompt(
  plan: ClonePlan,
  styleId?: string,
  /** True when the character sheet rides the call as the seed/reference. */
  seeded?: boolean,
  /** Burn each panel's timestamp + the spoken line onto the sheet itself. */
  burnScript?: boolean,
): string {
  const style = cloneSheetStyleFor(styleId);
  const bible = lookBibleString(plan.clone.lookBible);
  const panels = plan.beats.map((b, i) => {
    const what =
      b.kind === 'broll'
        ? (b.brollPrompt ?? 'visual beat')
        : `${b.shot} talking-head frame of the character delivering: "${b.line.slice(0, 80)}"`;
    return `Panel ${i + 1} (${b.startSec ?? 0}-${b.endSec ?? b.durationSec}s): ${what}`;
  });
  return [
    'A single SCENE SHEET for one video — a multi-panel storyboard board where each panel is ONE beat of the script below, the SAME character in every panel:',
    `${plan.clone.name}.`,
    plan.productImageUrl
      ? 'THE PRODUCT: the product image rides this forge as a reference — it appears in the panels that show the thing being sold (the app screen, the box), exactly as it looks in the reference.'
      : '',
    seeded
      ? 'The attached reference image IS the character — the exact same person (face, hair, wardrobe) appears in every panel.'
      : '',
    style.direction,
    'The panels, in script order:',
    ...panels,
    bible ? `${bible}.` : '',
    'CHARACTER + WORLD CONSISTENCY (STRICT): identical facial structure, hairstyle, and wardrobe logic in every panel; the world evolves naturally panel to panel like one continuous shoot — never stock poses, never a reset.',
    burnScript
      ? 'BURN THE SCRIPT (on): each panel carries a small clean caption strip at its bottom — the panel\'s timestamp window (e.g. "0–10s") and the spoken line (or the b-roll note) in a legible condensed sans, bone-white on a dark chip. Never cover the subject\'s face.'
      : 'Photorealistic, sharp focus, no text, no watermark, no logos.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Resize the scene list: pad with blank b-roll scenes (the Sheet Studio
 * fills their visuals) or trim from the end. Pure — the caller saves.
 */
export function cloneSceneCountAdjust(plan: ClonePlan, count: number): ClonePlan {
  const target = Math.max(1, Math.min(12, Math.round(count)));
  const beats = plan.beats.slice();
  while (beats.length < target) {
    beats.push({
      id: makeBeatId(),
      index: beats.length,
      kind: 'broll',
      line: '',
      shot: 'medium',
      durationSec: 5,
      refs: [],
      brollPrompt: '',
      status: 'planned',
    });
  }
  return {
    ...plan,
    beats: beats.slice(0, target).map((b, i) => ({ ...b, index: i })),
    approvedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

/** The scene sheet is stale when the plan changed after it was forged. */
export function sceneSheetStale(plan: ClonePlan): boolean {
  if (!plan.sceneSheetUrl || !plan.sceneSheetAt) return false;
  return !!plan.updatedAt && plan.updatedAt > plan.sceneSheetAt;
}

/**
 * THE sheet resolver for a beat: sheets-by-world first (the sheet whose scene
 * list contains this beat), then the even-slice fallback, then the single
 * sheet. The generate route quotes THIS sheet for the beat.
 */
export function cloneSheetForBeat(plan: ClonePlan, beatIndex: number): string | null {
  const sheets = plan.sceneSheetUrls ?? (plan.sceneSheetUrl ? [plan.sceneSheetUrl] : []);
  if (sheets.length === 0) return null;
  if (plan.sheetScenes && plan.sheetScenes.length === sheets.length) {
    const k = plan.sheetScenes.findIndex((g) => g.includes(beatIndex));
    if (k >= 0) return sheets[k];
  }
  const perBeat = Math.max(1, plan.sheetPanels ?? plan.beats.length);
  return sheets[Math.min(sheets.length - 1, Math.floor(beatIndex / perBeat))];
}

/**
 * Group a Production Plan's scenes into WORLDS (first-appearance order).
 * Unlabeled scenes fold into the previous world (or 'the main world').
 */
export function producerWorldGroups(
  scenes: { world?: string }[],
): { world: string; indices: number[] }[] {
  const out: { world: string; indices: number[] }[] = [];
  scenes.forEach((s, i) => {
    const label = (s.world ?? '').trim().slice(0, 60);
    const last = out[out.length - 1];
    if (label && last && last.world === label) {
      last.indices.push(i);
    } else if (label) {
      out.push({ world: label, indices: [i] });
    } else if (last) {
      last.indices.push(i); // unlabeled — rides the previous world
    } else {
      out.push({ world: 'the main world', indices: [i] });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// THE PRODUCER — the AI-scoped video pipeline (intake → plan → the manifest)
// ---------------------------------------------------------------------------

/**
 * A producer style preset: the rails the AI plans inside. Each maps to a
 * video type + framework + sheet style + the caption feel — the intake
 * question "what kind of video?" answers itself with one of these.
 */
export interface ProducerStyle {
  id: string;
  label: string;
  hint: string;
  videoType: string;
  sheetStyle: string;
  /** The caption preset id the assemble step suggests. */
  captionPreset: string;
}

export const PRODUCER_STYLES: ProducerStyle[] = [
  { id: 'ugc-ad', label: 'UGC ad', hint: 'phone-real first-person proof', videoType: 'ugc', sheetStyle: 'ugc', captionPreset: 'karaoke-pop' },
  { id: 'hook-ad', label: 'Hook ad', hint: '5/10/15s scroll-stopper', videoType: 'hook-ad', sheetStyle: 'cinematic', captionPreset: 'karaoke-pop' },
  { id: 'vsl', label: 'VSL', hint: 'long-form sales argument', videoType: 'vsl', sheetStyle: 'vsl', captionPreset: 'minimal-clean' },
  { id: 'tutorial', label: 'Tutorial', hint: 'teach one thing well', videoType: 'tutorial', sheetStyle: 'editorial', captionPreset: 'minimal-clean' },
  { id: 'announcement', label: 'Announcement', hint: 'one piece of news, fast', videoType: 'announcement', sheetStyle: 'cinematic', captionPreset: 'bold-title' },
  { id: 'cinematic-story', label: 'Cinematic story', hint: 'the filmic arc, scene-linked', videoType: 'vsl', sheetStyle: 'cinematic', captionPreset: 'cinematic-lower' },
];

export function producerStyleFor(id?: string): ProducerStyle {
  return PRODUCER_STYLES.find((s) => s.id === id) ?? PRODUCER_STYLES[0];
}

/**
 * The Production Plan — what the producer decides from the brief, before a
 * dollar moves. Editable on the plan card; approving it writes the manifest.
 */
export interface ProductionPlan {
  /** The working title + the topic the script writer runs on. */
  title: string;
  topic: string;
  videoType: string;
  framework: string;
  /** Scenes the writer should produce (count + seconds each). */
  beatCount: number;
  beatSec: number;
  /** Per-scene intent, in order — kind + the visual/line idea + its WORLD. */
  scenes: { kind: CloneBeatKind; idea: string; seedanceTier?: SeedanceTier; world?: string }[];
  /** Sheet needs: forge the character sheet? how many scene panels? */
  needsCharacterSheet: boolean;
  scenePanels: number;
  /** The voice plan. */
  voicePlan: 'twin-voice' | 'stock-voice' | 'record-voice';
  /** The caption preset id for the assemble step. */
  captionPreset: string;
  /** The producer's direction notes (rides as script guides). */
  notes: string;
}

/** Defensive normalizer — the plan card never crashes on a stray model word. */
export function normalizeProductionPlan(raw: unknown): ProductionPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const topic = asString(o.topic).trim().slice(0, 400);
  if (!topic) return null;
  const scenes = (Array.isArray(o.scenes) ? o.scenes : [])
    .map((s) => {
      const r = s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
      const idea = asString(r.idea).trim().slice(0, 200);
      if (!idea) return null;
      return {
        kind: (r.kind === 'broll' ? 'broll' : 'avatar') as CloneBeatKind,
        idea,
        ...(SEEDANCE_TIERS.includes(r.seedanceTier as SeedanceTier)
          ? { seedanceTier: r.seedanceTier as SeedanceTier }
          : {}),
        ...(asString(r.world).trim() ? { world: asString(r.world).trim().slice(0, 60) } : {}),
      };
    })
    .filter((s): s is NonNullable<typeof s> => !!s)
    .slice(0, 12);
  const beatCount = Math.max(1, Math.min(12, Math.round(asNumber(o.beatCount, scenes.length || 3))));
  return {
    title: asString(o.title).trim().slice(0, 80) || topic.slice(0, 60),
    topic,
    videoType: asString(o.videoType) || CLONE_VIDEO_TYPES[0].id,
    framework: asString(o.framework) || CLONE_FRAMEWORKS[0].id,
    beatCount,
    beatSec: Math.max(5, Math.min(15, Math.round(asNumber(o.beatSec, 10)))),
    scenes,
    needsCharacterSheet: o.needsCharacterSheet === true,
    scenePanels: Math.max(0, Math.min(12, Math.round(asNumber(o.scenePanels, beatCount)))),
    voicePlan: ['twin-voice', 'stock-voice', 'record-voice'].includes(asString(o.voicePlan))
      ? (asString(o.voicePlan) as ProductionPlan['voicePlan'])
      : 'twin-voice',
    captionPreset: asString(o.captionPreset).slice(0, 60) || 'karaoke-pop',
    notes: asString(o.notes).slice(0, 500),
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

// ---------------------------------------------------------------------------
// The clone library (every clone you've built, pickable on any reel)
// ---------------------------------------------------------------------------

/** A clone built on another reel, offered in this reel's picker. */
export interface CloneLibraryEntry {
  reelId: string;
  reelName: string;
  clone: ReelClone;
  /** Ready to cast: a sheet (or ref photo) + a voice id. */
  ready: boolean;
}

/**
 * The clone library: every OTHER reel's saved clonePlan, in list order.
 * Copy semantics — picking one fills this reel's form, and saving writes an
 * independent copy onto this reel's manifest (no shared mutable state). The
 * current reel is excluded: its clone is already loaded.
 */
export function cloneLibraryEntries(
  projects: { id: string; name: string; clonePlan?: unknown }[],
  excludeReelId: string,
): CloneLibraryEntry[] {
  const out: CloneLibraryEntry[] = [];
  for (const p of projects) {
    if (p.id === excludeReelId) continue;
    const plan = normalizeClonePlan(p.clonePlan ?? null);
    if (!plan) continue;
    out.push({
      reelId: p.id,
      reelName: p.name || 'Untitled reel',
      clone: plan.clone,
      ready: !!(plan.clone.sheetUrl ?? plan.clone.refPhotos[0]) && !!plan.clone.voice.voiceId,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The twin roster (the /admin/ai-twins bridge over per-reel manifests)
// ---------------------------------------------------------------------------

/**
 * Twin records ride reel projects until the roster earns its own table: a
 * roster reel is named `Twin: <name>`, has no scenes, and its clonePlan's
 * clone IS the twin. The studio hides roster reels from its reel picker.
 */
export const TWIN_REEL_PREFIX = 'Twin: ';

export function isTwinReel(name: string): boolean {
  return name.trim().startsWith(TWIN_REEL_PREFIX);
}

export function twinReelName(cloneName: string): string {
  return `${TWIN_REEL_PREFIX}${cloneName.trim().slice(0, 60)}`;
}

/** One card on the twins page. */
export interface TwinRosterEntry {
  reelId: string;
  reelName: string;
  clone: ReelClone;
  /** True when the record is a dedicated roster reel (`Twin: …`). */
  rosterRecord: boolean;
  /** Ready to cast: a sheet (or ref photo) + a voice id. */
  ready: boolean;
  beats: number;
  rendered: number;
  approved: boolean;
}

/**
 * The twin roster: every reel carrying a clonePlan, roster records first.
 * This is the UI-first bridge — the data model promotes to a real table
 * when the flow proves itself (docs/AI_CLONE_VIDEO_PORT.md).
 */
export function twinRoster(
  projects: { id: string; name: string; clonePlan?: unknown }[],
): TwinRosterEntry[] {
  const out: TwinRosterEntry[] = [];
  for (const p of projects) {
    const plan = normalizeClonePlan(p.clonePlan ?? null);
    if (!plan) continue;
    out.push({
      reelId: p.id,
      reelName: p.name || 'Untitled reel',
      clone: plan.clone,
      rosterRecord: isTwinReel(p.name),
      ready: !!(plan.clone.sheetUrl ?? plan.clone.refPhotos[0]) && !!plan.clone.voice.voiceId,
      beats: plan.beats.length,
      rendered: plan.beats.filter((b) => b.status === 'generated' && !!b.videoUrl).length,
      approved: !!plan.approvedAt,
    });
  }
  return out.sort((a, b) => Number(b.rosterRecord) - Number(a.rosterRecord));
}
