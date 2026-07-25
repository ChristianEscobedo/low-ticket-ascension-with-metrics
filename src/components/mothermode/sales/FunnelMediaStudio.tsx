'use client';

/**
 * Funnel Media Studio — focused popup for one media slot on a sales funnel page.
 *
 * Supports:
 *   - Image: AI generate, AI edit (seed + refs), upload, paste URL
 *   - Video: upload (hosted to Storage), paste URL (YouTube/Vimeo/mp4)
 *
 * On Apply, writes the chosen URL back into the funnel field via onApply.
 * Designed for inline edit mode on VSL / optin / sales / upsell pages.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ImagePlus,
  Sparkles,
  Wand2,
  Upload,
  Link2,
  Video,
  Check,
  Trash2,
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
  aiHostVideo,
} from '@/components/mothermode/content/aiClient';

export type FunnelMediaKind = 'image' | 'video';

export interface FunnelMediaStudioProps {
  open: boolean;
  onClose: () => void;
  /** image or video slot */
  kind: FunnelMediaKind;
  /** Current URL in the field */
  value: string;
  /** Write the chosen URL back */
  onApply: (url: string) => void;
  /** Label shown in the header, e.g. "VSL video" */
  label?: string;
  /** Seeds AI prompt writer */
  hook?: string;
  context?: { theme?: string; tone?: string };
}

type Tab = 'generate' | 'edit' | 'upload' | 'url';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
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

export const FunnelMediaStudio: React.FC<FunnelMediaStudioProps> = ({
  open,
  onClose,
  kind,
  value,
  onApply,
  label,
  hook,
  context,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const seedFileRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);

  const defaultTab: Tab = kind === 'video' ? 'upload' : 'generate';
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(AUTO_MODEL);
  const [editModel, setEditModel] = useState(AUTO_MODEL);
  const [editPrompt, setEditPrompt] = useState('');
  const [seed, setSeed] = useState<string | null>(null);
  const [references, setReferences] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState(value || '');
  const [preview, setPreview] = useState<string>(value || '');
  const [busy, setBusy] = useState<
    null | 'prompt' | 'generate' | 'edit' | 'upload'
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(kind === 'video' ? 'upload' : 'generate');
    setUrlInput(value || '');
    setPreview(value || '');
    setError(null);
    setBusy(null);
    if (kind === 'image' && value && /^https?:\/\//i.test(value)) {
      setSeed(value);
    }
  }, [open, kind, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = label || (kind === 'video' ? 'Video' : 'Image');

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError('Write a prompt first');
      return;
    }
    setBusy('generate');
    setError(null);
    try {
      const url = await aiGenerateImage(prompt.trim(), 'feed', model || undefined);
      setPreview(url);
      setSeed(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleAiPrompt() {
    setBusy('prompt');
    setError(null);
    try {
      const prompts = await aiImagePrompts({
        count: 1,
        hook: hook || label || 'sales funnel hero image',
        context: {
          theme: context?.theme,
          tone: context?.tone,
          platform: 'web',
          format: 'feed',
        },
      });
      if (prompts[0]) setPrompt(prompts[0]);
      else setError('No prompt returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prompt failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleEdit() {
    if (!seed) {
      setError('Pick or upload a seed image first');
      return;
    }
    if (!editPrompt.trim()) {
      setError('Write an edit instruction');
      return;
    }
    setBusy('edit');
    setError(null);
    try {
      const url = await aiEditImage({
        prompt: editPrompt.trim(),
        seed,
        references,
        format: 'feed',
        model: editModel || undefined,
      });
      setPreview(url);
      setSeed(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(file: File) {
    setBusy('upload');
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (kind === 'video') {
        if (!file.type.startsWith('video/')) {
          throw new Error('Please choose a video file (mp4, webm, mov)');
        }
        const url = await aiHostVideo(dataUrl);
        setPreview(url);
        setUrlInput(url);
      } else {
        if (!file.type.startsWith('image/')) {
          throw new Error('Please choose an image file');
        }
        const url = await aiHostImage(dataUrl);
        setPreview(url);
        setSeed(url);
        setUrlInput(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleSeedUpload(file: File) {
    setBusy('upload');
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const url = await aiHostImage(dataUrl);
      setSeed(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed upload failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleRefUpload(file: File) {
    if (references.length >= MAX_EDIT_REFERENCES) {
      setError(`Max ${MAX_EDIT_REFERENCES} reference images`);
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const url = await aiHostImage(dataUrl);
      setReferences((prev) => [...prev, url].slice(0, MAX_EDIT_REFERENCES));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reference upload failed');
    } finally {
      setBusy(null);
    }
  }

  function applyUrl() {
    const u = urlInput.trim();
    if (!u) {
      setError('Paste a URL first');
      return;
    }
    setPreview(u);
    if (kind === 'image') setSeed(u);
  }

  function handleApply() {
    const out = preview.trim();
    if (!out) {
      setError('Nothing to apply — generate, upload, or paste a URL');
      return;
    }
    onApply(out);
    onClose();
  }

  function handleClear() {
    setPreview('');
    setUrlInput('');
    setSeed(null);
    onApply('');
    onClose();
  }

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'generate', label: 'Generate', show: kind === 'image' },
    { id: 'edit', label: 'Edit', show: kind === 'image' },
    { id: 'upload', label: 'Upload', show: true },
    { id: 'url', label: 'URL', show: true },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} studio`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-bone/15 bg-ink shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bone/10 px-5 py-3">
          <div className="flex items-center gap-2">
            {kind === 'video' ? (
              <Video className="h-4 w-4 text-brass" />
            ) : (
              <ImagePlus className="h-4 w-4 text-brass" />
            )}
            <h2 className="text-sm font-semibold text-bone">{title} studio</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-bone/60 hover:bg-bone/10 hover:text-bone"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-bone/10 px-5 pt-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
                  tab === t.id
                    ? 'bg-bone/10 text-brass'
                    : 'text-bone/50 hover:text-bone'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Preview */}
          <div className="mb-4 overflow-hidden rounded-xl border border-bone/10 bg-ink/60">
            {preview ? (
              kind === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(preview) ? (
                <video
                  src={preview}
                  controls
                  className="max-h-56 w-full bg-black object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-56 w-full object-contain"
                />
              )
            ) : (
              <div className="flex h-36 items-center justify-center text-xs text-bone/40">
                No media yet
              </div>
            )}
          </div>

          {error && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          {/* Generate tab */}
          {tab === 'generate' && kind === 'image' && (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className={labelCls}>Prompt</label>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={handleAiPrompt}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brass hover:underline disabled:opacity-40"
                  >
                    <Sparkles className="h-3 w-3" />
                    {busy === 'prompt' ? 'Writing…' : 'AI write prompt'}
                  </button>
                </div>
                <textarea
                  className={`${fieldCls} min-h-[88px]`}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the hero image…"
                />
              </div>
              <div>
                <label className={labelCls}>Model</label>
                <select
                  className={fieldCls}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value={AUTO_MODEL}>Auto</option>
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {m.note ? ` — ${m.note}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!!busy || !prompt.trim()}
                onClick={handleGenerate}
                className={btnPrimary}
              >
                <Wand2 className="h-4 w-4" />
                {busy === 'generate' ? 'Generating…' : 'Generate image'}
              </button>
            </div>
          )}

          {/* Edit tab */}
          {tab === 'edit' && kind === 'image' && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Seed image</label>
                <div className="flex items-center gap-2">
                  {seed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={seed}
                      alt="Seed"
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-bone/20 text-[10px] text-bone/40">
                      None
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => seedFileRef.current?.click()}
                    className={btnGhost}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {seed ? 'Replace' : 'Upload seed'}
                  </button>
                  <input
                    ref={seedFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleSeedUpload(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  References ({references.length}/{MAX_EDIT_REFERENCES})
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {references.map((r) => (
                    <div key={r} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r}
                        alt=""
                        className="h-12 w-12 rounded-md object-cover"
                      />
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-ink p-0.5 text-bone"
                        onClick={() =>
                          setReferences((prev) => prev.filter((x) => x !== r))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {references.length < MAX_EDIT_REFERENCES && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => refFileRef.current?.click()}
                      className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-bone/25 text-bone/50 hover:border-brass/50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <input
                    ref={refFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleRefUpload(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Edit instruction</label>
                <textarea
                  className={`${fieldCls} min-h-[72px]`}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Warm brass lighting, soft bokeh background…"
                />
              </div>
              <div>
                <label className={labelCls}>Model</label>
                <select
                  className={fieldCls}
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                >
                  <option value={AUTO_MODEL}>Auto</option>
                  {EDIT_IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!!busy || !seed || !editPrompt.trim()}
                onClick={handleEdit}
                className={btnPrimary}
              >
                <Wand2 className="h-4 w-4" />
                {busy === 'edit' ? 'Editing…' : 'Apply edit'}
              </button>
            </div>
          )}

          {/* Upload tab */}
          {tab === 'upload' && (
            <div className="space-y-3">
              <p className="text-xs text-bone/50">
                {kind === 'video'
                  ? 'Upload an MP4, WebM, or MOV. It will be hosted publicly so the funnel can play it.'
                  : 'Upload a PNG, JPG, or WebP. It will be hosted publicly.'}
              </p>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => fileRef.current?.click()}
                className={btnPrimary}
              >
                <Upload className="h-4 w-4" />
                {busy === 'upload'
                  ? 'Uploading…'
                  : kind === 'video'
                    ? 'Choose video'
                    : 'Choose image'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={kind === 'video' ? 'video/*' : 'image/*'}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {/* URL tab */}
          {tab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>
                  {kind === 'video'
                    ? 'Video URL (mp4, YouTube, Vimeo, Loom…)'
                    : 'Image URL'}
                </label>
                <div className="flex gap-2">
                  <input
                    className={fieldCls}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://…"
                  />
                  <button
                    type="button"
                    onClick={applyUrl}
                    className={btnGhost}
                  >
                    <Link2 className="h-4 w-4" />
                    Preview
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-bone/10 px-5 py-3">
          <button
            type="button"
            onClick={handleClear}
            className={`${btnGhost} text-red-300/80`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnGhost}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!preview.trim() || !!busy}
              onClick={handleApply}
              className={btnPrimary}
            >
              <Check className="h-4 w-4" />
              Apply to page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact trigger button for inline edit toolbars.
 * Opens FunnelMediaStudio when clicked.
 */
export function MediaStudioTrigger({
  kind,
  label,
  onClick,
}: {
  kind: FunnelMediaKind;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brass/40 bg-brass/15 px-2.5 py-1.5 text-[11px] font-semibold text-brass hover:bg-brass/25"
    >
      {kind === 'video' ? (
        <Video className="h-3.5 w-3.5" />
      ) : (
        <ImagePlus className="h-3.5 w-3.5" />
      )}
      {label || (kind === 'video' ? 'Video studio' : 'Image studio')}
    </button>
  );
}
