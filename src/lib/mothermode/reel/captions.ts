/**
 * R17 caption presets — STRUCTURED, data-driven looks (Submagic-style gallery).
 *
 * Each preset is a plain-data `CaptionStyleDef` (font + weight + case + colors +
 * highlight mode), NOT a Tailwind class blob — so the same def drives BOTH the
 * live canvas preview (`captionCssFor`) AND a future ffmpeg burn-in (`assFor`).
 *
 * The legacy R3 API (`CAPTION_PRESETS`, `captionStyleFor`, Tailwind classes) is
 * kept as a deprecated shim so saved reels with old preset ids never break:
 * karaoke→hormozi2, beast→beast, hormozi→hormozi1, minimal→minimal.
 */
import type { CaptionPreset, ReelWord } from './types';

// ---------------------------------------------------------------------------
// Structured style model (R17a)
// ---------------------------------------------------------------------------

export type CaptionTag = 'new' | 'trend' | 'premium';
export type HighlightMode =
  | 'color'
  | 'box'
  | 'sweep'
  | 'underline'
  | 'scale'
  | 'glow'
  | 'boxGrow'
  | 'gradient';

/**
 * Word-ENTER animation (the spoken word's entrance each time it lights up).
 * pop = soft scale-up · fade = fade-in · slide = slide up from below ·
 * flip = flip in on the X axis · spin = a subtle rotate-in · bounce = springy
 * overshoot · blurIn = the Opus-Clip blur resolve · riseUp = clean rise+fade ·
 * elastic = squash-and-stretch · glitch = 2-frame RGB split · typeOn = a
 * left-to-right wipe reveal · shake = a 3-cycle emphasis wobble. '' = none.
 */
export type CaptionAnim =
  | ''
  | 'pop'
  | 'fade'
  | 'slide'
  | 'flip'
  | 'spin'
  | 'bounce'
  | 'blurIn'
  | 'riseUp'
  | 'elastic'
  | 'glitch'
  | 'typeOn'
  | 'shake';

/** The CSS keyframe for a word-enter animation (injected once into the page). */
export function captionAnimKeyframes(anim: CaptionAnim): string {
  switch (anim) {
    case 'pop':
      return `@keyframes cap-pop{0%{transform:scale(0.82);opacity:.3}100%{transform:scale(1);opacity:1}}`;
    case 'fade':
      return `@keyframes cap-fade{0%{opacity:0}100%{opacity:1}}`;
    case 'slide':
      return `@keyframes cap-slide{0%{transform:translateY(0.5em);opacity:0}100%{transform:translateY(0);opacity:1}}`;
    case 'flip':
      return `@keyframes cap-flip{0%{transform:rotateX(90deg);opacity:0}100%{transform:rotateX(0);opacity:1}}`;
    case 'spin':
      return `@keyframes cap-spin{0%{transform:rotate(-6deg) scale(0.9);opacity:.3}100%{transform:rotate(0) scale(1);opacity:1}}`;
    case 'bounce':
      return `@keyframes cap-bounce{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}`;
    case 'blurIn':
      return `@keyframes cap-blurin{0%{filter:blur(10px);transform:scale(1.06);opacity:.2}100%{filter:blur(0);transform:scale(1);opacity:1}}`;
    case 'riseUp':
      return `@keyframes cap-riseup{0%{transform:translateY(0.35em);opacity:0}100%{transform:translateY(0);opacity:1}}`;
    case 'elastic':
      return `@keyframes cap-elastic{0%{transform:scale(0.7,1.25);opacity:.4}45%{transform:scale(1.12,0.9)}70%{transform:scale(0.96,1.04)}100%{transform:scale(1,1);opacity:1}}`;
    case 'glitch':
      return `@keyframes cap-glitch{0%{text-shadow:-2px 0 #f0f,2px 0 #0ff;transform:translateX(-2px);opacity:.6}50%{text-shadow:2px 0 #f0f,-2px 0 #0ff;transform:translateX(2px)}100%{text-shadow:none;transform:none;opacity:1}}`;
    case 'typeOn':
      return `@keyframes cap-typeon{0%{clip-path:inset(0 100% 0 0);opacity:.4}100%{clip-path:inset(0 0 0 0);opacity:1}}`;
    case 'shake':
      return `@keyframes cap-shake{0%,100%{transform:translate(0,0) rotate(0)}20%{transform:translate(2px,-1px) rotate(2deg)}40%{transform:translate(-2px,1px) rotate(-2deg)}60%{transform:translate(1px,1px) rotate(1deg)}80%{transform:translate(-1px,-1px) rotate(-1deg)}}`;
    default:
      return '';
  }
}

/** The animation shorthand for a word-enter animation (duration + easing). */
export function captionAnimCss(anim: CaptionAnim): string {
  switch (anim) {
    case 'pop':
      return 'cap-pop 190ms cubic-bezier(0.2,0.9,0.3,1.3)';
    case 'fade':
      return 'cap-fade 220ms ease';
    case 'slide':
      return 'cap-slide 200ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'flip':
      return 'cap-flip 220ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'spin':
      return 'cap-spin 220ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'bounce':
      return 'cap-bounce 210ms cubic-bezier(0.34,1.56,0.64,1)';
    case 'blurIn':
      return 'cap-blurin 220ms ease-out';
    case 'riseUp':
      return 'cap-riseup 180ms cubic-bezier(0.2,0.8,0.3,1)';
    case 'elastic':
      return 'cap-elastic 220ms cubic-bezier(0.3,1.4,0.5,1)';
    case 'glitch':
      return 'cap-glitch 160ms steps(2, end)';
    case 'typeOn':
      return 'cap-typeon 200ms cubic-bezier(0.3,0.7,0.4,1)';
    case 'shake':
      return 'cap-shake 220ms ease-in-out';
    default:
      return '';
  }
}

/** Every word-enter animation — the gallery + tests iterate this. */
export const CAPTION_ANIMS: CaptionAnim[] = [
  'pop',
  'fade',
  'slide',
  'flip',
  'spin',
  'bounce',
  'blurIn',
  'riseUp',
  'elastic',
  'glitch',
  'typeOn',
  'shake',
];

export interface CaptionStyleDef {
  /** Stable id — stored on project.captionStyle (e.g. 'kelly2'). */
  id: string;
  /** Gallery label (e.g. 'Kelly 2'). */
  label: string;
  /** Gallery badges (filter chips). */
  tags: CaptionTag[];
  /** Google-font family name (the canvas stacks a fallback chain). */
  font: string;
  weight: 400 | 600 | 700 | 800 | 900;
  /** Uppercase every word at render time. */
  upper: boolean;
  italic?: boolean;
  /** Idle word color. */
  wordColor: string;
  /** Active (currently spoken) word color. */
  activeColor: string;
  /** Optional highlight box behind the active word (Kelly = green box). */
  activeBg?: string;
  /** How the active word is emphasized. */
  highlightMode: HighlightMode;
  /** Text stroke (paint-order outline) — Hormozi's heavy black outline. */
  stroke?: { color: string; width: number };
  /** CSS text-shadow. */
  shadow?: string;
  /** Submagic's punchy 1-word beats vs phrase lines. */
  wordsPerLine: 1 | 2 | 3;
  /** Auto-emoji slot on the active word (premium presets). */
  emoji?: boolean;
  /** Word-ENTER animation when the spoken word lights up (default 'pop'). */
  anim?: CaptionAnim;
  /** Gradient text fill on the ACTIVE word (ultra-modern: needs background-clip). */
  gradient?: [string, string];
  /** Big-word emphasis: the active word renders ~1.6× (the "big word" beat). */
  big?: boolean;
  /** Letter spacing in em (negative tightens, positive tracks out). Default ~0.01–0.03. */
  letterSpacingEm?: number;
  /** Space BETWEEN words in em (the airy, spaced-out caption look). Default 0. */
  wordSpacingEm?: number;
  /** Rounded card behind the whole caption LINE (Soft Card look), as CSS color. */
  lineBg?: string;
}

/**
 * The preset roster — ~24 archetypes mirroring the Submagic gallery.
 * Hormozi 1–5 (bold sans, yellow/green active), Beast (heavy + yellow box),
 * Kelly 2 (script accent + green box), Devin/Tracy/Luke (clean sans),
 * Dan 2 (italic serif), Leon (orange), William (yellow highlight)…
 */
export const CAPTION_STYLE_DEFS: CaptionStyleDef[] = [
  // --- Hormozi family (heavy sans, heavy black outline, bright active) ------
  {
    id: 'hormozi1', label: 'Hormozi 1', tags: ['trend'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#F8E16C', highlightMode: 'scale',
    stroke: { color: '#000000', width: 2 },
    shadow: '0 4px 8px rgba(0,0,0,0.85)',
    wordsPerLine: 3,
  },
  {
    id: 'hormozi2', label: 'Hormozi 2', tags: ['trend'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#A8E063', highlightMode: 'color',
    stroke: { color: '#000000', width: 2 },
    shadow: '0 4px 8px rgba(0,0,0,0.85)',
    wordsPerLine: 3,
  },
  {
    id: 'hormozi3', label: 'Hormozi 3', tags: [],
    font: 'Anton', weight: 800, upper: true,
    wordColor: '#FFFFFF', activeColor: '#4ADE80', highlightMode: 'scale',
    stroke: { color: '#000000', width: 2 },
    wordsPerLine: 2,
  },
  {
    id: 'hormozi4', label: 'Hormozi 4', tags: ['new'],
    font: 'Bebas Neue', weight: 700, upper: true,
    wordColor: '#FFFFFF', activeColor: '#FFD400', highlightMode: 'box',
    activeBg: '#000000',
    stroke: { color: '#000000', width: 1.5 },
    wordsPerLine: 2,
  },
  {
    id: 'hormozi5', label: 'Hormozi 5', tags: ['premium'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: '#F5F5F5', activeColor: '#22D3EE', highlightMode: 'scale',
    stroke: { color: '#000000', width: 2.5 },
    shadow: '0 6px 14px rgba(0,0,0,0.9)',
    wordsPerLine: 1,
  },
  // --- Beast (heavy, ALL-CAPS, yellow box behind the active word) -----------
  {
    id: 'beast', label: 'Beast', tags: ['trend'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: 'rgba(255,255,255,0.9)', activeColor: '#0B0B0B', highlightMode: 'box',
    activeBg: '#FDE047',
    shadow: '0 3px 6px rgba(0,0,0,0.95)',
    wordsPerLine: 3,
  },
  // --- Kelly 2 (script accent + green highlight box) ------------------------
  {
    id: 'kelly2', label: 'Kelly 2', tags: ['trend', 'new'],
    font: 'Inter', weight: 800, upper: false,
    wordColor: '#FFFFFF', activeColor: '#0B0B0B', highlightMode: 'box',
    activeBg: '#4ADE80',
    shadow: '0 2px 4px rgba(0,0,0,0.9)',
    wordsPerLine: 3,
  },
  // --- Clean sans variants ---------------------------------------------------
  {
    id: 'devin', label: 'Devin', tags: [],
    font: 'Inter', weight: 700, upper: false,
    wordColor: 'rgba(255,255,255,0.9)', activeColor: '#F8E16C', highlightMode: 'color',
    shadow: '0 2px 4px rgba(0,0,0,0.9)',
    wordsPerLine: 3,
  },
  {
    id: 'tracy', label: 'Tracy', tags: [],
    font: 'Inter', weight: 600, upper: false,
    wordColor: 'rgba(255,255,255,0.85)', activeColor: '#F8E16C', highlightMode: 'underline',
    shadow: '0 1px 3px rgba(0,0,0,0.9)',
    wordsPerLine: 3,
  },
  {
    id: 'luke', label: 'Luke', tags: ['new'],
    font: 'Poppins', weight: 700, upper: false,
    wordColor: '#FFFFFF', activeColor: '#FB923C', highlightMode: 'scale',
    shadow: '0 2px 5px rgba(0,0,0,0.9)',
    wordsPerLine: 2,
  },
  // --- Dan 2 (italic serif) --------------------------------------------------
  {
    id: 'dan2', label: 'Dan 2', tags: [],
    font: 'Georgia', weight: 700, upper: false, italic: true,
    wordColor: '#FFFFFF', activeColor: '#F8E16C', highlightMode: 'color',
    shadow: '0 2px 4px rgba(0,0,0,0.9)',
    wordsPerLine: 3,
  },
  // --- Leon (orange) ----------------------------------------------------------
  {
    id: 'leon', label: 'Leon', tags: ['trend'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#FB923C', highlightMode: 'scale',
    stroke: { color: '#000000', width: 2 },
    wordsPerLine: 2,
  },
  // --- William (yellow highlight sweep) ---------------------------------------
  {
    id: 'william', label: 'William', tags: ['premium'],
    font: 'Inter', weight: 800, upper: false,
    wordColor: 'rgba(255,255,255,0.55)', activeColor: '#0B0B0B', highlightMode: 'box',
    activeBg: '#FDE047',
    wordsPerLine: 3,
  },
  // --- The rest of the archetype bench ---------------------------------------
  {
    id: 'karaoke', label: 'Karaoke', tags: [],
    font: 'Inter', weight: 700, upper: false,
    wordColor: 'rgba(255,255,255,0.85)', activeColor: '#A88B5C', highlightMode: 'color',
    shadow: '0 2px 4px rgba(0,0,0,0.9)',
    wordsPerLine: 3,
  },
  {
    id: 'minimal', label: 'Minimal', tags: [],
    font: 'Inter', weight: 600, upper: false,
    wordColor: 'rgba(255,255,255,0.75)', activeColor: '#FFFFFF', highlightMode: 'color',
    shadow: '0 1px 3px rgba(0,0,0,0.9)',
    wordsPerLine: 3,
  },
  {
    id: 'pop', label: 'Pop', tags: ['new'],
    font: 'Poppins', weight: 800, upper: true,
    wordColor: '#FFFFFF', activeColor: '#F472B6', highlightMode: 'scale',
    shadow: '0 3px 6px rgba(0,0,0,0.9)',
    wordsPerLine: 1, emoji: true,
  },
  {
    id: 'neon', label: 'Neon', tags: ['premium'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#22D3EE', highlightMode: 'color',
    shadow: '0 0 10px rgba(34,211,238,0.8), 0 2px 4px rgba(0,0,0,0.9)',
    wordsPerLine: 2,
  },
  {
    id: 'retro', label: 'Retro', tags: [],
    font: 'Bebas Neue', weight: 700, upper: true,
    wordColor: '#FFF7ED', activeColor: '#FBBF24', highlightMode: 'color',
    stroke: { color: '#7C2D12', width: 1 },
    wordsPerLine: 3,
  },
  {
    id: 'typewriter', label: 'Typewriter', tags: [],
    font: 'Courier Prime', weight: 700, upper: false,
    wordColor: 'rgba(255,255,255,0.9)', activeColor: '#FFFFFF', highlightMode: 'underline',
    shadow: '0 1px 2px rgba(0,0,0,0.9)',
    wordsPerLine: 3,
  },
  {
    id: 'bold-box', label: 'Bold Box', tags: ['new'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#FFFFFF', highlightMode: 'box',
    activeBg: '#DC2626',
    wordsPerLine: 2,
  },
  {
    id: 'soft', label: 'Soft', tags: [],
    font: 'Poppins', weight: 600, upper: false,
    wordColor: 'rgba(255,255,255,0.8)', activeColor: '#F8E16C', highlightMode: 'color',
    shadow: '0 1px 4px rgba(0,0,0,0.7)',
    wordsPerLine: 3,
  },
  {
    id: 'impact', label: 'Impact', tags: ['trend'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#F8E16C', highlightMode: 'scale',
    stroke: { color: '#000000', width: 3 },
    wordsPerLine: 1,
  },
  {
    id: 'elegant', label: 'Elegant', tags: ['premium'],
    font: 'Playfair Display', weight: 700, upper: false, italic: true,
    wordColor: 'rgba(255,255,255,0.9)', activeColor: '#E7C873', highlightMode: 'color',
    shadow: '0 2px 6px rgba(0,0,0,0.85)',
    wordsPerLine: 3,
  },
  {
    id: 'gamer', label: 'Gamer', tags: ['new'],
    font: 'Rubik Mono One', weight: 700, upper: true,
    wordColor: '#FFFFFF', activeColor: '#A3E635', highlightMode: 'color',
    stroke: { color: '#000000', width: 2 },
    wordsPerLine: 2, emoji: true,
  },
  // --- ULTRA-MODERN batch (gradient / big-word / fade-on / rotating / emoji) ---
  {
    id: 'gradient-pop', label: 'Gradient', tags: ['new', 'trend'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: 'rgba(255,255,255,0.85)', activeColor: '#FFFFFF', highlightMode: 'color',
    gradient: ['#F472B6', '#A78BFA'],
    shadow: '0 3px 10px rgba(0,0,0,0.9)',
    wordsPerLine: 3, anim: 'pop',
  },
  {
    id: 'bigword', label: 'Big Word', tags: ['trend'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: 'rgba(255,255,255,0.55)', activeColor: '#FFD400', highlightMode: 'color',
    stroke: { color: '#000000', width: 2 },
    shadow: '0 4px 12px rgba(0,0,0,0.95)',
    wordsPerLine: 1, anim: 'pop', big: true,
  },
  {
    id: 'fadeon', label: 'Fade On', tags: ['new'],
    font: 'Inter', weight: 700, upper: false,
    wordColor: 'rgba(255,255,255,0.4)', activeColor: '#FFFFFF', highlightMode: 'color',
    shadow: '0 2px 8px rgba(0,0,0,0.9)',
    wordsPerLine: 3, anim: 'fade',
  },
  {
    id: 'slider', label: 'Slider', tags: ['new'],
    font: 'Poppins', weight: 800, upper: false,
    wordColor: 'rgba(255,255,255,0.7)', activeColor: '#4ADE80', highlightMode: 'color',
    shadow: '0 2px 8px rgba(0,0,0,0.9)',
    wordsPerLine: 2, anim: 'slide',
  },
  {
    id: 'flipper', label: 'Flipper', tags: ['new', 'premium'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#22D3EE', highlightMode: 'color',
    stroke: { color: '#000000', width: 2 },
    wordsPerLine: 1, anim: 'flip', big: true,
  },
  {
    id: 'spinner', label: 'Spinner', tags: ['new'],
    font: 'Bebas Neue', weight: 700, upper: true,
    wordColor: 'rgba(255,255,255,0.8)', activeColor: '#FB923C', highlightMode: 'color',
    stroke: { color: '#000000', width: 1.5 },
    wordsPerLine: 2, anim: 'spin',
  },
  {
    id: 'party', label: 'Party', tags: ['new', 'trend'],
    font: 'Poppins', weight: 800, upper: false,
    wordColor: '#FFFFFF', activeColor: '#F8E16C', highlightMode: 'scale',
    gradient: ['#FBBF24', '#F472B6'],
    shadow: '0 3px 8px rgba(0,0,0,0.9)',
    wordsPerLine: 1, emoji: true, anim: 'spin',
  },
  // --- MODERN batch 2 (bounce / blur / rise / elastic / glitch / type / shake) ---
  {
    id: 'opus', label: 'Opus', tags: ['new', 'trend'],
    font: 'Inter', weight: 800, upper: false,
    wordColor: 'rgba(255,255,255,0.5)', activeColor: '#FFFFFF', highlightMode: 'glow',
    shadow: '0 2px 8px rgba(0,0,0,0.9)',
    wordsPerLine: 3, anim: 'blurIn',
  },
  {
    id: 'neon-pulse', label: 'Neon Pulse', tags: ['new', 'premium'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#22D3EE', highlightMode: 'glow',
    stroke: { color: '#000000', width: 1.5 },
    wordsPerLine: 2, anim: 'elastic',
  },
  {
    id: 'clean-rise', label: 'Clean Rise', tags: ['new'],
    font: 'Inter', weight: 600, upper: false,
    wordColor: 'rgba(255,255,255,0.85)', activeColor: '#FFFFFF', highlightMode: 'underline',
    shadow: '0 1px 3px rgba(0,0,0,0.85)',
    wordsPerLine: 3, anim: 'riseUp', letterSpacingEm: 0.02, wordSpacingEm: 0.12,
  },
  {
    id: 'impact-shake', label: 'Impact Shake', tags: ['new', 'trend'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#0B0B0B', highlightMode: 'box',
    activeBg: '#FDE047',
    stroke: { color: '#000000', width: 2.5 },
    wordsPerLine: 1, anim: 'shake',
  },
  {
    id: 'glitch-tape', label: 'Glitch Tape', tags: ['new'],
    font: 'Rubik Mono One', weight: 700, upper: true,
    wordColor: 'rgba(255,255,255,0.85)', activeColor: '#F0ABFC', highlightMode: 'box',
    activeBg: 'rgba(10,10,10,0.85)',
    shadow: '0 2px 6px rgba(0,0,0,0.95)',
    wordsPerLine: 2, anim: 'glitch',
  },
  {
    id: 'soft-card', label: 'Soft Card', tags: ['new'],
    font: 'Poppins', weight: 700, upper: false,
    wordColor: '#FFFFFF', activeColor: '#F8E16C', highlightMode: 'scale',
    lineBg: 'rgba(10,10,12,0.55)',
    wordsPerLine: 3, anim: 'fade', wordSpacingEm: 0.08,
  },
  {
    id: 'mono-beat', label: 'Mono Beat', tags: ['new'],
    font: 'Bebas Neue', weight: 700, upper: true,
    wordColor: '#FFFFFF', activeColor: '#A88B5C', highlightMode: 'color',
    stroke: { color: '#000000', width: 1.5 },
    wordsPerLine: 1, anim: 'elastic', letterSpacingEm: 0.05,
  },
  {
    id: 'bounce-box', label: 'Bounce Box', tags: ['new', 'trend'],
    font: 'Poppins', weight: 800, upper: true,
    wordColor: '#FFFFFF', activeColor: '#0B0B0B', highlightMode: 'boxGrow',
    activeBg: '#4ADE80',
    shadow: '0 3px 8px rgba(0,0,0,0.9)',
    wordsPerLine: 2, anim: 'bounce',
  },
  {
    id: 'gradient-flow', label: 'Gradient Flow', tags: ['new', 'premium'],
    font: 'Archivo Black', weight: 900, upper: false,
    wordColor: 'rgba(255,255,255,0.7)', activeColor: '#FFFFFF', highlightMode: 'gradient',
    gradient: ['#22D3EE', '#A78BFA'],
    shadow: '0 3px 10px rgba(0,0,0,0.9)',
    wordsPerLine: 3, anim: 'riseUp', letterSpacingEm: 0.015,
  },
  {
    id: 'type-swift', label: 'Type Swift', tags: ['new'],
    font: 'Courier Prime', weight: 700, upper: false,
    wordColor: 'rgba(255,255,255,0.75)', activeColor: '#FFFFFF', highlightMode: 'color',
    shadow: '0 1px 3px rgba(0,0,0,0.9)',
    wordsPerLine: 3, anim: 'typeOn', wordSpacingEm: 0.1,
  },
];

const DEF_BY_ID = new Map(CAPTION_STYLE_DEFS.map((d) => [d.id, d]));

/** Legacy R3 ids → the R17 def that best matches their old look. */
const LEGACY_MAP: Record<string, string> = {
  karaoke: 'karaoke',
  beast: 'beast',
  hormozi: 'hormozi1',
  minimal: 'minimal',
};

/** Resolve any id (new OR legacy) to a def; junk falls back to karaoke. */
export function captionDefFor(id: string | undefined | null): CaptionStyleDef {
  if (!id) return DEF_BY_ID.get('karaoke')!;
  const direct = DEF_BY_ID.get(id);
  if (direct) return direct;
  const mapped = LEGACY_MAP[id];
  if (mapped && DEF_BY_ID.has(mapped)) return DEF_BY_ID.get(mapped)!;
  return DEF_BY_ID.get('karaoke')!;
}

// ---------------------------------------------------------------------------
// CSS generation (drives the canvas preview)
// ---------------------------------------------------------------------------

export interface CaptionCss {
  /** <p> wrapper styles. */
  line: React.CSSProperties;
  /** Idle word styles. */
  word: React.CSSProperties;
  /** Active (spoken) word styles. */
  active: React.CSSProperties;
  /** Uppercase words at render time. */
  upper: boolean;
  /** How many words show around the playhead. */
  wordsPerLine: 1 | 2 | 3;
  /** Google font families to load (the canvas injects a <link>). */
  fontFamily: string;
}

/** The font stack the canvas uses (Google font + safe fallbacks). */
export function fontStackFor(def: CaptionStyleDef): string {
  const generic =
    def.font === 'Georgia' || def.font === 'Playfair Display'
      ? 'Georgia, serif'
      : def.font === 'Courier Prime'
        ? '"Courier New", monospace'
        : 'Inter, system-ui, sans-serif';
  return `"${def.font}", ${generic}`;
}

/** Shared word-level CSS (stroke + shadow + color) for one render state. */
function wordCss(
  def: CaptionStyleDef,
  color: string,
  active: boolean,
): React.CSSProperties {
  const css: React.CSSProperties = {
    color,
    fontStyle: def.italic ? 'italic' : undefined,
  };
  // ULTRA-MODERN: gradient text fill on the ACTIVE word (background-clip:text).
  if (active && def.gradient) {
    (css as Record<string, unknown>)['backgroundImage'] =
      `linear-gradient(135deg, ${def.gradient[0]}, ${def.gradient[1]})`;
    (css as Record<string, unknown>)['WebkitBackgroundClip'] = 'text';
    (css as Record<string, unknown>)['backgroundClip'] = 'text';
    (css as Record<string, unknown>)['WebkitTextFillColor'] = 'transparent';
    css['color'] = 'transparent';
  }
  if (def.stroke && def.stroke.width > 0) {
    // paint-order stroke: the outline sits behind the fill (the Hormozi look).
    (css as Record<string, unknown>)['WebkitTextStroke'] =
      `${def.stroke.width}px ${def.stroke.color}`;
    (css as Record<string, unknown>)['paintOrder'] = 'stroke fill';
  }
  if (def.shadow) css['textShadow'] = def.shadow;
  if (active) {
    // Big-word emphasis (~1.6× the active word).
    const bigScale = def.big ? 1.55 : 1.18;
    if (def.highlightMode === 'scale' || def.big) {
      css['transform'] = `scale(${bigScale})`;
      css['display'] = 'inline-block';
    } else if (def.highlightMode === 'box' && def.activeBg) {
      css['backgroundColor'] = def.activeBg;
      css['padding'] = '0 0.18em';
      css['borderRadius'] = '0.18em';
      css['display'] = 'inline-block';
    } else if (def.highlightMode === 'boxGrow') {
      // The highlight box GROWS in behind the word (the modern soft-pop look).
      css['backgroundColor'] = def.activeBg ?? 'rgba(255,255,255,0.16)';
      css['padding'] = '0 0.22em';
      css['borderRadius'] = '0.28em';
      css['display'] = 'inline-block';
      css['transform'] = 'scale(1.06)';
      css['boxShadow'] = `0 0 0 0.06em ${def.activeBg ?? 'rgba(255,255,255,0.16)'}`;
    } else if (def.highlightMode === 'glow') {
      // Animated bloom in the accent color (neon without a hard box).
      css['textShadow'] =
        `0 0 0.35em ${def.activeColor}, 0 0 0.9em ${def.activeColor}66, ${def.shadow ?? '0 2px 6px rgba(0,0,0,0.9)'}`;
    } else if (def.highlightMode === 'underline') {
      css['textDecoration'] = 'underline';
      css['textDecorationThickness'] = '0.12em';
      css['textUnderlineOffset'] = '0.18em';
    }
    // 'color'/'sweep'/'gradient' just change color (gradient fills via background-clip above).
  }
  return css;
}

/** The resolved style for a def, as CSS property objects (canvas-ready). */
export function captionCssFor(def: CaptionStyleDef): CaptionCss {
  return {
    line: {
      textAlign: 'center',
      fontFamily: fontStackFor(def),
      fontWeight: def.weight,
      lineHeight: 1.15,
      // Spacing is a first-class dial now — presets set it, the customizer
      // overrides it (the "space the words/letters out" ask).
      letterSpacing: `${def.letterSpacingEm ?? (def.upper ? 0.03 : 0.01)}em`,
      // `?? 0`, NOT a truthy check. The old `def.wordSpacingEm ? {...} : {}`
      // dropped the property whenever the value was 0, so you could never dial
      // spacing back OFF on a preset that ships a nonzero default (Clean Rise
      // 0.12, Soft Card 0.08, Type Swift 0.1) — the slider moved to 0 and the
      // preset's spacing stayed. Emit it unconditionally, like letterSpacing.
      wordSpacing: `${def.wordSpacingEm ?? 0}em`,

      textTransform: def.upper ? 'uppercase' : 'none',
      margin: 0,
      transition: 'font-size 120ms ease',
      ...(def.lineBg
        ? {
            backgroundColor: def.lineBg,
            borderRadius: '0.35em',
            padding: '0.1em 0.35em',
            display: 'inline-block',
          }
        : {}),
    },
    word: {
      ...wordCss(def, def.wordColor, false),
      // Both renderers put the separator space INSIDE the word span
      // (`{text}{' '}`). wordCss sets `display:inline-block` for the box/scale/big
      // looks, and a trailing space at the end of an inline-block's own line box
      // gets trimmed — so there was no whitespace left for `word-spacing` (set on
      // .line and inherited) to act on, and the dial looked completely dead.
      // `pre-wrap` preserves that space while still allowing wrapping.
      whiteSpace: 'pre-wrap',
      transition: 'color 120ms ease, transform 120ms ease, background-color 120ms ease',
    },
    active: {
      ...wordCss(def, def.activeColor, true),
      // Same reason as `word` above — the active span is the one most likely to be
      // inline-block (it carries the pop/scale), so it needs this most.
      whiteSpace: 'pre-wrap',
      // The highlight SWEEPS between words (color + a tiny pop) instead of snapping.
      transition: 'color 120ms ease, transform 140ms cubic-bezier(0.2,0.9,0.3,1.2), background-color 120ms ease',
    },

    upper: def.upper,
    wordsPerLine: def.wordsPerLine,
    fontFamily: fontStackFor(def),
  };
}

// ---------------------------------------------------------------------------
// Per-reel overrides (R17c) + merge
// ---------------------------------------------------------------------------

export interface CaptionOverrides {
  /** Vertical position: 0 (bottom) – 100 (top) — drives the overlay's bottom offset. */
  positionPct?: number;
  /** Horizontal position: 0 (left) – 100 (right) — drag-to-move on the preview. Default 50. */
  xPct?: number;
  /** Font size in px (canvas scales it to the preview height). */
  sizePx?: number;
  /** [font, main(active), second, third] color wells — sweep presets use all. */
  colors?: string[];
  /** Words shown per ROW (overrides the preset's wordsPerLine). 1–6. */
  wordsPerRow?: number;
  /** How many ROWS show at once (1 = one line, 2 = the current + next line). 1–3. */
  rows?: number;
  /** Letter spacing in em (−0.05 tight … 0.3 tracked out). Overrides the preset. */
  letterSpacing?: number;
  /** Space BETWEEN words in em (0 … 0.6 — the airy look). Overrides the preset. */
  wordSpacing?: number;
  /** POWER WORDS: comma-separated — they render in the ACTIVE style even when idle. */
  powerWords?: string[];
}

/** Clamp a number into a range, with a fallback for junk. */
function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}

/** The layout values the renderer uses, resolved from overrides (with sane defaults). */
export interface CaptionLayout {
  xPct: number;
  positionPct: number;
  sizePx: number;
  wordsPerRow: number;
  rows: number;
}

/** Resolve the on-stage layout from overrides (canvas + burn-in share this). */
export function captionLayoutFor(
  def: CaptionStyleDef,
  overrides?: CaptionOverrides | null,
): CaptionLayout {
  const o = overrides ?? {};
  return {
    xPct: clampNum(o.xPct, 0, 100, 50),
    positionPct: clampNum(o.positionPct, 0, 100, 12),
    sizePx: clampNum(o.sizePx, 8, 200, 18),
    wordsPerRow: Math.round(clampNum(o.wordsPerRow, 1, 6, def.wordsPerLine)),
    rows: Math.round(clampNum(o.rows, 1, 3, 1)),
  };
}

/**
 * Slice the word list into display ROWS: `rows` lines, each up to `wordsPerRow`
 * words. The rows form a PAGE of `rows * wordsPerRow` words that holds still
 * while the highlight marches through it, then flips to the next page. The
 * active word can therefore be on ANY row, not just row 0 — callers must locate
 * it with `from <= activeIdx < to` rather than assuming row 0.
 * Returns each row as [startIdx, endIdx) into `words`.
 */

export function captionRows(
  totalWords: number,
  activeIdx: number,
  wordsPerRow: number,
  rows: number,
): { from: number; to: number }[] {
  const perRow = Math.max(1, Math.round(wordsPerRow));
  const rowCount = Math.max(1, Math.round(rows));
  const idx = Math.max(0, Math.min(activeIdx, Math.max(0, totalWords - 1)));
  // R22 kept the lit word marching across a row instead of parking on the last
  // slot (`idx - (perRow - 1)`) — that part was right and stays.
  //
  // R29 fix — but R22 anchored ROW 0 on the active word's chunk, so rows 1..n
  // were always the NEXT words and the highlight could never leave the top row
  // (the reported "active word only stays on the top row"). The window is now a
  // PAGE of rowCount*perRow words that holds still while the highlight walks
  // down through every row, then flips. With rowCount === 1 (the default) the
  // page IS the chunk, so single-row behaviour is byte-for-byte unchanged.
  const pageSize = perRow * rowCount;
  const pageFrom = Math.floor(idx / pageSize) * pageSize;

  const out: { from: number; to: number }[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const from = pageFrom + r * perRow;

    if (from >= totalWords) break;
    out.push({ from, to: Math.min(totalWords, from + perRow) });
  }
  return out.length ? out : [{ from: Math.max(0, totalWords - perRow), to: totalWords }];
}

/**
 * Merge per-reel overrides over a preset def. Returns a NEW def (never mutates).
 * colors[0]→wordColor, colors[1]→activeColor, colors[2/3]→sweep accents.
 */
export function resolveCaptionStyle(
  def: CaptionStyleDef,
  overrides?: CaptionOverrides | null,
): CaptionStyleDef {
  if (!overrides) return def;
  const out: CaptionStyleDef = { ...def };
  const c = overrides.colors;
  if (Array.isArray(c)) {
    if (typeof c[0] === 'string' && c[0]) out.wordColor = c[0];
    if (typeof c[1] === 'string' && c[1]) out.activeColor = c[1];
    if (typeof c[2] === 'string' && c[2] && def.highlightMode === 'sweep') {
      out.activeColor = c[2];
    }
  }
  // Spacing dials ride the def so captionCssFor picks them up everywhere.
  if (typeof overrides.letterSpacing === 'number' && Number.isFinite(overrides.letterSpacing)) {
    out.letterSpacingEm = Math.max(-0.05, Math.min(0.3, overrides.letterSpacing));
  }
  if (typeof overrides.wordSpacing === 'number' && Number.isFinite(overrides.wordSpacing)) {
    out.wordSpacingEm = Math.max(0, Math.min(0.6, overrides.wordSpacing));
  }
  return out;
}

/** Normalize a word for power-word matching (lowercase, punctuation stripped). */
export function powerKey(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9'$]/g, '');
}

/** Is this word in the reel's POWER WORDS list? (they glow even when idle) */
export function isPowerWord(word: string, powerWords?: string[] | null): boolean {
  if (!powerWords || powerWords.length === 0) return false;
  const key = powerKey(word);
  if (!key) return false;
  return powerWords.some((p) => powerKey(p) === key);
}

// ---------------------------------------------------------------------------
// wordsPerLine windowing (the punchy 1-word beat vs phrase lines)
// ---------------------------------------------------------------------------

/**
 * The line of word indices containing the active word, as a FIXED CHUNK.
 *
 * R22 fix — this used to return a window that re-centred on the active index
 * (`from: idx - 2, to: idx + 4`). That pins the highlight: the words scroll
 * underneath a stationary lit slot instead of the highlight walking across the
 * words, and at the tail it clamps so only the LAST word ever lights up.
 *
 * Chunking instead means the highlighted slot is `activeIdx - from`, which
 * genuinely advances 0,1,2… across the line before the line flips to the next
 * chunk. That is what makes it read as karaoke.
 */
export function captionWindow(
  totalWords: number,
  activeIdx: number,
  wordsPerLine: 1 | 2 | 3,
): { from: number; to: number } {
  const total = Math.max(0, totalWords);
  if (total === 0) return { from: 0, to: 0 };
  const idx = Math.max(0, Math.min(activeIdx, total - 1));
  const from = Math.floor(idx / wordsPerLine) * wordsPerLine;
  return { from, to: Math.min(total, from + wordsPerLine) };
}


// ---------------------------------------------------------------------------
// R17d — auto-emoji (keyword → emoji on the active word)
// ---------------------------------------------------------------------------

const EMOJI_MAP: Record<string, string> = {
  money: '💰', cash: '💵', rich: '💰', fire: '🔥', love: '❤️', win: '🏆',
  winner: '🏆', growth: '📈', grow: '📈', rocket: '🚀', fast: '⚡', speed: '⚡',
  secret: '🤫', free: '🎁', gift: '🎁', time: '⏰', now: '⚡', stop: '🛑',
  warning: '⚠️', mistake: '❌', wrong: '❌', right: '✅', yes: '✅', no: '🚫',
  idea: '💡', brain: '🧠', mind: '🧠', work: '💪', hard: '💪', boss: '👑',
  king: '👑', queen: '👑', goal: '🎯', target: '🎯', sale: '🏷️', buy: '🛒',
};

/** The emoji for a word (lowercased, punctuation stripped), or ''. */
export function emojiFor(word: string): string {
  const key = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  return EMOJI_MAP[key] ?? '';
}

// ---------------------------------------------------------------------------
// R17d — ASS subtitle exporter (drives the ffmpeg burn-in; ultra-precise timing)
// ---------------------------------------------------------------------------

/** ASS color (&HAABBGGRR) from a #RRGGBB (or rgba() fallback) hex. */
function assColor(hex: string): string {
  const m = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6,8}$/.test(m)) return '&H00FFFFFF'; // rgba() → safe white
  const r = m.slice(0, 2);
  const g = m.slice(2, 4);
  const b = m.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * ASS timestamp `h:mm:ss.cc` (centiseconds). This is THE precision path: it
 * carries the Whisper word's exact seconds through to the burned frame, never
 * snapping to a coarser grid — the karaoke preview and the burn read the same
 * `ReelWord.start/end`, so what you saw on stage is what's in the MP4.
 */
export function assTime(sec: number): string {
  const v = Math.max(0, sec);
  const h = Math.floor(v / 3600);
  const m = Math.floor((v - h * 3600) / 60);
  const s = v - h * 3600 - m * 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

/** Escape one word for an ASS Dialogue text field (braces + newlines break the parser). */
function assEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\r?\n/g, ' ');
}

/** Map the customizer's vertical position (0–100%) to an ASS MarginV (bottom-anchored, Align 2). */
export function assMarginV(positionPct: number | undefined, playResY: number): number {
  const pct = Math.max(0, Math.min(100, positionPct ?? 12));
  return Math.round((pct / 100) * playResY);
}

export interface AssOptions {
  /** Vertical position 0–100 (captionOverrides.positionPct) → MarginV. Default 12. */
  positionPct?: number;
  /** PlayRes the style is authored against (the burn scales to the real frame). */
  playResX?: number;
  playResY?: number;
  /** Base font size in PlayRes px (captionOverrides.sizePx maps through). */
  sizePx?: number;
}

/**
 * The ASS (Advanced SubStation Alpha) document for a word-timed caption track,
 * styled from a def (already override-merged by the caller). One Dialogue event
 * per word at its EXACT Whisper start/end — karaoke-accurate burn-in.
 *
 * The active word is a SECOND, overlapping event in the active color, so the
 * spoken word lights up in the rendered MP4 exactly as it does on the stage.
 */
export function assFor(captions: ReelWord[], def: CaptionStyleDef, opts: AssOptions = {}): string {
  const playResX = opts.playResX ?? 1080;
  const playResY = opts.playResY ?? 1920;
  const marginV = assMarginV(opts.positionPct, playResY);
  const fontSize = Math.max(8, Math.round(opts.sizePx ?? 72));
  const outline = def.stroke?.width ?? 2;
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Base style: the idle word color, positioned by the customizer.
    `Style: Default,${def.font},${fontSize},${assColor(def.wordColor)},${assColor(
      def.wordColor,
    )},${def.stroke ? assColor(def.stroke.color) : '&H00000000'},&H80000000,${
      def.weight >= 700 ? -1 : 0
    },${def.italic ? -1 : 0},0,0,100,100,0,0,1,${outline},0,2,60,60,${marginV},1`,
    // Active style: identical geometry, the active color (the karaoke highlight).
    `Style: Active,${def.font},${fontSize},${assColor(def.activeColor)},${assColor(
      def.activeColor,
    )},${def.stroke ? assColor(def.stroke.color) : '&H00000000'},&H80000000,${
      def.weight >= 700 ? -1 : 0
    },${def.italic ? -1 : 0},0,0,100,100,0,0,1,${outline},0,2,60,60,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const events: string[] = [];
  for (const w of captions) {
    if (!(w.end > w.start)) continue; // never emit a zero/negative window
    const text = assEscape(def.upper ? w.word.toUpperCase() : w.word);
    if (!text.trim()) continue;
    // The active word gets the Active style (the highlight); idle words get Default.
    events.push(
      `Dialogue: 0,${assTime(w.start)},${assTime(w.end)},Active,,0,0,0,,${text}`,
    );
  }
  return [...header, ...events, ''].join('\n');
}

// ---------------------------------------------------------------------------
// DEPRECATED R3 shim — Tailwind classes (kept so old reels/tests never break)
// ---------------------------------------------------------------------------

export interface CaptionPresetMeta {
  id: CaptionPreset;
  label: string;
  hint: string;
}

/** @deprecated R17 uses CAPTION_STYLE_DEFS. Kept for back-compat. */
export const CAPTION_PRESETS: CaptionPresetMeta[] = [
  { id: 'karaoke', label: 'Karaoke', hint: 'Phrase line — the spoken word lit in brass' },
  { id: 'beast', label: 'Beast', hint: 'ALL-CAPS — the active word pops yellow' },
  { id: 'hormozi', label: 'Hormozi', hint: 'White with a heavy black outline — the active word grows' },
  { id: 'minimal', label: 'Minimal', hint: 'Small single-line subtitle, no highlight' },
];

export interface CaptionStyleClasses {
  line: string;
  word: string;
  active: string;
  upper: boolean;
}

/** @deprecated R17 uses captionCssFor(def). Kept for back-compat. */
export function captionStyleFor(preset: CaptionPreset): CaptionStyleClasses {
  switch (preset) {
    case 'beast':
      return {
        line: 'text-center text-xl font-black uppercase leading-tight tracking-wide drop-shadow-[0_3px_6px_rgba(0,0,0,0.95)]',
        word: 'text-white/90',
        active: 'text-yellow-300',
        upper: true,
      };
    case 'hormozi':
      return {
        line: 'text-center text-lg font-extrabold uppercase leading-snug [text-shadow:2px_2px_0_#000,-2px_2px_0_#000,2px_-2px_0_#000,-2px_-2px_0_#000,0_4px_8px_rgba(0,0,0,0.85)]',
        word: 'text-white',
        active: 'text-yellow-300 text-xl',
        upper: true,
      };
    case 'minimal':
      return {
        line: 'text-center text-xs font-medium leading-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
        word: 'text-white/75',
        active: 'text-white',
        upper: false,
      };
    case 'karaoke':
    default:
      return {
        line: 'text-center text-base font-bold leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]',
        word: 'text-white/85',
        active: 'text-brass',
        upper: false,
      };
  }
}
