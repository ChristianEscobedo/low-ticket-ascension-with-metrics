'use client';

/**
 * The full-screen image studio. Launched from the Edit tab so image work gets
 * room: a left compose rail with Generate and Edit tabs, and a right gallery
 * canvas that shows every frame or variant at the post's true crop.
 *
 * Generate: text-to-image with scene starters, variants, and model picker.
 * Edit: seed-based image edit with preset prompt injections and multi reference
 * images (character, logo, product, etc.) sent along with the seed.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ImagePlus,
  Sparkles,
  Trash2,
  Star,
  Download,
  Minus,
  Plus,
  Wand2,
} from 'lucide-react';
import {
  IMAGE_MODELS,
  EDIT_IMAGE_MODELS,
  AUTO_MODEL,
  FORMAT_LABEL,
  IMAGE_EDIT_PRESETS,
  MAX_EDIT_REFERENCES,
  type ContentPiece,
} from '@/lib/mothermode/content';
import {
  clampIndex,
  reviewImages,
  type PieceReview,
} from '@/lib/mothermode/content/review';
import { PreviewMedia } from './previews/shared';
import { aiGenerateImage, aiEditImage } from './aiClient';
import { AiError, Spinner, aiBtnGhost, aiBtnSolid, useAiAction } from './AiControls';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const tileBtn = 'rounded-full bg-white/90 p-1.5 text-ink hover:bg-white';
const MULTI_FRAME = ['story', 'carousel', 'idea'];
const MAX_VARIANTS = 4;

type StudioTab = 'generate' | 'edit';

/** The post's true crop, so the studio shows images at the shape they ship in. */
export function formatAspect(format: string): string {
  if (['story', 'reel', 'idea', 'short'].includes(format)) return 'aspect-[9/16]';
  if (format === 'pin') return 'aspect-[2/3]';
  if (['blog', 'article', 'answer'].includes(format)) return 'aspect-[16/9]';
  return 'aspect-square';
}

/** Scene starters in the brand's quiet, object-led imagery. */
const SCENE_CHIPS = [
  'A closed notebook and a cold coffee on a kitchen counter at dawn, no people',
  "A mother's hands folding laundry in soft window light, face out of frame",
  'A flat lay of a planner, a pen, and house keys on a linen surface',
  'A quiet living room at night, one lamp on, the toys put away',
];

/** Trigger a browser download of a data-URL image. */
function download(src: string, name: string) {
  const a = document.createElement('a');
  a.href = src;
  a.download = name;
  a.click();
}

/** Read a File as a data URL. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

/** Segmented Generate / Edit switch. */
const StudioTabs: React.FC<{
  value: StudioTab;
  onChange: (v: StudioTab) => void;
}> = ({ value, onChange }) => (
  <div className="inline-flex w-full overflow-hidden rounded-lg border border-ink/15">
    {(
      [
        { v: 'generate' as const, label: 'Generate', Icon: Sparkles },
        { v: 'edit' as const, label: 'Edit', Icon: Wand2 },
      ] as const
    ).map(({ v, label, Icon }) => (
      <button
        key={v}
        type="button"
        onClick={() => onChange(v)}
        className={`inline-flex flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${
          value === v
            ? 'bg-mode/10 font-semibold text-mode'
            : 'text-ink/55 hover:text-ink/80'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    ))}
  </div>
);

export const ImageStudioModal: React.FC<{
  open: boolean;
  onClose: () => void;
  piece: ContentPiece;
  review: PieceReview;
  onUpload: (file: File) => void;
  onAddImages: (urls: string[]) => void;
  onRemove: (index: number) => void;
  onSetIndex: (index: number) => void;
}> = ({ open, onClose, piece, review, onUpload, onAddImages, onRemove, onSetIndex }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const seedFileRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<StudioTab>('generate');
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [model, setModel] = useState(AUTO_MODEL);
  const [editModel, setEditModel] = useState(AUTO_MODEL);
  const [count, setCount] = useState(1);
  const [editCount, setEditCount] = useState(1);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [references, setReferences] = useState<string[]>([]);
  const [presetIds, setPresetIds] = useState<Set<string>>(new Set());
  const { busy, error, run } = useAiAction();

  const images = reviewImages(review);
  const active = clampIndex(review.imageIndex, images.length);
  const noun = MULTI_FRAME.includes(piece.format) ? 'Frame' : 'Image';
  const aspect = formatAspect(piece.format);
  const modelOptions = tab === 'edit' ? EDIT_IMAGE_MODELS : IMAGE_MODELS;
  const activeModel = tab === 'edit' ? editModel : model;
  const modelLabel =
    modelOptions.find((m) => m.id === activeModel)?.label ?? 'Auto';

  // Seed the generate prompt from the piece's art direction when the studio opens
  // or the focused piece changes (e.g. review drafts). Reset on piece change so
  // freeform edits from a previous draft do not leak across.
  useEffect(() => {
    if (!open) return;
    const scene = piece.media?.prompt ?? piece.visual ?? '';
    setPrompt(scene);
  }, [open, piece.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default the edit seed to the primary gallery image when Edit opens / gallery changes.
  useEffect(() => {
    if (!open) return;
    if (images.length === 0) {
      setSeed(null);
      return;
    }
    setSeed((prev) => {
      if (prev && images.includes(prev)) return prev;
      return images[active] ?? images[0] ?? null;
    });
  }, [open, images, active]);

  // Escape closes the lightbox first, then the studio.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') lightbox !== null ? setLightbox(null) : onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightbox, onClose]);

  const composedEditPrompt = useMemo(() => {
    const injects = IMAGE_EDIT_PRESETS.filter((p) => presetIds.has(p.id)).map(
      (p) => p.inject,
    );
    const free = editPrompt.trim();
    return [...injects, free].filter(Boolean).join('\n\n');
  }, [presetIds, editPrompt]);

  if (!open) return null;

  const addChip = (s: string) =>
    setPrompt((p) => (p.trim() ? `${p.trim()}\n${s}` : s));

  const togglePreset = (id: string) =>
    setPresetIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const generate = () =>
    run(async () => {
      const urls = await Promise.all(
        Array.from({ length: count }, () =>
          aiGenerateImage(prompt, piece.format, model || undefined),
        ),
      );
      onAddImages(urls.filter(Boolean));
    });

  const edit = () =>
    run(async () => {
      if (!seed) throw new Error('Pick a seed image first');
      if (!composedEditPrompt.trim())
        throw new Error('Add an edit instruction or pick a preset');
      const urls = await Promise.all(
        Array.from({ length: editCount }, () =>
          aiEditImage({
            prompt: composedEditPrompt,
            seed,
            references: references.length ? references : undefined,
            format: piece.format,
            model: editModel || undefined,
          }),
        ),
      );
      onAddImages(urls.filter(Boolean));
    });

  const onSeedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const dataUrl = await readFileAsDataUrl(f);
      setSeed(dataUrl);
    } catch {
      /* local read failure is rare; leave seed unchanged */
    }
  };

  const onRefFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_EDIT_REFERENCES - references.length;
    if (room <= 0) return;
    const picked = files.slice(0, room);
    const urls: string[] = [];
    for (const f of picked) {
      try {
        urls.push(await readFileAsDataUrl(f));
      } catch {
        /* skip unreadable */
      }
    }
    if (urls.length)
      setReferences((prev) => [...prev, ...urls].slice(0, MAX_EDIT_REFERENCES));
  };

  const removeReference = (index: number) =>
    setReferences((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative m-auto flex h-[92vh] w-[min(1100px,94vw)] overflow-hidden rounded-2xl border border-ink/15 bg-bone shadow-2xl">
        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-ink/10 bg-white/50 p-5">
          <div>
            <div className="font-display text-lg text-ink">Image studio</div>
            <div className="text-xs text-ink/45">
              {FORMAT_LABEL[piece.format]} {'\u00b7'} {piece.theme}
            </div>
          </div>

          <StudioTabs value={tab} onChange={setTab} />

          {tab === 'generate' ? (
            <>
              <div>
                <span className={labelCls}>Describe the scene</span>
                <textarea
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A closed notebook and a cold coffee on a kitchen counter at dawn, no people."
                  className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SCENE_CHIPS.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => addChip(s)}
                      className="rounded-full border border-ink/15 px-2 py-0.5 text-[11px] text-ink/60 hover:border-mode hover:text-mode"
                    >
                      {s.split(',')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={labelCls}>Variants</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCount((c) => Math.max(1, c - 1))}
                    className="rounded-full border border-ink/15 p-1 text-ink/70 hover:border-ink/30 disabled:opacity-40"
                    disabled={count <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-4 text-center text-sm font-semibold text-ink">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCount((c) => Math.min(MAX_VARIANTS, c + 1))}
                    className="rounded-full border border-ink/15 p-1 text-ink/70 hover:border-ink/30 disabled:opacity-40"
                    disabled={count >= MAX_VARIANTS}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between gap-2">
                <span className={labelCls}>Model</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs text-ink focus:border-mode focus:outline-none"
                >
                  <option value={AUTO_MODEL}>Auto</option>
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={generate}
                disabled={busy || !prompt.trim()}
                className={`${aiBtnSolid} justify-center`}
              >
                {busy ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
                {busy
                  ? 'Creating'
                  : `Create ${count} ${noun.toLowerCase()}${count > 1 ? 's' : ''}`}
              </button>
              <p className="-mt-2 text-[11px] text-ink/40">
                {modelLabel} {'\u00b7'} on-brand styling added
              </p>
            </>
          ) : (
            <>
              <div>
                <span className={labelCls}>Seed image</span>
                <p className="mt-1 text-[11px] text-ink/50">
                  The base image to edit. Pick from the gallery or upload one.
                </p>
                {seed ? (
                  <div className="relative mt-2 overflow-hidden rounded-xl border border-mode ring-2 ring-mode">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={seed}
                      alt="Seed"
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setSeed(null)}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-ink hover:bg-white"
                      title="Clear seed"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex aspect-square items-center justify-center rounded-xl border border-dashed border-ink/15 text-xs text-ink/40">
                    No seed selected
                  </div>
                )}
                {images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {images.map((src, i) => {
                      const on = seed === src;
                      return (
                        <button
                          key={`${src}-${i}`}
                          type="button"
                          onClick={() => setSeed(src)}
                          title={`Use gallery ${noun.toLowerCase()} ${i + 1} as seed`}
                          className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition-colors ${
                            on
                              ? 'border-mode'
                              : 'border-ink/10 hover:border-ink/30'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  ref={seedFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onSeedFile}
                />
                <button
                  type="button"
                  onClick={() => seedFileRef.current?.click()}
                  className={`${aiBtnGhost} mt-2 w-full justify-center`}
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Upload seed
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className={labelCls}>Add images</span>
                  <span className="text-[10px] text-ink/40">
                    {references.length}/{MAX_EDIT_REFERENCES}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink/50">
                  Character, logo, product, or other references sent with the
                  seed.
                </p>
                {references.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {references.map((src, i) => (
                      <div
                        key={`${src.slice(0, 32)}-${i}`}
                        className="group relative h-12 w-12 overflow-hidden rounded-lg border border-ink/15"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeReference(i)}
                          className="absolute inset-0 flex items-center justify-center bg-ink/50 opacity-0 transition-opacity group-hover:opacity-100"
                          title="Remove reference"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={refFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onRefFiles}
                />
                <button
                  type="button"
                  onClick={() => refFileRef.current?.click()}
                  disabled={references.length >= MAX_EDIT_REFERENCES}
                  className={`${aiBtnGhost} mt-2 w-full justify-center`}
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Add reference image
                </button>
              </div>

              <div>
                <span className={labelCls}>Edit presets</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {IMAGE_EDIT_PRESETS.map((p) => {
                    const on = presetIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePreset(p.id)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          on
                            ? 'border-mode bg-mode/10 font-semibold text-mode'
                            : 'border-ink/15 text-ink/60 hover:border-mode hover:text-mode'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className={labelCls}>Edit instructions</span>
                <textarea
                  rows={4}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Shift the palette cooler, add the logo bottom-right, keep the notebook as the focus."
                  className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className={labelCls}>Variants</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditCount((c) => Math.max(1, c - 1))}
                    className="rounded-full border border-ink/15 p-1 text-ink/70 hover:border-ink/30 disabled:opacity-40"
                    disabled={editCount <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-4 text-center text-sm font-semibold text-ink">
                    {editCount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditCount((c) => Math.min(MAX_VARIANTS, c + 1))
                    }
                    className="rounded-full border border-ink/15 p-1 text-ink/70 hover:border-ink/30 disabled:opacity-40"
                    disabled={editCount >= MAX_VARIANTS}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between gap-2">
                <span className={labelCls}>Model</span>
                <select
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs text-ink focus:border-mode focus:outline-none"
                >
                  <option value={AUTO_MODEL}>Auto</option>
                  {EDIT_IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={edit}
                disabled={busy || !seed || !composedEditPrompt.trim()}
                className={`${aiBtnSolid} justify-center`}
              >
                {busy ? <Spinner /> : <Wand2 className="h-3.5 w-3.5" />}
                {busy
                  ? 'Editing'
                  : `Edit ${editCount} ${noun.toLowerCase()}${editCount > 1 ? 's' : ''}`}
              </button>
              <p className="-mt-2 text-[11px] text-ink/40">
                {modelLabel} {'\u00b7'} seed + refs {'\u00b7'} on-brand styling
              </p>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className={`${aiBtnGhost} justify-center`}
          >
            <ImagePlus className="h-3.5 w-3.5" /> Upload {noun.toLowerCase()}
          </button>
          <AiError message={error} />
        </aside>

        <section className="flex-1 overflow-y-auto p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className={labelCls}>
              {noun}s{images.length > 0 ? ` \u00b7 ${images.length}` : ''}
            </span>
            <span className="text-[11px] text-ink/40">Click to enlarge</span>
          </div>

          {images.length === 0 ? (
            <div className="flex h-[70%] items-center justify-center rounded-xl border border-dashed border-ink/15 text-sm text-ink/40">
              No {noun.toLowerCase()}s yet. Describe a scene and create one, or
              switch to Edit with an uploaded seed.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {images.map((src, i) => (
                <div
                  key={i}
                  className={`group relative overflow-hidden rounded-xl border ${
                    i === active
                      ? 'border-mode ring-2 ring-mode'
                      : 'border-ink/15'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setLightbox(i)}
                    className="block w-full"
                    aria-label={`Enlarge ${noun.toLowerCase()} ${i + 1}`}
                  >
                    <PreviewMedia
                      src={src}
                      alt={`${noun} ${i + 1}`}
                      aspect={aspect}
                    />
                  </button>
                  {i === active && (
                    <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-mode px-2 py-0.5 text-[10px] font-semibold text-bone">
                      Primary
                    </span>
                  )}
                  {tab === 'edit' && seed === src && (
                    <span className="pointer-events-none absolute left-2 top-8 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-bone">
                      Seed
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {tab === 'edit' && seed !== src && (
                      <button
                        type="button"
                        onClick={() => setSeed(src)}
                        className={tileBtn}
                        title="Use as seed"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {i !== active && (
                      <button
                        type="button"
                        onClick={() => onSetIndex(i)}
                        className={tileBtn}
                        title="Set as primary"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        download(src, `${noun.toLowerCase()}-${i + 1}.png`)
                      }
                      className={tileBtn}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      className={tileBtn}
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-ink/60 hover:bg-ink/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {lightbox !== null && images[lightbox] && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center bg-ink/90 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[lightbox]}
            alt={`${noun} ${lightbox + 1}`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-ink hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};
