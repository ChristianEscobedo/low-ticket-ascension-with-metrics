/**
 * The Thumbnail Lab — the pure composition model the canvas editor renders.
 *
 * WHY A PURE MODULE AND NOT JUST CANVAS CALLS
 * -------------------------------------------
 * The editor's job is drawing; THIS module's job is deciding WHAT to draw:
 * the layer list (background frame, treatments, text layers, badges), the
 * templates that fill it, and the safe zones text must stay inside. Keeping
 * it pure means the same composition renders in the editor, in tests, and
 * later server-side (burn-in via ffmpeg) without a DOM.
 */

export interface ThumbnailTextLayer {
  id: string;
  text: string;
  /** 0–100 percentage position of the text CENTER in the frame. */
  xPct: number;
  yPct: number;
  /** px font size at 1280×720 reference size. */
  fontPx: number;
  color: string;
  strokeColor: string;
  strokePx: number;
  align: 'left' | 'center' | 'right';
  upper: boolean;
  weight: 700 | 800 | 900;
}

export interface ThumbnailBadge {
  id: string;
  text: string;
  xPct: number;
  yPct: number;
  color: string;
  bg: string;
}

export type ThumbnailTreatment = 'none' | 'darken' | 'blur' | 'vignette';

export interface ThumbnailComposition {
  /** 16:9 canvas reference size — everything is computed at this size and scaled. */
  width: 1280;
  height: 720;
  /** Background image/frame URL (or a seed image from the library). */
  backgroundUrl: string;
  treatment: ThumbnailTreatment;
  textLayers: ThumbnailTextLayer[];
  badges: ThumbnailBadge[];
}

export interface ThumbnailTemplate {
  id: string;
  label: string;
  hint: string;
  build: (hook: string) => Pick<ThumbnailComposition, 'treatment' | 'textLayers' | 'badges'>;
}

let _lid = 0;
function lid(prefix: string) {
  _lid += 1;
  return `${prefix}-${_lid}`;
}

/** YouTube's safe zone: keep text inside the middle 80% (platform chrome eats the edges). */
export const SAFE_ZONE = { leftPct: 8, rightPct: 92, topPct: 8, bottomPct: 88 } as const;

/** Clamp a layer's center so its text never leaves the safe zone. */
export function clampToSafeZone(xPct: number, yPct: number): { xPct: number; yPct: number } {
  return {
    xPct: Math.min(SAFE_ZONE.rightPct, Math.max(SAFE_ZONE.leftPct, xPct)),
    yPct: Math.min(SAFE_ZONE.bottomPct, Math.max(SAFE_ZONE.topPct, yPct)),
  };
}

export const THUMBNAIL_TEMPLATES: ThumbnailTemplate[] = [
  {
    id: 'bold-left',
    label: 'Bold left',
    hint: 'Big hook on the left third, darkened frame behind it',
    build: (hook) => ({
      treatment: 'darken',
      badges: [],
      textLayers: [
        {
          id: lid('t'),
          text: hook,
          xPct: 10,
          yPct: 62,
          fontPx: 96,
          color: '#ffffff',
          strokeColor: '#000000',
          strokePx: 10,
          align: 'left',
          upper: true,
          weight: 900,
        },
      ],
    }),
  },
  {
    id: 'center-stat',
    label: 'Center stat',
    hint: 'One huge number or phrase dead center, vignette behind',
    build: (hook) => ({
      treatment: 'vignette',
      badges: [],
      textLayers: [
        {
          id: lid('t'),
          text: hook,
          xPct: 50,
          yPct: 46,
          fontPx: 132,
          color: '#ffd400',
          strokeColor: '#000000',
          strokePx: 14,
          align: 'center',
          upper: true,
          weight: 900,
        },
      ],
    }),
  },
  {
    id: 'question-hook',
    label: 'Question hook',
    hint: 'Question on top, answer tease at the bottom, small badge',
    build: (hook) => ({
      treatment: 'darken',
      badges: [
        {
          id: lid('b'),
          text: 'WATCH',
          xPct: 88,
          yPct: 10,
          color: '#ffffff',
          bg: '#e11d48',
        },
      ],
      textLayers: [
        {
          id: lid('t'),
          text: hook,
          xPct: 50,
          yPct: 22,
          fontPx: 72,
          color: '#ffffff',
          strokeColor: '#000000',
          strokePx: 8,
          align: 'center',
          upper: false,
          weight: 800,
        },
        {
          id: lid('t'),
          text: 'The answer surprises you',
          xPct: 50,
          yPct: 80,
          fontPx: 44,
          color: '#ffd400',
          strokeColor: '#000000',
          strokePx: 6,
          align: 'center',
          upper: false,
          weight: 800,
        },
      ],
    }),
  },
  {
    id: 'episode',
    label: 'Episode card',
    hint: 'Series badge top-left, hook low — for numbered content',
    build: (hook) => ({
      treatment: 'darken',
      badges: [
        {
          id: lid('b'),
          text: 'EP 1',
          xPct: 12,
          yPct: 10,
          color: '#0f0f0f',
          bg: '#ffd400',
        },
      ],
      textLayers: [
        {
          id: lid('t'),
          text: hook,
          xPct: 50,
          yPct: 78,
          fontPx: 64,
          color: '#ffffff',
          strokeColor: '#000000',
          strokePx: 8,
          align: 'center',
          upper: true,
          weight: 900,
        },
      ],
    }),
  },
];

/** Build a composition from a template id + hook text (empty composition when unknown). */
export function compositionFromTemplate(
  templateId: string,
  hook: string,
  backgroundUrl: string,
): ThumbnailComposition {
  const tpl = THUMBNAIL_TEMPLATES.find((t) => t.id === templateId) ?? THUMBNAIL_TEMPLATES[0];
  const built = tpl.build(hook);
  return {
    width: 1280,
    height: 720,
    backgroundUrl,
    treatment: built.treatment,
    textLayers: built.textLayers.map((l) => ({
      ...l,
      ...(clampToSafeZone(l.xPct, l.yPct) as { xPct: number; yPct: number }),
    })),
    badges: built.badges,
  };
}

/** Auto-layout for per-variant stamping: each variant's hook onto its own frame. */
export function variantStampComposition(opts: {
  hook: string;
  backgroundUrl: string;
  variantIndex: number;
}): ThumbnailComposition {
  // Alternate two proven layouts so adjacent variants never look identical.
  const tplId = opts.variantIndex % 2 === 0 ? 'bold-left' : 'center-stat';
  return compositionFromTemplate(tplId, opts.hook, opts.backgroundUrl);
}

/** Estimate a text layer's pixel width at reference size (rough: 0.62em per char, weight-adjusted). */
export function estimateTextWidthPx(layer: ThumbnailTextLayer): number {
  const text = layer.upper ? layer.text.toUpperCase() : layer.text;
  return Math.round(text.length * layer.fontPx * (layer.weight >= 900 ? 0.64 : 0.58));
}

/** Does the layer fit inside the safe zone at its current size? */
export function layerFits(layer: ThumbnailTextLayer): boolean {
  const w = estimateTextWidthPx(layer);
  const halfPct = ((w / 1280) * 100) / 2;
  return (
    layer.xPct - halfPct >= SAFE_ZONE.leftPct - 1 &&
    layer.xPct + halfPct <= SAFE_ZONE.rightPct + 1
  );
}

/** Shrink a layer's font until it fits the safe zone (min 24px). */
export function fitLayer(layer: ThumbnailTextLayer): ThumbnailTextLayer {
  let out = { ...layer };
  while (!layerFits(out) && out.fontPx > 24) {
    out = { ...out, fontPx: Math.max(24, out.fontPx - 4) };
  }
  return out;
}
