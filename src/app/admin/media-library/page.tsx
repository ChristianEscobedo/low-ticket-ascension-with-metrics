'use client';

/**
 * /admin/media-library — the advanced media library surface.
 *
 * Folder tree on the left, asset grid on the right. Every upload, generated
 * render, hub export, and Thumbnail Lab thumbnail lands here with provenance
 * and tags, so AI prompts and other surfaces can use prior media as context.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Film,
  Loader2,
  Music,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  assetMatches,
  folderCounts,
  folderTree,
  tagRollup,
  type MediaAsset,
  type MediaFolder,
  type MediaKind,
} from '@/lib/mothermode/reel/mediaLibrary';

const API = '/api/admin/media-library';

const KIND_ICON: Record<MediaKind, typeof Film> = {
  video: Film,
  image: ImageIcon,
  audio: Music,
};

const SOURCE_LABEL: Record<string, string> = {
  upload: 'upload',
  generated: 'AI',
  'thumbnail-lab': 'thumb',
  vault: 'vault',
  external: 'ext',
};

async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export default function MediaLibraryPage() {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null | undefined>(undefined); // undefined = all
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<MediaKind | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setFolders(json.folders as MediaFolder[]);
        setAssets(json.assets as MediaAsset[]);
      } else {
        setAssets([]);
      }
    } catch {
      setAssets([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => folderCounts(assets ?? [], folders), [assets, folders]);
  const tree = useMemo(() => folderTree(folders), [folders]);
  const tags = useMemo(() => tagRollup(assets ?? []).slice(0, 12), [assets]);

  const visible = useMemo(() => {
    let list = assets ?? [];
    if (activeFolder !== undefined) list = list.filter((a) => a.folderId === activeFolder);
    if (kindFilter !== 'all') list = list.filter((a) => a.kind === kindFilter);
    if (tagFilter) list = list.filter((a) => a.tags.includes(tagFilter));
    if (query.trim()) list = list.filter((a) => assetMatches(a, query));
    return list;
  }, [assets, activeFolder, kindFilter, tagFilter, query]);

  async function createFolder() {
    const name = newFolder.trim();
    if (!name) return;
    const json = await post({ action: 'createFolder', name });
    if (json?.folder) {
      setFolders((f) => [...f, json.folder as MediaFolder]);
      setNewFolder('');
      setNote(`Folder "${name}" created.`);
    }
  }

  async function deleteFolder(id: string, name: string) {
    if (!window.confirm(`Delete the folder "${name}"? Assets move to Unfiled.`)) return;
    await post({ action: 'deleteFolder', id });
    setFolders((f) => f.filter((x) => x.id !== id));
    void load();
  }

  async function deleteAsset(a: MediaAsset) {
    if (!window.confirm(`Delete "${a.name}" from the library?`)) return;
    await post({ action: 'deleteAsset', id: a.id });
    setAssets((list) => (list ?? []).filter((x) => x.id !== a.id));
    if (selected?.id === a.id) setSelected(null);
  }

  async function addTag(a: MediaAsset, tag: string) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || a.tags.includes(t)) return;
    const tags = [...a.tags, t];
    await post({ action: 'patchAsset', id: a.id, patch: { tags } });
    setAssets((list) => (list ?? []).map((x) => (x.id === a.id ? { ...x, tags } : x)));
    if (selected?.id === a.id) setSelected({ ...a, tags });
    setTagInput('');
  }

  async function removeTag(a: MediaAsset, tag: string) {
    const tags = a.tags.filter((t) => t !== tag);
    await post({ action: 'patchAsset', id: a.id, patch: { tags } });
    setAssets((list) => (list ?? []).map((x) => (x.id === a.id ? { ...x, tags } : x)));
    if (selected?.id === a.id) setSelected({ ...a, tags });
  }

  async function moveToFolder(a: MediaAsset, folderId: string | null) {
    await post({ action: 'patchAsset', id: a.id, patch: { folderId } });
    setAssets((list) => (list ?? []).map((x) => (x.id === a.id ? { ...x, folderId } : x)));
    if (selected?.id === a.id) setSelected({ ...a, folderId });
  }

  async function uploadFile(file: File) {
    const kind: MediaKind = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'image';
    // upload through the reel signed-url route, then ingest
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const mint = await fetch('/api/admin/reel-upload-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ext, contentType: file.type || undefined, kind }),
    });
    const mintJson = await mint.json();
    if (!mintJson.success) {
      setNote(mintJson.error || 'Upload failed');
      return;
    }
    const put = await fetch(mintJson.signedUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!put.ok) {
      setNote(`Upload rejected (${put.status})`);
      return;
    }
    const url = String(mintJson.publicUrl || '');
    await post({
      action: 'ingest',
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
      url,
      kind,
      source: 'upload',
      folderId: activeFolder ?? null,
      tags: [],
    });
    setNote(`"${file.name}" is in the library.`);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ImageIcon className="h-5 w-5 text-brass" />
        <h1 className="font-display text-xl font-semibold text-bone">Media Library</h1>
        <span className="text-xs text-bone/40">
          {assets?.length ?? 0} asset(s) · every upload, render, and thumbnail in one place
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bone/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or tag…"
              className="w-52 rounded-lg border border-bone/15 bg-ink py-1.5 pl-8 pr-2 text-xs text-bone/80 outline-none placeholder:text-bone/25"
            />
          </div>
          <button
            onClick={() => uploadInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brass/90"
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
          <input
            ref={uploadInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {note && (
        <p className="rounded-lg border border-brass/30 bg-brass/10 px-3 py-1.5 text-xs text-brass/90">{note}</p>
      )}

      <div className="grid grid-cols-[220px_1fr_280px] gap-4">
        {/* folder tree */}
        <div className="space-y-1 rounded-2xl border border-bone/10 bg-bone/[0.02] p-2.5">
          <button
            onClick={() => setActiveFolder(undefined)}
            className={clsx(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
              activeFolder === undefined ? 'bg-brass/15 font-semibold text-brass' : 'text-ink/60 hover:bg-bone/10',
            )}
          >
            <Folder className="h-3.5 w-3.5" /> All assets
            <span className="ml-auto text-[10px] text-bone/30">{assets?.length ?? 0}</span>
          </button>
          <button
            onClick={() => setActiveFolder(null)}
            className={clsx(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
              activeFolder === null ? 'bg-brass/15 font-semibold text-brass' : 'text-ink/60 hover:bg-bone/10',
            )}
          >
            <Folder className="h-3.5 w-3.5 opacity-50" /> Unfiled
            <span className="ml-auto text-[10px] text-bone/30">{counts.get(null) ?? 0}</span>
          </button>
          {tree.map(({ folder, children }) => (
            <div key={folder.id}>
              <div className="group flex items-center">
                <button
                  onClick={() => setActiveFolder(folder.id)}
                  className={clsx(
                    'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
                    activeFolder === folder.id ? 'bg-brass/15 font-semibold text-brass' : 'text-ink/60 hover:bg-bone/10',
                  )}
                >
                  <Folder className="h-3.5 w-3.5" style={{ color: folder.color ?? undefined }} />
                  <span className="truncate">{folder.name}</span>
                  <span className="ml-auto text-[10px] text-bone/30">{counts.get(folder.id) ?? 0}</span>
                </button>
                <button
                  onClick={() => void deleteFolder(folder.id, folder.name)}
                  className="invisible px-1 text-bone/25 hover:text-red-300 group-hover:visible"
                  title="Delete folder"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveFolder(c.id)}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-lg py-1.5 pl-7 pr-2 text-[11px]',
                    activeFolder === c.id ? 'bg-brass/15 font-semibold text-brass' : 'text-ink/50 hover:bg-bone/10',
                  )}
                >
                  <Folder className="h-3 w-3" style={{ color: c.color ?? undefined }} />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto text-[10px] text-bone/30">{counts.get(c.id) ?? 0}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="flex items-center gap-1 pt-2">
            <FolderPlus className="h-3.5 w-3.5 shrink-0 text-bone/30" />
            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createFolder();
              }}
              placeholder="new folder"
              className="min-w-0 flex-1 rounded border border-bone/15 bg-ink px-1.5 py-1 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
            />
            <button
              onClick={() => void createFolder()}
              disabled={!newFolder.trim()}
              className="rounded bg-brass px-1.5 py-1 text-[10px] font-semibold text-ink disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          {/* tag filters */}
          {tags.length > 0 && (
            <div className="border-t border-bone/10 pt-2">
              <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-bone/35">
                <Tag className="h-3 w-3" /> Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setTagFilter(tagFilter === t.tag ? null : t.tag)}
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[9px] font-semibold',
                      tagFilter === t.tag ? 'bg-brass text-ink' : 'border border-bone/15 text-ink/50 hover:bg-bone/10',
                    )}
                  >
                    {t.tag} · {t.count}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* kind filter */}
          <div className="border-t border-bone/10 pt-2">
            <div className="flex gap-1">
              {(['all', 'image', 'video', 'audio'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={clsx(
                    'flex-1 rounded px-1 py-1 text-[9px] font-semibold',
                    kindFilter === k ? 'bg-brass text-ink' : 'text-ink/45 hover:bg-bone/10',
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* asset grid */}
        <div className="grid content-start gap-2.5 rounded-2xl border border-bone/10 bg-bone/[0.02] p-3 sm:grid-cols-3 xl:grid-cols-4">
          {assets === null ? (
            <p className="col-span-full flex items-center justify-center gap-2 py-16 text-xs text-bone/40">
              <Loader2 className="h-4 w-4 animate-spin" /> Opening the library…
            </p>
          ) : visible.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed border-bone/10 px-4 py-16 text-center text-xs leading-relaxed text-bone/35">
              Nothing here yet. Upload media, or it lands here automatically when you render in the
              Content Hub, compose a reel, or export from the Thumbnail Lab.
            </p>
          ) : (
            visible.map((a) => {
              const Icon = KIND_ICON[a.kind];
              const isSelected = selected?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(isSelected ? null : a)}
                  className={clsx(
                    'group overflow-hidden rounded-xl border text-left transition-colors',
                    isSelected ? 'border-brass/60 ring-1 ring-brass/40' : 'border-bone/10 hover:border-bone/30',
                  )}
                >
                  <div className="relative aspect-video bg-black/40">
                    {a.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <Icon className="h-6 w-6 text-bone/25" />
                      </span>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-white/80">
                      {SOURCE_LABEL[a.source] ?? a.source}
                    </span>
                    {a.kind === 'video' && (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={a.url} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-[11px] font-medium text-bone/85">{a.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-bone/10 px-1.5 py-0.5 text-[8px] text-bone/50">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* detail panel */}
        <div className="space-y-3 rounded-2xl border border-bone/10 bg-bone/[0.02] p-3.5">
          {selected ? (
            <>
              <div className="overflow-hidden rounded-xl bg-black/40">
                {selected.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.url} alt={selected.name} className="w-full object-contain" />
                ) : selected.kind === 'video' ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={selected.url} controls className="w-full" />
                ) : (
                  <div className="flex h-32 items-center justify-center">
                    <Music className="h-8 w-8 text-bone/25" />
                  </div>
                )}
              </div>
              <p className="truncate text-sm font-semibold text-bone/90" title={selected.name}>
                {selected.name}
              </p>
              <button
                onClick={() => void navigator.clipboard?.writeText(selected.url)}
                className="w-full rounded-lg border border-bone/15 px-2.5 py-1.5 text-[10px] font-semibold text-bone/60 hover:bg-bone/10"
              >
                Copy URL
              </button>
              {/* folder */}
              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Folder</p>
                <select
                  value={selected.folderId ?? ''}
                  onChange={(e) => void moveToFolder(selected, e.target.value || null)}
                  className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[11px] text-bone/80"
                >
                  <option value="">Unfiled</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* tags */}
              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-bone/40">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-brass/15 px-2 py-0.5 text-[9px] font-semibold text-brass"
                    >
                      {t}
                      <button onClick={() => void removeTag(selected, t)} className="hover:text-red-300">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-1">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void addTag(selected, tagInput);
                    }}
                    placeholder="add tag"
                    className="min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink px-2 py-1 text-[10px] text-bone/80 outline-none placeholder:text-bone/25"
                  />
                  <button
                    onClick={() => void addTag(selected, tagInput)}
                    disabled={!tagInput.trim()}
                    className="rounded-lg bg-brass px-2 py-1 text-[10px] font-semibold text-ink disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => void deleteAsset(selected)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/25 px-2.5 py-1.5 text-[10px] font-semibold text-red-300/70 hover:bg-red-500/100/10"
              >
                <Trash2 className="h-3 w-3" /> Delete from library
              </button>
            </>
          ) : (
            <p className="py-16 text-center text-[11px] leading-relaxed text-bone/30">
              Select an asset to tag it, file it, copy its URL, or delete it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
