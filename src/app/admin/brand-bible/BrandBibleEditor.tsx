'use client';

import { useState } from 'react';
import type { BrandBible } from '@/lib/mothermode/brandbible/types';

type Draft = {
  id: string | null;
  name: string;
  scope: string;
  visualDirection: string;
  colorLanguage: string;
  emotion: string;
  camera: string;
  negatives: string;
};

const EMPTY: Draft = {
  id: null,
  name: '',
  scope: '',
  visualDirection: '',
  colorLanguage: '',
  emotion: '',
  camera: '',
  negatives: '',
};

function toDraft(b: BrandBible): Draft {
  return {
    id: b.id,
    name: b.name,
    scope: b.scope ?? '',
    visualDirection: b.visualDirection ?? '',
    colorLanguage: b.colorLanguage ?? '',
    emotion: b.emotion ?? '',
    camera: b.camera ?? '',
    negatives: (b.negatives ?? []).join('\n'),
  };
}

const labelCls =
  'block text-xs uppercase tracking-[0.18em] text-brass/80 font-semibold mb-1.5';
const inputCls =
  'w-full rounded-lg bg-bone/[0.04] border border-bone/15 px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus:border-brass/50 focus:outline-none';

export default function BrandBibleEditor({
  initialBibles,
}: {
  initialBibles: BrandBible[];
}) {
  const [bibles, setBibles] = useState<BrandBible[]>(initialBibles);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const startNew = () => {
    setDraft(EMPTY);
    setError(null);
  };

  const edit = (b: BrandBible) => {
    setDraft(toDraft(b));
    setError(null);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mothermode-brandbible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          name: draft.name,
          scope: draft.scope,
          visualDirection: draft.visualDirection,
          colorLanguage: draft.colorLanguage,
          emotion: draft.emotion,
          camera: draft.camera,
          negatives: draft.negatives
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Save failed');
      }
      const saved = json.item as BrandBible;
      setBibles((prev) => {
        const rest = prev.filter((b) => b.id !== saved.id);
        return [saved, ...rest];
      });
      setDraft(toDraft(saved));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: BrandBible) => {
    if (!confirm(`Delete Brand Bible "${b.name}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/mothermode-brandbible?id=${encodeURIComponent(b.id)}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Delete failed');
      }
      setBibles((prev) => prev.filter((x) => x.id !== b.id));
      if (draft.id === b.id) startNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* List */}
      <div>
        <button
          onClick={startNew}
          className="w-full rounded-lg border border-brass/30 bg-brass/[0.08] px-3 py-2 text-sm font-semibold text-brass hover:bg-brass/[0.15] transition-colors mb-3"
        >
          + New Brand Bible
        </button>
        <div className="flex flex-col gap-1">
          {bibles.length === 0 && (
            <p className="text-sm text-bone/40 px-1">No bibles yet.</p>
          )}
          {bibles.map((b) => (
            <button
              key={b.id}
              onClick={() => edit(b)}
              className={`text-left rounded-lg px-3 py-2 text-sm transition-colors border ${
                draft.id === b.id
                  ? 'bg-brass/[0.12] text-brass border-brass/25 font-semibold'
                  : 'text-bone/60 hover:text-bone hover:bg-bone/[0.05] border-transparent'
              }`}
            >
              <div className="truncate">{b.name}</div>
              {b.scope && (
                <div className="text-[11px] text-bone/35 truncate">{b.scope}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Name</label>
            <input
              className={inputCls}
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="MotherMode — Warm Documentary"
            />
          </div>
          <div>
            <label className={labelCls}>Scope</label>
            <input
              className={inputCls}
              value={draft.scope}
              onChange={(e) => set({ scope: e.target.value })}
              placeholder="mothermode (blank = global)"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Visual direction</label>
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={draft.visualDirection}
            onChange={(e) => set({ visualDirection: e.target.value })}
            placeholder="Film stock, era, lighting, grade, texture…"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Color language</label>
            <textarea
              className={`${inputCls} min-h-[70px]`}
              value={draft.colorLanguage}
              onChange={(e) => set({ colorLanguage: e.target.value })}
              placeholder="Amber highs, teal shadows, low saturation…"
            />
          </div>
          <div>
            <label className={labelCls}>Emotion</label>
            <textarea
              className={`${inputCls} min-h-[70px]`}
              value={draft.emotion}
              onChange={(e) => set({ emotion: e.target.value })}
              placeholder="Quiet, earned confidence…"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Camera grammar</label>
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={draft.camera}
            onChange={(e) => set({ camera: e.target.value })}
            placeholder="Lenses, movement, framing, pacing…"
          />
        </div>

        <div className="mt-4">
          <label className={labelCls}>Negatives (one per line)</label>
          <textarea
            className={`${inputCls} min-h-[90px]`}
            value={draft.negatives}
            onChange={(e) => set({ negatives: e.target.value })}
            placeholder={'no text overlays\nno lens flares\nno fast cuts'}
          />
          <p className="text-[11px] text-bone/35 mt-1">
            Joined into the Seedance negative prompt on every clip.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg border border-brass/40 bg-brass/[0.12] px-4 py-2 text-sm font-semibold text-brass hover:bg-brass/[0.2] transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Create bible'}
          </button>
          {draft.id && (
            <button
              onClick={() => {
                const current = bibles.find((b) => b.id === draft.id);
                if (current) remove(current);
              }}
              disabled={busy}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/[0.1] transition-colors disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
