'use client';

/**
 * /admin/hook-bank — the visual hook library.
 *
 * A tagged, scored bank of 0.5-3s opening clips (character reactions, meme
 * intros, pattern interrupts) that mount as beat 0 on the reel timeline.
 * Upload a clip, tag the reaction it triggers, mark the rights, and it shows
 * up in the reel studio's hook rail. The score column becomes the leaderboard
 * once hooks carry real hold metrics.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  Film,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import {
  HOOK_REACTIONS,
  HOOK_RIGHTS,
  hookMatches,
  rankHooksByScore,
  type HookClip,
  type HookReaction,
  type HookRights,
} from '@/lib/mothermode/reel/hookBank';

const API = '/api/admin/hook-bank';

const REACTION_LABEL: Record<HookReaction, string> = {
  shock: 'Shock',
  laugh: 'Laugh',
  confusion: 'Confusion',
  satisfaction: 'Satisfaction',
  relatability: 'Relatable',
  chaos: 'Chaos',
  curiosity: 'Curiosity',
  awe: 'Awe',
};

const RIGHTS_LABEL: Record<HookRights, string> = {
  owned: 'Owned',
  licensed: 'Licensed',
  'meme-fair-use': 'Meme',
  unknown: 'Unknown',
};

function rightsTone(rights: HookRights): string {
  return rights === 'owned' || rights === 'licensed'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

export default function HookBankPage() {
  const [hooks, setHooks] = useState<HookClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reaction, setReaction] = useState<HookReaction | 'all'>('all');
  const [paidOnly, setPaidOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [preview, setPreview] = useState<HookClip | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API);
      const data = await res.json();
      if (data.success) setHooks(data.hooks ?? []);
      else setError(data.error || 'Load failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    let list = hooks;
    if (reaction !== 'all') list = list.filter((h) => h.reaction === reaction);
    if (paidOnly) list = list.filter((h) => h.rights === 'owned' || h.rights === 'licensed');
    list = list.filter((h) => hookMatches(h, query));
    return rankHooksByScore(list);
  }, [hooks, reaction, paidOnly, query]);

  const remove = async (id: string) => {
    setHooks((prev) => prev.filter((h) => h.id !== id));
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
  };

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Reel Studio
      </div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Hook Bank
          </h1>
          <p className="mt-2 text-bone/60 max-w-2xl">
            The first 1.5 seconds decide the scroll. Bank the reactions, meme
            intros, and pattern interrupts here — then mount one as beat 0 in
            the reel studio so the content starts on a hard cut.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink hover:bg-brass/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add hook
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-bone/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hooks, tags…"
            className="rounded-lg border border-bone/10 bg-bone/[0.03] pl-9 pr-3 py-2 text-sm text-bone placeholder:text-bone/30 focus:outline-none focus:border-brass/40 w-64"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterChip active={reaction === 'all'} onClick={() => setReaction('all')}>
            All
          </FilterChip>
          {HOOK_REACTIONS.map((r) => (
            <FilterChip key={r} active={reaction === r} onClick={() => setReaction(r)}>
              {REACTION_LABEL[r]}
            </FilterChip>
          ))}
        </div>
        <button
          onClick={() => setPaidOnly((v) => !v)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            paidOnly
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-bone/10 bg-bone/[0.03] text-bone/50 hover:text-bone/80',
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Paid-safe
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="mt-16 flex items-center justify-center gap-2 text-bone/40 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the bank…
        </div>
      ) : error ? (
        <div className="mt-10 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-16 text-center">
          <Zap className="mx-auto h-8 w-8 text-bone/20" />
          <p className="mt-3 text-sm text-bone/50">
            {hooks.length === 0
              ? 'No hooks yet. Add the first one — a reaction clip, a meme intro, a chaos cut.'
              : 'Nothing matches these filters.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visible.map((hook) => (
            <HookCard
              key={hook.id}
              hook={hook}
              onPreview={() => setPreview(hook)}
              onDelete={() => void remove(hook.id)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddHookSheet
          onClose={() => setShowAdd(false)}
          onAdded={(hook) => {
            setHooks((prev) => [hook, ...prev]);
            setShowAdd(false);
          }}
        />
      )}

      {preview && <PreviewSheet hook={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-brass/40 bg-brass/15 text-brass'
          : 'border-bone/10 bg-bone/[0.03] text-bone/50 hover:text-bone/80',
      )}
    >
      {children}
    </button>
  );
}

function HookCard({
  hook,
  onPreview,
  onDelete,
}: {
  hook: HookClip;
  onPreview: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-xl border border-bone/10 bg-bone/[0.02] overflow-hidden hover:border-brass/30 transition-colors">
      <button onClick={onPreview} className="block w-full text-left">
        <div className="relative aspect-[9/16] bg-ink/60">
          {hook.spriteUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hook.spriteUrl}
              alt={hook.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              src={hook.url}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
          {hook.hookScore != null && (
            <div className="absolute top-2 right-2 rounded-md bg-ink/80 border border-brass/30 px-1.5 py-0.5 text-[10px] font-bold text-brass">
              {hook.hookScore}
            </div>
          )}
          <div className="absolute bottom-2 left-2 right-2">
            <div className="text-xs font-medium text-bone truncate">{hook.name}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="rounded border border-bone/15 bg-ink/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-bone/60">
                {REACTION_LABEL[hook.reaction]}
              </span>
              <span
                className={clsx(
                  'rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider',
                  rightsTone(hook.rights),
                )}
              >
                {RIGHTS_LABEL[hook.rights]}
              </span>
            </div>
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-[10px] text-bone/40">
          {hook.durationSec != null ? `${hook.durationSec.toFixed(1)}s` : '—'} · {hook.source}
        </span>
        <button
          onClick={onDelete}
          className="rounded p-1 text-bone/30 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          title="Delete hook"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddHookSheet({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (hook: HookClip) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [reaction, setReaction] = useState<HookReaction>('shock');
  const [rights, setRights] = useState<HookRights>('owned');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setErr(null);
    try {
      // Reuse the reel upload-url flow: get a signed URL, PUT the file, then
      // the public URL becomes the hook's url.
      const res = await fetch('/api/admin/reel-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const data = await res.json();
      if (!data.success || !data.uploadUrl) throw new Error(data.error || 'Upload URL failed');
      await fetch(data.uploadUrl, { method: 'PUT', body: file });
      setUrl(data.publicUrl || data.uploadUrl.split('?')[0]);
      if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim() || !url.trim()) {
      setErr('Name and a clip (upload or URL) are required.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ingest',
          name: name.trim(),
          url: url.trim(),
          source: 'uploaded',
          reaction,
          rights,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success && data.hook) onAdded(data.hook);
      else setErr(data.error || 'Save failed');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-brass/20 bg-mode-deep p-6 shadow-2xl">
        <h2 className="font-display text-xl font-semibold tracking-tight">Add a hook</h2>
        <p className="mt-1 text-xs text-bone/50">
          A 0.5-3s clip that opens the reel. Upload a file or paste a URL.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-brass/70">
              Clip
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…/hook.mp4"
                className="flex-1 rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus:outline-none focus:border-brass/40"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 bg-bone/[0.04] px-3 py-2 text-xs font-medium text-bone/70 hover:border-brass/40 hover:text-bone transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f);
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-brass/70">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Laundry avalanche"
              className="mt-1.5 w-full rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus:outline-none focus:border-brass/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-brass/70">
                Reaction
              </label>
              <select
                value={reaction}
                onChange={(e) => setReaction(e.target.value as HookReaction)}
                className="mt-1.5 w-full rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm text-bone focus:outline-none focus:border-brass/40"
              >
                {HOOK_REACTIONS.map((r) => (
                  <option key={r} value={r}>
                    {REACTION_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-brass/70">
                Rights
              </label>
              <select
                value={rights}
                onChange={(e) => setRights(e.target.value as HookRights)}
                className="mt-1.5 w-full rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm text-bone focus:outline-none focus:border-brass/40"
              >
                {HOOK_RIGHTS.map((r) => (
                  <option key={r} value={r}>
                    {RIGHTS_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-brass/70">
              Tags <span className="text-bone/30 normal-case">(comma separated)</span>
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="kids, kitchen, morning"
              className="mt-1.5 w-full rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus:outline-none focus:border-brass/40"
            />
          </div>

          {err && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              {err}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="rounded-lg border border-bone/15 px-4 py-2 text-sm text-bone/60 hover:text-bone transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink hover:bg-brass/90 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add to bank
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSheet({ hook, onClose }: { hook: HookClip; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-brass/20 bg-mode-deep p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl overflow-hidden bg-ink aspect-[9/16]">
          <video src={hook.url} controls autoPlay loop className="h-full w-full object-contain" />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-bone">{hook.name}</div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="rounded border border-bone/15 bg-bone/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-bone/60">
                {REACTION_LABEL[hook.reaction]}
              </span>
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider',
                  rightsTone(hook.rights),
                )}
              >
                {hook.rights === 'owned' || hook.rights === 'licensed' ? (
                  <ShieldCheck className="h-2.5 w-2.5" />
                ) : (
                  <ShieldAlert className="h-2.5 w-2.5" />
                )}
                {RIGHTS_LABEL[hook.rights]}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-bone/15 bg-bone/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-bone/50">
                <Film className="h-2.5 w-2.5" />
                {hook.source}
              </span>
            </div>
            {hook.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {hook.tags.map((t) => (
                  <span key={t} className="rounded bg-bone/[0.05] px-1.5 py-0.5 text-[10px] text-bone/50">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          {hook.hookScore != null && (
            <div className="text-right">
              <div className="text-2xl font-bold text-brass">{hook.hookScore}</div>
              <div className="text-[9px] uppercase tracking-wider text-bone/40">hold score</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
