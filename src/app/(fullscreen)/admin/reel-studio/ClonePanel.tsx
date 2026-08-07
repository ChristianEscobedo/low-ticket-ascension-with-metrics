'use client';

/**
 * The AI Clone tab — Step 1 of the guided wizard: THE CLONE (the asset) +
 * the character-sheet foundry.
 *
 * A clone is a saved cast member: name, reference photos, an ElevenLabs
 * voice, and a locked LOOK BIBLE (wardrobe / backdrop / lighting / lens)
 * that every downstream prompt quotes verbatim. No photos? The foundry
 * forges a character sheet with GPT Image 2 — one call, ONCE per character
 * (the cheapest consistency lever in the stack) — and the sheet lands in
 * the Media Library tagged `character-sheet`, reusable across reels.
 *
 * The clone persists as `clonePlan` on the reel project (the manifest
 * steps 2–6 build on). The stepper shows the full wizard; steps 2–6 light
 * up as they ship.
 */
import { useEffect, useState } from 'react';
import { Check, Loader2, Mic, PersonStanding, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import type { ReelProject } from '@/lib/mothermode/reel/types';
import {
  blankClonePlan,
  characterSheetPrompt,
  CLONE_COSTS,
  CLONE_SHEET_MODEL,
  lookBibleString,
  makeCloneId,
  type ClonePlan,
  type ReelClone,
} from '@/lib/mothermode/reel/clone';
import { aiGenerateImage, aiListVoices, type AiVoice } from '@/components/mothermode/content/aiClient';

const WIZARD_STEPS = [
  { n: 1, label: 'The Clone', live: true },
  { n: 2, label: 'Video type', live: false },
  { n: 3, label: 'Script', live: false },
  { n: 4, label: 'Storyboard', live: false },
  { n: 5, label: 'Generate', live: false },
  { n: 6, label: 'Assemble', live: false },
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
  onNote,
}: {
  project: ReelProject;
  onSavePlan: (plan: ClonePlan) => Promise<void> | void;
  onNote?: (msg: string) => void;
}) {
  const existing = project.clonePlan ?? null;

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
      onNote?.('Clone saved to this reel — step 2 (video type) unlocks as it ships.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaveBusy(false);
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
    </div>
  );
}
