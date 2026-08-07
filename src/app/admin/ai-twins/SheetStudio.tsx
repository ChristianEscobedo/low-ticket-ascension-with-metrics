'use client';

/**
 * THE SHEET STUDIO — the sheet process, full-size, from the AI Twins roster.
 * Left: the forged sheet BIG. Right: the controls — the style, the scene
 * count (pad/trim the scene list), and ONE ROW PER SCENE: its visual (what
 * the panel shows) + its line (what's said) + the voice direction. The forge
 * is seeded with the character sheet, so the person in every panel is the
 * twin — never an invented stranger. Every edit writes back to the manifest.
 */
import { useState } from 'react';
import { Film, Loader2, Sparkles, X } from 'lucide-react';
import {
  CLONE_COSTS,
  CLONE_SHEET_MODEL,
  CLONE_SHEET_STYLES,
  cloneSceneCountAdjust,
  normalizeClonePlan,
  sceneSheetPrompt,
  sceneSheetStale,
  type CloneBeat,
  type ClonePlan,
  type ReelClone,
} from '@/lib/mothermode/reel/clone';
import { aiEditImage, aiGenerateImage } from '@/components/mothermode/content/aiClient';

const INPUT =
  'w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[11px] text-bone/80 outline-none placeholder:text-bone/25';

export default function SheetStudio({
  clone,
  plan: rawPlan,
  onSavePlan,
  onClose,
}: {
  clone: ReelClone;
  /** The raw clonePlan off the twin's reel record (normalized inside). */
  plan: unknown;
  onSavePlan: (plan: ClonePlan) => Promise<void>;
  onClose: () => void;
}) {
  const plan = normalizeClonePlan(rawPlan) ?? null;
  const [style, setStyle] = useState('cinematic');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const master = clone.sheetUrl ?? clone.refPhotos[0] ?? null;
  const sheet = plan?.sceneSheetUrl || master;
  const stale = plan ? sceneSheetStale(plan) : false;

  async function save(next: ClonePlan) {
    setSaving(true);
    try {
      await onSavePlan(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function patchScene(id: string, partial: Partial<CloneBeat>) {
    if (!plan) return;
    await save({
      ...plan,
      beats: plan.beats.map((b) => (b.id === id ? { ...b, ...partial } : b)),
      approvedAt: null,
      updatedAt: new Date().toISOString(),
    });
  }

  async function forge() {
    if (!plan || plan.beats.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const prompt = sceneSheetPrompt(plan, style, !!master);
      const url = master
        ? await aiEditImage({ prompt, seed: master, references: [master], format: 'reel', model: CLONE_SHEET_MODEL })
        : await aiGenerateImage(prompt, 'reel', CLONE_SHEET_MODEL);
      await save({ ...plan, sceneSheetUrl: url, sceneSheetAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Forge failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-bone/15 bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-bone/10 px-5 py-3">
          <Film className="h-4 w-4 text-brass" />
          <span className="text-sm font-semibold text-bone">Sheet Studio — {clone.name}</span>
          <span className="text-[10px] text-bone/35">the world, decided once, full size</span>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-bone/40 hover:bg-bone/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!plan || plan.beats.length === 0 ? (
          <p className="p-8 text-center text-xs text-bone/40">
            This twin has no scenes yet — write a script in the Clone wizard first (the scenes ARE
            the beats).
          </p>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* LEFT — the sheet, BIG */}
            <div className="flex flex-1 flex-col items-center justify-center border-r border-bone/10 bg-black/30 p-4">
              {sheet ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sheet}
                  alt="The sheet"
                  className="max-h-full max-w-full rounded-xl border border-brass/25 object-contain"
                />
              ) : (
                <p className="text-xs text-bone/35">No sheet yet — forge one.</p>
              )}
              {stale && (
                <p className="mt-2 text-[10px] text-amber-300">the script changed — re-forge</p>
              )}
            </div>

            {/* RIGHT — the controls */}
            <div className="w-[380px] shrink-0 space-y-3 overflow-y-auto p-4">
              <div className="flex flex-wrap gap-1">
                {CLONE_SHEET_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    title={s.hint}
                    className={`rounded px-2 py-1 text-[10px] font-semibold ${style === s.id ? 'bg-brass text-ink' : 'text-bone/50 hover:bg-bone/10'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-bone/45">Scenes on the sheet:</span>
                <input
                  type="number"
                  min={3}
                  max={7}
                  value={plan.beats.length}
                  onChange={(e) => {
                    const n = Math.max(3, Math.min(7, Math.round(Number(e.target.value) || plan.beats.length)));
                    if (n !== plan.beats.length) void save(cloneSceneCountAdjust(plan, n));
                  }}
                  className="w-16 rounded-lg border border-bone/15 bg-ink px-2 py-1 text-[11px] text-bone/80"
                />
                <span className="text-[9px] text-bone/30">3–7 (pads / trims the scene list)</span>
              </div>

              {plan.beats.map((b, i) => (
                <div key={b.id} className="space-y-1 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
                  <div className="flex items-center gap-1.5 text-[9px] text-bone/40">
                    <span className="font-bold text-brass/80">{i + 1}</span>
                    <span>
                      {b.startSec ?? 0}–{b.endSec ?? b.durationSec}s · {b.kind === 'broll' ? 'b-roll' : b.shot}
                    </span>
                    <select
                      value={b.voice?.energy ?? 'medium'}
                      onChange={(e) => void patchScene(b.id, { voice: { pace: b.voice?.pace ?? 'natural', energy: e.target.value as 'low' | 'medium' | 'high' } })}
                      className="ml-auto rounded border border-bone/15 bg-ink px-1 py-0.5 text-[9px] text-bone/60"
                      title="The voice energy for this scene's line"
                    >
                      {['low', 'medium', 'high'].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    key={`${b.id}:v:${b.brollPrompt ?? ''}`}
                    defaultValue={b.kind === 'broll' ? b.brollPrompt ?? '' : b.line}
                    rows={2}
                    placeholder={b.kind === 'broll' ? 'What the panel shows…' : 'The talking-head frame…'}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (b.kind === 'broll') {
                        if (v !== (b.brollPrompt ?? '')) void patchScene(b.id, { brollPrompt: v });
                      } else if (v && v !== b.line) void patchScene(b.id, { line: v });
                    }}
                    className={INPUT}
                  />
                </div>
              ))}

              {error && <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-[10px] text-red-300">{error}</p>}

              <button
                onClick={() => void forge()}
                disabled={busy || saving}
                className="w-full rounded-xl bg-brass px-3 py-2.5 text-xs font-bold text-ink disabled:opacity-40"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> forging…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> forge the scene sheet — ~$
                    {CLONE_COSTS.characterSheetImage.toFixed(2)}
                  </span>
                )}
              </button>
              <p className="text-[9px] text-bone/35">
                Seeded with {master ? 'the character sheet — the person in every panel is the twin' : 'nothing (no sheet yet — forge one in the editor first)'}
                . The board rides every b-roll render as an omni-reference.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
