'use client';

/**
 * /admin/producer — THE PRODUCER. The AI scopes the whole video pipeline:
 * you answer in plain words (the brief + a style + a twin), the planner
 * returns the Production Plan — scenes, sheets, voice, captions, cost —
 * editable on the plan card. Approving writes the manifest: a fresh reel
 * with the script beats landed (per-scene tiers pinned), and you land in
 * the Clipping Studio at the storyboard gate. Phase 2 (the auto-run)
 * drives generate → assemble → captions → render from here.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clapperboard, Loader2, PersonStanding, Sparkles, Wand2 } from 'lucide-react';
import {
  blankClonePlan,
  CLONE_COSTS,
  cloneFrameworkFor,
  cloneVideoTypeFor,
  makeBeatId,
  normalizeProductionPlan,
  PRODUCER_STYLES,
  producerStyleFor,
  twinRoster,
  type CloneBeat,
  type ProductionPlan,
  type TwinRosterEntry,
} from '@/lib/mothermode/reel/clone';
import type { ReelProject } from '@/lib/mothermode/reel/types';
import { aiGenerateCloneScript, aiProductionPlan } from '@/components/mothermode/content/aiClient';

const API = '/api/admin/mothermode-reel';
const INPUT =
  'w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-xs text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/50';
const LABEL = 'block text-[10px] font-semibold uppercase tracking-wider text-bone/40';

export default function ProducerPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ReelProject[] | null>(null);
  const [twinId, setTwinId] = useState('');
  const [styleId, setStyleId] = useState(PRODUCER_STYLES[0].id);
  const [brief, setBrief] = useState('');
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [busy, setBusy] = useState<'plan' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setProjects(json.projects);
    } catch {
      /* keep last */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const roster = twinRoster(projects ?? []);
  const twin: TwinRosterEntry | undefined = roster.find((e) => e.reelId === twinId);
  const style = producerStyleFor(styleId);

  /** The planner call — the brief + style + twin become the plan card. */
  async function scope() {
    if (!brief.trim() || busy) return;
    setBusy('plan');
    setError(null);
    setPlan(null);
    try {
      const raw = await aiProductionPlan({
        brief: brief.trim(),
        styleLabel: style.label,
        styleVideoType: style.videoType,
        styleCaption: style.captionPreset,
        persona: twin?.clone.name ?? 'the founder',
        hasSheet: !!(twin?.clone.sheetUrl ?? twin?.clone.refPhotos[0]),
        hasVoice: !!twin?.clone.voice.voiceId,
      });
      const p = normalizeProductionPlan(raw);
      if (!p) throw new Error('The plan came back empty — tighten the brief and try again');
      setPlan(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scoping failed');
    } finally {
      setBusy(null);
    }
  }

  function patchPlan(partial: Partial<ProductionPlan>) {
    setPlan((p) => (p ? { ...p, ...partial } : p));
  }

  /**
   * Approve: write the script from the plan's picks, land the beats on a
   * fresh reel's manifest (per-scene tiers pinned), and hand off to the
   * Clipping Studio at the storyboard gate.
   */
  async function approve() {
    if (!plan || !twin || busy) return;
    setBusy('approve');
    setError(null);
    try {
      const type = cloneVideoTypeFor(plan.videoType);
      const fw = cloneFrameworkFor(plan.framework);
      const { beats } = await aiGenerateCloneScript({
        topic: plan.topic,
        typeLabel: type.label,
        frameworkLabel: fw.label,
        frameworkBeats: fw.beats,
        beatSec: plan.beatSec,
        beatCount: plan.beatCount,
        persona: twin.clone.name,
        lookBible: '',
        guides: plan.notes || undefined,
      });
      const master = twin.clone.sheetUrl ?? twin.clone.refPhotos[0];
      const mapped: CloneBeat[] = beats.map((b, i) => ({
        id: makeBeatId(),
        index: i,
        kind: plan.scenes[i]?.kind ?? b.kind,
        line: b.line,
        voice: {
          pace: b.pace,
          energy: b.energy,
          ...(b.emphasis.length ? { emphasis: b.emphasis } : {}),
          ...(b.pauseAfterWord > 0 ? { pauseAfterWord: b.pauseAfterWord } : {}),
        },
        shot: b.shot,
        durationSec: b.durationSec,
        refs: master ? [master] : [],
        ...(b.brollPrompt ? { brollPrompt: b.brollPrompt } : {}),
        ...(plan.scenes[i]?.seedanceTier ? { seedanceTier: plan.scenes[i].seedanceTier } : {}),
        status: 'planned',
      }));
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          project: {
            name: plan.title.slice(0, 150),
            clips: [],
            audio: null,
            clonePlan: {
              ...blankClonePlan(twin.clone),
              videoType: plan.videoType,
              framework: plan.framework,
              beats: mapped,
            },
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not create the reel');
      const id = (json.project as ReelProject).id;
      router.push(`/admin/reel-studio?reel=${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
      setBusy(null);
    }
  }

  const estVideo = plan
    ? plan.scenes.reduce(
        (s, sc) =>
          s +
          plan.beatSec *
            (sc.kind === 'broll'
              ? CLONE_COSTS.seedancePerSec[sc.seedanceTier ?? 'seedance-2.0']
              : CLONE_COSTS.avatarPerSec),
        0,
      )
    : 0;
  const estSheets =
    (plan?.needsCharacterSheet ? CLONE_COSTS.characterSheetImage : 0) +
    (plan && plan.scenePanels > 0 ? CLONE_COSTS.characterSheetImage : 0);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center gap-3">
        <Clapperboard className="h-6 w-6 text-brass" />
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">The Producer</h1>
          <p className="text-xs text-bone/50">
            Say the video in plain words — the AI scopes the whole pipeline, you approve the plan.
          </p>
        </div>
      </div>

      {/* intake */}
      <div className="space-y-3 rounded-2xl border border-mode/25 bg-mode/[0.07] p-4">
        <div>
          <span className={LABEL}>Who stars in it</span>
          {roster.length === 0 ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-bone/40">
              <PersonStanding className="h-3.5 w-3.5" /> No twins yet — build one on AI Twins first.
            </p>
          ) : (
            <select value={twinId} onChange={(e) => setTwinId(e.target.value)} className={`${INPUT} mt-1`}>
              <option value="">Pick the twin…</option>
              {roster.map((e) => (
                <option key={e.reelId} value={e.reelId}>
                  {e.clone.name}
                  {e.ready ? '' : ' (incomplete)'}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <span className={LABEL}>What kind of video</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PRODUCER_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyleId(s.id)}
                title={s.hint}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${
                  styleId === s.id ? 'bg-brass text-ink' : 'text-bone/50 hover:bg-bone/10'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={LABEL}>The brief — plain words</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder='e.g. "A 45-second ad for the Ascension offer — me talking to camera about the 40-tabs problem, gym b-roll in the middle, end on the $27 price."'
            className={`${INPUT} mt-1`}
          />
        </div>
        <button
          onClick={() => void scope()}
          disabled={!brief.trim() || !twinId || busy !== null}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brass px-4 py-2.5 text-xs font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
        >
          {busy === 'plan' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          scope the production
        </button>
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {error}
          </p>
        )}
      </div>

      {/* the plan card */}
      {plan && (
        <div className="mt-4 space-y-3 rounded-2xl border border-brass/30 bg-brass/[0.06] p-4">
          <div className="flex items-center justify-between">
            <span className={LABEL}>The Production Plan — edit anything</span>
            <span className="text-[9px] text-bone/35">
              est. ${(estVideo + estSheets).toFixed(2)} before the gate
            </span>
          </div>
          <input
            value={plan.title}
            onChange={(e) => patchPlan({ title: e.target.value })}
            className={INPUT}
            placeholder="Working title"
          />
          <textarea
            value={plan.topic}
            onChange={(e) => patchPlan({ topic: e.target.value })}
            rows={2}
            className={INPUT}
            placeholder="The topic the script writer runs on"
          />
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-bone/55">
            <span>
              {cloneVideoTypeFor(plan.videoType).label} · {cloneFrameworkFor(plan.framework).label}
            </span>
            <span className="text-bone/30">·</span>
            <label className="flex items-center gap-1">
              scenes
              <input
                type="number"
                min={3}
                max={8}
                value={plan.beatCount}
                onChange={(e) =>
                  patchPlan({
                    beatCount: Math.max(3, Math.min(8, Math.round(Number(e.target.value) || plan.beatCount))),
                  })
                }
                className="w-14 rounded border border-bone/15 bg-ink px-1.5 py-0.5 text-bone/80"
              />
            </label>
            <label className="flex items-center gap-1">
              seconds each
              <select
                value={plan.beatSec}
                onChange={(e) => patchPlan({ beatSec: Number(e.target.value) })}
                className="rounded border border-bone/15 bg-ink px-1.5 py-0.5 text-bone/80"
              >
                {[5, 10, 15].map((s) => (
                  <option key={s} value={s}>
                    {s}s
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* the scenes, in order */}
          <div className="space-y-1.5">
            {plan.scenes.map((sc, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg border border-bone/10 bg-bone/[0.03] px-2 py-1.5">
                <span className="text-[10px] font-bold text-brass/80">{i + 1}</span>
                <button
                  onClick={() =>
                    patchPlan({
                      scenes: plan.scenes.map((x, k) =>
                        k === i ? { ...x, kind: x.kind === 'avatar' ? 'broll' : 'avatar' } : x,
                      ),
                    })
                  }
                  className="rounded bg-bone/10 px-1.5 py-0.5 text-[8px] font-semibold text-bone/60"
                  title="Flip avatar ↔ b-roll"
                >
                  {sc.kind === 'broll' ? 'b-roll' : 'talking head'}
                </button>
                {sc.kind === 'broll' && (
                  <button
                    onClick={() =>
                      patchPlan({
                        scenes: plan.scenes.map((x, k) =>
                          k === i
                            ? { ...x, seedanceTier: x.seedanceTier === 'seedance-2.5' ? undefined : 'seedance-2.5' }
                            : x,
                        ),
                      })
                    }
                    className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${
                      sc.seedanceTier === 'seedance-2.5' ? 'bg-brass/20 text-brass' : 'bg-bone/10 text-bone/45'
                    }`}
                    title="Pin this scene to the 2.5 hero tier"
                  >
                    {sc.seedanceTier === 'seedance-2.5' ? '2.5 hero' : '2.0'}
                  </button>
                )}
                <input
                  value={sc.idea}
                  onChange={(e) =>
                    patchPlan({
                      scenes: plan.scenes.map((x, k) => (k === i ? { ...x, idea: e.target.value } : x)),
                    })
                  }
                  className="min-w-0 flex-1 bg-transparent text-[10px] text-bone/75 outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-[10px] text-bone/55">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={plan.needsCharacterSheet}
                onChange={(e) => patchPlan({ needsCharacterSheet: e.target.checked })}
              />
              forge the character sheet (~${CLONE_COSTS.characterSheetImage.toFixed(2)})
            </label>
            <span className="text-bone/30">·</span>
            <span>
              scene sheet: {plan.scenePanels} panels (~${CLONE_COSTS.characterSheetImage.toFixed(2)})
            </span>
            <span className="text-bone/30">·</span>
            <span>
              voice: {plan.voicePlan === 'twin-voice' ? "the twin's voice" : plan.voicePlan === 'stock-voice' ? 'a stock voice' : 'record your voice'}
            </span>
            <span className="text-bone/30">·</span>
            <span>captions: {plan.captionPreset}</span>
          </div>

          <textarea
            value={plan.notes}
            onChange={(e) => patchPlan({ notes: e.target.value })}
            rows={2}
            className={INPUT}
            placeholder="Producer direction for the script writer (optional)"
          />

          <button
            onClick={() => void approve()}
            disabled={busy !== null}
            className="w-full rounded-xl bg-brass px-4 py-2.5 text-xs font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
          >
            {busy === 'approve' ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> writing the script + opening the studio…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> approve the plan — write the script, open the studio
              </span>
            )}
          </button>
          <p className="text-center text-[9px] text-bone/30">
            Nothing spends here. The storyboard gate in the studio is the spend check — the sheets
            forge there, full price on screen, before any scene renders.
          </p>
        </div>
      )}
    </div>
  );
}
