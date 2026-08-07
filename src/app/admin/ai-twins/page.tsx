'use client';

/**
 * /admin/ai-twins — THE ROSTER. Your cast, library-first: every AI twin as a
 * card (face, voice, how many videos it stars in), "New twin" as the
 * creation modal (the foundry + AI fill + voice picker live HERE, the only
 * place that form exists), and "New video" casting a twin into a fresh reel
 * and deep-linking into the Clipping Studio's wizard.
 *
 * THE BRIDGE (UI-first, data-second): twins ride reel projects — a roster
 * record is a reel named `Twin: <name>` with no scenes whose clonePlan
 * carries the twin; a twin built inside a working reel shows up too (the
 * clone library's derive). When the flow proves itself, the store promotes
 * to a real table — see docs/AI_CLONE_VIDEO_PORT.md.
 */
import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  Check,
  Clapperboard,
  Loader2,
  Mic,
  PersonStanding,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  blankClonePlan,
  characterSheetPrompt,
  CLONE_COSTS,
  CLONE_SHEET_MODEL,
  lookBibleString,
  makeCloneId,
  twinReelName,
  twinRoster,
  type ReelClone,
  type TwinRosterEntry,
} from '@/lib/mothermode/reel/clone';
import type { ReelProject } from '@/lib/mothermode/reel/types';
import {
  aiCloneAutofill,
  aiGenerateImage,
  aiListVoices,
  type AiVoice,
} from '@/components/mothermode/content/aiClient';

const API = '/api/admin/mothermode-reel';

const INPUT =
  'w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-xs text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/50';
const LABEL = 'block text-[10px] font-semibold uppercase tracking-wider text-bone/40';

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
    /* the library entry is a convenience — the twin still saves */
  }
}

// ---------------------------------------------------------------------------
// The twin form modal — create + edit share it (the ONLY form surface)
// ---------------------------------------------------------------------------

function TwinFormModal({
  seed,
  onSave,
  onClose,
}: {
  /** The clone being edited (null = a fresh twin). */
  seed: ReelClone | null;
  onSave: (clone: ReelClone) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(seed?.name ?? '');
  const [description, setDescription] = useState('');
  const [wardrobe, setWardrobe] = useState(seed?.lookBible.wardrobe ?? '');
  const [backdrop, setBackdrop] = useState(seed?.lookBible.backdrop ?? '');
  const [lighting, setLighting] = useState(seed?.lookBible.lighting ?? '');
  const [lens, setLens] = useState(seed?.lookBible.lens ?? '');
  const [voiceId, setVoiceId] = useState(seed?.voice.voiceId ?? '');
  const [voiceName, setVoiceName] = useState(seed?.voice.name ?? '');
  const [refPhotos, setRefPhotos] = useState<string[]>(seed?.refPhotos ?? []);
  const [sheetUrl, setSheetUrl] = useState(seed?.sheetUrl ?? '');
  const [refUrl, setRefUrl] = useState('');
  const [includeFullBody, setIncludeFullBody] = useState(false);
  const [voices, setVoices] = useState<AiVoice[]>([]);
  const [autofillBusy, setAutofillBusy] = useState(false);
  const [forgeBusy, setForgeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void aiListVoices().then(setVoices);
  }, []);

  const lookBible = { wardrobe, backdrop, lighting, lens };
  const bibleLine = lookBibleString(lookBible);
  const canSave =
    !!name.trim() && !!voiceId.trim() && (refPhotos.length > 0 || !!sheetUrl) && !saveBusy;

  /** AI fill: one loose sentence → the whole card. */
  async function runAutofill() {
    if (!description.trim() || autofillBusy) return;
    setAutofillBusy(true);
    setError(null);
    try {
      const a = await aiCloneAutofill(description.trim());
      if (!name.trim() && a.name) setName(a.name);
      setDescription(a.description);
      if (a.wardrobe) setWardrobe(a.wardrobe);
      if (a.backdrop) setBackdrop(a.backdrop);
      if (a.lighting) setLighting(a.lighting);
      if (a.lens) setLens(a.lens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI fill failed');
    } finally {
      setAutofillBusy(false);
    }
  }

  /** The foundry: one GPT Image 2 call forges the turnaround sheet. */
  async function forgeSheet() {
    if (!description.trim() || forgeBusy) return;
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
      setRefPhotos((prev) => (prev.includes(url) ? prev : [url, ...prev].slice(0, 8)));
      await ingestSheet(`${name.trim() || 'Twin'} — character sheet`, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sheet generation failed');
    } finally {
      setForgeBusy(false);
    }
  }

  async function save() {
    if (!canSave) return;
    setSaveBusy(true);
    setError(null);
    try {
      await onSave({
        id: seed?.id ?? makeCloneId(),
        name: name.trim().slice(0, 80),
        refPhotos,
        ...(sheetUrl ? { sheetUrl } : {}),
        lookBible,
        voice: {
          voiceId: voiceId.trim(),
          name: (voiceName.trim() || voiceId.trim()).slice(0, 80),
          stability: seed?.voice.stability ?? 0.5,
          similarityBoost: seed?.voice.similarityBoost ?? 0.75,
          style: seed?.voice.style ?? 0.3,
        },
        createdAt: seed?.createdAt ?? new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaveBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-bone/15 bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-bone/10 px-5 py-3">
          <PersonStanding className="h-4 w-4 text-brass" />
          <span className="text-sm font-semibold text-bone">
            {seed ? `Edit ${seed.name}` : 'New twin'}
          </span>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-bone/40 hover:bg-bone/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {/* the person */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={LABEL}>The person</span>
              <button
                onClick={() => void runAutofill()}
                disabled={!description.trim() || autofillBusy}
                title="AI fill: the description becomes the name + look bible fields"
                className="inline-flex items-center gap-1 rounded-md border border-brass/50 px-2 py-1 text-[10px] font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
              >
                {autofillBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                AI fill
              </button>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Twin name (e.g. The Founder)" className={INPUT} />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Who is this person? (age, face, hair, build, vibe — AI fill and the foundry read this)"
              className={INPUT}
            />
          </div>

          {/* the look bible */}
          <div className="space-y-1.5">
            <span className={LABEL}>Look bible — locked, quoted verbatim everywhere</span>
            <input value={wardrobe} onChange={(e) => setWardrobe(e.target.value)} placeholder="Wardrobe (navy crewneck, no logos)" className={INPUT} />
            <input value={backdrop} onChange={(e) => setBackdrop(e.target.value)} placeholder="Backdrop (warm gray studio wall)" className={INPUT} />
            <input value={lighting} onChange={(e) => setLighting(e.target.value)} placeholder="Lighting (soft key from camera-left)" className={INPUT} />
            <input value={lens} onChange={(e) => setLens(e.target.value)} placeholder="Lens (50mm, shallow depth of field)" className={INPUT} />
            {bibleLine && (
              <p className="rounded-lg bg-bone/[0.05] px-2 py-1 text-[10px] italic text-bone/40">{bibleLine}</p>
            )}
          </div>

          {/* the voice */}
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <span className={LABEL}>Character-sheet foundry</span>
            <label className="flex items-center gap-1.5 text-[11px] text-bone/55">
              <input
                type="checkbox"
                checked={includeFullBody}
                onChange={(e) => setIncludeFullBody(e.target.checked)}
              />
              add a full-body cell (for walking b-roll shots)
            </label>
            <button
              onClick={() => void forgeSheet()}
              disabled={!description.trim() || forgeBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-2 text-[11px] font-semibold text-ink hover:bg-brass/90 disabled:opacity-40"
            >
              {forgeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              forge character sheet
            </button>
            <p className="text-[10px] text-bone/35">
              One GPT Image 2 call (~${CLONE_COSTS.characterSheetImage.toFixed(2)}) ONCE per
              character — not per video. The sheet lands in the Media Library tagged
              character-sheet.
            </p>
            {sheetUrl && (
              <div className="overflow-hidden rounded-lg border border-brass/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sheetUrl} alt="Character sheet" className="w-full" />
              </div>
            )}
          </div>

          {/* reference photos */}
          <div className="space-y-1.5">
            <span className={LABEL}>Reference photos ({refPhotos.length}/8)</span>
            <div className="flex items-center gap-1.5">
              <input
                value={refUrl}
                onChange={(e) => setRefUrl(e.target.value)}
                placeholder="https://… reference photo URL"
                className={INPUT}
              />
              <button
                onClick={() => {
                  const url = refUrl.trim();
                  if (!/^https?:\/\//i.test(url)) return;
                  setRefPhotos((prev) => (prev.includes(url) ? prev : [...prev, url].slice(0, 8)));
                  setRefUrl('');
                }}
                disabled={!refUrl.trim()}
                className="shrink-0 rounded-lg border border-bone/15 px-2 py-2 text-bone/60 hover:bg-bone/10 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {refPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5">
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
            <p className="text-[10px] text-bone/35">
              <Upload className="mr-0.5 inline h-2.5 w-2.5" /> Upload via the Media Library, then
              paste the URL here — the sheet above already counts as the master reference.
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-bone/10 p-4">
          <button
            onClick={() => void save()}
            disabled={!canSave}
            className="w-full rounded-xl bg-brass px-4 py-2.5 text-xs font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
          >
            {saveBusy ? 'saving…' : seed ? 'save changes' : 'add to the roster'}
          </button>
          {!canSave && !saveBusy && (
            <p className="mt-1.5 text-center text-[10px] text-bone/30">
              Needs a name, a voice, and at least one reference (or a forged sheet).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

export default function AiTwinsPage() {
  const [projects, setProjects] = useState<ReelProject[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The modal: 'new' or the entry being edited. */
  const [editing, setEditing] = useState<'new' | TwinRosterEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setProjects(json.projects);
    } catch {
      /* keep last good list */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roster = twinRoster(projects ?? []);

  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setError(null);
    setNote(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Action failed');
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      return null;
    }
  }

  /** Modal save: create a roster record, or write the edit back to its reel. */
  async function saveTwin(clone: ReelClone) {
    if (editing === 'new') {
      const json = await post({
        action: 'save',
        project: {
          name: twinReelName(clone.name),
          clips: [],
          audio: null,
          clonePlan: blankClonePlan(clone),
        },
      });
      if (json?.project) {
        setNote(`${clone.name} is on the roster.`);
        setEditing(null);
        void load();
      }
      return;
    }
    if (editing) {
      const project = (projects ?? []).find((p) => p.id === editing.reelId);
      if (!project || !project.clonePlan) return;
      const json = await post({
        action: 'save',
        project: {
          ...project,
          clonePlan: { ...project.clonePlan, clone, updatedAt: new Date().toISOString() },
        },
      });
      if (json?.project) {
        setNote(`${clone.name} updated.`);
        setEditing(null);
        void load();
      }
    }
  }

  /** Cast the twin: a fresh video reel seeded with the clone, into the studio. */
  async function newVideo(entry: TwinRosterEntry) {
    setBusyId(entry.reelId);
    const json = await post({
      action: 'save',
      project: {
        name: `${entry.clone.name} — new video`.slice(0, 150),
        clips: [],
        audio: null,
        clonePlan: blankClonePlan(entry.clone),
      },
    });
    setBusyId(null);
    if (json?.project) {
      const id = (json.project as ReelProject).id;
      window.location.assign(`/admin/reel-studio?reel=${encodeURIComponent(id)}`);
    }
  }

  async function deleteTwin(entry: TwinRosterEntry) {
    if (!window.confirm(`Remove ${entry.clone.name} from the roster? Videos it already starred in keep their scenes.`)) {
      return;
    }
    const json = await post({ action: 'delete', id: entry.reelId });
    if (json) {
      setNote(`${entry.clone.name} removed.`);
      void load();
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-5 flex items-center gap-3">
        <PersonStanding className="h-6 w-6 text-brass" />
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">AI Twins</h1>
          <p className="text-xs text-bone/50">
            Your cast, library-first. Build a twin once — cast them into as many videos as you want.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brass px-3.5 py-2 text-xs font-semibold text-ink hover:bg-brass/90"
        >
          <Plus className="h-3.5 w-3.5" /> New twin
        </button>
      </div>

      {note && (
        <p className="mb-3 rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-xs text-brass">
          {note}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      {projects === null ? (
        <p className="flex items-center gap-2 py-16 text-sm text-bone/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the roster…
        </p>
      ) : roster.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bone/15 bg-bone/[0.03] p-12 text-center">
          <PersonStanding className="mx-auto h-10 w-10 text-brass/60" />
          <p className="mt-3 text-sm font-semibold text-bone/80">No twins yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-bone/45">
            A twin is a saved cast member: a character sheet, a voice, and a locked look. Build one
            and every video you make can star the same person.
          </p>
          <button
            onClick={() => setEditing('new')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brass px-4 py-2 text-xs font-semibold text-ink hover:bg-brass/90"
          >
            <Plus className="h-3.5 w-3.5" /> Build your first twin
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((entry) => {
            const thumb = entry.clone.sheetUrl ?? entry.clone.refPhotos[0];
            return (
              <div
                key={entry.reelId}
                className="overflow-hidden rounded-2xl border border-bone/10 bg-bone/[0.04] shadow-sm"
              >
                <div className="relative aspect-[16/10] bg-bone/[0.04]">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={entry.clone.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <PersonStanding className="h-10 w-10 text-bone/15" />
                    </div>
                  )}
                  <span
                    className={clsx(
                      'absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-semibold',
                      entry.ready
                        ? 'bg-emerald-400/15 text-emerald-300'
                        : 'bg-amber-400/15 text-amber-300',
                    )}
                  >
                    {entry.ready ? 'ready' : 'incomplete'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-bone">
                    {entry.clone.name}
                    {entry.approved && <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-bone/45">
                    <Mic className="mr-1 inline h-3 w-3" />
                    {entry.clone.voice.name}
                    {entry.rosterRecord ? ' · roster' : ` · on ${entry.reelName}`}
                    {entry.beats > 0 && ` · ${entry.rendered}/${entry.beats} rendered`}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      onClick={() => void newVideo(entry)}
                      disabled={busyId === entry.reelId || !entry.ready}
                      title={
                        entry.ready
                          ? 'Cast this twin into a fresh video (opens the Clipping Studio wizard)'
                          : 'This twin needs a sheet (or ref photo) and a voice first'
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brass px-2.5 py-1.5 text-[10px] font-semibold text-ink hover:bg-brass/90 disabled:opacity-40"
                    >
                      {busyId === entry.reelId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      New video
                    </button>
                    <button
                      onClick={() => setEditing(entry)}
                      className="rounded-lg border border-bone/15 px-2.5 py-1.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void deleteTwin(entry)}
                      className="rounded-lg border border-red-500/25 px-2 py-1.5 text-red-300/70 hover:bg-red-500/10"
                      title="Remove from the roster"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-1.5 text-[10px] text-bone/30">
        <Clapperboard className="h-3 w-3" />
        New video casts the twin into a fresh reel and opens the Clipping Studio's Clone wizard on
        it — script, storyboard gate, generate, assemble.
      </p>

      {editing && (
        <TwinFormModal
          seed={editing === 'new' ? null : editing.clone}
          onSave={saveTwin}
          onClose={() => setEditing(null)}
        />
      )}
      {/* keep Check referenced (saved-state chip styling) */}
      <span className="hidden">
        <Check />
      </span>
    </div>
  );
}
