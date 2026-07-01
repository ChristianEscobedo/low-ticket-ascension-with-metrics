'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2, X, Pencil, Loader2 } from 'lucide-react';
import { OFFER_MEDIA_SLOTS } from '@/lib/mothermode/offerMediaSlots';

const API = '/api/admin/mothermode-media';

/**
 * Admin-only image editor for a sales page. Detects an admin viewer by calling
 * the admin media endpoint (a 200 means admin; buyers get 401/403 and see
 * nothing). When open, each image slot can be populated by uploading a file or
 * pasting a link, and saved images publish to every buyer.
 */
export const OfferMediaEditor: React.FC<{ slug: string }> = ({ slug }) => {
  const router = useRouter();
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    fetch(`${API}?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.admin) {
          setAdmin(true);
          setMedia(d.media ?? {});
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug]);

  if (!admin) return null;

  const refresh = async () => {
    const r = await fetch(`${API}?slug=${encodeURIComponent(slug)}`);
    if (r.ok) {
      const d = await r.json();
      setMedia(d.media ?? {});
    }
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-mode px-5 py-3 text-sm font-medium text-bone shadow-lg transition hover:bg-modeDeep"
      >
        <Pencil className="h-4 w-4" />
        Edit images
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink/10 bg-bone shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
            <div>
              <h2 className="font-display text-xl text-ink">Edit page images</h2>
              <p className="mt-1 text-xs text-ink/55">
                Upload a file or paste a link. Saved images go live for everyone.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-ink/15 p-1.5 text-ink/60 transition hover:border-ink/30 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {OFFER_MEDIA_SLOTS.map((s) => (
              <SlotRow
                key={s.key}
                slug={slug}
                slot={s.key}
                label={s.label}
                hint={s.hint}
                current={media[s.key]}
                onChanged={refresh}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

interface SlotRowProps {
  slug: string;
  slot: string;
  label: string;
  hint: string;
  current?: string;
  onChanged: () => Promise<void>;
}

const SlotRow: React.FC<SlotRowProps> = ({ slug, slot, label, hint, current, onChanged }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (payload: { url?: string; base64Image?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, slot, ...payload }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'Save failed');
      setLink('');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => send({ base64Image: String(reader.result) });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}?slug=${encodeURIComponent(slug)}&slot=${slot}`, {
        method: 'DELETE',
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'Remove failed');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink/40">{hint}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-ink/10 bg-bone">
        {current ? (
          <img src={current} alt={label} className="aspect-[16/10] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center text-xs text-ink/40">
            No image yet
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/70 transition hover:border-ink/30 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {current ? 'Replace' : 'Upload'}
        </button>
        {current && (
          <button
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/60 transition hover:border-ink/30 hover:text-ink disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Paste an image link"
          className="flex-1 rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
        />
        <button
          onClick={() => link.trim() && send({ url: link.trim() })}
          disabled={busy || !link.trim()}
          className="rounded-full bg-mode px-3 py-1.5 text-xs font-medium text-bone transition hover:bg-modeDeep disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-mode">{error}</p>}
    </div>
  );
};

export default OfferMediaEditor;
