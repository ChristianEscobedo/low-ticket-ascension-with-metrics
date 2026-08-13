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
  resolveCaptionStyle,
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
  words = [],
  clipName = '',
}: {
  currentPreset: CaptionPreset;
  overrides?: CaptionOverrides;
  onPick: (def: CaptionStyleDef) => void;
  onCustomize: (patch: Partial<CaptionOverrides>) => void;
  /** R20: the current scene's word track (shown as a timestamped subtitle list). */
  words?: { word: string; start: number; end: number }[];
  clipName?: string;
}) {
  const [filter, setFilter] = useState<CaptionTag | 'all'>('all');
  const [customizing, setCustomizing] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);

  const defs = useMemo(
    () =>
      filter === 'all'
        ? CAPTION_STYLE_DEFS
        : CAPTION_STYLE_DEFS.filter((d) => d.tags.includes(filter)),
    [filter],
  );

  const activeDef = resolveCaptionStyle(
    CAPTION_STYLE_DEFS.find((d) => d.id === currentPreset) ??
      CAPTION_STYLE_DEFS.find((d) => d.id === 'karaoke')!,
    overrides,
  );
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

      {/* the 3-col tile grid */}
      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto pr-0.5">
        {defs.map((d) => (
          <PresetTile
            key={d.id}
            def={d}
            selected={currentPreset === d.id}
            onPick={() => onPick(d)}
          />
        ))}
      </div>

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
                <p className="text-[8px] leading-relaxed text-bone/25">
                  1 word/row = the punchy Submagic beat. 2 rows = current + next line.
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
                    title="Page fades in on arrival and out before the next page"
                  >
                    {(overrides?.ghostFade ??
                      (activeDef.blockFx ?? []).includes('ghostFade'))
                      ? 'On'
                      : 'Off'}
                  </button>
                </label>
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
                        },
                      })
                    }
                    className="w-full accent-brass"
                  />
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
                  Ghost fades each page in/out. Shadow + glow stack on every word
                  and burn into the MP4 the same way.
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
