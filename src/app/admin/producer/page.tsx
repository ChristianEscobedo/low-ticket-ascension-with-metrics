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
import { Clapperboard, Loader2, PersonStanding, Sparkles, Wand2 } from 'lucide-react';
import {
  approveClonePlan,
  blankClonePlan,
  characterSheetPrompt,
  CLONE_COSTS,
  CLONE_SHEET_MODEL,
  cloneFrameworkFor,
  cloneSheetForBeat,
  cloneVideoTypeFor,
  makeBeatId,
  normalizeClonePlan,
  normalizeProductionPlan,
  PRODUCER_STYLES,
  producerStyleFor,
  producerWorldGroups,
  sceneSheetPrompt,
  twinRoster,
  type CloneBeat,
  type ClonePlan,
  type ProductionPlan,
  type TwinRosterEntry,
} from '@/lib/mothermode/reel/clone';
import type { ReelProject } from '@/lib/mothermode/reel/types';
import {
  cloneAvatarPrompt,
  cloneBrollPrompt,
  cloneRefImagesFor,
} from '@/lib/mothermode/reel/cloneGenerate';
import {
  aiEditImage,
  aiGenerateCloneScript,
  aiGenerateImage,
  aiProductionPlan,
} from '@/components/mothermode/content/aiClient';
import { usePieceLinks } from '@/components/mothermode/content/pieceLinks';

const API = '/api/admin/mothermode-reel';
const INPUT =
  'w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-xs text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/50';
const LABEL = 'block text-[10px] font-semibold uppercase tracking-wider text-bone/40';

export default function ProducerPage() {
  const [projects, setProjects] = useState<ReelProject[] | null>(null);
  const [twinId, setTwinId] = useState('');
  const [styleId, setStyleId] = useState(PRODUCER_STYLES[0].id);
  const [brief, setBrief] = useState('');
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [busy, setBusy] = useState<'plan' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PHASE 2 — the auto-run: after approval, the producer DRIVES the pipeline
  // (sheets → the gate → generate-all) with live progress, then hands off to
  // the studio for assemble + captions + render.
  const [runReel, setRunReel] = useState<ReelProject | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [runDone, setRunDone] = useState(false);

  // GROUNDING — an offer / lead magnet / a research artifact, by selection.
  const { funnels, optinFunnels } = usePieceLinks('');
  const [ctxPick, setCtxPick] = useState(''); // 'offer:<slug>' | 'lead:<slug>' | ''
  const [artifactPick, setArtifactPick] = useState('');
  const [artifacts, setArtifacts] = useState<{ id: string; label: string; summary: string }[]>([]);
  // The sheet review — sheets BY WORLD (uneven by construction), each with
  // its prompt visible + editable BEFORE the forge. sheets[k] covers the
  // scenes of world k; forged in order with the previous sheet as lookback.
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheetPrompts, setSheetPrompts] = useState<string[]>([]);
  const [sheetBusy, setSheetBusy] = useState(false);
  // The CHARACTER sheet forge — when the plan needs one (or the twin lacks
  // one), its prompt is editable here and the forge SAVES ONTO THE TWIN.
  const [charPrompt, setCharPrompt] = useState('');
  const [charBusy, setCharBusy] = useState(false);
  // The SESSION LIBRARY — named producer sessions (intake + plan + sheet
  // prompts + forged sheets) that survive between visits.
  const [sessions, setSessions] = useState<
    { id: string; name: string; savedAt: string; data: Record<string, unknown> }[]
  >([]);

  // The DRAFT: everything pre-approve persists to local storage (a refresh
  // never loses the scoped plan); post-approve it all rides the reel's
  // manifest in Supabase (beats, sheets, the gate — the run card resumes).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('producer-draft');
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.twinId === 'string') setTwinId(d.twinId);
      if (typeof d.styleId === 'string') setStyleId(d.styleId);
      if (typeof d.brief === 'string') setBrief(d.brief);
      if (typeof d.ctxPick === 'string') setCtxPick(d.ctxPick);
      if (typeof d.artifactPick === 'string') setArtifactPick(d.artifactPick);
      const p = normalizeProductionPlan(d.plan ?? null);
      if (p) setPlan(p);
      if (Array.isArray(d.sheetPrompts)) setSheetPrompts(d.sheetPrompts.filter((s) => typeof s === 'string'));
      if (Array.isArray(d.sheets)) setSheets(d.sheets.filter((s) => typeof s === 'string'));
    } catch {
      /* a stale draft never blocks the page */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Load the session library once.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('producer-sessions');
      if (raw) setSessions(JSON.parse(raw));
    } catch {
      /* empty library is fine */
    }
  }, []);

  /** The current session snapshot — what save/resume round-trips. */
  function sessionSnapshot(): Record<string, unknown> {
    return { twinId, styleId, brief, ctxPick, artifactPick, plan, sheetPrompts, sheets };
  }
  function restoreSession(d: Record<string, unknown>) {
    if (typeof d.twinId === 'string') setTwinId(d.twinId);
    if (typeof d.styleId === 'string') setStyleId(d.styleId);
    if (typeof d.brief === 'string') setBrief(d.brief);
    if (typeof d.ctxPick === 'string') setCtxPick(d.ctxPick);
    if (typeof d.artifactPick === 'string') setArtifactPick(d.artifactPick);
    const p = normalizeProductionPlan(d.plan ?? null);
    setPlan(p);
    setSheetPrompts(Array.isArray(d.sheetPrompts) ? d.sheetPrompts.filter((s) => typeof s === 'string') : []);
    setSheets(Array.isArray(d.sheets) ? d.sheets.filter((s) => typeof s === 'string') : []);
    setRunReel(null);
    setRunDone(false);
    setRunLog([]);
  }
  function saveSession() {
    const name = (plan?.title ?? brief).slice(0, 60) || 'untitled session';
    const next = [
      { id: `s-${Date.now().toString(36)}`, name, savedAt: new Date().toISOString(), data: sessionSnapshot() },
      ...sessions.filter((s) => s.name !== name),
    ].slice(0, 20);
    setSessions(next);
    try {
      window.localStorage.setItem('producer-sessions', JSON.stringify(next));
    } catch {
      /* full — keep the in-memory list */
    }
  }
  function deleteSession(id: string) {
    const next = sessions.filter((s) => s.id !== id);
    setSessions(next);
    try {
      window.localStorage.setItem('producer-sessions', JSON.stringify(next));
    } catch {
      /* fine */
    }
  }

  /** Forge the character sheet from the producer — saves ONTO the twin. */
  async function forgeCharacter() {
    if (!twin || charBusy) return;
    setCharBusy(true);
    setError(null);
    try {
      const prompt =
        charPrompt.trim() ||
        characterSheetPrompt({
          description: twin.clone.name,
          lookBible: twin.clone.lookBible,
          styleId: style.sheetStyle,
        });
      const seed = twin.clone.sheetUrl ?? twin.clone.refPhotos[0];
      const url = seed
        ? await aiEditImage({ prompt, seed, references: [], format: 'reel', model: CLONE_SHEET_MODEL })
        : await aiGenerateImage(prompt);
      // Save onto the twin's reel record — the roster updates everywhere.
      const project = (projects ?? []).find((p) => p.id === twin.reelId);
      if (project) {
        const planNow = normalizeClonePlan(project.clonePlan ?? null) ?? blankClonePlan(twin.clone);
        await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            project: {
              ...project,
              clonePlan: { ...planNow, clone: { ...planNow.clone, sheetUrl: url } },
            },
          }),
        });
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Character sheet forge failed');
    } finally {
      setCharBusy(false);
    }
  }
  useEffect(() => {
    try {
      window.localStorage.setItem(
        'producer-draft',
        JSON.stringify({ twinId, styleId, brief, ctxPick, artifactPick, plan, sheetPrompts, sheets }),
      );
    } catch {
      /* storage full/blocked — the draft is a convenience */
    }
  }, [twinId, styleId, brief, ctxPick, artifactPick, plan, sheetPrompts, sheets]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/mothermode-research', { cache: 'no-store' });
        const json = await res.json();
        const list = (json.artifacts ?? json.sessions ?? json.runs ?? []) as unknown[];
        setArtifacts(
          list
            .slice(0, 30)
            .map((a, i) => {
              const o = (a ?? {}) as Record<string, unknown>;
              const summary = String(o.summary ?? o.recap ?? o.answer ?? '').slice(0, 800);
              return {
                id: String(o.id ?? i),
                label: String(o.title ?? o.name ?? o.query ?? 'research').slice(0, 80),
                summary,
              };
            })
            .filter((a) => a.summary),
        );
      } catch {
        /* research is optional grounding — empty is fine */
      }
    })();
  }, []);

  const artifact = artifacts.find((a) => a.id === artifactPick);
  const groundingNotes = [artifact?.summary].filter(Boolean).join('\n\n');

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
        grounding: groundingNotes || undefined,
      });
      setSheets([]); // a fresh scope = fresh sheets to review
      const p = normalizeProductionPlan(raw);
      if (!p) throw new Error('The plan came back empty — tighten the brief and try again');
      setPlan(p);
      // PROMPT-FIRST: the per-world sheet prompts land immediately — you read
      // and edit the exact words BEFORE anything forges.
      setSheetPrompts(
        producerWorldGroups(p.scenes).map((g) => worldSheetPrompt(p, twin?.clone.name ?? 'the founder', g.indices, style.sheetStyle)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scoping failed');
    } finally {
      setBusy(null);
    }
  }

  function patchPlan(partial: Partial<ProductionPlan>) {
    setPlan((p) => (p ? { ...p, ...partial } : p));
  }

  /** The default prompt for one world's sheet — a pseudo-plan of its scenes. */
  function worldSheetPrompt(p: ProductionPlan, persona: string, indices: number[], styleId: string): string {
    const pseudo: ClonePlan = {
      ...blankClonePlan({
        id: 'preview',
        name: persona,
        refPhotos: [],
        lookBible: { wardrobe: '', backdrop: '', lighting: '', lens: '' },
        voice: { voiceId: '', name: '', stability: 0.5, similarityBoost: 0.75, style: 0.3 },
        createdAt: null,
      }),
      videoType: p.videoType,
      framework: p.framework,
      beats: indices.map((sceneIdx, i) => {
        const s = p.scenes[sceneIdx];
        return {
          id: `w-${sceneIdx}`,
          index: i,
          kind: s?.kind ?? 'avatar',
          line: s?.kind === 'avatar' ? (s?.idea ?? '') : '',
          shot: 'medium' as const,
          durationSec: p.beatSec,
          refs: [],
          ...(s?.kind === 'broll' ? { brollPrompt: s?.idea ?? '' } : {}),
          status: 'planned' as const,
        };
      }),
    };
    return sceneSheetPrompt(pseudo, styleId, true);
  }

  /**
   * THE SHEET REVIEW: forge the scene sheets BEFORE approval — one sheet per
   * WORLD (uneven by construction), the prompt visible + editable first,
   * seeded with the character sheet, the previous sheet riding as lookback.
   */
  async function forgeSheets() {
    if (!plan || !twin || sheetBusy) return;
    const master = twin.clone.sheetUrl ?? twin.clone.refPhotos[0];
    if (!master || plan.scenePanels <= 0) return;
    setSheetBusy(true);
    setError(null);
    try {
      const out: string[] = [];
      for (let k = 0; k < sheetPrompts.length; k++) {
        const url = await aiEditImage({
          prompt: sheetPrompts[k],
          seed: master,
          references: [master, ...(out.length ? [out[out.length - 1]] : [])],
          format: 'reel',
          model: CLONE_SHEET_MODEL,
        });
        out.push(url);
        setSheets([...out]); // progressive — each sheet shows as it lands
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sheet forge failed');
    } finally {
      setSheetBusy(false);
    }
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
        context: {
          offerSlug: ctxPick.startsWith('offer:') ? ctxPick.slice(6) : undefined,
          optinSlug: ctxPick.startsWith('lead:') ? ctxPick.slice(5) : undefined,
          notes: groundingNotes || undefined,
        },
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
        // The writer's b-roll prompt — backfilled from the plan's scene idea
        // when it left one empty, so the gate never meets a prompt-less beat.
        ...((b.brollPrompt ?? '').trim() || plan.scenes[i]?.idea
          ? { brollPrompt: (b.brollPrompt ?? '').trim() || plan.scenes[i]!.idea }
          : {}),
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
              captionPreset: plan.captionPreset,
              // The reviewed sheets ride the manifest — beat k quotes ITS sheet.
              ...(sheets.length
                ? {
                    sceneSheetUrl: sheets[0],
                    sceneSheetAt: new Date().toISOString(),
                    sceneSheetUrls: sheets,
                    sheetScenes: producerWorldGroups(plan.scenes).map((g) => g.indices),
                  }
                : {}),
            },
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not create the reel');
      setRunReel(json.project as ReelProject); // the auto-run card takes over
      setRunLog([`Reel created — ${mapped.length} scenes on the manifest (saved — it survives a refresh).`]);
      setBusy(null);
      setTimeout(
        () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),
        250,
      ); // land on the run card
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
      setBusy(null);
    }
  }

  /** Per-scene cost label for the one-scene button. */
  function sceneCostLabel(b: CloneBeat, planTier: string): string {
    const voice = (b.line.length / 1000) * CLONE_COSTS.elevenlabsPer1kChars;
    const video =
      b.kind === 'broll'
        ? b.durationSec *
          CLONE_COSTS.seedancePerSec[
            (b.seedanceTier ?? planTier) as 'seedance-2.0' | 'seedance-2.5'
          ]
        : b.durationSec * CLONE_COSTS.avatarPerSec;
    return `$${(voice + video).toFixed(2)}`;
  }

  /** Run ONE scene (stamp the gate first if needed) — test scene 1 first. */
  async function runScene(index: number) {
    if (!runReel || runBusy) return;
    setRunBusy(true);
    setError(null);
    try {
      let planNow = normalizeClonePlan(runReel.clonePlan ?? null);
      if (!planNow) throw new Error('The reel lost its plan');
      if (!planNow.approvedAt) {
        const saved = await saveRunPlan(approveClonePlan(planNow));
        planNow = normalizeClonePlan(saved?.clonePlan ?? null) ?? planNow;
        setRunLog((l) => [...l, 'Storyboard gate stamped.']);
      }
      let beat = planNow.beats[index];
      if (!beat) return;
      if (beat.status === 'generated' && beat.videoUrl) return;
      for (let leg = 0; leg < 2; leg++) {
        if (beat.status === 'generated' && beat.videoUrl) break;
        if (beat.status !== 'failed' && (beat.status === 'voiced' || beat.status === 'generated') && leg === 0) continue;
        setRunLog((l) => [...l, `Scene ${index + 1}: ${beat.audioUrl ? 'video' : 'voice'}…`]);
        const res = await fetch('/api/admin/reel-clone-generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId: runReel.id, beatId: beat.id }),
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const patch = json?.patch as Partial<CloneBeat> | undefined;
        if (patch) {
          const next: ClonePlan = {
            ...planNow,
            beats: planNow.beats.map((b) => (b.id === beat.id ? { ...b, ...patch } : b)),
            updatedAt: new Date().toISOString(),
          };
          const saved = await saveRunPlan(next);
          planNow = normalizeClonePlan(saved?.clonePlan ?? null) ?? next;
          beat = planNow.beats.find((b) => b.id === beat.id) ?? beat;
        }
        if (!res.ok || json?.ok !== true) {
          throw new Error(
            `Scene ${index + 1}: ${typeof json?.error === 'string' ? json.error : 'generation failed'}`,
          );
        }
      }
      setRunLog((l) => [...l, `Scene ${index + 1} rendered.`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scene render stopped');
    } finally {
      setRunBusy(false);
    }
  }

  /** Save a clonePlan patch back onto the run reel; returns the fresh project. */
  async function saveRunPlan(next: ClonePlan): Promise<ReelProject | null> {
    if (!runReel) return null;
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'save', project: { ...runReel, clonePlan: next } }),
    });
    const json = await res.json();
    if (!json.success) return null;
    setRunReel(json.project as ReelProject);
    return json.project as ReelProject;
  }

  /** THE AUTO-RUN: sheets → the gate (the spend check, on the button) →
   *  generate every scene. Stops honest on a failure; resume re-enters. */
  async function autoRun() {
    if (!runReel || !plan || !twin || runBusy) return;
    setRunBusy(true);
    setError(null);
    try {
      let planNow = normalizeClonePlan(runReel.clonePlan ?? null);
      if (!planNow) throw new Error('The reel lost its plan');
      const master = twin.clone.sheetUrl ?? twin.clone.refPhotos[0] ?? null;

      // 1 — the scene sheet, seeded with the character sheet (once).
      if (plan.scenePanels > 0 && !planNow.sceneSheetUrl && master) {
        setRunLog((l) => [...l, 'Forging the scene sheet…']);
        const prompt = sceneSheetPrompt(planNow, style.sheetStyle, true);
        const url = await aiEditImage({
          prompt,
          seed: master,
          references: [master],
          format: 'reel',
          model: CLONE_SHEET_MODEL,
        });
        const saved = await saveRunPlan({
          ...planNow,
          sceneSheetUrl: url,
          sceneSheetAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        planNow = normalizeClonePlan(saved?.clonePlan ?? null) ?? planNow;
        setRunLog((l) => [...l, 'Scene sheet forged — it rides every b-roll render.']);
      }

      // 2 — the gate. The run button carried the total; stamp it here.
      if (!planNow.approvedAt) {
        const stamped = approveClonePlan(planNow);
        const saved = await saveRunPlan(stamped);
        planNow = normalizeClonePlan(saved?.clonePlan ?? null) ?? stamped;
        setRunLog((l) => [...l, 'Storyboard gate stamped.']);
      }

      // 3 — generate every scene, per leg (voice then video), in order.
      for (let i = 0; i < planNow.beats.length; i++) {
        let beat = planNow.beats[i];
        if (beat.status === 'generated' && beat.videoUrl) continue;
        for (let leg = 0; leg < 2; leg++) {
          if (beat.status === 'generated' && beat.videoUrl) break;
          if (beat.status !== 'failed' && (beat.status === 'voiced' || beat.status === 'generated') && leg === 0) continue;
          setRunLog((l) => [...l, `Scene ${i + 1}: ${beat.audioUrl ? 'video' : 'voice'}…`]);
          const res = await fetch('/api/admin/reel-clone-generate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectId: runReel.id, beatId: beat.id }),
          });
          const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          const patch = json?.patch as Partial<CloneBeat> | undefined;
          if (patch) {
            const next: ClonePlan = {
              ...planNow,
              beats: planNow.beats.map((b) => (b.id === beat.id ? { ...b, ...patch } : b)),
              updatedAt: new Date().toISOString(),
            };
            const saved = await saveRunPlan(next);
            planNow = normalizeClonePlan(saved?.clonePlan ?? null) ?? next;
            beat = planNow.beats.find((b) => b.id === beat.id) ?? beat;
          }
          if (!res.ok || json?.ok !== true) {
            throw new Error(
              `Scene ${i + 1}: ${typeof json?.error === 'string' ? json.error : 'generation failed'} — hit run again to resume.`,
            );
          }
        }
        setRunLog((l) => [...l, `Scene ${i + 1} rendered.`]);
      }

      setRunDone(true);
      setRunLog((l) => [...l, 'Every scene rendered. Assemble + captions + render happen in the studio.']);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The run stopped');
    } finally {
      setRunBusy(false);
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

      {/* THE SESSION LIBRARY — named producer sessions, resume in one tap */}
      {sessions.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-bone/10 bg-bone/[0.03] px-3 py-2">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-bone/35">
            sessions:
          </span>
          {sessions.slice(0, 8).map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-lg bg-ink px-2 py-1">
              <button
                onClick={() => restoreSession(s.data)}
                className="text-[9px] font-semibold text-bone/70 hover:text-brass"
                title={`saved ${new Date(s.savedAt).toLocaleString()}`}
              >
                {s.name}
              </button>
              <button
                onClick={() => deleteSession(s.id)}
                className="text-[9px] text-bone/25 hover:text-red-300"
                title="drop this session"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <span className={LABEL}>Ground it in (optional)</span>
            <select
              value={ctxPick}
              onChange={(e) => setCtxPick(e.target.value)}
              className={`${INPUT} mt-1`}
            >
              <option value="">no offer / lead magnet</option>
              {funnels.map((f) => (
                <option key={f.id} value={`offer:${f.slug}`}>
                  Offer — {f.name}
                </option>
              ))}
              {optinFunnels.map((f) => (
                <option key={f.id} value={`lead:${f.slug}`}>
                  Lead magnet — {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={LABEL}>…or a research artifact</span>
            <select
              value={artifactPick}
              onChange={(e) => setArtifactPick(e.target.value)}
              className={`${INPUT} mt-1`}
            >
              <option value="">no research</option>
              {artifacts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
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
        {(plan || sheets.length > 0) && (
          <button
            onClick={saveSession}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brass/40 px-3 py-2.5 text-[10px] font-semibold text-brass hover:bg-brass/10"
            title="Save this session to the library — intake + plan + sheet prompts + forged sheets"
          >
            save this session
          </button>
        )}
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

          {/* THE SHEET REVIEW — see the character sheet + every scene sheet
              BEFORE approving. Sheets carry scene slices in order, lookback-
              forged, and ride the manifest (beat k quotes ITS sheet). */}
          <div className="space-y-2 rounded-xl border border-bone/10 bg-ink/40 p-2.5">
            <span className={LABEL}>Review the sheets — prompts first, then the forge</span>
            {(twin?.clone.sheetUrl ?? twin?.clone.refPhotos[0]) && (
              <div>
                <p className="mb-1 text-[9px] uppercase tracking-wider text-bone/35">
                  the character — {twin?.clone.name}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(twin?.clone.sheetUrl ?? twin?.clone.refPhotos[0]) as string}
                  alt="character sheet"
                  className="w-full rounded-lg border border-brass/25"
                />
              </div>
            )}
            {/* THE CHARACTER SHEET'S TRIGGER — forge it right here when the
                plan needs one or the twin has none. Prompt first, always. */}
            {twin && (plan.needsCharacterSheet || !twin.clone.sheetUrl) && (
              <div className="space-y-1 rounded-lg border border-brass/25 bg-brass/[0.05] p-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-brass/80">
                  the character sheet — forge it here, it saves onto the twin
                </p>
                <textarea
                  value={
                    charPrompt ||
                    characterSheetPrompt({
                      description: twin.clone.name,
                      lookBible: twin.clone.lookBible,
                      styleId: style.sheetStyle,
                    })
                  }
                  onChange={(e) => setCharPrompt(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-bone/10 bg-ink px-2 py-1.5 font-mono text-[9px] leading-relaxed text-bone/60 outline-none"
                  title="The character-sheet prompt — edit before forging"
                />
                <button
                  onClick={() => void forgeCharacter()}
                  disabled={charBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-2 text-[10px] font-semibold text-ink hover:bg-brass/90 disabled:opacity-40"
                >
                  {charBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  forge the character sheet (~${CLONE_COSTS.characterSheetImage.toFixed(2)})
                </button>
              </div>
            )}
            {/* ONE SHEET PER WORLD — uneven by construction, prompt editable */}
            {plan.scenePanels > 0 &&
              producerWorldGroups(plan.scenes).map((g, k) => (
                <div key={k} className="space-y-1 rounded-lg border border-bone/10 bg-bone/[0.03] p-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-brass/80">
                    sheet {k + 1} · {g.world} — scene{g.indices.length > 1 ? 's' : ''}{' '}
                    {g.indices.map((i) => i + 1).join(', ')} · ~{g.indices.length * plan.beatSec}s
                  </p>
                  <textarea
                    value={sheetPrompts[k] ?? ''}
                    onChange={(e) =>
                      setSheetPrompts((prev) => prev.map((p, j) => (j === k ? e.target.value : p)))
                    }
                    rows={4}
                    className="w-full rounded-md border border-bone/10 bg-ink px-2 py-1.5 font-mono text-[9px] leading-relaxed text-bone/60 outline-none"
                    title="The exact prompt this sheet forges with — edit it before forging"
                  />
                  {sheets[k] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sheets[k]}
                      alt={`scene sheet ${k + 1}`}
                      className="w-full rounded-lg border border-brass/30"
                    />
                  )}
                </div>
              ))}
            {plan.scenePanels > 0 && (twin?.clone.sheetUrl ?? twin?.clone.refPhotos[0]) && (
              <button
                onClick={() => void forgeSheets()}
                disabled={sheetBusy || sheetPrompts.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-2 text-[10px] font-semibold text-ink hover:bg-brass/90 disabled:opacity-40"
              >
                {sheetBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {sheets.length
                  ? 're-forge the sheets'
                  : `forge the sheets (${sheetPrompts.length} × ~$${CLONE_COSTS.characterSheetImage.toFixed(2)})`}
              </button>
            )}
            <p className="text-[9px] text-bone/30">
              One sheet per world — edit its prompt, then forge. Sheets forge in order, each
              carrying the previous as its lookback, so the world stays one continuous shoot.
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              {error}
            </p>
          )}
          <button
            onClick={() => void approve()}
            disabled={busy !== null}
            className="w-full rounded-xl bg-brass px-4 py-2.5 text-xs font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
          >
            {busy === 'approve' ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> writing the script onto the manifest…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> approve the plan — write the script onto the manifest
              </span>
            )}
          </button>
          <p className="text-center text-[9px] text-bone/30">
            The plan saves as you go (the draft survives a refresh). Approving writes the script
            onto the reel — the run card appears right below with the total on the button.
          </p>
        </div>
      )}

      {/* PHASE 2 — the auto-run card: sheets → the gate → generate-all, live */}
      {runReel && (
        <div className="mt-4 space-y-3 rounded-2xl border border-brass/40 bg-brass/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className={LABEL}>The run — {runReel.name}</span>
            {runDone && <span className="text-[9px] font-semibold text-emerald-300">rendered</span>}
          </div>

          {/* the cast on screen — the character sheet + the world sheets */}
          {(() => {
            const p = normalizeClonePlan(runReel.clonePlan ?? null);
            const charSheet = p?.clone.sheetUrl ?? p?.clone.refPhotos[0];
            const worlds = p?.sceneSheetUrls ?? [];
            if (!charSheet && worlds.length === 0) return null;
            return (
              <div className="flex flex-wrap items-start gap-2 rounded-lg bg-ink/60 p-2">
                {charSheet && (
                  <figure className="space-y-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={charSheet}
                      alt="the character"
                      className="h-24 rounded-lg border border-brass/30 object-cover"
                    />
                    <figcaption className="text-[7px] uppercase tracking-wider text-bone/35">
                      @1 the character
                    </figcaption>
                  </figure>
                )}
                {worlds.map((url, k) => (
                  <figure key={url} className="space-y-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`world sheet ${k + 1}`}
                      className="h-24 rounded-lg border border-brass/20 object-cover"
                    />
                    <figcaption className="text-[7px] uppercase tracking-wider text-bone/35">
                      world sheet {k + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>
            );
          })()}

          {/* THE SCRIPT — written at approve, shown before a dollar moves */}
          {(() => {
            const p = normalizeClonePlan(runReel.clonePlan ?? null);
            if (!p || p.beats.length === 0) return null;
            return (
              <div className="space-y-1 rounded-lg bg-ink/60 p-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-bone/40">
                  the script — read it before you run
                </p>
                {p.beats.map((b, i) => (
                  <p key={b.id} className="text-[10px] leading-snug text-bone/70">
                    <span className="font-bold text-brass/80">{i + 1}.</span>{' '}
                    <span className="text-bone/40">
                      [{b.kind === 'broll' ? 'b-roll' : 'talking head'} · {b.durationSec}s]{' '}
                    </span>
                    {b.kind === 'broll' ? (b.brollPrompt ?? 'visual beat') : b.line}
                  </p>
                ))}
                <a
                  href={`/admin/reel-studio?reel=${encodeURIComponent(runReel.id)}`}
                  className="block pt-0.5 text-[9px] font-semibold text-brass hover:underline"
                >
                  edit any line in the studio storyboard →
                </a>
              </div>
            );
          })()}

          {/* THE RENDER PROMPTS — the exact Seedance/avatar prompt per scene,
              the @references IN ORDER, the settings. Edit = the override rides
              the manifest (finalPrompt); generation sends YOURS. */}
          {(() => {
            const p = normalizeClonePlan(runReel.clonePlan ?? null);
            if (!p || p.beats.length === 0) return null;
            return (
              <details className="rounded-lg bg-ink/60 p-2" open={!runDone}>
                <summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-wider text-bone/40">
                  the render prompts + @references, per scene — edit before you run
                </summary>
                <div className="mt-1.5 space-y-2">
                  {p.beats.map((b, i) => {
                    const refs = cloneRefImagesFor(b, p.clone);
                    const worldSheet = cloneSheetForBeat(p, b.index);
                    const ordered = worldSheet && !refs.includes(worldSheet) ? [...refs, worldSheet] : refs;
                    const derived =
                      b.kind === 'broll'
                        ? (b.finalPrompt ?? cloneBrollPrompt(b, p.clone))
                        : (b.finalPrompt ?? cloneAvatarPrompt(b, p.clone));
                    return (
                      <div key={b.id} className="space-y-1 rounded-md border border-bone/10 p-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[9px] font-bold text-brass/80">#{i + 1}</span>
                          <span className="text-[8px] text-bone/40">
                            {b.kind === 'broll'
                              ? `Seedance ${(b.seedanceTier ?? p.seedanceTier) === 'seedance-2.5' ? '2.5 hero' : '2.0'}`
                              : 'avatar'}{' '}
                            · {b.durationSec}s · 9:16
                          </span>
                          {ordered.map((url, k) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={k}
                              src={url}
                              alt={`@${k + 1}`}
                              title={`@image${k + 1}${worldSheet && k === ordered.length - 1 && url === worldSheet ? ' — the world scene sheet' : k === 0 ? ' — the character sheet' : ''}`}
                              className="h-7 w-7 rounded border border-brass/30 object-cover"
                            />
                          ))}
                          {b.finalPrompt && (
                            <span className="rounded bg-brass/15 px-1 py-0.5 text-[7px] font-semibold text-brass">
                              edited
                            </span>
                          )}
                          <span className="flex-1" />
                          {b.status === 'generated' && b.videoUrl ? (
                            <a
                              href={b.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-300"
                            >
                              watch ↗
                            </a>
                          ) : (
                            <button
                              onClick={() => void runScene(i)}
                              disabled={runBusy}
                              className="rounded bg-brass px-1.5 py-0.5 text-[8px] font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
                              title="Render JUST this scene (voice then video) — test scene 1 first"
                            >
                              render this scene · {sceneCostLabel(b, p.seedanceTier)}
                            </button>
                          )}
                        </div>
                        <textarea
                          key={`${b.id}:${b.finalPrompt ?? ''}`}
                          defaultValue={derived}
                          rows={3}
                          onBlur={async (e) => {
                            const v = e.target.value.trim();
                            const baseline =
                              b.kind === 'broll'
                                ? cloneBrollPrompt(b, p.clone)
                                : cloneAvatarPrompt(b, p.clone);
                            const next = v && v !== baseline ? v : undefined;
                            if ((next ?? undefined) === (b.finalPrompt ?? undefined)) return;
                            await saveRunPlan({
                              ...p,
                              beats: p.beats.map((x) =>
                                x.id === b.id
                                  ? next
                                    ? { ...x, finalPrompt: next }
                                    : (() => {
                                        const c = { ...x };
                                        delete c.finalPrompt;
                                        return c;
                                      })()
                                  : x,
                              ),
                              updatedAt: new Date().toISOString(),
                            });
                          }}
                          className="w-full rounded-md border border-bone/10 bg-ink px-2 py-1.5 font-mono text-[9px] leading-relaxed text-bone/60 outline-none"
                          title="The exact prompt this scene renders with — your edit wins"
                        />
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })()}

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              {error}
            </p>
          )}
          <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg bg-ink/60 p-2">
            {runLog.map((line, i) => (
              <p key={i} className="text-[9px] text-bone/55">
                {line}
              </p>
            ))}
          </div>
          {!runDone ? (
            <>
            <button
              onClick={() => void autoRun()}
              disabled={runBusy}
              className="w-full rounded-xl bg-brass px-4 py-2.5 text-xs font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
            >
              {runBusy ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> running — watch the log…
                </span>
              ) : (
                `run it — render every scene (~$${(estVideo + estSheets).toFixed(2)}, watch the log)`
              )}
            </button>
            <p className="text-center text-[9px] text-bone/35">
              The sheets you forged ride every scene; the gate stamps when you hit run.
            </p>
            </>
          ) : (
            <>
              <a
                href={`/admin/reel-studio?reel=${encodeURIComponent(runReel.id)}`}
                className="block w-full rounded-xl bg-brass px-4 py-2.5 text-center text-xs font-bold text-ink hover:bg-brass/90"
              >
                assemble + captions + render in the studio →
              </a>
              <button
                onClick={() => {
                  // A/B: same plan, a second reel — tweak the brief or the hook,
                  // scope again, and run the variant next to the first.
                  setRunReel(null);
                  setRunDone(false);
                  setRunLog([]);
                  setPlan(null);
                }}
                className="w-full rounded-xl border border-brass/40 px-4 py-2 text-[10px] font-semibold text-brass hover:bg-brass/10"
              >
                run a variant — same cast, new angle (A/B the two)
              </button>
            </>
          )}
          <p className="text-center text-[9px] text-bone/30">
            The run button IS the spend approval — the gate stamps when you hit it. A failed scene
            stamps itself and the run resumes where it stopped.
          </p>
        </div>
      )}
    </div>
  );
}
