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
 * left-to-right wipe reveal · shake = a 3-cycle emphasis wobble ·
 * riseMask = rise out of a clip mask · springPop = big overshoot pop ·
 * neonFlicker = sign-flicker on · glowPulse = bloom swell ·
 * cascade = letters stagger in one at a time. '' = none.
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
  | 'shake'
  | 'riseMask'
  | 'springPop'
  | 'neonFlicker'
  | 'glowPulse'
  | 'cascade'
  | 'slam'
  | 'typewriter'
  | 'blurPop'
  | 'neonPulse'
  | 'zoomSnap'
  | 'dropIn'
  | 'tilt3d'
  | 'outlineFill'
  | 'dualTone'
  | 'motionTrail'
  | 'tickUp';

/**
 * BLOCK-level ambience — the whole caption block, not one word.
 * ghostFade = each PAGE of rows fades in on arrival and out before the flip
 * (the smooth "ghost" dissolve). float = the block bobs gently forever.
 *
 * These are FRAME-DERIVED in the layer (page turns are computed from the word
 * window, the bob from the frame clock) — never stored state, so they can't
 * drift from the words the way a keyframe on a row index would.
 */
export type CaptionBlockFx = 'ghostFade' | 'float' | 'wiggle' | 'punchIn' | 'letterbox' | 'springExit';

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
    case 'riseMask':
      return `@keyframes cap-risemask{0%{transform:translateY(0.5em);clip-path:inset(0 0 100% 0)}100%{transform:translateY(0);clip-path:inset(0 0 0% 0)}}`;
    case 'springPop':
      return `@keyframes cap-springpop{0%{transform:scale(0.5);opacity:0}55%{transform:scale(1.32);opacity:1}80%{transform:scale(0.94)}100%{transform:scale(1);opacity:1}}`;
    case 'neonFlicker':
      return `@keyframes cap-neonflicker{0%,9%,11%,19%,21%,100%{opacity:1}10%,20%{opacity:0.25}}`;
    case 'glowPulse':
      return `@keyframes cap-glowpulse{0%{opacity:.55;transform:scale(0.94)}55%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}`;
    case 'cascade':
      // The true letter-stagger is computed per frame in the layer; the CSS
      // swatch approximates it as a soft rise for the platform mocks.
      return `@keyframes cap-cascade{0%{transform:translateY(0.3em);opacity:0;filter:blur(3px)}100%{transform:translateY(0);opacity:1;filter:blur(0)}}`;
    case 'slam':
      return `@keyframes cap-slam{0%{transform:translateY(-0.55em) scale(1.55);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}`;
    case 'typewriter':
      return `@keyframes cap-typewriter{0%{opacity:0}100%{opacity:1}}`;
    case 'blurPop':
      return `@keyframes cap-blurpop{0%{filter:blur(8px);transform:scale(0.85);opacity:0}100%{filter:blur(0);transform:scale(1);opacity:1}}`;
    case 'neonPulse':
      return `@keyframes cap-neonpulse{0%{opacity:.6;transform:scale(0.96)}100%{opacity:1;transform:scale(1)}}`;
    case 'zoomSnap':
      return `@keyframes cap-zoomsnap{0%{transform:scale(0.4);opacity:0}100%{transform:scale(1);opacity:1}}`;
    case 'dropIn':
      return `@keyframes cap-dropin{0%{transform:translateY(-1.1em);opacity:0}100%{transform:translateY(0);opacity:1}}`;
    case 'tilt3d':
      return `@keyframes cap-tilt3d{0%{transform:perspective(500px) rotateY(55deg) scale(0.85);opacity:0}100%{transform:perspective(500px) rotateY(0) scale(1);opacity:1}}`;
    case 'outlineFill':
      return `@keyframes cap-outlinefill{0%{-webkit-text-stroke:2px currentColor;color:transparent;opacity:.5}100%{-webkit-text-stroke:0;color:currentColor;opacity:1}}`;
    case 'dualTone':
      return `@keyframes cap-dualtone{0%{opacity:.6}100%{opacity:1}}`;
    case 'motionTrail':
      return `@keyframes cap-motiontrail{0%{transform:translateX(-0.2em);opacity:.3;filter:blur(2px)}100%{transform:none;opacity:1;filter:blur(0)}}`;
    case 'tickUp':
      return `@keyframes cap-tickup{0%{transform:translateY(0.4em);opacity:0}100%{transform:translateY(0);opacity:1}}`;

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
    case 'riseMask':
      return 'cap-risemask 220ms cubic-bezier(0.2,0.8,0.3,1)';
    case 'springPop':
      return 'cap-springpop 220ms cubic-bezier(0.34,1.56,0.64,1)';
    case 'neonFlicker':
      return 'cap-neonflicker 220ms linear';
    case 'glowPulse':
      return 'cap-glowpulse 220ms ease-out';
    case 'cascade':
      return 'cap-cascade 220ms ease-out';
    case 'slam':
      return 'cap-slam 200ms cubic-bezier(0.2,0.9,0.3,1.3)';
    case 'typewriter':
      return 'cap-typewriter 160ms ease';
    case 'blurPop':
      return 'cap-blurpop 220ms ease-out';
    case 'neonPulse':
      return 'cap-neonpulse 220ms ease-out';
    case 'zoomSnap':
      return 'cap-zoomsnap 180ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'dropIn':
      return 'cap-dropin 200ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'tilt3d':
      return 'cap-tilt3d 220ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'outlineFill':
      return 'cap-outlinefill 220ms ease-out';
    case 'dualTone':
      return 'cap-dualtone 200ms ease';
    case 'motionTrail':
      return 'cap-motiontrail 200ms ease-out';
    case 'tickUp':
      return 'cap-tickup 180ms cubic-bezier(0.2,0.9,0.3,1.2)';

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
  'riseMask',
  'springPop',
  'neonFlicker',
  'glowPulse',
  'cascade',
  'slam',
  'typewriter',
  'blurPop',
  'neonPulse',
  'zoomSnap',
  'dropIn',
  'tilt3d',
  'outlineFill',
  'dualTone',
  'motionTrail',
  'tickUp'
];

/** Highlight modes the customizer can pick. */
export const HIGHLIGHT_MODES: HighlightMode[] = [
  'color',
  'box',
  'boxGrow',
  'scale',
  'glow',
  'underline',
  'sweep',
  'gradient',
];


/**
 * One-click editor packs — stacked look recipes (preset id + optional overrides).
 * Applied from the gallery "Packs" row.
 */
export type EditorPackId = 'mrbeast' | 'faceless' | 'luxury' | 'podcast';

export interface EditorPack {
  id: EditorPackId;
  label: string;
  blurb: string;
  /** Base preset id from CAPTION_STYLE_DEFS */
  presetId: string;
  /** Optional style overrides merged on apply */
  overrides?: CaptionOverrides;
}

export const EDITOR_PACKS: EditorPack[] = [
  {
    id: 'mrbeast',
    label: 'MrBeast',
    blurb: 'Huge yellow pop, slam words, punch-in',
    presetId: 'beast',
    overrides: {
      anim: 'slam',
      blockMotion: 'still',
      ghostFade: false,
      floatOn: false,
      punchIn: true,
    },
  },
  {
    id: 'faceless',
    label: 'Faceless',
    blurb: 'Clean gradient flow + ghost fade',
    presetId: 'gradient-flow',
    overrides: {
      anim: 'fade',
      ghostFade: true,
      ghostFadeInSec: 0.3,
      ghostFadeOutSec: 0.4,
      blockMotion: 'float',
      floatOn: true,
    },
  },
  {
    id: 'luxury',
    label: 'Luxury',
    blurb: 'Soft rise, letterbox feel, gold glow',
    presetId: 'soft-card',
    overrides: {
      anim: 'riseUp',
      ghostFade: true,
      ghostFadeInSec: 0.35,
      ghostFadeOutSec: 0.45,
      blockMotion: 'float',
      floatOn: true,
    },
  },
  {
    id: 'podcast',
    label: 'Podcast',
    blurb: 'Type-on + underline, readable',
    presetId: 'minimal',
    overrides: {
      anim: 'typeOn',
      ghostFade: false,
      blockMotion: 'still',
    },
  },
];

export function editorPackFor(id: string): EditorPack | undefined {
  return EDITOR_PACKS.find((p) => p.id === id);
}


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
  /**
   * Gradient text fill (background-clip:text). By default only the ACTIVE word
   * gets it; set gradientScope:'all' to paint every word. Stroke is suppressed
   * on gradient-filled glyphs — outlines fight the clip and look like a black
   * halo around every modern gradient preset.
   */
  gradient?: [string, string] | [string, string, string];
  /** Where the gradient applies. Default 'active'. */
  gradientScope?: 'active' | 'all';
  /** Gradient angle in degrees (CSS linear-gradient). Default 135. */
  gradientAngle?: number;
  /**
   * Slow background-position drift on gradient fills (frame-driven in the
   * layer). The "living" neon/iridescent look.
   */
  gradientShift?: boolean;
  /**
   * Ghost page-fade timing + stagger. Only used when blockFx includes ghostFade.
   * Defaults: fadeIn 0.22, fadeOut 0.28 — with a full-opacity HOLD between them.
   * stagger: 'block' = whole page (default) · 'word' = words cascade in/out ·
   * 'letter' = letters cascade in/out. staggerSec is the delay between units.
   */
  ghost?: {
    fadeInSec?: number;
    fadeOutSec?: number;
    /** How the page reveals / dissolves. Default 'block'. */
    stagger?: 'block' | 'word' | 'letter';
    /** Delay between staggered units in seconds (0.02–0.25). Default 0.05 word / 0.03 letter. */
    staggerSec?: number;
  
    ease?: 'linear' | 'smooth';
    driftEm?: number;  /** Fade each word on its own spoken window (from→to), not the page. */
    syncToWords?: boolean;
  };

  /** Ambient motion amplitude/speed (float + wiggle compose). */
  motion?: {
    floatAmpEm?: number;
    floatPeriodSec?: number;
    wiggleDeg?: number;
    wigglePeriodSec?: number;
  
    /** When true, float/wiggle phase is keyed to each word's start (not global clock). */
    syncToWords?: boolean;
  };

  /** Big-word emphasis: the active word renders ~1.6× (the "big word" beat). */
  big?: boolean;

  /** Letter spacing in em (negative tightens, positive tracks out). Default ~0.01–0.03. */
  letterSpacingEm?: number;
  /** Space BETWEEN words in em (the airy, spaced-out caption look). Default 0. */
  wordSpacingEm?: number;
  /** Rounded card behind the whole caption LINE (Soft Card look), as CSS color. */
  lineBg?: string;
  /**
   * Karaoke PROGRESS FILL — the active word fills with the active color
   * left-to-right across its own timing (the Submagic/Hormozi sweep), then the
   * fill jumps to the next word. Frame-derived in the layer; the word still
   * pops when fill is on.
   */
  karaokeFill?: boolean;
  /**
   * Block-level ambience (ghost page fades, gentle float). Frame-derived in
   * the layer from the word window — see CaptionBlockFx.
   */
  blockFx?: CaptionBlockFx[];
  /** Hand-drawn accent on the active word. */
  handDrawn?: 'underline' | 'circle';

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
    // No stroke — outlines fight background-clip:text and read as a black halo.
    gradient: ['#F472B6', '#A78BFA'],
    gradientScope: 'active',
    shadow: '0 2px 14px rgba(0,0,0,0.55)',
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
    gradientScope: 'active',
    shadow: '0 2px 12px rgba(0,0,0,0.55)',
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
    gradient: ['#22D3EE', '#A78BFA', '#F472B6'],
    gradientScope: 'all',
    gradientAngle: 110,
    gradientShift: true,
    shadow: '0 2px 14px rgba(0,0,0,0.5)',
    wordsPerLine: 3, anim: 'riseUp', letterSpacingEm: 0.015,
  },
  {
    id: 'iridescent', label: 'Iridescent', tags: ['new', 'premium'],
    font: 'Poppins', weight: 800, upper: false,
    wordColor: '#FFFFFF', activeColor: '#FFFFFF', highlightMode: 'color',
    gradient: ['#22D3EE', '#A78BFA', '#F472B6'],
    gradientScope: 'all',
    gradientAngle: 90,
    gradientShift: true,
    shadow: '0 0 16px rgba(167,139,250,0.35), 0 2px 10px rgba(0,0,0,0.45)',
    wordsPerLine: 3, anim: 'fade', blockFx: ['ghostFade'],
    ghost: { fadeInSec: 0.28, fadeOutSec: 0.35 },
  },
  {
    id: 'sunset-wash', label: 'Sunset Wash', tags: ['new', 'trend'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: '#FFF7ED', activeColor: '#FFFFFF', highlightMode: 'scale',
    gradient: ['#FB923C', '#F472B6', '#A78BFA'],
    gradientScope: 'all',
    gradientAngle: 160,
    shadow: '0 2px 12px rgba(0,0,0,0.5)',
    wordsPerLine: 2, anim: 'pop',
  },

  {
    id: 'type-swift', label: 'Type Swift', tags: ['new'],
    font: 'Courier Prime', weight: 700, upper: false,
    wordColor: 'rgba(255,255,255,0.75)', activeColor: '#FFFFFF', highlightMode: 'color',
    shadow: '0 1px 3px rgba(0,0,0,0.9)',
    wordsPerLine: 3, anim: 'typeOn', wordSpacingEm: 0.1,
  },
  // --- MODERN batch 3 (ghost fade / float / karaoke fill / flicker / cascade) ---
  {
    id: 'ghost', label: 'Ghost', tags: ['new', 'premium'],
    font: 'Inter', weight: 600, upper: false,
    wordColor: 'rgba(255,255,255,0.9)', activeColor: '#FFFFFF', highlightMode: 'color',
    shadow: '0 2px 10px rgba(0,0,0,0.85)',
    wordsPerLine: 3, anim: 'fade', blockFx: ['ghostFade'],
    ghost: { fadeInSec: 0.3, fadeOutSec: 0.4 },
  },

  {
    id: 'floater', label: 'Floater', tags: ['new'],
    font: 'Poppins', weight: 700, upper: false,
    wordColor: '#FFFFFF', activeColor: '#7DD3FC', highlightMode: 'scale',
    shadow: '0 4px 14px rgba(0,0,0,0.9)',
    wordsPerLine: 2, anim: 'pop', blockFx: ['float'],
  },
  {
    id: 'fill-sweep', label: 'Fill Sweep', tags: ['new', 'trend'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: 'rgba(255,255,255,0.45)', activeColor: '#FFD400', highlightMode: 'color',
    stroke: { color: '#000000', width: 2 },
    shadow: '0 4px 10px rgba(0,0,0,0.9)',
    wordsPerLine: 2, anim: 'pop', karaokeFill: true,
  },
  {
    id: 'sign-on', label: 'Sign On', tags: ['new', 'premium'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: 'rgba(255,255,255,0.6)', activeColor: '#22D3EE', highlightMode: 'glow',
    stroke: { color: '#000000', width: 1.5 },
    wordsPerLine: 2, anim: 'neonFlicker',
  },
  {
    id: 'cascade', label: 'Cascade', tags: ['new', 'trend'],
    font: 'Poppins', weight: 800, upper: true,
    wordColor: 'rgba(255,255,255,0.5)', activeColor: '#F472B6', highlightMode: 'color',
    stroke: { color: '#000000', width: 1.5 },
    shadow: '0 3px 8px rgba(0,0,0,0.9)',
    wordsPerLine: 1, anim: 'cascade',
  },
  // --- MODERN batch 4 (ghost + glow + shadow themes the customizer dials) ---
  {
    id: 'ghost-soft', label: 'Ghost Soft', tags: ['new', 'premium'],
    font: 'Inter', weight: 600, upper: false,
    wordColor: 'rgba(255,255,255,0.88)', activeColor: '#FFFFFF', highlightMode: 'color',
    shadow: '0 2px 12px rgba(0,0,0,0.75), 0 0 18px rgba(255,255,255,0.18)',
    wordsPerLine: 3, anim: 'fade', blockFx: ['ghostFade'], letterSpacingEm: 0.02, wordSpacingEm: 0.1,
    ghost: { fadeInSec: 0.35, fadeOutSec: 0.45 },
  },

  {
    id: 'neon-pop', label: 'Neon Pop', tags: ['new', 'trend'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: '#FFFFFF', activeColor: '#22D3EE', highlightMode: 'glow',
    stroke: { color: '#000000', width: 2 },
    shadow: '0 0 8px rgba(34,211,238,0.85), 0 0 22px rgba(34,211,238,0.45), 0 4px 10px rgba(0,0,0,0.9)',
    wordsPerLine: 2, anim: 'springPop',
  },
  {
    id: 'clean-drop', label: 'Clean Drop', tags: ['new'],
    font: 'Inter', weight: 700, upper: false,
    wordColor: 'rgba(255,255,255,0.92)', activeColor: '#FFFFFF', highlightMode: 'color',
    shadow: '0 3px 10px rgba(0,0,0,0.85), 0 8px 24px rgba(0,0,0,0.45)',
    wordsPerLine: 3, anim: 'riseUp', letterSpacingEm: 0.01, wordSpacingEm: 0.08,
  },
  {
    id: 'glass-pill', label: 'Glass Pill', tags: ['new', 'premium'],
    font: 'Poppins', weight: 700, upper: false,
    wordColor: '#FFFFFF', activeColor: '#F8E16C', highlightMode: 'scale',
    lineBg: 'rgba(12,12,16,0.55)',
    shadow: '0 4px 18px rgba(0,0,0,0.55)',
    wordsPerLine: 3, anim: 'fade', blockFx: ['ghostFade'], wordSpacingEm: 0.1,
  },
  {
    id: 'aura', label: 'Aura', tags: ['new', 'premium'],
    font: 'Poppins', weight: 800, upper: false,
    wordColor: 'rgba(255,255,255,0.7)', activeColor: '#A78BFA', highlightMode: 'glow',
    shadow: '0 0 10px rgba(167,139,250,0.7), 0 0 28px rgba(167,139,250,0.35), 0 3px 10px rgba(0,0,0,0.85)',
    wordsPerLine: 2, anim: 'glowPulse', blockFx: ['float'],
  },
  {
    id: 'bold-karaoke', label: 'Bold Karaoke', tags: ['new', 'trend'],
    font: 'Archivo Black', weight: 900, upper: true,
    wordColor: 'rgba(255,255,255,0.4)', activeColor: '#FFD400', highlightMode: 'color',
    stroke: { color: '#000000', width: 2.5 },
    shadow: '0 0 12px rgba(255,212,0,0.35), 0 4px 12px rgba(0,0,0,0.9)',
    wordsPerLine: 2, anim: 'pop', karaokeFill: true,
  },
  {
    id: 'modern-word', label: 'Modern Word', tags: ['new', 'trend'],
    font: 'Bebas Neue', weight: 700, upper: true,
    wordColor: 'rgba(255,255,255,0.45)', activeColor: '#FFFFFF', highlightMode: 'scale',
    stroke: { color: '#000000', width: 1.5 },
    shadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 16px rgba(255,255,255,0.12)',
    wordsPerLine: 1, anim: 'blurIn', big: true, blockFx: ['ghostFade'],
  },
  {
    id: 'ember', label: 'Ember', tags: ['new'],
    font: 'Anton', weight: 900, upper: true,
    wordColor: '#FFF7ED', activeColor: '#FB923C', highlightMode: 'glow',
    stroke: { color: '#7C2D12', width: 1.5 },
    shadow: '0 0 10px rgba(251,146,60,0.75), 0 0 24px rgba(251,146,60,0.35), 0 4px 10px rgba(0,0,0,0.9)',
    wordsPerLine: 2, anim: 'elastic',
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

/** Build a CSS linear-gradient string from a def's gradient stops + angle. */
export function gradientCssFor(
  stops: NonNullable<CaptionStyleDef['gradient']>,
  angleDeg = 135,
): string {
  const a = Number.isFinite(angleDeg) ? angleDeg : 135;
  if (stops.length >= 3) {
    return `linear-gradient(${a}deg, ${stops[0]}, ${stops[1]}, ${stops[2]})`;
  }
  return `linear-gradient(${a}deg, ${stops[0]}, ${stops[1]})`;
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
  // Gradient fill: active-only by default, or every word when scope is 'all'.
  // NEVER combine with WebkitTextStroke — the stroke paints outside the clip
  // and reads as a hard black outline around every modern gradient preset.
  //
  // Also NEVER use text-shadow on a background-clip:text glyph: the fill is
  // transparent so only the shadow silhouette shows (the "black outline blob"
  // the gallery was rendering). Use filter:drop-shadow instead — it respects
  // the clipped alpha and keeps the gradient visible.
  const scope = def.gradientScope ?? 'active';
  const paintGradient = !!def.gradient && (active || scope === 'all');
  if (paintGradient && def.gradient) {
    (css as Record<string, unknown>)['backgroundImage'] = gradientCssFor(
      def.gradient,
      def.gradientAngle ?? 135,
    );
    (css as Record<string, unknown>)['WebkitBackgroundClip'] = 'text';
    (css as Record<string, unknown>)['backgroundClip'] = 'text';
    (css as Record<string, unknown>)['WebkitTextFillColor'] = 'transparent';
    css['color'] = 'transparent';
    // background-clip:text needs a real box; inline spans clip unreliably.
    css['display'] = 'inline-block';
    // Larger background so gradientShift can drift without seams.
    if (def.gradientShift) {
      (css as Record<string, unknown>)['backgroundSize'] = '200% 200%';
      (css as Record<string, unknown>)['backgroundRepeat'] = 'no-repeat';
    }
    // Depth via filter (not text-shadow) so the gradient stays visible.
    if (def.shadow) {
      (css as Record<string, unknown>)['--caption-grad-shadow'] = def.shadow;
    }
  } else if (def.stroke && def.stroke.width > 0) {
    // paint-order stroke: the outline sits behind the fill (the Hormozi look).
    // Only when we are NOT gradient-filling this glyph.
    (css as Record<string, unknown>)['WebkitTextStroke'] =
      `${def.stroke.width}px ${def.stroke.color}`;
    (css as Record<string, unknown>)['paintOrder'] = 'stroke fill';
    if (def.shadow) css['textShadow'] = def.shadow;
  } else if (def.shadow) {
    css['textShadow'] = def.shadow;
  }

  if (active) {
    // Big-word emphasis (~1.6× the active word).
    const bigScale = def.big ? 1.55 : 1.18;
    if (def.highlightMode === 'scale' || def.big) {
      css['transform'] = `scale(${bigScale})`;
      css['display'] = 'inline-block';
    } else if (def.highlightMode === 'box' && def.activeBg && !paintGradient) {
      css['backgroundColor'] = def.activeBg;
      css['padding'] = '0 0.18em';
      css['borderRadius'] = '0.18em';
      css['display'] = 'inline-block';
    } else if (def.highlightMode === 'boxGrow' && !paintGradient) {
      // The highlight box GROWS in behind the word (the modern soft-pop look).
      css['backgroundColor'] = def.activeBg ?? 'rgba(255,255,255,0.16)';
      css['padding'] = '0 0.22em';
      css['borderRadius'] = '0.28em';
      css['display'] = 'inline-block';
      css['transform'] = 'scale(1.06)';
      css['boxShadow'] = `0 0 0 0.06em ${def.activeBg ?? 'rgba(255,255,255,0.16)'}`;
    } else if (def.highlightMode === 'glow') {
      // Animated bloom in the accent color (neon without a hard box).
      // On gradient glyphs, stack into filter so we don't kill the fill.
      if (paintGradient) {
        const glow = `drop-shadow(0 0 0.35em ${def.activeColor}) drop-shadow(0 0 0.9em ${def.activeColor}66)`;
        css['filter'] = css['filter'] ? `${glow} ${css['filter']}` : glow;
      } else {
        css['textShadow'] =
          `0 0 0.35em ${def.activeColor}, 0 0 0.9em ${def.activeColor}66, ${def.shadow ?? '0 2px 6px rgba(0,0,0,0.9)'}`;
      }
    } else if (def.highlightMode === 'underline') {
      css['textDecoration'] = 'underline';
      css['textDecorationThickness'] = '0.12em';
      css['textUnderlineOffset'] = '0.18em';
    }
    // 'color'/'sweep'/'gradient' just change color (gradient fills via background-clip above).
  }
  return css;
}

/**
 * Convert a CSS text-shadow stack into filter:drop-shadow() layers.
 * background-clip:text + text-shadow = silhouette only; drop-shadow keeps the
 * gradient fill and still gives depth under the glyphs.
 */
function cssTextShadowToDropFilter(shadow: string): string {
  // Split on commas that separate shadow layers (not those inside rgba()).
  const layers: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < shadow.length; i += 1) {
    const ch = shadow[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      if (cur.trim()) layers.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) layers.push(cur.trim());
  if (!layers.length) return 'drop-shadow(0 2px 6px rgba(0,0,0,0.55))';
  return layers
    .slice(0, 4)
    .map((layer) => `drop-shadow(${layer})`)
    .join(' ');
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
  /**
   * The block's ambient motion: 'still' strips float/wiggle, 'float' is the
   * gentle bob, 'wiggle' a soft rotational sway. Omit = the preset's own
   * blockFx. Page-level effects (ghostFade) are a different axis and survive.
   */
  blockMotion?: 'still' | 'float' | 'wiggle';
  /** Toggle float bob independently (can combine with wiggle). */
  floatOn?: boolean;
  /** Toggle wiggle sway independently (can combine with float). */
  wiggleOn?: boolean;
  /** Float bob amplitude in em (0.02–0.4). Default 0.12. */
  floatAmpEm?: number;
  /** Float bob period in seconds (0.6–4). Default 1.8. */
  floatPeriodSec?: number;
  /** Wiggle rotation amplitude in degrees (0.3–6). Default 1.4. */
  wiggleDeg?: number;
  /** Wiggle period in seconds (0.4–3). Default 0.9. */
  wigglePeriodSec?: number;
  /** Ghost fade ease curve. */
  ghostEase?: 'linear' | 'smooth';
  /** Ghost vertical drift in em during fade (0–0.4). */
  ghostDriftEm?: number;
  /** Ghost each word on its spoken window (karaoke-synced reveal). */
  ghostSyncToWords?: boolean;
  /** Float/wiggle phase keyed to each word start. */
  motionSyncToWords?: boolean;
  /**
   * Ghost page fade on/off. true forces ghostFade into blockFx; false strips it.
   * Omit = leave the preset alone. This is the "ghost fade on and off" dial.
   */
  ghostFade?: boolean;
  /**
   * Drop shadow strength 0–1. Builds a soft black text-shadow under the words.
   * 0 = none. Composes with outerGlow (glow layers first, then drop).
   */
  dropShadow?: number;
  /**
   * Outer glow: soft bloom around every word. Color defaults to the active
   * caption color when omitted. Strength 0–1 (0 = off).
   */
  outerGlow?: { strength: number; color?: string };
  /**
   * Full-block / active-word gradient fill. When set, paints with
   * background-clip:text and suppresses stroke on filled glyphs.
   * colors: 2–3 stops. scope 'all' = every word; 'active' = spoken only.
   */
  gradientFill?: {
    colors: [string, string] | [string, string, string];
    scope?: 'active' | 'all';
    angle?: number;
    shift?: boolean;
  };
  /** Ghost fade-in duration in seconds (0.05–1.2). Requires ghostFade on. */
  ghostFadeInSec?: number;
  /** Ghost fade-out duration in seconds (0.05–1.2). Requires ghostFade on. */
  ghostFadeOutSec?: number;
  /**
   * Ghost reveal/dissolve unit. 'block' = whole page, 'word' = one word at a
   * time, 'letter' = one letter at a time. Requires ghostFade on.
   */
  ghostStagger?: 'block' | 'word' | 'letter';
  /** Delay between staggered ghost units in seconds (0.02–0.25). */
  ghostStaggerSec?: number;
  /** Entrance animation override (pop, slam, tilt3d, ...). */
  anim?: CaptionAnim | '';
  /** Highlight mode override (color, box, boxGrow, ...). */
  highlightMode?: HighlightMode;
  /** Wave bounce on the caption block. */
  waveBounce?: boolean;
  /** Hand-drawn SVG accent on the active word. */
  handDrawn?: false | 'underline' | 'circle';
  /** Camera punch-in on page enter. */
  punchIn?: boolean;
  /** Cinematic letterbox bars. */
  letterbox?: boolean;
  /** Springy scale-out on page exit. */
  springExit?: boolean;
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

/**
 * The authored range for `sizePx`, exported so every surface that lets a human
 * change the caption size agrees on the limits.
 *
 * These numbers used to live only inside the clamp below, so the size slider and
 * anything else that touched sizePx re-typed them from memory. That is precisely
 * the shape of the bug that made the renderer ignore 37 of 41 caption presets: a
 * second, hand-copied definition of what counts as valid. One export, no copies.
 *
 * The unit is px authored against the 360px editor stage (CAPTION_STAGE_W); the
 * caption layer scales it to the real frame width.
 */
export const CAPTION_SIZE_MIN = 8;
export const CAPTION_SIZE_MAX = 200;
export const CAPTION_SIZE_DEFAULT = 18;

/** Resolve the on-stage layout from overrides (canvas + burn-in share this). */
export function captionLayoutFor(
  def: CaptionStyleDef,
  overrides?: CaptionOverrides | null,
): CaptionLayout {
  const o = overrides ?? {};
  return {
    xPct: clampNum(o.xPct, 0, 100, 50),
    positionPct: clampNum(o.positionPct, 0, 100, 12),
    sizePx: clampNum(o.sizePx, CAPTION_SIZE_MIN, CAPTION_SIZE_MAX, CAPTION_SIZE_DEFAULT),
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
  // Whole-text gradient fill override (paints every word, drops stroke).
  if (overrides.gradientFill && Array.isArray(overrides.gradientFill.colors)) {
    const cols = overrides.gradientFill.colors.filter(
      (c): c is string => typeof c === 'string' && c.length > 0,
    );
    if (cols.length >= 2) {
      out.gradient = cols.length >= 3
        ? [cols[0], cols[1], cols[2]]
        : [cols[0], cols[1]];
      out.gradientScope = overrides.gradientFill.scope === 'active' ? 'active' : 'all';
      if (typeof overrides.gradientFill.angle === 'number' && Number.isFinite(overrides.gradientFill.angle)) {
        out.gradientAngle = Math.max(0, Math.min(360, overrides.gradientFill.angle));
      }
      if (overrides.gradientFill.shift) {
        out.gradientShift = true;
      }
      // Gradient glyphs can't carry a stroke without the black-halo bug.
      out.stroke = undefined;
    }
  }
  // Block feel: float + wiggle are independent toggles (can both be on).
  // Legacy blockMotion still works for old saves.
  {
    let fx = [...(out.blockFx ?? [])];
    const hasFloatToggle = typeof overrides.floatOn === 'boolean';
    const hasWiggleToggle = typeof overrides.wiggleOn === 'boolean';
    if (hasFloatToggle || hasWiggleToggle) {
      if (hasFloatToggle) {
        fx = fx.filter((x) => x !== 'float');
        if (overrides.floatOn) fx.push('float');
      }
      if (hasWiggleToggle) {
        fx = fx.filter((x) => x !== 'wiggle');
        if (overrides.wiggleOn) fx.push('wiggle');
      }
      out.blockFx = fx;
    } else if (
      overrides.blockMotion === 'still' ||
      overrides.blockMotion === 'float' ||
      overrides.blockMotion === 'wiggle'
    ) {
      const rest = fx.filter((x) => x !== 'float' && x !== 'wiggle');
      out.blockFx =
        overrides.blockMotion === 'still' ? rest : [...rest, overrides.blockMotion];
    }
    const m: NonNullable<CaptionStyleDef['motion']> = { ...(out.motion ?? {}) };
    let touched = false;
    if (typeof overrides.floatAmpEm === 'number' && Number.isFinite(overrides.floatAmpEm)) {
      m.floatAmpEm = Math.max(0.02, Math.min(0.4, overrides.floatAmpEm));
      touched = true;
    }
    if (typeof overrides.floatPeriodSec === 'number' && Number.isFinite(overrides.floatPeriodSec)) {
      m.floatPeriodSec = Math.max(0.6, Math.min(4, overrides.floatPeriodSec));
      touched = true;
    }
    if (typeof overrides.wiggleDeg === 'number' && Number.isFinite(overrides.wiggleDeg)) {
      m.wiggleDeg = Math.max(0.3, Math.min(6, overrides.wiggleDeg));
      touched = true;
    }
    if (typeof overrides.wigglePeriodSec === 'number' && Number.isFinite(overrides.wigglePeriodSec)) {
      m.wigglePeriodSec = Math.max(0.4, Math.min(3, overrides.wigglePeriodSec));
      touched = true;
    }
    if (touched) out.motion = m;
  }
  // Ghost fade dial — independent of float/wiggle.
  if (typeof overrides.ghostFade === 'boolean') {
    const rest = (out.blockFx ?? []).filter((fx) => fx !== 'ghostFade');
    out.blockFx = overrides.ghostFade ? [...rest, 'ghostFade'] : rest;
  }
  // Editor block FX toggles
  {
    const toggles: Array<[boolean | undefined, CaptionBlockFx]> = [
      [overrides.punchIn, 'punchIn'],
      [overrides.letterbox, 'letterbox'],
      [overrides.springExit, 'springExit'],
    ];
    let fx = [...(out.blockFx ?? [])] as CaptionBlockFx[];
    for (const [on, name] of toggles) {
      if (typeof on !== 'boolean') continue;
      fx = fx.filter((x) => x !== name);
      if (on) fx.push(name);
    }
    out.blockFx = fx;
  }
  if (overrides.motionTrail) {
    out.anim = out.anim && out.anim !== '' ? out.anim : 'motionTrail';
  }
  if (overrides.outlineFill) {
    out.anim = 'outlineFill';
  }
  if (overrides.dualTone) {
    out.anim = 'dualTone';
  }
  if (typeof overrides.anim === 'string') {
    out.anim = overrides.anim as CaptionAnim;
  }
  if (typeof overrides.highlightMode === 'string' && overrides.highlightMode) {
    out.highlightMode = overrides.highlightMode as HighlightMode;
  }
  if (typeof overrides.waveBounce === 'boolean') {
    let fx = [...(out.blockFx ?? [])] as CaptionBlockFx[];
    fx = fx.filter((x) => x !== 'waveBounce');
    if (overrides.waveBounce) fx.push('waveBounce' as CaptionBlockFx);
    out.blockFx = fx;
  }
  if (overrides.handDrawn === 'underline' || overrides.handDrawn === 'circle') {
    (out as CaptionStyleDef & { handDrawn?: string }).handDrawn = overrides.handDrawn;
  } else if (overrides.handDrawn === false) {
    delete (out as { handDrawn?: string }).handDrawn;
  }


  // Ghost timing + stagger (fade fully on → hold → fade fully off).
  {
    const gi = overrides.ghostFadeInSec;
    const go = overrides.ghostFadeOutSec;
    const gs = overrides.ghostStagger;
    const gss = overrides.ghostStaggerSec;
    const ge = overrides.ghostEase;
    const gd = overrides.ghostDriftEm;
    const hasTiming =
      (typeof gi === 'number' && Number.isFinite(gi)) ||
      (typeof go === 'number' && Number.isFinite(go)) ||
      gs === 'block' ||
      gs === 'word' ||
      gs === 'letter' ||
      (typeof gss === 'number' && Number.isFinite(gss)) ||
      ge === 'linear' ||
      ge === 'smooth' ||
      (typeof gd === 'number' && Number.isFinite(gd));
    if (hasTiming) {
      out.ghost = {
        ...(out.ghost ?? {}),
        ...(typeof gi === 'number' && Number.isFinite(gi)
          ? { fadeInSec: Math.max(0.05, Math.min(1.2, gi)) }
          : {}),
        ...(typeof go === 'number' && Number.isFinite(go)
          ? { fadeOutSec: Math.max(0.05, Math.min(1.2, go)) }
          : {}),
        ...(gs === 'block' || gs === 'word' || gs === 'letter'
          ? { stagger: gs }
          : {}),
        ...(typeof gss === 'number' && Number.isFinite(gss)
          ? { staggerSec: Math.max(0.02, Math.min(0.25, gss)) }
          : {}),
        ...(ge === 'linear' || ge === 'smooth' ? { ease: ge } : {}),
        ...(typeof gd === 'number' && Number.isFinite(gd)
          ? { driftEm: Math.max(0, Math.min(0.4, gd)) }
          : {}),
      };
    }
    }
  
  // Karaoke-sync toggles for ghost + motion.
  if (typeof overrides.ghostSyncToWords === 'boolean') {
    out.ghost = { ...(out.ghost ?? {}), syncToWords: overrides.ghostSyncToWords };
  }
  if (typeof overrides.motionSyncToWords === 'boolean') {
    out.motion = { ...(out.motion ?? {}), syncToWords: overrides.motionSyncToWords };
  }
  // Drop shadow + outer glow compose into a single text-shadow stack so the
  // layer (which already reads def.shadow) picks them up with no extra path.

  {
    const parts: string[] = [];
    const glow = overrides.outerGlow;
    if (glow && typeof glow.strength === 'number' && glow.strength > 0) {
      const s = Math.max(0, Math.min(1, glow.strength));
      const c = (typeof glow.color === 'string' && glow.color) || out.activeColor || '#ffffff';
      const r1 = (6 + s * 10).toFixed(1);
      const r2 = (14 + s * 22).toFixed(1);
      parts.push(`0 0 ${r1}px ${c}`, `0 0 ${r2}px ${c}88`);
    }
    if (typeof overrides.dropShadow === 'number' && overrides.dropShadow > 0) {
      const s = Math.max(0, Math.min(1, overrides.dropShadow));
      const y = (2 + s * 6).toFixed(1);
      const b = (4 + s * 14).toFixed(1);
      const a = (0.45 + s * 0.45).toFixed(2);
      parts.push(`0 ${y}px ${b}px rgba(0,0,0,${a})`);
    }
    if (parts.length) {
      // Keep any preset shadow underneath so themes don't lose their look.
      out.shadow = out.shadow ? `${parts.join(', ')}, ${out.shadow}` : parts.join(', ');
    }
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
