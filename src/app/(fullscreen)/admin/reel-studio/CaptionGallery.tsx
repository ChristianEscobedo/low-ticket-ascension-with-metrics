'use client';

/**
 * R17b + R17c — the Submagic-style caption preset gallery + customizer.
 *
 * A browsable 3-col tile grid: each tile renders a sample word IN the preset's
 * actual font/colors/highlight (a live sample, exactly like Submagic). Filter
 * chips slice by tag (trend / new / premium). Click = apply to the reel (the
 * canvas restyles live). "Customize ▸" opens position/size/color controls whose
 * overrides persist per reel and merge over the preset at render.
 */
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Check, SlidersHorizontal, Zap } from 'lucide-react';

import {
  CAPTION_STYLE_DEFS,
  captionCssFor,
  captionDefFor,
  resolveCaptionStyle,
  EDITOR_PACKS,
  CAPTION_ANIMS,
  HIGHLIGHT_MODES,
  type CaptionOverrides,
  type CaptionStyleDef,
  type CaptionTag,
} from '@/lib/mothermode/reel/captions';
import type { CaptionPreset } from '@/lib/mothermode/reel/types';

const FILTERS: { id: CaptionTag | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trend', label: 'Trend' },
  { id: 'new', label: 'New' },
  { id: 'premium', label: 'Premium' },
];

/** Normalize 2–3 color stops into the gradientFill tuple shape. */
function gradientStopsOf(
  stops: readonly string[] | undefined | null,
  fallback: [string, string] | [string, string, string] = [
    '#22D3EE',
    '#A78BFA',
  ],
): [string, string] | [string, string, string] {
  const cleaned = (stops ?? []).filter(
    (c): c is string => typeof c === 'string' && !!c,
  );
  if (cleaned.length >= 3) return [cleaned[0], cleaned[1], cleaned[2]];
  if (cleaned.length >= 2) return [cleaned[0], cleaned[1]];
  return fallback;
}


/** One gallery tile: the preset's label rendered in its own style on a dark chip. */
function PresetTile({
  def,
  selected,
  onPick,
}: {
  def: CaptionStyleDef;
  selected: boolean;
  onPick: () => void;
}) {
  const css = captionCssFor(def);
  return (
    <button
      onClick={onPick}
      title={`${def.label} — ${def.highlightMode} highlight`}
      className={clsx(
        'group relative flex h-16 flex-col items-center justify-center overflow-hidden rounded-lg border bg-neutral-950 transition-all',
        selected
          ? 'border-brass ring-1 ring-brass/60'
          : 'border-bone/10 hover:border-bone/30',
      )}
    >
      {/* live sample: idle word + the ACTIVE word (the karaoke beat) */}
      <span
        className="pointer-events-none flex items-baseline gap-1 px-1 leading-none"
        style={{ fontFamily: css.fontFamily, fontWeight: def.weight }}
      >
        <span style={{ ...css.word, fontSize: 13 }}>
          {def.upper ? 'YOUR' : 'Your'}
        </span>
        <span style={{ ...css.active, fontSize: 13 }}>
          {def.upper ? 'WORD' : 'word'}
        </span>
      </span>
      <span className="pointer-events-none mt-1 text-[8px] font-semibold uppercase tracking-wide text-bone/40">
        {def.label}
      </span>
      {selected && (
        <span className="absolute right-1 top-1 rounded-full bg-brass p-0.5 text-ink">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}
      {/* tag badges */}
      <span className="absolute left-1 top-1 flex gap-0.5">
        {def.tags.includes('new') && (
          <span className="rounded bg-emerald-500/20 px-1 text-[7px] font-bold text-emerald-300">
            NEW
          </span>
        )}
        {def.tags.includes('premium') && (
          <span className="rounded bg-amber-500/20 px-1 text-[7px] font-bold text-amber-300">
            PRO
          </span>
        )}
      </span>
    </button>
  );
}

/** A color well row (font / main / second / third). */
function ColorWell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span
        className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-bone/20"
        style={{ backgroundColor: value || 'transparent' }}
        title={`${label}: ${value || 'preset default'}`}
      >
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full cursor-pointer opacity-0"
        />
      </span>
      <span className="text-[10px] text-bone/55">{label}</span>
      {value && (
        <button
          onClick={() => onChange('')}
          className="ml-auto text-[9px] text-bone/30 hover:text-bone/60"
          title="Reset to the preset default"
        >
          ↺
        </button>
      )}
    </label>
  );
}

/** A small numeric stepper (words-per-row / rows). */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-bone/55">{label}</span>
      <span className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="h-5 w-5 rounded border border-bone/15 text-[11px] text-bone/60 hover:bg-bone/10 disabled:opacity-30"
        >
          −
        </button>
        <span className="w-5 text-center text-[10px] font-bold text-brass/90">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="h-5 w-5 rounded border border-bone/15 text-[11px] text-bone/60 hover:bg-bone/10 disabled:opacity-30"
        >
          +
        </button>
      </span>
    </div>
  );
}

export function CaptionGallery({
  currentPreset,
  overrides,
  onPick,
  onCustomize,
  onResetOverrides,
  onApplyTransition,

  words = [],
  clipName = '',
}: {
  currentPreset: CaptionPreset;
  overrides?: CaptionOverrides;
  onPick: (def: CaptionStyleDef) => void;
  onCustomize: (patch: Partial<CaptionOverrides>) => void;
  /** Clear every caption override back to the preset defaults. */
  onResetOverrides?: () => void;
  /**
   * A pack's seam transition: set it on every boundary (null = hard cuts).
   * The page owns the clips, so the gallery hands the choice up.
   */
  onApplyTransition?: (type: import('@/lib/mothermode/reel/types').ReelTransitionType | null) => void;
  /** R20: the current scene's word track (shown as a timestamped subtitle list). */
  words?: { word: string; start: number; end: number }[];
  clipName?: string;
}) {
  const [filter, setFilter] = useState<CaptionTag | 'all'>('all');
  const [customizing, setCustomizing] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  /** Saved custom themes (named looks) — persisted in localStorage, shown under Custom. */
  const [customThemes, setCustomThemes] = useState<{ name: string; presetId: string; overrides: CaptionOverrides }[]>(() => {
    try {
      const raw = localStorage.getItem('reel-studio:custom-caption-themes');
      return raw ? (JSON.parse(raw) as { name: string; presetId: string; overrides: CaptionOverrides }[]) : [];
    } catch {
      return [];
    }
  });
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeName, setThemeName] = useState('');

  const defs = useMemo(
    () =>
      filter === 'all'
        ? CAPTION_STYLE_DEFS
        : CAPTION_STYLE_DEFS.filter((d) => d.tags.includes(filter)),
    [filter],
  );

  /** Save the current look (preset + overrides) as a named custom theme. */
  function saveCustomTheme() {
    const name = themeName.trim();
    if (!name) return;
    const next = [
      ...customThemes.filter((t) => t.name !== name),
      { name, presetId: String(currentPreset), overrides: { ...(overrides ?? {}) } },
    ].slice(0, 24);
    setCustomThemes(next);
    try {
      localStorage.setItem('reel-studio:custom-caption-themes', JSON.stringify(next));
    } catch {
      /* private mode */
    }
    setSavingTheme(false);
    setThemeName('');
  }

  /** Apply a saved custom theme: its preset + its overrides. */
  function applyCustomTheme(t: { name: string; presetId: string; overrides: CaptionOverrides }) {
    const def = CAPTION_STYLE_DEFS.find((d) => d.id === t.presetId);
    if (def) onPick(def);
    onCustomize(t.overrides);
  }

  // Resolve the current preset through captionDefFor so a LEGACY id (karaoke,
  // beast, hormozi, minimal) maps to its def — otherwise the selected tile never
  // highlights because currentPreset ('karaoke') never equals a def id
  // ('kelly-neon'). This is the "selected on the panel shows on the preview" sync.
  const activeDef = resolveCaptionStyle(captionDefFor(currentPreset), overrides);
  const activeDefId = activeDef.id;
  const posPct = overrides?.positionPct ?? 12;
  const sizePx = overrides?.sizePx ?? 18;
  const wordsPerRow = overrides?.wordsPerRow ?? activeDef.wordsPerLine;
  const rows = overrides?.rows ?? 1;
  const colors = overrides?.colors ?? [];

  const fmtT = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(2).padStart(5, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="flex h-full flex-col gap-2">
      {/* filter chips */}
      <div className="flex items-center gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'rounded-full px-2.5 py-1 text-[9px] font-semibold',
              filter === f.id
                ? 'bg-brass text-ink'
                : 'text-bone/45 hover:bg-bone/10',
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[9px] text-bone/25">{defs.length} looks</span>
      </div>

      {/* the 3-col tile grid — selected = the RESOLVED def id, so a legacy
          currentPreset ('karaoke') highlights its mapped def, and the preview's
          current look is the one that's lit. This is the panel↔preview sync. */}
      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto pr-0.5">
        {defs.map((d) => (
          <PresetTile
            key={d.id}
            def={d}
            selected={activeDefId === d.id}
            onPick={() => onPick(d)}
          />
        ))}
      </div>

      {/* CUSTOM themes — named looks you saved, each with a live visual. */}
      {customThemes.length > 0 && (
        <div className="shrink-0 rounded-xl border border-bone/10 bg-bone/[0.03] px-2 py-1.5">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-bone/50">
            Custom themes
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {customThemes.map((t) => {
              const def = CAPTION_STYLE_DEFS.find((d) => d.id === t.presetId);
              const css = def ? captionCssFor(resolveCaptionStyle(def, t.overrides)) : null;
              return (
                <button
                  key={t.name}
                  onClick={() => applyCustomTheme(t)}
                  title={`Apply "${t.name}"`}
                  className="group relative flex h-14 flex-col items-center justify-center overflow-hidden rounded-lg border border-bone/10 bg-neutral-950 transition-all hover:border-bone/30"
                >
                  {css ? (
                    <span
                      className="pointer-events-none flex items-baseline gap-1 px-1 leading-none"
                      style={{ fontFamily: css.fontFamily }}
                    >
                      <span style={{ ...css.word, fontSize: 12 }}>Aa</span>
                      <span style={{ ...css.active, fontSize: 12 }}>Bb</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-bone/40">Aa</span>
                  )}
                  <span className="pointer-events-none mt-0.5 max-w-full truncate px-1 text-[8px] font-semibold text-bone/50">
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* R17c Customize ▸ (Submagic's bottom bar as real controls) */}
      <div className="shrink-0 rounded-xl border border-bone/10 bg-bone/[0.03]">
        <button
          onClick={() => setCustomizing((v) => !v)}
          className="flex w-full items-center gap-2 px-2.5 py-2 text-[10px] font-semibold text-bone/60 hover:text-bone"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-brass/80" />
          Customize <span className="text-bone/30">— {activeDef.label}</span>
          <span className="ml-auto text-bone/30">{customizing ? '▾' : '▸'}</span>
        </button>
        {customizing && (
          <div className="space-y-2.5 border-t border-bone/10 px-2.5 py-2.5">
            {/* position */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                <span>Caption position</span>
                <span className="text-brass/80">{posPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={posPct}
                onChange={(e) => onCustomize({ positionPct: Number(e.target.value) })}
                className="w-full accent-brass"
              />
              <p className="mt-0.5 text-[8px] text-bone/25">0 = bottom · 90 = near the top</p>
            </div>
            {/* font size (text scale up/down) */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                <span>Text size</span>
                <span className="text-brass/80">{sizePx}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={64}
                step={1}
                value={sizePx}
                onChange={(e) => onCustomize({ sizePx: Number(e.target.value) })}
                className="w-full accent-brass"
              />
              <p className="mt-0.5 text-[8px] text-bone/25">
                Scales the captions on the preview + the burned MP4.
              </p>
            </div>
              {/* layout: words per row + rows */}
              <div className="space-y-1.5 rounded-lg border border-bone/10 bg-ink/40 px-2 py-2">
                <Stepper
                  label="Words per row"
                  value={wordsPerRow}
                  min={1}
                  max={6}
                  onChange={(n) => onCustomize({ wordsPerRow: n })}
                />
                <Stepper
                  label="Rows shown"
                  value={rows}
                  min={1}
                  max={3}
                  onChange={(n) => onCustomize({ rows: n })}
                />
                {/* PHRASE rows: each row is a natural speech phrase (punctuation /
                    timing gap), not a fixed wordsPerRow chunk — the organic
                    "kinda random, not 2-words-2-rows" rhythm. */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[10px] text-bone/55">Phrase rows</span>
                  <button
                    type="button"
                    onClick={() =>
                      onCustomize({
                        rowMode: (overrides?.rowMode ?? 'fixed') === 'phrase' ? 'fixed' : 'phrase',
                      })
                    }
                    className={clsx(
                      'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                      (overrides?.rowMode ?? 'fixed') === 'phrase'
                        ? 'bg-brass text-ink'
                        : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                    )}
                    title="Each row is a natural speech phrase (breaks on punctuation or a pause) instead of a fixed word count — the organic, kinda-random rhythm"
                  >
                    {(overrides?.rowMode ?? 'fixed') === 'phrase' ? 'On' : 'Off'}
                  </button>
                </div>
                <p className="text-[8px] leading-relaxed text-bone/25">
                  1 word/row = the punchy Submagic beat. 2 rows = current + next line.
                  Phrase rows = each row is a spoken phrase, not a fixed count.
                </p>
              </div>
              {/* spacing: letters + words (the "space it out" dials) */}
              <div className="space-y-2 rounded-lg border border-bone/10 bg-ink/40 px-2 py-2">
                <div>
                  <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                    <span>Letter spacing</span>
                    <span className="text-brass/80">
                      {Math.round(
                        (overrides?.letterSpacing ??
                          activeDef.letterSpacingEm ??
                          (activeDef.upper ? 0.03 : 0.01)) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-5}
                    max={30}
                    step={1}
                    value={Math.round(
                      (overrides?.letterSpacing ??
                        activeDef.letterSpacingEm ??
                        (activeDef.upper ? 0.03 : 0.01)) * 100,
                    )}
                    onChange={(e) => onCustomize({ letterSpacing: Number(e.target.value) / 100 })}
                    className="w-full accent-brass"
                  />
                </div>
                <div>
                  <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                    <span>Word spacing</span>
                    <span className="text-brass/80">
                      {Math.round((overrides?.wordSpacing ?? activeDef.wordSpacingEm ?? 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={2}
                    value={Math.round(
                      (overrides?.wordSpacing ?? activeDef.wordSpacingEm ?? 0) * 100,
                    )}
                    onChange={(e) => onCustomize({ wordSpacing: Number(e.target.value) / 100 })}
                    className="w-full accent-brass"
                  />
                </div>
                <p className="text-[8px] leading-relaxed text-bone/25">
                  Airy captions: word spacing ~10–20%. Tight + punchy: letter spacing −2%.
                </p>
              </div>
              {/* Effects: ghost fade · drop shadow · outer glow */}
              <div className="space-y-2 rounded-lg border border-bone/10 bg-ink/40 px-2 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                  Effects
                </div>
                
                <div className="flex flex-col gap-2 rounded-lg border border-bone/10 bg-bone/[0.03] p-2">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-bone/40">
                    Motion
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const on =
                          overrides?.floatOn ??
                          (activeDef.blockFx ?? []).includes('float');
                        onCustomize({ floatOn: !on });
                      }}
                      className={clsx(
                        'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                        (overrides?.floatOn ??
                          (activeDef.blockFx ?? []).includes('float'))
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                      )}
                    >
                      Float{' '}
                      {(overrides?.floatOn ??
                        (activeDef.blockFx ?? []).includes('float'))
                        ? 'On'
                        : 'Off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const on =
                          overrides?.wiggleOn ??
                          (activeDef.blockFx ?? []).includes('wiggle');
                        onCustomize({ wiggleOn: !on });
                      }}
                      className={clsx(
                        'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                        (overrides?.wiggleOn ??
                          (activeDef.blockFx ?? []).includes('wiggle'))
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                      )}
                    >
                      Wiggle{' '}
                      {(overrides?.wiggleOn ??
                        (activeDef.blockFx ?? []).includes('wiggle'))
                        ? 'On'
                        : 'Off'}
                    </button>
                  </div>
                  {(overrides?.floatOn ??
                    (activeDef.blockFx ?? []).includes('float')) && (
                    <>
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Float amp</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.floatAmpEm ??
                            activeDef.motion?.floatAmpEm ??
                            0.12
                          ).toFixed(2)}
                          em
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={40}
                        step={1}
                        value={Math.round(
                          (overrides?.floatAmpEm ??
                            activeDef.motion?.floatAmpEm ??
                            0.12) * 100,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            floatAmpEm: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-brass"
                      />
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Float speed</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.floatPeriodSec ??
                            activeDef.motion?.floatPeriodSec ??
                            1.8
                          ).toFixed(1)}
                          s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={40}
                        step={1}
                        value={Math.round(
                          (overrides?.floatPeriodSec ??
                            activeDef.motion?.floatPeriodSec ??
                            1.8) * 10,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            floatPeriodSec: Number(e.target.value) / 10,
                          })
                        }
                        className="w-full accent-brass"
                      />
                    </>
                  )}
                  {(overrides?.wiggleOn ??
                    (activeDef.blockFx ?? []).includes('wiggle')) && (
                    <>
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Wiggle amp</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.wiggleDeg ??
                            activeDef.motion?.wiggleDeg ??
                            1.4
                          ).toFixed(1)}
                          °
                        </span>
                      </div>
                      <input
                        type="range"
                        min={3}
                        max={60}
                        step={1}
                        value={Math.round(
                          (overrides?.wiggleDeg ??
                            activeDef.motion?.wiggleDeg ??
                            1.4) * 10,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            wiggleDeg: Number(e.target.value) / 10,
                          })
                        }
                        className="w-full accent-brass"
                      />
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Wiggle speed</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.wigglePeriodSec ??
                            activeDef.motion?.wigglePeriodSec ??
                            0.9
                          ).toFixed(1)}
                          s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={30}
                        step={1}
                        value={Math.round(
                          (overrides?.wigglePeriodSec ??
                            activeDef.motion?.wigglePeriodSec ??
                            0.9) * 10,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            wigglePeriodSec: Number(e.target.value) / 10,
                          })
                        }
                        className="w-full accent-brass"
                      />
                    </>
                  )}
                </div>
<label className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-bone/55">Ghost fade</span>
                  <button
                    type="button"
                    onClick={() => {
                      const on =
                        overrides?.ghostFade ??
                        (activeDef.blockFx ?? []).includes('ghostFade');
                      onCustomize({ ghostFade: !on });
                    }}
                    className={clsx(
                      'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                      (overrides?.ghostFade ??
                        (activeDef.blockFx ?? []).includes('ghostFade'))
                        ? 'bg-brass text-ink'
                        : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                    )}
                    title="Page fades fully on, holds, then fades fully off"
                  >
                    {(overrides?.ghostFade ??
                      (activeDef.blockFx ?? []).includes('ghostFade'))
                      ? 'On'
                      : 'Off'}
                  </button>
                </label>
                {(overrides?.ghostFade ??
                  (activeDef.blockFx ?? []).includes('ghostFade')) && (
                  <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Fade in</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.ghostFadeInSec ??
                            activeDef.ghost?.fadeInSec ??
                            0.22
                          ).toFixed(2)}
                          s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={120}
                        step={5}
                        value={Math.round(
                          (overrides?.ghostFadeInSec ??
                            activeDef.ghost?.fadeInSec ??
                            0.22) * 100,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            ghostFadeInSec: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-brass"
                      />
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Fade out</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.ghostFadeOutSec ??
                            activeDef.ghost?.fadeOutSec ??
                            0.28
                          ).toFixed(2)}
                          s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={120}
                        step={5}
                        value={Math.round(
                          (overrides?.ghostFadeOutSec ??
                            activeDef.ghost?.fadeOutSec ??
                            0.28) * 100,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            ghostFadeOutSec: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-brass"
                      />
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Reveal</span>
                      </div>
                      <select
                        className="rounded border border-bone/15 bg-ink px-2 py-1 text-[10px] text-bone"
                        value={
                          overrides?.ghostStagger ??
                          activeDef.ghost?.stagger ??
                          'block'
                        }
                        onChange={(e) =>
                          onCustomize({
                            ghostStagger: e.target.value as
                              | 'block'
                              | 'word'
                              | 'letter',
                          })
                        }
                      >
                        <option value="block">Whole page</option>
                        <option value="word">Word by word</option>
                        <option value="letter">Letter by letter</option>
                      </select>
                    </div>
                    {(overrides?.ghostStagger ??
                      activeDef.ghost?.stagger ??
                      'block') !== 'block' && (
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                          <span>Stagger</span>
                          <span className="text-brass/80">
                            {(
                              overrides?.ghostStaggerSec ??
                              activeDef.ghost?.staggerSec ??
                              ((overrides?.ghostStagger ??
                                activeDef.ghost?.stagger) === 'letter'
                                ? 0.03
                                : 0.05)
                            ).toFixed(2)}
                            s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={25}
                          step={1}
                          value={Math.round(
                            (overrides?.ghostStaggerSec ??
                              activeDef.ghost?.staggerSec ??
                              ((overrides?.ghostStagger ??
                                activeDef.ghost?.stagger) === 'letter'
                                ? 0.03
                                : 0.05)) * 100,
                          )}
                          onChange={(e) =>
                            onCustomize({
                              ghostStaggerSec: Number(e.target.value) / 100,
                            })
                          }
                          className="accent-brass"
                        />
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Fade curve</span>
                      </div>
                      <select
                        className="rounded border border-bone/15 bg-ink px-2 py-1 text-[10px] text-bone"
                        value={
                          overrides?.ghostEase ??
                          activeDef.ghost?.ease ??
                          'smooth'
                        }
                        onChange={(e) =>
                          onCustomize({
                            ghostEase: e.target.value as 'linear' | 'smooth',
                          })
                        }
                      >
                        <option value="smooth">Smooth (movie)</option>
                        <option value="linear">Linear</option>
                      </select>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Rise / sink</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.ghostDriftEm ??
                            activeDef.ghost?.driftEm ??
                            0.14
                          ).toFixed(2)}
                          em
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={Math.round(
                          (overrides?.ghostDriftEm ??
                            activeDef.ghost?.driftEm ??
                            0.14) * 100,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            ghostDriftEm: Number(e.target.value) / 100,
                          })
                        }
                        className="accent-brass"
                      />
                    </div>
                      </div>
                    )}
                    </div>
                    <p className="text-[8px] leading-relaxed text-bone/25">
                      Full on → hold → full off. Short pages auto-shrink so a hold
                      still lands.
                    </p>
                  </div>
                )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {/* Sync reveal/motion to spoken word timings */}
            
            {/* One-click editor packs */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                Editor packs
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EDITOR_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    title={pack.blurb}
                    onClick={() => {
                      const def = CAPTION_STYLE_DEFS.find((d) => d.id === pack.presetId);
                      if (def) onPick(def);
                      if (pack.overrides) onCustomize(pack.overrides);
                      // The pack's seam transition rides the one-click look
                      // (null clears the seams — hard cuts are a look too).
                      onApplyTransition?.(pack.transition ?? null);
                    }}
                    className="rounded-full border border-bone/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-bone/55 hover:bg-bone/10 hover:text-bone"
                  >
                    {pack.label}
                  </button>
                ))}
              </div>
              <div className="text-[9px] leading-snug text-bone/40">
                Applies a stacked look (preset + motion). Tweak anything after.
              </div>
            </div>

            
            
            {/* Save the current look as a named custom theme + reset. */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/40 px-2 py-1.5">
              {savingTheme ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={themeName}
                    onChange={(e) => setThemeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveCustomTheme();
                      if (e.key === 'Escape') setSavingTheme(false);
                    }}
                    placeholder="Name this look…"
                    className="min-w-0 flex-1 rounded border border-bone/15 bg-ink px-2 py-1 text-[10px] text-bone outline-none placeholder:text-bone/25"
                  />
                  <button
                    type="button"
                    onClick={saveCustomTheme}
                    disabled={!themeName.trim()}
                    className="rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSavingTheme(true)}
                    className="rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink hover:brightness-110"
                    title="Save the current preset + overrides as a named custom theme"
                  >
                    Save as theme
                  </button>
                  {onResetOverrides && (
                    <button
                      type="button"
                      onClick={() => onResetOverrides()}
                      className="rounded-full border border-bone/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-bone/60 hover:bg-bone/10 hover:text-bone"
                      title="Clear all caption overrides and restore the preset defaults"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
              <p className="text-[8px] leading-relaxed text-bone/25">
                Saved themes show under "Custom themes" above with a live visual.
              </p>
            </div>


            {/* Stack + visibility */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                  Captions
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      captionsOn: !(overrides?.captionsOn !== false),
                    })
                  }
                  className={
                    overrides?.captionsOn === false
                      ? 'rounded-full border border-rose-400/40 px-2.5 py-0.5 text-[9px] font-bold uppercase text-rose-300'
                      : 'rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink'
                  }
                  title="Show or hide all captions"
                >
                  {overrides?.captionsOn === false ? 'Hidden' : 'Shown'}
                </button>
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50 pt-0.5">
                Stack mode
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'page', label: 'Karaoke page' },
                    { id: 'build', label: 'Build & hold' },
                  ] as const
                ).map((m) => {
                  const cur = overrides?.stackMode ?? 'page';
                  const on = cur === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={
                        m.id === 'build'
                          ? 'Words appear on speech and stay until the page flips — stacked phrase card'
                          : 'Whole page visible; highlight walks word-to-word'
                      }
                      onClick={() => onCustomize({ stackMode: m.id })}
                      className={
                        on
                          ? 'rounded-full bg-brass px-2 py-0.5 text-[9px] font-bold text-ink'
                          : 'rounded-full border border-bone/15 px-2 py-0.5 text-[9px] font-bold text-bone/45 hover:bg-bone/10'
                      }
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[8px] leading-relaxed text-bone/30">
                Build & hold + 2–3 rows + power words = the big stacked phrase look.
                Still locked to the spoken word clock.
              </p>
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50 pt-1">
                Mute ranges
              </div>
              <div className="space-y-1">
                {(overrides?.muteRanges ?? []).map((r, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px] text-bone/70">
                    <input
                      type="number"
                      step={0.1}
                      value={r.fromSec}
                      onChange={(e) => {
                        const next = [...(overrides?.muteRanges ?? [])];
                        next[i] = {
                          ...next[i],
                          fromSec: Number(e.target.value) || 0,
                        };
                        onCustomize({ muteRanges: next });
                      }}
                      className="w-14 rounded border border-bone/15 bg-ink px-1 py-0.5 text-[10px]"
                      title="From (sec)"
                    />
                    <span className="text-bone/30">→</span>
                    <input
                      type="number"
                      step={0.1}
                      value={r.toSec}
                      onChange={(e) => {
                        const next = [...(overrides?.muteRanges ?? [])];
                        next[i] = {
                          ...next[i],
                          toSec: Number(e.target.value) || 0,
                        };
                        onCustomize({ muteRanges: next });
                      }}
                      className="w-14 rounded border border-bone/15 bg-ink px-1 py-0.5 text-[10px]"
                      title="To (sec)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = (overrides?.muteRanges ?? []).filter(
                          (_, j) => j !== i,
                        );
                        onCustomize({ muteRanges: next });
                      }}
                      className="ml-auto text-[9px] text-bone/35 hover:text-rose-300"
                    >
                      remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      muteRanges: [
                        ...(overrides?.muteRanges ?? []),
                        { fromSec: 0, toSec: 2 },
                      ],
                    })
                  }
                  className="rounded-full border border-bone/15 px-2 py-0.5 text-[9px] font-bold uppercase text-bone/45 hover:bg-bone/10"
                >
                  + mute window
                </button>
              </div>
              <p className="text-[8px] leading-relaxed text-bone/25">
                Mute windows hide captions while other text is on screen. Times
                are project seconds.
              </p>
            </div>

{/* Entrance animation + highlight */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                Entrance anim
              </div>
              <div className="flex flex-wrap gap-1">
                {CAPTION_ANIMS.map((a) => {
                  const cur = overrides?.anim ?? activeDef.anim ?? 'pop';
                  const on = cur === a;
                  return (
                    <button
                      key={a || 'none'}
                      type="button"
                      onClick={() => onCustomize({ anim: a })}
                      className={
                        on
                          ? 'rounded-full bg-brass px-2 py-0.5 text-[9px] font-bold text-ink'
                          : 'rounded-full border border-bone/15 px-2 py-0.5 text-[9px] font-bold text-bone/45 hover:bg-bone/10'
                      }
                    >
                      {a || 'none'}
                    </button>
                  );
                })}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50 pt-1">
                Highlight
              </div>
              <div className="flex flex-wrap gap-1">
                {HIGHLIGHT_MODES.map((h) => {
                  const cur = overrides?.highlightMode ?? activeDef.highlightMode;
                  const on = cur === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onCustomize({ highlightMode: h })}
                      className={
                        on
                          ? 'rounded-full bg-brass px-2 py-0.5 text-[9px] font-bold text-ink'
                          : 'rounded-full border border-bone/15 px-2 py-0.5 text-[9px] font-bold text-bone/45 hover:bg-bone/10'
                      }
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onCustomize({ waveBounce: !(overrides?.waveBounce ?? false) })}
                  className={
                    overrides?.waveBounce
                      ? 'rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink'
                      : 'rounded-full border border-bone/15 px-2.5 py-0.5 text-[9px] font-bold uppercase text-bone/45 hover:bg-bone/10'
                  }
                >
                  Wave bounce
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      handDrawn:
                        overrides?.handDrawn === 'underline' ? false : 'underline',
                    })
                  }
                  className={
                    overrides?.handDrawn === 'underline'
                      ? 'rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink'
                      : 'rounded-full border border-bone/15 px-2.5 py-0.5 text-[9px] font-bold uppercase text-bone/45 hover:bg-bone/10'
                  }
                >
                  Draw underline
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      handDrawn: overrides?.handDrawn === 'circle' ? false : 'circle',
                    })
                  }
                  className={
                    overrides?.handDrawn === 'circle'
                      ? 'rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink'
                      : 'rounded-full border border-bone/15 px-2.5 py-0.5 text-[9px] font-bold uppercase text-bone/45 hover:bg-bone/10'
                  }
                >
                  Draw circle
                </button>
              </div>
            </div>

            {/* Full-block motion phase-lock to spoken caption page */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                Motion cue
              </div>
              <button
                type="button"
                onClick={() =>
                  onCustomize({
                    motionSyncToWords: !(overrides?.motionSyncToWords ?? false),
                  })
                }
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  overrides?.motionSyncToWords
                    ? 'bg-brass text-ink'
                    : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                )}
                title="Float/wiggle phase starts when this caption page is spoken"
              >
                {overrides?.motionSyncToWords ? 'Phase ↔ speech' : 'Phase free-run'}
              </button>
              <button
                type="button"
                onClick={() => onCustomize({ punchIn: !(overrides?.punchIn ?? false) })}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  overrides?.punchIn ? 'bg-brass text-ink' : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                )}
              >
                Punch-in
              </button>
              <button
                type="button"
                onClick={() => onCustomize({ letterbox: !(overrides?.letterbox ?? false) })}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  overrides?.letterbox ? 'bg-brass text-ink' : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                )}
              >
                Letterbox
              </button>
              <button
                type="button"
                onClick={() => onCustomize({ springExit: !(overrides?.springExit ?? false) })}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  overrides?.springExit ? 'bg-brass text-ink' : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                )}
              >
                Spring exit
              </button>

              <div className="text-[9px] leading-snug text-bone/40">
                Ghost always fades the full caption on, then fully off. Float/wiggle
                move the whole block — turn Phase ↔ speech on to lock the bob to when
                the line is spoken.
              </div>
            </div>
                  {(overrides?.gradientFill || activeDef.gradient) && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {gradientStopsOf(
                          overrides?.gradientFill?.colors ?? activeDef.gradient,
                        )
                          .slice(0, 3)
                          .map((hex, i) => (
                            <label key={i} className="flex items-center gap-1">
                              <span className="text-[8px] text-bone/35">
                                {i === 0 ? 'A' : i === 1 ? 'B' : 'C'}
                              </span>
                              <input
                                type="color"
                                value={hex.startsWith('#') ? hex.slice(0, 7) : '#ffffff'}
                                onChange={(e) => {
                                  const base = [
                                    ...gradientStopsOf(
                                      overrides?.gradientFill?.colors ??
                                        activeDef.gradient,
                                    ),
                                  ];
                                  base[i] = e.target.value;
                                  onCustomize({
                                    gradientFill: {
                                      colors: gradientStopsOf(base),
                                      scope:
                                        overrides?.gradientFill?.scope ??
                                        activeDef.gradientScope ??
                                        'all',
                                      angle:
                                        overrides?.gradientFill?.angle ??
                                        activeDef.gradientAngle ??
                                        135,
                                      shift:
                                        overrides?.gradientFill?.shift ??
                                        activeDef.gradientShift ??
                                        false,
                                    },
                                  });
                                }}
                                className="h-5 w-7 cursor-pointer rounded border border-bone/15 bg-transparent"
                              />
                            </label>
                          ))}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] text-bone/40">Scope</span>
                        <div className="flex gap-1">
                          {(['active', 'all'] as const).map((scope) => {
                            const cur =
                              overrides?.gradientFill?.scope ??
                              activeDef.gradientScope ??
                              'active';
                            return (
                              <button
                                key={scope}
                                type="button"
                                onClick={() => {
                                  onCustomize({
                                    gradientFill: {
                                      colors: gradientStopsOf(
                                        overrides?.gradientFill?.colors ??
                                          activeDef.gradient,
                                      ),
                                      scope,
                                      angle:
                                        overrides?.gradientFill?.angle ??
                                        activeDef.gradientAngle ??
                                        135,
                                      shift:
                                        overrides?.gradientFill?.shift ??
                                        activeDef.gradientShift ??
                                        false,
                                    },
                                  });
                                }}
                                className={clsx(
                                  'rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide',
                                  cur === scope
                                    ? 'bg-brass text-ink'
                                    : 'border border-bone/15 text-bone/40 hover:bg-bone/10',
                                )}
                              >
                                {scope === 'all' ? 'Whole text' : 'Active'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                          <span>Angle</span>
                          <span className="text-brass/80">
                            {Math.round(
                              overrides?.gradientFill?.angle ??
                                activeDef.gradientAngle ??
                                135,
                            )}
                            °
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={5}
                          value={Math.round(
                            overrides?.gradientFill?.angle ??
                              activeDef.gradientAngle ??
                              135,
                          )}
                          onChange={(e) => {
                            onCustomize({
                              gradientFill: {
                                colors: gradientStopsOf(
                                  overrides?.gradientFill?.colors ??
                                    activeDef.gradient,
                                ),
                                scope:
                                  overrides?.gradientFill?.scope ??
                                  activeDef.gradientScope ??
                                  'all',
                                angle: Number(e.target.value),
                                shift:
                                  overrides?.gradientFill?.shift ??
                                  activeDef.gradientShift ??
                                  false,
                              },
                            });
                          }}
                          className="w-full accent-brass"
                        />
                      </div>
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-[9px] text-bone/40">Living shift</span>
                        <button
                          type="button"
                          onClick={() => {
                            const cur =
                              overrides?.gradientFill?.shift ??
                              activeDef.gradientShift ??
                              false;
                            onCustomize({
                              gradientFill: {
                                colors: gradientStopsOf(
                                  overrides?.gradientFill?.colors ??
                                    activeDef.gradient,
                                ),
                                scope:
                                  overrides?.gradientFill?.scope ??
                                  activeDef.gradientScope ??
                                  'all',
                                angle:
                                  overrides?.gradientFill?.angle ??
                                  activeDef.gradientAngle ??
                                  135,
                                shift: !cur,
                              },
                            });
                          }}
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide',
                            (overrides?.gradientFill?.shift ??
                              activeDef.gradientShift)
                              ? 'bg-brass text-ink'
                              : 'border border-bone/15 text-bone/40 hover:bg-bone/10',
                          )}
                        >
                          {(overrides?.gradientFill?.shift ??
                            activeDef.gradientShift)
                            ? 'On'
                            : 'Off'}
                        </button>
                      </label>

                    </>
                  )}
                </div>
                <div>
                  <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                    <span>Drop shadow</span>

                    <span className="text-brass/80">
                      {Math.round((overrides?.dropShadow ?? 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round((overrides?.dropShadow ?? 0) * 100)}
                    onChange={(e) =>
                      onCustomize({ dropShadow: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-brass"
                  />
                  {/* SPREAD: how far the shadow reaches (0 = tight, 1 = long soft drop). */}
                  {(overrides?.dropShadow ?? 0) > 0 && (
                    <div className="mt-1.5">
                      <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Shadow reach</span>
                        <span className="text-brass/80">
                          {Math.round((overrides?.dropShadowSpread ?? 0.5) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round((overrides?.dropShadowSpread ?? 0.5) * 100)}
                        onChange={(e) =>
                          onCustomize({ dropShadowSpread: Number(e.target.value) / 100 })
                        }
                        className="w-full accent-brass"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                    <span>Outer glow</span>
                    <span className="text-brass/80">
                      {Math.round((overrides?.outerGlow?.strength ?? 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round((overrides?.outerGlow?.strength ?? 0) * 100)}
                    onChange={(e) =>
                      onCustomize({
                        outerGlow: {
                          strength: Number(e.target.value) / 100,
                          color: overrides?.outerGlow?.color,
                          spread: overrides?.outerGlow?.spread,
                        },
                      })
                    }
                    className="w-full accent-brass"
                  />
                  {/* SPREAD: how far the glow feathers out (0 = tight halo, 1 = wide bloom). */}
                  {(overrides?.outerGlow?.strength ?? 0) > 0 && (
                    <div className="mt-1.5">
                      <div className="mb-0.5 flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Glow reach</span>
                        <span className="text-brass/80">
                          {Math.round((overrides?.outerGlow?.spread ?? 0.5) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round((overrides?.outerGlow?.spread ?? 0.5) * 100)}
                        onChange={(e) =>
                          onCustomize({
                            outerGlow: {
                              strength: overrides?.outerGlow?.strength ?? 0.55,
                              color: overrides?.outerGlow?.color,
                              spread: Number(e.target.value) / 100,
                            },
                          })
                        }
                        className="w-full accent-brass"
                      />
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[9px] text-bone/40">Glow color</span>
                    <input
                      type="color"
                      value={
                        overrides?.outerGlow?.color ||
                        activeDef.activeColor ||
                        '#ffffff'
                      }
                      onChange={(e) =>
                        onCustomize({
                          outerGlow: {
                            strength: overrides?.outerGlow?.strength ?? 0.55,
                            color: e.target.value,
                          },
                        })
                      }
                      className="h-5 w-7 cursor-pointer rounded border border-bone/15 bg-transparent"
                      title="Outer glow color (defaults to active caption color)"
                    />
                    {overrides?.outerGlow?.color && (
                      <button
                        type="button"
                        onClick={() =>
                          onCustomize({
                            outerGlow: {
                              strength: overrides?.outerGlow?.strength ?? 0,
                              color: undefined,
                            },
                          })
                        }
                        className="text-[9px] text-bone/30 hover:text-bone/60"
                      >
                        ↺ default
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[8px] leading-relaxed text-bone/25">
                  Ghost: full fade on → hold → full fade off. Gradient paints the
                  glyphs (no outline halo). Shadow + glow stack on every word.
                </p>

              </div>
              {/* POWER WORDS — they glow in the active style even when idle */}
              <div>
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">
                  Power words <span className="normal-case text-bone/25">(comma separated)</span>
                </div>

                <input
                  defaultValue={(overrides?.powerWords ?? []).join(', ')}
                  onBlur={(e) =>
                    onCustomize({
                      powerWords: e.target.value
                        .split(',')
                        .map((w) => w.trim())
                        .filter(Boolean)
                        .slice(0, 24),
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  placeholder="money, free, secret…"
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-1.5 text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                />
                <p className="mt-0.5 text-[8px] leading-relaxed text-bone/25">
                  These words light up in the highlight color + grow, even when they aren't the
                  spoken word. Saves on blur.
                </p>
              </div>
            {/* color wells */}
            <div className="grid grid-cols-2 gap-2">
              <ColorWell
                label="Font"
                value={colors[0] ?? ''}
                onChange={(hex) => {
                  const next = [hex, colors[1] ?? '', colors[2] ?? '', colors[3] ?? ''];
                  onCustomize({ colors: next });
                }}
              />
              <ColorWell
                label="Main (active)"
                value={colors[1] ?? ''}
                onChange={(hex) => {
                  const next = [colors[0] ?? '', hex, colors[2] ?? '', colors[3] ?? ''];
                  onCustomize({ colors: next });
                }}
              />
              <ColorWell
                label="Second"
                value={colors[2] ?? ''}
                onChange={(hex) => {
                  const next = [colors[0] ?? '', colors[1] ?? '', hex, colors[3] ?? ''];
                  onCustomize({ colors: next });
                }}
              />
              <ColorWell
                label="Third"
                value={colors[3] ?? ''}
                onChange={(hex) => {
                  const next = [colors[0] ?? '', colors[1] ?? '', colors[2] ?? '', hex];
                  onCustomize({ colors: next });
                }}
              />
            </div>
            <p className="text-[8px] leading-relaxed text-bone/25">
              Font + Main recolor the preset live. Second/Third feed multi-color sweep
              styles. Saved to this reel.
            </p>
          </div>
        )}
      </div>

      {/* R20: the subtitle track (the current scene's words with timestamps) */}
      {words.length > 0 && (
        <div className="shrink-0 rounded-xl border border-bone/10 bg-bone/[0.03]">
          <button
            onClick={() => setSubsOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-[10px] font-semibold text-bone/60 hover:text-bone"
          >
            <Zap className="h-3.5 w-3.5 text-brass/80" />
            Subtitles <span className="text-bone/30">— {words.length} words{clipName ? ` · ${clipName}` : ''}</span>
            <span className="ml-auto text-bone/30">{subsOpen ? '▾' : '▸'}</span>
          </button>
          {subsOpen && (
            <div className="max-h-44 space-y-0.5 overflow-y-auto border-t border-bone/10 px-2 py-1.5">
              {words.map((w, i) => (
                <div key={i} className="flex items-baseline gap-2 text-[10px] leading-snug">
                  <span className="shrink-0 font-mono text-[8px] text-bone/35">
                    {fmtT(w.start)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-bone/75">{w.word}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* default marker hint */}
      <p className="flex shrink-0 items-center gap-1 px-0.5 text-[8px] text-bone/25">
        <Zap className="h-2.5 w-2.5 text-brass/60" /> Click a look — the canvas restyles instantly.
      </p>
    </div>
  );
}
