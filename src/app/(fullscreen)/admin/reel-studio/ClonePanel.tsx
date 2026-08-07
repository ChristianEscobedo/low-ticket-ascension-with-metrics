'use client';

/**
 * The AI Clone tab — the guided wizard over the reel's `clonePlan` manifest.
 *
 * Steps 1–4 are live: THE CLONE (the asset + the GPT Image 2 character-sheet
 * foundry), VIDEO TYPE + SCRIPT (frameworks, per-line voice programming),
 * and THE STORYBOARD — the approval gate with per-beat shots, the two
 * @reference slots (@1 always the locked sheet, @2 the optional variant),
 * and the full cost readout (per-beat prices, the 2.0↔2.5 delta live, the
 * sheet charged once per character). Nothing spends without a number on
 * screen; any edit re-opens the gate. Steps 5–6 (generate, assemble) light
 * up as they ship.
 */
import { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Film,
  ListVideo,
  Loader2,
  Lock,
  Mic,
  PersonStanding,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import type { ReelProject } from '@/lib/mothermode/reel/types';
import {
  approveClonePlan,
  beatGridForWords,
  beatWordCount,
  blankClonePlan,
  characterSheetPrompt,
  CLONE_BEAT_GRID_SEC,
  CLONE_COSTS,
  CLONE_FRAMEWORKS,
  CLONE_SHEET_MODEL,
  CLONE_VIDEO_TYPES,
  cloneBeatCost,
  cloneBeatRefSlots,
  cloneFrameworkFor,
  clonePlanCost,
  clonePlanDurationSec,
  cloneTierCostDelta,
  cloneVideoTypeFor,
  lookBibleString,
  makeBeatId,
  makeCloneId,
  storyboardIssues,
  withBeatRefSlot,
  type CloneBeat,
  type ClonePlan,
  type CloneShotAngle,
  type ReelClone,
  type SeedanceTier,
} from '@/lib/mothermode/reel/clone';
import {
  cloneAssembleBeats,
  cloneGenProgress,
  cloneGenStep,
} from '@/lib/mothermode/reel/cloneGenerate';
import {
  aiGenerateCloneScript,
  aiGenerateImage,
  aiListVoices,
  type AiVoice,
} from '@/components/mothermode/content/aiClient';

const WIZARD_STEPS = [
  { n: 1, label: 'The Clone', live: true },
  { n: 2, label: 'Video type', live: true },
  { n: 3, label: 'Script', live: true },
  { n: 4, label: 'Storyboard', live: true },
  { n: 5, label: 'Generate', live: true },
  { n: 6, label: 'Assemble', live: true },
];

const INPUT =
  'w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[11px] text-bone/80 outline-none placeholder:text-bone/25';
const LABEL = 'block text-[9px] font-semibold uppercase tracking-wider text-bone/40';

/** Ingest a forged sheet into the Media Library (tagged character-sheet). */
async function ingestSheet(name: string, url: string) {
  try {
    await fetch('/api/admin/media-library', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'ingest',
        name: name.slice(0, 150),
        url,
        kind: 'image',
        source: 'generated',
        tags: ['character-sheet', 'clone'],
      }),
    });
  } catch {
    /* the library entry is a convenience — the clone still saves */
  }
}

export default function ClonePanel({
  project,
  onSavePlan,
  onAssemble,
  onNote,
}: {
  project: ReelProject;
  onSavePlan: (plan: ClonePlan) => Promise<void> | void;
  /** Generated beats land on the timeline as scenes (page.tsx owns clips). */
  onAssemble?: (beats: CloneBeat[]) => Promise<void> | void;
  onNote?: (msg: string) => void;
}) {
  // Local mirror of the saved manifest — a generation CHAIN (voice → video)
  // writes twice, and step 2 of the chain must read step 1's audioUrl, so
  // this ref always holds the freshest plan. Keyed by project id: a project
  // switch never reads another reel's mirror.
  const [planOverride, setPlanOverride] = useState<{ projectId: string; plan: ClonePlan } | null>(
    null,
  );
  const existing =
    (planOverride && planOverride.projectId === project.id ? planOverride.plan : null) ??
    project.clonePlan ??
    null;

  // The clone being edited (seeded from the saved plan when one exists).
  const [name, setName] = useState(existing?.clone.name ?? '');
  const [description, setDescription] = useState('');
  const [wardrobe, setWardrobe] = useState(existing?.clone.lookBible.wardrobe ?? '');
  const [backdrop, setBackdrop] = useState(existing?.clone.lookBible.backdrop ?? '');
  const [lighting, setLighting] = useState(existing?.clone.lookBible.lighting ?? '');
  const [lens, setLens] = useState(existing?.clone.lookBible.lens ?? '');
  const [voiceId, setVoiceId] = useState(existing?.clone.voice.voiceId ?? '');
  const [voiceName, setVoiceName] = useState(existing?.clone.voice.name ?? '');
  const [refPhotos, setRefPhotos] = useState<string[]>(existing?.clone.refPhotos ?? []);
  const [sheetUrl, setSheetUrl] = useState(existing?.clone.sheetUrl ?? '');
  const [refUrl, setRefUrl] = useState('');
  const [includeFullBody, setIncludeFullBody] = useState(false);

  const [voices, setVoices] = useState<AiVoice[]>([]);
  const [forgeBusy, setForgeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 — video type + framework + the script.
  const [topic, setTopic] = useState('');
  const [videoType, setVideoType] = useState(
    existing?.videoType ?? CLONE_VIDEO_TYPES[0].id,
  );
  const [framework, setFramework] = useState(
    existing?.framework ?? CLONE_VIDEO_TYPES[0].framework,
  );
  const [scriptBusy, setScriptBusy] = useState(false);

  // Step 4 (wizard) — the storyboard gate: per-beat @reference-2 URL drafts.
  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});

  // Step 5 (wizard) — generation: the beat being worked ('all' = the pass).
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [assembleBusy, setAssembleBusy] = useState(false);

  useEffect(() => {
    void aiListVoices().then(setVoices);
  }, []);

  const lookBible = { wardrobe, backdrop, lighting, lens };
  const bibleLine = lookBibleString(lookBible);
  const canForge = !!description.trim() && !forgeBusy;
  const canSave = !!name.trim() && !!voiceId.trim() && (refPhotos.length > 0 || !!sheetUrl) && !saveBusy;

  /** The foundry: one GPT Image 2 call forges the turnaround sheet. */
  async function forgeSheet() {
    setForgeBusy(true);
    setError(null);
    try {
      const prompt = characterSheetPrompt({
        description: description.trim(),
        lookBible,
        includeFullBody,
      });
      const url = await aiGenerateImage(prompt, 'reel', CLONE_SHEET_MODEL);
      setSheetUrl(url);
      // The sheet is the master — it also rides as the primary ref photo.
      setRefPhotos((prev) => (prev.includes(url) ? prev : [url, ...prev].slice(0, 8)));
      await ingestSheet(`${name.trim() || 'Clone'} — character sheet`, url);
      onNote?.('Character sheet forged — it is in the Media Library tagged character-sheet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sheet generation failed');
    } finally {
      setForgeBusy(false);
    }
  }

  function addRefPhoto() {
    const url = refUrl.trim();
    if (!/^https?:\/\//i.test(url)) return;
    setRefPhotos((prev) => (prev.includes(url) ? prev : [...prev, url].slice(0, 8)));
    setRefUrl('');
  }

  /** Save the clone into the reel's manifest (step 1 of the wizard). */
  async function saveClone() {
    if (!canSave) return;
    setSaveBusy(true);
    setError(null);
    try {
      const clone: ReelClone = {
        id: existing?.clone.id ?? makeCloneId(),
        name: name.trim().slice(0, 80),
        refPhotos,
        ...(sheetUrl ? { sheetUrl } : {}),
        lookBible,
        voice: {
          voiceId: voiceId.trim(),
          name: (voiceName.trim() || voiceId.trim()).slice(0, 80),
          stability: existing?.clone.voice.stability ?? 0.5,
          similarityBoost: existing?.clone.voice.similarityBoost ?? 0.75,
          style: existing?.clone.voice.style ?? 0.3,
        },
        createdAt: existing?.clone.createdAt ?? new Date().toISOString(),
      };
      // Keep any downstream progress (beats/gate) when the clone is re-saved.
      const base = existing ?? blankClonePlan(clone);
      await onSavePlan({ ...base, clone, updatedAt: new Date().toISOString() });
      onNote?.('Clone saved — step 2 (video type + script) is live below.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaveBusy(false);
    }
  }

  /** Step 2: write the script — per-beat lines with voice programming. */
  async function writeScript() {
    if (!existing || !topic.trim() || scriptBusy) return;
    setScriptBusy(true);
    setError(null);
    try {
      const type = cloneVideoTypeFor(videoType);
      const fw = cloneFrameworkFor(framework);
      const { beats } = await aiGenerateCloneScript({
        topic: topic.trim(),
        typeLabel: type.label,
        frameworkLabel: fw.label,
        frameworkBeats: fw.beats,
        beatSec: type.beatSec,
        beatCount: type.beats,
        persona: existing.clone.name,
        lookBible: lookBibleString(existing.clone.lookBible),
      });
      // @reference 1 on every beat: the sheet (or the first ref photo).
      const master = existing.clone.sheetUrl ?? existing.clone.refPhotos[0];
      const mapped: CloneBeat[] = beats.map((b, i) => ({
        id: makeBeatId(),
        index: i,
        kind: b.kind,
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
        status: 'planned',
      }));
      // A new script un-approves the storyboard gate (step 4 owns it).
      await onSavePlan({
        ...existing,
        videoType,
        framework,
        beats: mapped,
        approvedAt: null,
        updatedAt: new Date().toISOString(),
      });
      onNote?.(`Script written — ${mapped.length} beats on ${fw.label}. Edit any line below.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Script failed');
    } finally {
      setScriptBusy(false);
    }
  }

  /** Edit one beat's line (commits on blur — one save, not one per keystroke). */
  async function patchBeat(id: string, partial: Partial<CloneBeat>) {
    if (!existing) return;
    await onSavePlan({
      ...existing,
      beats: existing.beats.map((b) => (b.id === id ? { ...b, ...partial } : b)),
      approvedAt: null,
      updatedAt: new Date().toISOString(),
    });
  }

  async function removeBeat(id: string) {
    if (!existing) return;
    await onSavePlan({
      ...existing,
      beats: existing.beats
        .filter((b) => b.id !== id)
        .map((b, i) => ({ ...b, index: i })),
      approvedAt: null,
      updatedAt: new Date().toISOString(),
    });
  }

  // ———— Wizard step 4: the storyboard — the gate + the cost readout ————
  const storyboardCost = existing ? clonePlanCost(existing) : null;
  const storyboardDelta = existing ? cloneTierCostDelta(existing) : 0;
  const gateIssues = existing ? storyboardIssues(existing) : [];
  const approved = !!existing?.approvedAt;

  /** The plan-level 2.0↔2.5 toggle — reprices every un-pinned b-roll beat. */
  async function setPlanTier(tier: SeedanceTier) {
    if (!existing || existing.seedanceTier === tier) return;
    await onSavePlan({
      ...existing,
      seedanceTier: tier,
      approvedAt: null,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Flip a beat avatar ↔ b-roll (a b-roll beat needs a line to go avatar). */
  async function toggleBeatKind(b: CloneBeat) {
    const next = b.kind === 'avatar' ? ('broll' as const) : ('avatar' as const);
    if (next === 'avatar' && !b.line.trim()) return;
    await patchBeat(b.id, { kind: next });
  }

  /** Set / clear a beat's @reference 2 (the variant). @1 stays the sheet. */
  async function setVariantRef(beat: CloneBeat, url: string | null) {
    if (!existing) return;
    const next = withBeatRefSlot(beat, existing.clone, 1, url);
    setSlotDrafts((d) => ({ ...d, [beat.id]: '' }));
    await patchBeat(beat.id, { refs: next.refs });
  }

  /** The gate: stamp it. Generation (step 5) refuses an unapproved plan. */
  async function approveStoryboard() {
    if (!existing || gateIssues.length > 0 || !storyboardCost) return;
    await onSavePlan(approveClonePlan(existing));
    onNote?.(
      `Storyboard approved at $${storyboardCost.total.toFixed(2)} — generation unlocks in step 5. Any edit re-opens the gate.`,
    );
  }

  async function revokeStoryboard() {
    if (!existing) return;
    await onSavePlan({ ...existing, approvedAt: null, updatedAt: new Date().toISOString() });
  }

  // ———— Wizard step 5: generate, per beat (voice → video, gated) ————
  const genProgress = existing ? cloneGenProgress(existing) : null;
  const assembleReady = existing ? cloneAssembleBeats(existing) : [];

  /** Save a generation patch onto one beat AND mirror it locally. */
  async function applyGenPatch(beatId: string, patch: Partial<CloneBeat>) {
    if (!existing) return;
    const next: ClonePlan = {
      ...existing,
      beats: existing.beats.map((b) => (b.id === beatId ? { ...b, ...patch } : b)),
      updatedAt: new Date().toISOString(),
    };
    setPlanOverride({ projectId: project.id, plan: next }); // the chain reads this next leg
    await onSavePlan(next);
  }

  /** One beat, one route call per pending step (voice, then video). */
  async function generateBeat(beatId: string): Promise<boolean> {
    for (let leg = 0; leg < 2; leg++) {
      const current = existing?.beats.find((b) => b.id === beatId);
      if (!current || cloneGenStep(current) === 'done') return true;
      const res = await fetch('/api/admin/reel-clone-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, beatId }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const patch = json?.patch as Partial<CloneBeat> | undefined;
      if (patch) await applyGenPatch(beatId, patch);
      if (!res.ok || json?.ok !== true) {
        setError(typeof json?.error === 'string' ? json.error : 'Generation failed');
        return false;
      }
      if (json.alreadyDone) return true;
    }
    return true;
  }

  /** Generate ONE beat (voice → video in a single click). */
  async function generateOne(beatId: string) {
    if (!existing || genBusy) return;
    setGenBusy(beatId);
    setError(null);
    try {
      await generateBeat(beatId);
    } finally {
      setGenBusy(null);
    }
  }

  /** The full pass: every pending beat, in manifest order. */
  async function generateAll() {
    if (!existing || genBusy) return;
    setGenBusy('all');
    setError(null);
    try {
      for (;;) {
        const next = existing.beats.find((b) => cloneGenStep(b) !== 'done');
        if (!next) break;
        const ok = await generateBeat(next.id);
        if (!ok) break; // the failed stamp landed; the note says where
      }
      const done = existing.beats.filter((b) => b.status === 'generated' && b.videoUrl).length;
      onNote?.(`Generation pass finished — ${done}/${existing.beats.length} beats rendered.`);
    } finally {
      setGenBusy(null);
    }
  }

  /** Step 6: the generated beats land on the timeline as scenes, in order. */
  async function assemble() {
    if (!existing || !onAssemble || assembleReady.length === 0 || assembleBusy) return;
    setAssembleBusy(true);
    try {
      await onAssemble(assembleReady);
      onNote?.(
        `${assembleReady.length} clone beat(s) on the timeline — captions, fly-ins, and the render all work on them.`,
      );
    } finally {
      setAssembleBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* the wizard stepper — step 1 is live, the rest light up as they ship */}
      <div className="grid grid-cols-6 gap-1">
        {WIZARD_STEPS.map((s) => (
          <div
            key={s.n}
            className={`rounded-lg border px-1 py-1.5 text-center ${
              s.n === 1
                ? 'border-brass/40 bg-brass/10 text-brass'
                : s.live
                  ? 'border-bone/15 text-bone/70'
                  : 'border-bone/10 text-bone/25'
            }`}
            title={s.live ? s.label : `${s.label} — ships in a later step`}
          >
            <div className="text-[8px] font-bold uppercase tracking-wider">step {s.n}</div>
            <div className="text-[9px] font-semibold leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* saved clone summary */}
      {existing && (
        <div className="flex items-center gap-2 rounded-xl border border-brass/25 bg-brass/5 p-2">
          <PersonStanding className="h-4 w-4 shrink-0 text-brass" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-bone/85">{existing.clone.name}</p>
            <p className="truncate text-[9px] text-bone/40">
              {existing.clone.refPhotos.length} ref photo(s) · voice {existing.clone.voice.name}
              {existing.clone.sheetUrl ? ' · sheet forged' : ''}
            </p>
          </div>
          <Check className="h-3.5 w-3.5 shrink-0 text-brass" />
        </div>
      )}

      {/* the clone asset form */}
      <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
        <span className={LABEL}>The clone</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Clone name (e.g. The Founder)" className={INPUT} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Who is this person? (age, face, hair, build, vibe — the foundry reads this)"
          className={INPUT}
        />
      </div>

      {/* the look bible — one locked string downstream */}
      <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
        <span className={LABEL}>Look bible — locked, quoted verbatim everywhere</span>
        <input value={wardrobe} onChange={(e) => setWardrobe(e.target.value)} placeholder="Wardrobe (navy crewneck, no logos)" className={INPUT} />
        <input value={backdrop} onChange={(e) => setBackdrop(e.target.value)} placeholder="Backdrop (warm gray studio wall)" className={INPUT} />
        <input value={lighting} onChange={(e) => setLighting(e.target.value)} placeholder="Lighting (soft key from camera-left)" className={INPUT} />
        <input value={lens} onChange={(e) => setLens(e.target.value)} placeholder="Lens (50mm, shallow depth of field)" className={INPUT} />
        {bibleLine && <p className="rounded-lg bg-ink/60 px-2 py-1 text-[9px] italic text-bone/40">{bibleLine}</p>}
      </div>

      {/* the voice */}
      <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
        <span className={LABEL}>
          <Mic className="mr-1 inline h-3 w-3" /> Voice (ElevenLabs)
        </span>
        {voices.length > 0 && (
          <select
            value={voiceId}
            onChange={(e) => {
              const v = voices.find((x) => x.id === e.target.value);
              setVoiceId(e.target.value);
              setVoiceName(v?.name ?? '');
            }}
            className={INPUT}
          >
            <option value="">Pick a voice…</option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <input
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          placeholder="…or paste a voice id (clone or stock)"
          className={INPUT}
        />
      </div>

      {/* the foundry */}
      <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
        <span className={LABEL}>Character-sheet foundry</span>
        <label className="flex items-center gap-1.5 text-[10px] text-bone/55">
          <input
            type="checkbox"
            checked={includeFullBody}
            onChange={(e) => setIncludeFullBody(e.target.checked)}
          />
          add a full-body cell (for walking b-roll shots)
        </label>
        <button
          onClick={() => void forgeSheet()}
          disabled={!canForge}
          className="inline-flex items-center gap-1 rounded-lg bg-brass px-2.5 py-1.5 text-[10px] font-semibold text-ink disabled:opacity-40"
        >
          {forgeBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          forge character sheet
        </button>
        <p className="text-[9px] text-bone/35">
          One GPT Image 2 call (~${CLONE_COSTS.characterSheetImage.toFixed(2)}) ONCE per character —
          not per video. The sheet lands in the Media Library tagged character-sheet.
        </p>
        {sheetUrl && (
          <div className="overflow-hidden rounded-lg border border-brass/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sheetUrl} alt="Character sheet" className="w-full" />
          </div>
        )}
      </div>

      {/* reference photos */}
      <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
        <span className={LABEL}>Reference photos ({refPhotos.length}/8)</span>
        <div className="flex items-center gap-1.5">
          <input
            value={refUrl}
            onChange={(e) => setRefUrl(e.target.value)}
            placeholder="https://… reference photo URL"
            className={INPUT}
          />
          <button
            onClick={addRefPhoto}
            disabled={!refUrl.trim()}
            className="shrink-0 rounded-lg border border-bone/15 px-2 py-1.5 text-[10px] text-bone/60 hover:bg-bone/10 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {refPhotos.length > 0 && (
          <div className="grid grid-cols-4 gap-1">
            {refPhotos.map((url) => (
              <div key={url} className="group relative overflow-hidden rounded-md border border-bone/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="ref" className="aspect-square w-full object-cover" />
                <button
                  onClick={() => setRefPhotos((prev) => prev.filter((u) => u !== url))}
                  className="absolute right-0.5 top-0.5 rounded bg-ink/80 p-0.5 text-bone/60 opacity-0 transition group-hover:opacity-100"
                  title="Remove"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[9px] text-bone/35">
          <Upload className="mr-0.5 inline h-2.5 w-2.5" /> Upload via the Media Library, then paste
          the URL here — the sheet above already counts as the master reference.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-[10px] text-red-300">{error}</p>}

      <button
        onClick={() => void saveClone()}
        disabled={!canSave}
        className="w-full rounded-xl bg-brass px-3 py-2 text-[11px] font-bold text-ink disabled:opacity-40"
      >
        {saveBusy ? 'saving…' : existing ? 'save clone changes' : 'save clone to this reel'}
      </button>
      {!canSave && !saveBusy && (
        <p className="text-center text-[9px] text-bone/30">
          Needs a name, a voice, and at least one reference (or a forged sheet).
        </p>
      )}

      {/* ———— Step 2: video type + framework + the script ———— */}
      {existing && (
        <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
          <span className={LABEL}>Step 2 — video type + script</span>
          <div className="flex flex-wrap gap-1">
            {CLONE_VIDEO_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setVideoType(t.id);
                  setFramework(t.framework); // the type carries its default framework
                }}
                title={t.hint}
                className={`rounded px-2 py-1 text-[9px] font-semibold ${
                  videoType === t.id
                    ? 'bg-brass text-ink'
                    : 'text-bone/50 hover:bg-bone/10'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {CLONE_FRAMEWORKS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFramework(f.id)}
                title={f.beats.join(' → ')}
                className={`rounded border px-1.5 py-0.5 text-[8px] font-semibold ${
                  framework === f.id
                    ? 'border-brass/50 bg-brass/10 text-brass'
                    : 'border-bone/15 text-bone/45 hover:bg-bone/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={2}
            placeholder="What is this video about / selling? (the topic or offer — one or two sentences)"
            className={INPUT}
          />
          <button
            onClick={() => void writeScript()}
            disabled={!topic.trim() || scriptBusy}
            className="inline-flex items-center gap-1 rounded-lg bg-brass px-2.5 py-1.5 text-[10px] font-semibold text-ink disabled:opacity-40"
          >
            {scriptBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {existing.beats.length ? 're-write the script' : 'write the script'}
          </button>
          <p className="text-[9px] text-bone/35">
            {cloneVideoTypeFor(videoType).beats} beats · {cloneVideoTypeFor(videoType).beatSec}s
            each · every line carries its voice direction (pace, energy, emphasis, pauses).
          </p>
        </div>
      )}

      {/* the script — the beats the storyboard (step 4) gates on */}
      {existing && existing.beats.length > 0 && (
        <div className="space-y-1.5">
          <span className={LABEL}>
            The script — {existing.beats.length} beats ·{' '}
            {cloneFrameworkFor(existing.framework).label}
          </span>
          {existing.beats.map((b, i) => (
            <div
              key={b.id}
              className="space-y-1 rounded-xl border border-bone/10 bg-bone/[0.03] p-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-brass/80">{i + 1}</span>
                <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[8px] font-semibold text-bone/60">
                  {b.kind === 'broll' ? 'b-roll' : b.shot}
                </span>
                <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[8px] text-bone/45">
                  {b.durationSec}s · {beatWordCount(b.line)} words
                </span>
                {b.voice && b.kind === 'avatar' && (
                  <span
                    className="rounded bg-brass/10 px-1.5 py-0.5 text-[8px] text-brass/80"
                    title="The voice programming for this line"
                  >
                    {b.voice.energy} · {b.voice.pace}
                    {b.voice.emphasis?.length ? ` · "${b.voice.emphasis.join(', ')}"` : ''}
                    {b.voice.pauseAfterWord ? ` · …@${b.voice.pauseAfterWord}` : ''}
                  </span>
                )}
                <button
                  onClick={() => void removeBeat(b.id)}
                  className="ml-auto text-bone/30 hover:text-red-300"
                  title="Remove this beat"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {b.kind === 'avatar' ? (
                <textarea
                  key={`${b.id}:${b.line}`}
                  defaultValue={b.line}
                  rows={2}
                  onBlur={(e) => {
                    const line = e.target.value.trim();
                    if (line && line !== b.line) void patchBeat(b.id, { line });
                  }}
                  className={INPUT}
                />
              ) : (
                <p className="text-[10px] italic leading-snug text-bone/50">
                  {b.brollPrompt || 'visual beat'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ———— Wizard step 4: the storyboard — the gate + the cost readout ———— */}
      {existing && existing.beats.length > 0 && storyboardCost && (
        <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
          <div className="flex items-center justify-between">
            <span className={LABEL}>Step 4 — the storyboard · the gate</span>
            {approved && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-300">
                <ShieldCheck className="h-2.5 w-2.5" /> approved
              </span>
            )}
          </div>

          {/* the 2.0 ↔ 2.5 toggle — the delta shows live on the chip */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-bone/45">Seedance for b-roll:</span>
            {(['seedance-2.0', 'seedance-2.5'] as SeedanceTier[]).map((tier) => (
              <button
                key={tier}
                onClick={() => void setPlanTier(tier)}
                className={`rounded px-2 py-1 text-[9px] font-semibold ${
                  existing.seedanceTier === tier
                    ? 'bg-brass text-ink'
                    : 'text-bone/50 hover:bg-bone/10'
                }`}
              >
                {tier === 'seedance-2.0'
                  ? '2.0 standard'
                  : `2.5 hero${storyboardDelta > 0 ? ` (+$${storyboardDelta.toFixed(2)})` : ''}`}
              </button>
            ))}
          </div>

          {/* per-beat: the shot, the @reference slots, the price */}
          {existing.beats.map((b, i) => {
            const cost = cloneBeatCost(b, existing.seedanceTier);
            const slots = cloneBeatRefSlots(b, existing.clone);
            const words = beatWordCount(b.line);
            const floor = beatGridForWords(words);
            const brollTier = b.seedanceTier ?? existing.seedanceTier;
            return (
              <div
                key={b.id}
                className="space-y-1 rounded-xl border border-bone/10 bg-bone/[0.03] p-2"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-brass/80">{i + 1}</span>
                  <button
                    onClick={() => void toggleBeatKind(b)}
                    disabled={b.kind === 'broll' && !b.line.trim()}
                    title={
                      b.kind === 'avatar'
                        ? 'Switch to a b-roll cutaway (Seedance)'
                        : b.line.trim()
                          ? 'Switch to a talking-head beat (avatar)'
                          : 'A b-roll beat needs a spoken line to become an avatar beat'
                    }
                    className="inline-flex items-center gap-0.5 rounded bg-bone/10 px-1.5 py-0.5 text-[8px] font-semibold text-bone/60 hover:bg-bone/15 disabled:opacity-40"
                  >
                    {b.kind === 'broll' ? <Film className="h-2.5 w-2.5" /> : <Camera className="h-2.5 w-2.5" />}
                    {b.kind === 'broll' ? 'b-roll' : 'avatar'}
                  </button>
                  <div className="flex gap-0.5">
                    {CLONE_BEAT_GRID_SEC.map((sec) => (
                      <button
                        key={sec}
                        disabled={sec < floor}
                        onClick={() => void patchBeat(b.id, { durationSec: sec })}
                        title={
                          sec < floor
                            ? `${words} words need at least ${floor}s — the grid stays honest`
                            : `${sec}s`
                        }
                        className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${
                          b.durationSec === sec
                            ? 'bg-brass text-ink'
                            : 'text-bone/45 hover:bg-bone/10 disabled:opacity-30'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  {b.kind === 'broll' && (
                    <button
                      onClick={() =>
                        void patchBeat(b.id, {
                          seedanceTier: brollTier === 'seedance-2.0' ? 'seedance-2.5' : 'seedance-2.0',
                        })
                      }
                      title="Pin this beat's Seedance tier (beats the plan toggle)"
                      className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${
                        brollTier === 'seedance-2.5'
                          ? 'bg-brass/20 text-brass'
                          : 'bg-bone/10 text-bone/50 hover:bg-bone/15'
                      }`}
                    >
                      {brollTier === 'seedance-2.5' ? '2.5 hero' : '2.0'}
                    </button>
                  )}
                  <span
                    className="ml-auto rounded bg-bone/10 px-1.5 py-0.5 text-[8px] font-semibold text-bone/60"
                    title={`voice $${cost.voice.toFixed(3)} + video $${cost.video.toFixed(3)}`}
                  >
                    ${cost.total.toFixed(3)}
                  </span>
                </div>

                {b.kind === 'avatar' ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] uppercase tracking-wider text-bone/35">shot</span>
                    {(['close', 'medium', 'wide'] as CloneShotAngle[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => void patchBeat(b.id, { shot: s })}
                        className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${
                          b.shot === s
                            ? 'bg-brass/20 text-brass'
                            : 'text-bone/45 hover:bg-bone/10'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    key={`${b.id}:${b.brollPrompt ?? ''}`}
                    defaultValue={b.brollPrompt ?? ''}
                    rows={2}
                    placeholder="The b-roll visual — name the character so they show up INSIDE the footage"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (b.brollPrompt ?? '')) void patchBeat(b.id, { brollPrompt: v });
                    }}
                    className={INPUT}
                  />
                )}

                {/* the @reference slots — @1 is always the sheet, @2 the variant */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] uppercase tracking-wider text-bone/35">@ref</span>
                  {slots.primary ? (
                    <div className="relative shrink-0" title="@reference 1 — the locked character sheet">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slots.primary}
                        alt="@1"
                        className="h-8 w-8 rounded-md border border-brass/30 object-cover"
                      />
                      <Lock className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-ink p-0.5 text-brass" />
                    </div>
                  ) : (
                    <span className="text-[8px] text-red-300">@1 missing — forge the sheet</span>
                  )}
                  {slots.variant ? (
                    <div className="group relative shrink-0" title="@reference 2 — the variant">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slots.variant}
                        alt="@2"
                        className="h-8 w-8 rounded-md border border-bone/15 object-cover"
                      />
                      <button
                        onClick={() => void setVariantRef(b, null)}
                        className="absolute -right-1 -top-1 rounded-full bg-ink p-0.5 text-bone/60 opacity-0 transition group-hover:opacity-100"
                        title="Clear @reference 2"
                      >
                        <Trash2 className="h-2 w-2" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={slotDrafts[b.id] ?? ''}
                        onChange={(e) => setSlotDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                        placeholder="@2 variant URL (wardrobe / location / product)"
                        className="min-w-0 flex-1 rounded-md border border-bone/10 bg-ink px-1.5 py-1 text-[9px] text-bone/70 outline-none placeholder:text-bone/25"
                      />
                      <button
                        onClick={() => void setVariantRef(b, slotDrafts[b.id] ?? '')}
                        disabled={!/^https?:\/\//i.test((slotDrafts[b.id] ?? '').trim())}
                        className="shrink-0 rounded-md border border-bone/15 px-1.5 py-1 text-bone/60 hover:bg-bone/10 disabled:opacity-40"
                        title="Set @reference 2"
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                      {existing.clone.refPhotos
                        .filter((u) => u !== slots.primary)
                        .slice(0, 4)
                        .map((u) => (
                          <button
                            key={u}
                            onClick={() => void setVariantRef(b, u)}
                            title="Use as @reference 2"
                            className="shrink-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={u}
                              alt="pick"
                              className="h-6 w-6 rounded-md border border-bone/10 object-cover hover:border-brass/50"
                            />
                          </button>
                        ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* the totals — nothing spends without a number on screen */}
          <div className="space-y-0.5 rounded-xl border border-brass/20 bg-brass/5 p-2 text-[10px]">
            <div className="flex justify-between text-bone/45">
              <span>
                {existing.beats.length} beats · {clonePlanDurationSec(existing)}s runtime
              </span>
              <span>per-beat prices above</span>
            </div>
            <div className="flex justify-between text-bone/60">
              <span>voice (ElevenLabs)</span>
              <span>${storyboardCost.voiceTotal.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-bone/60">
              <span>video (avatar + Seedance)</span>
              <span>${storyboardCost.videoTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-bone/60">
              <span>character sheet — once per character, not per video</span>
              <span>
                {storyboardCost.sheet === 0 ? '$0.00 (forged)' : `$${storyboardCost.sheet.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between border-t border-brass/15 pt-0.5 text-[11px] font-bold text-brass">
              <span>total if you generate now</span>
              <span>${storyboardCost.total.toFixed(2)}</span>
            </div>
          </div>

          {/* the gate — approval stamps it, any edit re-opens it */}
          {approved ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-emerald-200">
                  Storyboard approved · {new Date(existing.approvedAt ?? '').toLocaleString()}
                </p>
                <p className="text-[9px] text-emerald-200/50">
                  Step 5 (generate) reads this gate. Any edit above re-opens it.
                </p>
              </div>
              <button
                onClick={() => void revokeStoryboard()}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300/25 px-2 py-1 text-[9px] font-semibold text-emerald-200 hover:bg-emerald-400/10"
              >
                <Undo2 className="h-3 w-3" /> revise
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {gateIssues.length > 0 && (
                <ul className="space-y-0.5 rounded-lg bg-red-500/10 px-2 py-1.5">
                  {gateIssues.map((issue) => (
                    <li key={issue} className="text-[9px] text-red-300">
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => void approveStoryboard()}
                disabled={gateIssues.length > 0}
                className="w-full rounded-xl bg-brass px-3 py-2 text-[11px] font-bold text-ink disabled:opacity-40"
              >
                approve the storyboard — ${storyboardCost.total.toFixed(2)} on screen
              </button>
              <p className="text-center text-[9px] text-bone/30">
                Nothing generates until this gate is stamped. Edits after approval re-open it.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ———— Wizard step 5: generate, per beat (voice → video, gated) ———— */}
      {existing && existing.beats.length > 0 && genProgress && (
        <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.04] p-2">
          <div className="flex items-center justify-between">
            <span className={LABEL}>Step 5 — generate, per beat</span>
            <span className="text-[9px] text-bone/40">
              {genProgress.generated}/{genProgress.total} rendered
              {genProgress.voiced > 0 ? ` · ${genProgress.voiced} voiced` : ''}
              {genProgress.failed > 0 ? ` · ${genProgress.failed} failed` : ''}
            </span>
          </div>

          {!approved ? (
            <p className="rounded-lg bg-bone/[0.06] px-2 py-1.5 text-[9px] text-bone/40">
              The storyboard gate locks this step — approve it above and these buttons light up.
            </p>
          ) : (
            <>
              {existing.beats.map((b, i) => {
                const stepState = cloneGenStep(b);
                const done = stepState === 'done';
                const busy = genBusy === b.id || genBusy === 'all';
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-1.5 rounded-lg border border-bone/10 bg-bone/[0.03] px-2 py-1.5"
                  >
                    <span className="text-[10px] font-bold text-brass/80">{i + 1}</span>
                    <span className="text-[9px] text-bone/50">
                      {b.kind === 'broll' ? 'b-roll' : b.shot} · {b.durationSec}s
                    </span>
                    {b.status === 'failed' ? (
                      <span
                        className="rounded bg-red-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-red-300"
                        title={b.error}
                      >
                        failed
                      </span>
                    ) : done ? (
                      <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-300">
                        rendered
                      </span>
                    ) : stepState === 'voice' ? (
                      <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[8px] text-bone/50">
                        needs voice
                      </span>
                    ) : (
                      <span className="rounded bg-brass/10 px-1.5 py-0.5 text-[8px] text-brass/80">
                        voiced — needs video
                      </span>
                    )}
                    <button
                      onClick={() => void generateOne(b.id)}
                      disabled={genBusy !== null || done}
                      title={
                        done
                          ? 'Rendered'
                          : b.status === 'failed'
                            ? 'Re-run the step that failed'
                            : stepState === 'voice'
                              ? 'ElevenLabs with this beat’s voice programming, then the video'
                              : 'Render the video (the audio is already on the manifest)'
                      }
                      className="ml-auto inline-flex items-center gap-1 rounded-lg bg-brass px-2 py-1 text-[9px] font-semibold text-ink disabled:opacity-40"
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : stepState === 'voice' ? (
                        <Mic className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {busy ? 'working…' : b.status === 'failed' ? 'retry' : done ? 'rendered' : 'generate'}
                    </button>
                    {b.videoUrl && (
                      <a
                        href={b.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-md border border-bone/15 px-1.5 py-1 text-[8px] font-semibold text-bone/60 hover:bg-bone/10"
                      >
                        watch
                      </a>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => void generateAll()}
                disabled={genBusy !== null || genProgress.generated === genProgress.total}
                className="w-full rounded-xl bg-brass px-3 py-2 text-[11px] font-bold text-ink disabled:opacity-40"
              >
                {genBusy === 'all'
                  ? 'generating…'
                  : genProgress.generated === genProgress.total
                    ? 'every beat is rendered'
                    : `generate all (${genProgress.total - genProgress.generated} to go)`}
              </button>
              <p className="text-[9px] text-bone/35">
                One call per beat per step: ElevenLabs reads each line with ITS voice programming,
                then muapi renders the talking head (@1 + that audio) or Seedance the b-roll (the
                @references ride inside the footage). The total is the one you approved at the gate.
              </p>
            </>
          )}
        </div>
      )}

      {/* ———— Wizard step 6: assemble — beats land on the timeline ———— */}
      {existing && onAssemble && assembleReady.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-brass/20 bg-brass/5 p-2">
          <span className={LABEL}>
            <ListVideo className="mr-1 inline h-3 w-3" /> Step 6 — assemble
          </span>
          <p className="text-[9px] text-bone/45">
            {assembleReady.length} generated beat(s) land on the timeline in order, as scenes —
            captions, fly-ins, SFX, and the Remotion render all work on them.
          </p>
          <button
            onClick={() => void assemble()}
            disabled={assembleBusy}
            className="w-full rounded-xl bg-brass px-3 py-2 text-[11px] font-bold text-ink disabled:opacity-40"
          >
            {assembleBusy
              ? 'assembling…'
              : `assemble ${assembleReady.length} beat${assembleReady.length === 1 ? '' : 's'} onto the timeline`}
          </button>
        </div>
      )}
    </div>
  );
}
