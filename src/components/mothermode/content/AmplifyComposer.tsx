'use client';

/**
 * The Version Composer for a Refine run. It assembles whole post versions from
 * the result pools (and the original) by picking hooks, bodies, and CTAs, shows
 * the live combination math (3 hooks x 2 bodies x 1 CTA = 6 versions), and lists
 * every built version as a preview with a voice-pass chip, Copy, Apply to the
 * editor, and Remove. Saved versions can be scheduled or published straight to
 * the GoHighLevel Social Planner from the library below.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Layers,
  Copy,
  Check,
  Plus,
  Trash2,
  Wand2,
  Save,
  Calendar,
  Send,
  RotateCcw,
  Loader2,
  Library,
  Eye,
  FileText,
  X,
  ImagePlus,
  Sparkles,
} from 'lucide-react';
import { aiBtnGhost, aiBtnSolid } from './AiControls';
import { VoiceChip } from './AmplifyPools';
import { VersionPreview } from './VersionPreview';
import { VersionChanges } from './VersionChanges';
import {
  listVersions,
  saveVersion,
  deleteVersion,
} from './versionsClient';
import { aiGenerateImage, aiImagePrompts } from './aiClient';
import { getReview, setReviewImages, loadReviews } from './reviewClient';
import { reviewImages } from '@/lib/mothermode/content/review';
import { buildImagePrompt } from '@/lib/mothermode/content/constants';
import type { SocialAccount } from '@/utils/integrations/social';
import {
  applyFixes,
  CONTENT_OFFER_URL,
  splitParas,
  versionText,
  versionCount,
  withFallback,
  buildVersions,
  makeSavedVersion,
  scheduleVersion,
  publishVersion,
  unscheduleVersion,
  sortVersions,
  countByStatus,
  VERSION_STATUS_LABEL,
  IMAGE_MODELS,
  AUTO_MODEL,
  type SavedVersion,
  type VersionStatus,
  type VersionParts,
  type AxisMode,
  type AmplifyTextDimension,
  type ContentPiece,
} from '@/lib/mothermode/content';

/** A built version: the assembled parts plus a tray id. */
interface Version extends VersionParts {
  id: string;
}

/** The most versions one Build action may create, to keep the tray sane. */
const MAX_VERSIONS = 40;

/** Tile width for a preview in the visual wall. */
const TILE_WIDTH = 264;

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';

type VersionView = 'visual' | 'text';

/** Segmented switch between the platform-preview wall and plain text cards. */
export const ViewToggle: React.FC<{
  value: VersionView;
  onChange: (v: VersionView) => void;
}> = ({ value, onChange }) => (
  <div className="inline-flex overflow-hidden rounded-lg border border-ink/15">
    {(
      [
        { v: 'visual', label: 'Visual', Icon: Eye },
        { v: 'text', label: 'Text', Icon: FileText },
      ] as const
    ).map(({ v, label, Icon }) => (
      <button
        key={v}
        type="button"
        onClick={() => onChange(v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors ${
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

/** A publishable caption for a saved version: copy, then link, then hashtags. */
function versionSummary(
  v: SavedVersion,
  piece: ContentPiece,
  link: string,
): string {
  const blocks: string[] = [];
  if (v.hook) blocks.push(v.hook);
  if (v.body.length) blocks.push(v.body.join('\n\n'));
  if (v.cta) blocks.push(v.cta);
  if (link) blocks.push(link);
  if (piece.hashtags?.length)
    blocks.push(piece.hashtags.map((t) => `#${t}`).join(' '));
  return blocks.join('\n\n').trim();
}

/** Truncate a candidate label so the picker rows stay one line. */
function clip(s: string, n = 72): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}...` : t;
}

/** A short unique id for a saved version, stable within a piece. */
function newVersionId(pieceId: string): string {
  return `${pieceId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Friendly absolute time for a scheduled version. */
function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** An ISO time as the local value a datetime-local input expects. */
function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_CHIP: Record<VersionStatus, string> = {
  draft: 'bg-ink/10 text-ink/70',
  scheduled: 'bg-brass/15 text-brass',
  published: 'bg-mode/10 text-mode',
};

/** A small status pill for a saved version. */
const StatusChip: React.FC<{ status: VersionStatus }> = ({ status }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CHIP[status]}`}
  >
    {VERSION_STATUS_LABEL[status]}
  </span>
);

/** A labelled row of checkboxes for one axis (hooks, bodies, or CTAs). */
const Picker: React.FC<{
  title: string;
  rows: { key: string; label: string; checked: boolean }[];
  onToggle: (key: string) => void;
}> = ({ title, rows, onToggle }) =>
  rows.length === 0 ? null : (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">{title}</p>
      <div className="space-y-1">
        {rows.map((r) => (
          <label
            key={r.key}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink/10 bg-white/50 px-2.5 py-1.5 text-xs text-ink/80 hover:border-ink/25"
          >
            <input
              type="checkbox"
              checked={r.checked}
              onChange={() => onToggle(r.key)}
              className="mt-0.5 accent-mode"
            />
            <span>{r.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

export const AmplifyComposer: React.FC<{
  piece: ContentPiece;
  offerSlug: string;
  pools: Partial<Record<AmplifyTextDimension, string[]>>;
  onAppendHooks: (hooks: string[]) => void;
  onUseBody: (body: string) => void;
  /** Routes the post's link when none is set on the piece. */
  offerUrl?: string;
  /** The Refine run's writer model, used to draft image scene prompts. */
  model?: string;
  /** The run's house-style guides, threaded into the image prompt stage. */
  guides?: string;
}> = ({
  piece,
  offerSlug,
  offerUrl,
  pools,
  onAppendHooks,
  onUseBody,
  model,
  guides,
}) => {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [versions, setVersions] = useState<Version[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  // Visual wall vs. plain text, and the version shown full size in the lightbox.
  const [versionView, setVersionView] = useState<VersionView>('visual');
  const [lightbox, setLightbox] = useState<VersionParts | null>(null);
  // The saved library for this piece, plus per-row busy/edit state.
  const [saved, setSaved] = useState<SavedVersion[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [libError, setLibError] = useState<string | null>(null);
  const [schedAt, setSchedAt] = useState<Record<string, string>>({});
  // GHL Social Planner: the accounts this piece's versions can post to.
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  // The image axis: a pool of hosted/catalog visuals, which are ticked, how the
  // axis combines with the copy, and the generation controls.
  const [imagePool, setImagePool] = useState<string[]>([]);
  const [imgSel, setImgSel] = useState<Set<string>>(new Set());
  const [axisMode, setAxisMode] = useState<AxisMode>('pair');
  const [imgCount, setImgCount] = useState(2);
  const [imgModel, setImgModel] = useState(AUTO_MODEL);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  // Seed the image pool from the piece's shared gallery (and its catalog still),
  // so visuals generated in the Image Studio are pickable here too.
  useEffect(() => {
    let active = true;
    const catalog =
      piece.media?.type === 'video' ? piece.media?.poster : piece.media?.src;
    void loadReviews(offerSlug).then(() => {
      if (!active) return;
      const gallery = reviewImages(getReview(offerSlug, piece.id));
      const pool: string[] = [];
      for (const u of [...(catalog ? [catalog] : []), ...gallery])
        if (u && !pool.includes(u)) pool.push(u);
      setImagePool(pool);
    });
    return () => {
      active = false;
    };
  }, [offerSlug, piece.id, piece.media]);

  // Hydrate the saved library for this piece, seeding the schedule inputs from
  // any version already scheduled so the picker shows its time.
  useEffect(() => {
    let active = true;
    listVersions(offerSlug, piece.id)
      .then((list) => {
        if (!active) return;
        setSaved(sortVersions(list));
        const seed: Record<string, string> = {};
        for (const v of list)
          if (v.scheduledFor) seed[v.id] = toLocalInput(v.scheduledFor);
        setSchedAt(seed);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [offerSlug, piece.id]);

  // Load the connected social accounts once so the library can ship versions.
  useEffect(() => {
    let active = true;
    setAccountsLoading(true);
    fetch('/api/mothermode/social')
      .then(async (r) => ({ ok: r.ok, json: await r.json().catch(() => ({})) }))
      .then(({ ok, json }) => {
        if (!active) return;
        if (!ok || json.ok !== true)
          setAccountsError(json.error ?? 'Could not load social accounts');
        else setAccounts(Array.isArray(json.accounts) ? json.accounts : []);
      })
      .catch(() => {
        if (active) setAccountsError('Could not reach the scheduler');
      })
      .finally(() => {
        if (active) setAccountsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleAccount = (id: string) =>
    setSelectedAccounts((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  const statusCounts = useMemo(() => countByStatus(saved), [saved]);
  // The source piece as version parts, the baseline every change chip diffs against.
  const original = useMemo<VersionParts>(
    () => ({ hook: piece.hook ?? '', body: piece.body ?? [], cta: piece.cta ?? '' }),
    [piece],
  );
  const toggle = (key: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const has = (key: string) => sel.has(key);

  // The effective candidate lists per axis. An axis with nothing ticked falls
  // back to the original, so the math always has at least one of each.
  const { hooks, bodies, ctas } = useMemo(() => {
    const h: string[] = [];
    if (has('h:o') && piece.hook) h.push(piece.hook);
    (pools.hooks ?? []).forEach((t, i) => has(`h:${i}`) && h.push(t));
    (pools.angles ?? []).forEach((t, i) => has(`a:${i}`) && h.push(t));
    const b: string[][] = [];
    if (has('b:o')) b.push(piece.body ?? []);
    (pools.bodies ?? []).forEach((t, i) => has(`b:${i}`) && b.push(splitParas(t)));
    const c: string[] = [];
    if (has('c:o') && piece.cta) c.push(piece.cta);
    (pools.ctas ?? []).forEach((t, i) => has(`c:${i}`) && c.push(t));
    return {
      hooks: withFallback(h, piece.hook ? [piece.hook] : []),
      bodies: withFallback(b, [piece.body ?? []]),
      ctas: withFallback(c, piece.cta ? [piece.cta] : []),
    };
  }, [sel, pools, piece]);

  // The ticked images, in pool order, are the fourth axis. None ticked leaves
  // the copy alone (versions keep the piece's default visual).
  const images = useMemo(
    () => imagePool.filter((u) => imgSel.has(u)),
    [imagePool, imgSel],
  );
  const toggleImage = (url: string) =>
    setImgSel((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });

  const count = versionCount(hooks, bodies, ctas, images, axisMode);
  const over = count > MAX_VERSIONS;

  const build = () => {
    const made = buildVersions(
      hooks,
      bodies,
      ctas,
      versions,
      images,
      axisMode,
    ).map((v, i) => ({ ...v, id: `${Date.now()}-${i}` }));
    if (made.length) setVersions((prev) => [...prev, ...made]);
  };

  // The brand/format context the scene-prompt stage writes against.
  const imgContext = useMemo(
    () => ({
      theme: piece.theme,
      tone: piece.tone,
      platform: piece.platform,
      format: piece.format,
    }),
    [piece],
  );

  // Two-stage generation: the writer model drafts N distinct scene prompts from
  // the leading hook, each is composed into a hook-anchored image prompt and
  // rendered to a hosted URL, then the renders join the pool, the selection, and
  // the piece's shared gallery so they persist and post to GoHighLevel.
  const generateImages = async () => {
    setImgBusy(true);
    setImgError(null);
    try {
      const hook = hooks[0] ?? piece.hook ?? '';
      const scenes = await aiImagePrompts({
        count: imgCount,
        hook,
        guides: guides?.trim() || undefined,
        avoid: imagePool,
        context: imgContext,
        model: model || undefined,
      });
      const urls: string[] = [];
      for (const scene of scenes) {
        const url = await aiGenerateImage(
          buildImagePrompt(scene, hook),
          piece.format,
          imgModel || undefined,
        );
        if (url) urls.push(url);
      }
      const fresh = urls.filter((u) => !imagePool.includes(u));
      if (fresh.length) {
        setImagePool((prev) => [...prev, ...fresh]);
        setImgSel((prev) => {
          const next = new Set(prev);
          for (const u of fresh) next.add(u);
          return next;
        });
        const gallery = reviewImages(getReview(offerSlug, piece.id));
        const merged = [...gallery];
        for (const u of fresh) if (!merged.includes(u)) merged.push(u);
        setReviewImages(offerSlug, piece.id, merged, 0);
      }
    } catch (e) {
      setImgError(e instanceof Error ? e.message : 'Could not generate images');
    } finally {
      setImgBusy(false);
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  };
  const apply = (v: Version) => {
    if (v.hook) onAppendHooks([v.hook]);
    if (v.body.length) onUseBody(v.body.join('\n\n'));
  };
  const remove = (id: string) =>
    setVersions((prev) => prev.filter((v) => v.id !== id));
  const fixAll = (id: string) =>
    setVersions((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              hook: applyFixes(v.hook),
              body: v.body.map(applyFixes),
              cta: applyFixes(v.cta),
            }
          : v,
      ),
    );

  // Apply a saved-version change locally and persist it, rolling back the local
  // state if the write fails. Throws so callers can react (for example, only
  // after a successful GHL push).
  const commitSaved = async (next: SavedVersion) => {
    const prev = saved;
    setSaved((list) =>
      sortVersions(list.map((x) => (x.id === next.id ? next : x))),
    );
    try {
      await saveVersion(offerSlug, piece.id, next);
    } catch (e) {
      setSaved(prev);
      throw e;
    }
  };

  // A status-only change (reset, voice fix) with row busy and inline error.
  const persistSaved = async (next: SavedVersion) => {
    setBusyId(next.id);
    setLibError(null);
    try {
      await commitSaved(next);
    } catch (e) {
      setLibError(e instanceof Error ? e.message : 'Could not update version');
    } finally {
      setBusyId((b) => (b === next.id ? null : b));
    }
  };

  // The publishable shape for this piece's versions: link, native type, image.
  const link = piece.link ?? offerUrl ?? CONTENT_OFFER_URL;
  const postType: 'post' | 'story' | 'reel' =
    piece.format === 'story' || piece.format === 'reel' ? piece.format : 'post';
  const image = piece.media?.src;
  // The hosted media a version posts with: its own generated image wins when it
  // is a public URL, else the piece's default still (only http(s) posts to GHL).
  const versionMedia = (v: SavedVersion): string[] | undefined => {
    const pick = v.image && /^https?:\/\//i.test(v.image) ? v.image : image;
    return pick && /^https?:\/\//i.test(pick) ? [pick] : undefined;
  };

  // Push one version to the GoHighLevel Social Planner. With a scheduleDate it
  // schedules; without one it publishes now. Throws on any failure.
  const pushToGhl = async (
    v: SavedVersion,
    scheduleDate?: string,
  ): Promise<void> => {
    const res = await fetch('/api/mothermode/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accountIds: selectedAccounts,
        summary: versionSummary(v, piece, link),
        type: postType,
        mediaUrls: versionMedia(v),
        scheduleDate,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.ok !== true) {
      throw new Error(
        typeof json.error === 'string' ? json.error : `Failed (${res.status})`,
      );
    }
  };

  // Add a built version to the saved library as a draft.
  const saveToLibrary = async (v: Version) => {
    const sv = makeSavedVersion(v, newVersionId(piece.id), new Date().toISOString());
    setSavingId(v.id);
    setLibError(null);
    const prev = saved;
    setSaved((list) => sortVersions([sv, ...list]));
    try {
      await saveVersion(offerSlug, piece.id, sv);
    } catch (e) {
      setLibError(e instanceof Error ? e.message : 'Could not save version');
      setSaved(prev);
    } finally {
      setSavingId((s) => (s === v.id ? null : s));
    }
  };

  const now = () => new Date().toISOString();

  // Schedule a version: push it to GHL for the chosen time, then record the
  // scheduled status locally. Needs a time and at least one account.
  const schedule = async (v: SavedVersion) => {
    const at = schedAt[v.id];
    if (!at || selectedAccounts.length === 0) return;
    const iso = new Date(at).toISOString();
    setBusyId(v.id);
    setLibError(null);
    try {
      await pushToGhl(v, iso);
      await commitSaved(scheduleVersion(v, iso, now()));
    } catch (e) {
      setLibError(
        e instanceof Error ? e.message : 'Could not schedule to GoHighLevel',
      );
    } finally {
      setBusyId((b) => (b === v.id ? null : b));
    }
  };

  // Publish a version now: push it live to GHL, then record it published.
  const publish = async (v: SavedVersion) => {
    if (selectedAccounts.length === 0) return;
    setBusyId(v.id);
    setLibError(null);
    try {
      await pushToGhl(v);
      await commitSaved(publishVersion(v, now()));
    } catch (e) {
      setLibError(
        e instanceof Error ? e.message : 'Could not publish to GoHighLevel',
      );
    } finally {
      setBusyId((b) => (b === v.id ? null : b));
    }
  };

  const reset = (v: SavedVersion) =>
    void persistSaved(unscheduleVersion(v, now()));
  const fixSaved = (v: SavedVersion) =>
    void persistSaved({
      ...v,
      hook: applyFixes(v.hook),
      body: v.body.map(applyFixes),
      cta: applyFixes(v.cta),
      updatedAt: now(),
    });

  // Remove a saved version from the library.
  const removeSaved = async (id: string) => {
    setBusyId(id);
    setLibError(null);
    const prev = saved;
    setSaved((list) => list.filter((x) => x.id !== id));
    try {
      await deleteVersion(id);
    } catch (e) {
      setLibError(e instanceof Error ? e.message : 'Could not delete version');
      setSaved(prev);
    } finally {
      setBusyId((b) => (b === id ? null : b));
    }
  };

  const hookRows = [
    ...(piece.hook ? [{ key: 'h:o', label: `Original: ${clip(piece.hook)}`, checked: has('h:o') }] : []),
    ...(pools.hooks ?? []).map((t, i) => ({ key: `h:${i}`, label: clip(t), checked: has(`h:${i}`) })),
    ...(pools.angles ?? []).map((t, i) => ({ key: `a:${i}`, label: `Angle: ${clip(t)}`, checked: has(`a:${i}`) })),
  ];
  const bodyRows = [
    ...(piece.body?.length ? [{ key: 'b:o', label: `Original body (${piece.body.length} paras)`, checked: has('b:o') }] : []),
    ...(pools.bodies ?? []).map((t, i) => ({ key: `b:${i}`, label: clip(t), checked: has(`b:${i}`) })),
  ];
  const ctaRows = [
    ...(piece.cta ? [{ key: 'c:o', label: `Original: ${clip(piece.cta)}`, checked: has('c:o') }] : []),
    ...(pools.ctas ?? []).map((t, i) => ({ key: `c:${i}`, label: clip(t), checked: has(`c:${i}`) })),
  ];

  // The action row shared by a built version's visual tile and text card.
  const builtActions = (v: Version) => (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => copy(v.id, versionText(v))} className={aiBtnGhost}>
        {copied === v.id ? (
          <Check className="h-3.5 w-3.5 text-brass" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied === v.id ? 'Copied' : 'Copy'}
      </button>
      <button onClick={() => apply(v)} className={aiBtnGhost}>
        <Plus className="h-3.5 w-3.5" />
        Apply to editor
      </button>
      <button onClick={() => fixAll(v.id)} className={aiBtnGhost}>
        <Wand2 className="h-3.5 w-3.5" />
        Fix voice
      </button>
      <button
        onClick={() => saveToLibrary(v)}
        disabled={savingId === v.id}
        className={aiBtnGhost}
      >
        {savingId === v.id ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        Save to library
      </button>
      <button onClick={() => remove(v.id)} className={`${aiBtnGhost} ml-auto`}>
        <Trash2 className="h-3.5 w-3.5" />
        Remove
      </button>
    </div>
  );

  return (
    <div className="space-y-4 rounded-xl border border-ink/12 bg-bone/40 p-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-mode" />
        <h4 className="text-sm font-semibold text-ink">Compose versions</h4>
        {(versions.length > 0 || saved.length > 0) && (
          <div className="ml-auto flex items-center gap-2">
            {versions.length > 0 && (
              <span className="rounded-full bg-mode/10 px-2 py-0.5 text-[11px] font-semibold text-mode">
                {versions.length} built
              </span>
            )}
            <ViewToggle value={versionView} onChange={setVersionView} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Picker title="Hooks" rows={hookRows} onToggle={toggle} />
        <Picker title="Bodies" rows={bodyRows} onToggle={toggle} />
        <Picker title="CTAs" rows={ctaRows} onToggle={toggle} />
      </div>

      <div className="space-y-2 rounded-lg border border-ink/10 bg-white/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <ImagePlus className="h-4 w-4 text-mode" />
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Images
          </p>
          {images.length > 0 && (
            <span className="rounded-full bg-mode/10 px-2 py-0.5 text-[10px] font-semibold text-mode">
              {images.length} ticked
            </span>
          )}
          {imagePool.length > 0 && (
            <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-ink/15">
              {(['pair', 'multiply'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAxisMode(m)}
                  title={
                    m === 'pair'
                      ? 'Cycle one image per version (keeps the count)'
                      : 'Every copy version against every image'
                  }
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    axisMode === m
                      ? 'bg-mode/10 font-semibold text-mode'
                      : 'text-ink/55 hover:text-ink/80'
                  }`}
                >
                  {m === 'pair' ? 'Pair' : 'Multiply'}
                </button>
              ))}
            </div>
          )}
        </div>

        {imagePool.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {imagePool.map((url) => {
              const on = imgSel.has(url);
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => toggleImage(url)}
                  title={on ? 'Ticked' : 'Tick to use this image'}
                  className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors ${
                    on ? 'border-mode' : 'border-ink/10 hover:border-ink/30'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute right-0.5 top-0.5 rounded-full bg-mode p-0.5 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-ink/55">
            No images yet. Generate a few below, or add them in the Image Studio.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-ink/55">How many</span>
          <input
            type="number"
            min={1}
            max={6}
            value={imgCount}
            onChange={(e) =>
              setImgCount(Math.max(1, Math.min(6, Number(e.target.value) || 1)))
            }
            className="w-14 rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs text-ink focus:border-mode focus:outline-none"
          />
          <span className="text-[11px] text-ink/55">with</span>
          <select
            value={imgModel}
            onChange={(e) => setImgModel(e.target.value)}
            title="Image model"
            className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs text-ink focus:border-mode focus:outline-none"
          >
            <option value={AUTO_MODEL}>Auto</option>
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.note ? ` (${m.note})` : ''}
              </option>
            ))}
          </select>
          <button onClick={generateImages} disabled={imgBusy} className={aiBtnGhost}>
            {imgBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {imgBusy
              ? 'Generating...'
              : `Generate ${imgCount} ${imgCount === 1 ? 'image' : 'images'}`}
          </button>
          <span className="text-[10px] text-ink/45">
            Anchored to {clip(hooks[0] ?? piece.hook ?? '', 36)}
          </span>
        </div>
        {imgError && <p className="text-xs text-brass">{imgError}</p>}
      </div>

      <p className="text-xs text-ink/60">
        {hooks.length} {hooks.length === 1 ? 'hook' : 'hooks'} x {bodies.length}{' '}
        {bodies.length === 1 ? 'body' : 'bodies'} x {ctas.length}{' '}
        {ctas.length === 1 ? 'CTA' : 'CTAs'}
        {images.length > 0 && (
          <>
            {' '}
            {axisMode === 'pair' ? 'paired with' : 'x'} {images.length}{' '}
            {images.length === 1 ? 'image' : 'images'}
          </>
        )}{' '}
        ={' '}
        <span className={over ? 'font-semibold text-mode' : 'font-semibold text-ink'}>
          {count} {count === 1 ? 'version' : 'versions'}
        </span>
        {over ? `. Narrow the picks to ${MAX_VERSIONS} or fewer.` : '. Tick parts, then build.'}
      </p>

      <button
        onClick={build}
        disabled={count === 0 || over}
        className={`${aiBtnSolid} w-full justify-center py-2`}
      >
        <Layers className="h-4 w-4" />
        Build {count} {count === 1 ? 'version' : 'versions'}
      </button>

      {versions.length > 0 &&
        (versionView === 'visual' ? (
          <div className="flex flex-wrap gap-5">
            {versions.map((v, i) => (
              <div key={v.id} style={{ width: TILE_WIDTH }} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
                    Version {i + 1}
                  </span>
                  <span className="ml-auto">
                    <VoiceChip text={versionText(v)} onFix={() => fixAll(v.id)} />
                  </span>
                </div>
                <VersionPreview
                  piece={piece}
                  version={v}
                  width={TILE_WIDTH}
                  onEnlarge={() => setLightbox(v)}
                />
                <VersionChanges original={original} version={v} />
                {builtActions(v)}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((v, i) => (
              <div key={v.id} className="rounded-lg border border-ink/12 bg-white/70 p-3 text-sm text-ink">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
                    Version {i + 1} of {versions.length}
                  </span>
                  <span className="ml-auto">
                    <VoiceChip text={versionText(v)} onFix={() => fixAll(v.id)} />
                  </span>
                </div>
                <p className="font-semibold">{v.hook}</p>
                {v.body.map((p, j) => (
                  <p key={j} className="mt-1 whitespace-pre-line text-ink/80">
                    {p}
                  </p>
                ))}
                {v.cta && <p className="mt-2 text-mode">{v.cta}</p>}
                <div className="mt-2">
                  <VersionChanges original={original} version={v} />
                </div>
                <div className="mt-2">{builtActions(v)}</div>
              </div>
            ))}
          </div>
        ))}

      {saved.length > 0 && (
        <div className="space-y-3 border-t border-ink/12 pt-4">
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-mode" />
            <h4 className="text-sm font-semibold text-ink">Library</h4>
            <span className="ml-auto text-[11px] text-ink/55">
              {statusCounts.scheduled} scheduled {'\u00b7'} {statusCounts.draft} saved{' '}
              {'\u00b7'} {statusCounts.published} published
            </span>
          </div>

          <div>
            <span className={labelCls}>Post to</span>
            {accounts.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {accounts.map((a) => {
                  const on = selectedAccounts.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAccount(a.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        on
                          ? 'border-mode bg-mode/10 font-semibold text-mode'
                          : 'border-ink/15 text-ink/65 hover:border-ink/30'
                      }`}
                    >
                      <span className="capitalize">{a.platform}</span> {'\u00b7'}{' '}
                      {a.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-ink/55">
                {accountsLoading
                  ? 'Loading connected accounts...'
                  : `${accountsError ?? 'No social accounts connected in GoHighLevel.'} Connect them to schedule or publish.`}
              </p>
            )}
          </div>

          {libError && <p className="text-xs text-brass">{libError}</p>}
          {saved.map((v) => (
            <div key={v.id} className="rounded-lg border border-ink/12 bg-white/70 p-3 text-sm text-ink">
              <div className="mb-2 flex items-center gap-2">
                <StatusChip status={v.status} />
                {v.status === 'scheduled' && v.scheduledFor && (
                  <span className="text-[11px] text-ink/55">
                    {formatWhen(v.scheduledFor)}
                  </span>
                )}
                <span className="ml-auto">
                  <VoiceChip text={versionText(v)} onFix={() => fixSaved(v)} />
                </span>
              </div>
              {versionView === 'visual' ? (
                <VersionPreview
                  piece={piece}
                  version={v}
                  width={TILE_WIDTH}
                  onEnlarge={() => setLightbox(v)}
                />
              ) : (
                <>
                  <p className="font-semibold">{v.hook}</p>
                  {v.body.map((p, j) => (
                    <p key={j} className="mt-1 whitespace-pre-line text-ink/80">
                      {p}
                    </p>
                  ))}
                  {v.cta && <p className="mt-2 text-mode">{v.cta}</p>}
                </>
              )}
              <div className="mt-2">
                <VersionChanges original={original} version={v} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={schedAt[v.id] ?? ''}
                  onChange={(e) =>
                    setSchedAt((s) => ({ ...s, [v.id]: e.target.value }))
                  }
                  className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs text-ink focus:border-mode focus:outline-none"
                />
                <button
                  onClick={() => schedule(v)}
                  disabled={
                    !schedAt[v.id] ||
                    busyId === v.id ||
                    selectedAccounts.length === 0
                  }
                  className={aiBtnGhost}
                >
                  {busyId === v.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Calendar className="h-3.5 w-3.5" />
                  )}
                  Schedule
                </button>
                <button
                  onClick={() => publish(v)}
                  disabled={
                    busyId === v.id ||
                    v.status === 'published' ||
                    selectedAccounts.length === 0
                  }
                  className={aiBtnGhost}
                >
                  {busyId === v.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Publish now
                </button>
                {v.status !== 'draft' && (
                  <button onClick={() => reset(v)} disabled={busyId === v.id} className={aiBtnGhost}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to draft
                  </button>
                )}
                <button
                  onClick={() => removeSaved(v.id)}
                  disabled={busyId === v.id}
                  className={`${aiBtnGhost} ml-auto`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto">
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-ink shadow-sm hover:bg-white"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <VersionPreview piece={piece} version={lightbox} />
            <div className="mt-3 rounded-lg bg-white/90 p-3 shadow-sm">
              <VersionChanges original={original} version={lightbox} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
