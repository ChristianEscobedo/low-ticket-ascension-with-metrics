'use client';

/**
 * Per-email Image Studio for the Email Marketing Kit editor.
 *
 * A focused, email-shaped popup (not coupled to ContentPiece like the content
 * hub's ImageStudioModal). It lets an admin, for one email:
 *   - Generate tab: write a prompt (or have AI draft one from the subject) and
 *     generate a hero image.
 *   - Edit tab: pick/upload a seed image, attach up to MAX_EDIT_REFERENCES
 *     reference images for seeding/context, and AI-edit the seed.
 * Every result and every upload is a hosted public URL, appended to the email's
 * `images[]` (first = primary/hero). The gallery lets you set-primary, download,
 * or remove.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ImagePlus,
  Sparkles,
  Wand2,
  Trash2,
  Star,
  Download,
  PenLine,
  FileInput,
} from 'lucide-react';

import {
  IMAGE_MODELS,
  EDIT_IMAGE_MODELS,
  AUTO_MODEL,
  MAX_EDIT_REFERENCES,
} from '@/lib/mothermode/content';
import {
  aiGenerateImage,
  aiEditImage,
  aiImagePrompts,
  aiHostImage,
} from '@/components/mothermode/content/aiClient';
import { downloadUrl } from '@/utils/mothermode/download';

type Tab = 'generate' | 'edit';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Current email.images. */
  images: string[];
  /** Write the next images array back onto the email. */
  onChange: (next: string[]) => void;
  /** Seeds the "AI write prompt" call (email subject or summary). */
  hook?: string;
  /** Light context for the prompt writer. */
  context?: { theme?: string; tone?: string };
  /**
   * When provided, each gallery image shows an "Insert into body" action that
   * appends the image at the end of the email body (the editor handles the
   * actual `<img>` insertion + rich-text sync).
   */
  onInsertToBody?: (src: string) => void;
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

const labelCls =
  'block text-[11px] uppercase tracking-wider text-bone/50 mb-1 font-semibold';
const fieldCls =
  'w-full rounded-lg bg-ink/50 border border-bone/15 px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus:outline-none focus:border-brass/60';
const btn =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-brass text-ink hover:bg-brass/90`;
const btnGhost = `${btn} border border-bone/20 text-bone hover:border-brass/50`;
const tileBtn = 'rounded-full bg-white/90 p-1.5 text-ink hover:bg-white';

export const EmailImageStudio: React.FC<Props> = ({
  open,
  onClose,
  images,
  onChange,
  hook,
  context,
  onInsertToBody,
}) => {
  const seedFileRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('generate');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(AUTO_MODEL);
  const [editModel, setEditModel] = useState(AUTO_MODEL);
  const [editPrompt, setEditPrompt] = useState('');
  const [seed, setSeed] = useState<string | null>(null);
  const [references, setReferences] = useState<string[]>([]);
  const [busy, setBusy] = useState<null | 'prompt' | 'generate' | 'edit' | 'upload'>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Default the seed to the primary image whenever the studio opens / gallery changes.
  useEffect(() => {
    if (!open) return;
    setSeed((prev) => {
      if (prev && images.includes(prev)) return prev;
      return images[0] ?? null;
    });
  }, [open, images]);

  // Escape closes the lightbox first, then the studio.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') lightbox ? setLightbox(null) : onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightbox, onClose]);

  if (!open) return null;

  async function run<T>(kind: NonNullable<typeof busy>, fn: () => Promise<T>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  const writePrompt = () =>
    run('prompt', async () => {
      const prompts = await aiImagePrompts({
        count: 1,
        hook: hook?.trim() || 'A warm, on-brand hero image for a marketing email',
        context: context
          ? { theme: context.theme, tone: context.tone }
          : undefined,
      });
      if (prompts[0]) setPrompt(prompts[0]);
    });

  const generate = () =>
    run('generate', async () => {
      if (!prompt.trim()) throw new Error('Describe the image first');
      const url = await aiGenerateImage(prompt, 'feed', model || undefined);
      if (url) onChange([...images, url]);
    });

  const edit = () =>
    run('edit', async () => {
      if (!seed) throw new Error('Pick or upload a seed image first');
      if (!editPrompt.trim()) throw new Error('Add an edit instruction');
      const url = await aiEditImage({
        prompt: editPrompt,
        seed,
        references: references.length ? references : undefined,
        format: 'feed',
        model: editModel || undefined,
      });
      if (url) onChange([...images, url]);
    });

  const onSeedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    run('upload', async () => {
      const dataUrl = await readFileAsDataUrl(f);
      const hosted = await aiHostImage(dataUrl);
      setSeed(hosted);
      // Also add uploaded seeds to the gallery so they can be reused/saved.
      if (!images.includes(hosted)) onChange([...images, hosted]);
    });
  };

  const onRefFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_EDIT_REFERENCES - references.length;
    if (room <= 0) return;
    run('upload', async () => {
      const picked = files.slice(0, room);
      const hosted: string[] = [];
      for (const f of picked) {
        try {
          hosted.push(await aiHostImage(await readFileAsDataUrl(f)));
        } catch {
          /* skip unreadable */
        }
      }
      if (hosted.length)
        setReferences((prev) =>
          [...prev, ...hosted].slice(0, MAX_EDIT_REFERENCES),
        );
    });
  };

  const setPrimary = (src: string) =>
    onChange([src, ...images.filter((s) => s !== src)]);
  const removeImage = (src: string) =>
    onChange(images.filter((s) => s !== src));
  const removeReference = (i: number) =>
    setReferences((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative m-auto flex h-[90vh] w-[min(980px,94vw)] overflow-hidden rounded-2xl border border-bone/15 bg-ink shadow-2xl">
        {/* Left: compose rail */}
        <aside className="flex w-[22rem] shrink-0 flex-col border-r border-bone/10 bg-ink/60">
          <div className="shrink-0 space-y-3 border-b border-bone/10 px-5 pb-3 pt-5">
            <div>
              <div className="font-display text-lg text-bone">Email image</div>
              <div className="text-xs text-bone/40">
                Generate or edit a hero image for this email.
              </div>
            </div>
            <div
              role="tablist"
              className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-bone/15 bg-bone/10"
            >
              {(
                [
                  { v: 'generate' as const, label: 'Generate', Icon: Sparkles },
                  { v: 'edit' as const, label: 'Edit', Icon: Wand2 },
                ] as const
              ).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={tab === v}
                  onClick={() => setTab(v)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold transition-colors ${
                    tab === v
                      ? 'bg-brass/20 text-brass'
                      : 'bg-ink/40 text-bone/55 hover:text-bone/80'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {tab === 'generate' ? (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <span className={labelCls}>Describe the image</span>
                    <button
                      type="button"
                      onClick={writePrompt}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1 text-[11px] text-brass hover:text-brass/80 disabled:opacity-40"
                      title="Draft a prompt from this email's subject"
                    >
                      <PenLine className="h-3 w-3" />
                      {busy === 'prompt' ? 'Writing…' : 'Write with AI'}
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A warm flat-lay of a planner and coffee on a linen surface, soft morning light, no people."
                    className={fieldCls}
                  />
                </div>
                <label>
                  <span className={labelCls}>Model</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className={fieldCls}
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
                  type="button"
                  onClick={generate}
                  disabled={busy !== null || !prompt.trim()}
                  className={btnPrimary}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {busy === 'generate' ? 'Creating…' : 'Generate image'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <span className={labelCls}>Seed image</span>
                  <p className="mb-2 text-[11px] text-bone/45">
                    The base image to edit. Pick one below or upload.
                  </p>
                  {seed ? (
                    <div className="relative overflow-hidden rounded-xl border border-brass ring-1 ring-brass/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={seed}
                        alt="Seed"
                        className="aspect-video w-full object-cover"
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
                    <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-bone/15 text-xs text-bone/40">
                      No seed selected
                    </div>
                  )}
                  {images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {images.map((src, i) => (
                        <button
                          key={`${src}-${i}`}
                          type="button"
                          onClick={() => setSeed(src)}
                          className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition-colors ${
                            seed === src
                              ? 'border-brass'
                              : 'border-bone/10 hover:border-bone/30'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
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
                    disabled={busy !== null}
                    className={`${btnGhost} mt-2 w-full`}
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> Upload seed
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className={labelCls}>Reference images</span>
                    <span className="text-[10px] text-bone/40">
                      {references.length}/{MAX_EDIT_REFERENCES}
                    </span>
                  </div>
                  <p className="mb-2 text-[11px] text-bone/45">
                    Extra images for seeding/context (logo, product, style) sent
                    along with the seed.
                  </p>
                  {references.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {references.map((src, i) => (
                        <div
                          key={`${src.slice(0, 24)}-${i}`}
                          className="group relative h-12 w-12 overflow-hidden rounded-lg border border-bone/15"
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
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
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
                    disabled={busy !== null || references.length >= MAX_EDIT_REFERENCES}
                    className={`${btnGhost} w-full`}
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> Add reference image
                  </button>
                </div>

                <div>
                  <span className={labelCls}>Edit instructions</span>
                  <textarea
                    rows={4}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="e.g. Shift the palette warmer, add the logo bottom-right, keep the planner as the focus."
                    className={fieldCls}
                  />
                </div>
                <label>
                  <span className={labelCls}>Model</span>
                  <select
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className={fieldCls}
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
                  type="button"
                  onClick={edit}
                  disabled={busy !== null || !seed || !editPrompt.trim()}
                  className={btnPrimary}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {busy === 'edit' ? 'Editing…' : 'Edit image'}
                </button>
              </>
            )}

            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
          </div>
        </aside>

        {/* Right: gallery */}
        <section className="flex-1 overflow-y-auto p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className={labelCls}>
              Images{images.length > 0 ? ` · ${images.length}` : ''}
            </span>
            <span className="text-[11px] text-bone/40">
              First image is the hero
            </span>
          </div>
          {images.length === 0 ? (
            <div className="flex h-[70%] items-center justify-center rounded-xl border border-dashed border-bone/15 text-sm text-bone/40">
              No images yet. Generate one, or upload a seed on the Edit tab.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {images.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className={`group relative overflow-hidden rounded-xl border ${
                    i === 0 ? 'border-brass ring-1 ring-brass/40' : 'border-bone/15'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setLightbox(src)}
                    className="block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Image ${i + 1}`}
                      className="aspect-video w-full bg-ink/40 object-cover"
                    />
                  </button>
                  {i === 0 && (
                    <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-brass px-2 py-0.5 text-[10px] font-semibold text-ink">
                      Hero
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {onInsertToBody && (
                      <button
                        type="button"
                        onClick={() => onInsertToBody(src)}
                        className={tileBtn}
                        title="Insert into email body"
                      >
                        <FileInput className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => setPrimary(src)}
                        className={tileBtn}
                        title="Set as hero"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void downloadUrl(src, `email-image-${i + 1}.png`)}
                      className={tileBtn}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(src)}
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
          className="absolute right-3 top-3 rounded-full p-1.5 text-bone/60 hover:bg-bone/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {lightbox && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Preview"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default EmailImageStudio;
