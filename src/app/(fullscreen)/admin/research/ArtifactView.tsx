'use client';

/**
 * The artifact drawer: markdown render, in-place edit, and the handoff
 * buttons that turn the artifact into planner cards / kits / a funnel draft.
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import {
  X,
  Pencil,
  Check,
  Loader2,
  Trash2,
  CalendarDays,
  Magnet,
  Mail,
  ShoppingBag,
  ExternalLink,
  Boxes,
  History,
} from 'lucide-react';
import {
  ARTIFACT_TYPE_LABELS,
  handoffTargetsFor,
  type HandedOffRef,
  type ResearchArtifact,
  type ResearchArtifactVersion,
} from '@/lib/mothermode/research/types';
import * as client from './researchClient';
import Markdown from './Markdown';
import FunnelMapCard from './FunnelMapCard';
import { buildFunnelMap } from '@/lib/mothermode/research/funnelMap';

const TARGET_META: Record<
  HandedOffRef['kind'],
  {
    label: string;
    buildLabel?: string;
    /** The button once handed off (past tense, names the destination). */
    sentLabel: string;
    /** The busy strip while the handoff runs. */
    busyLabel: string;
    icon: typeof CalendarDays;
    href: string;
  }
> = {
  'planner-cards': { label: 'Send to Planner', sentLabel: 'Sent to Planner', busyLabel: 'Sending planner cards', icon: CalendarDays, href: '/admin/planner' },
  'leadgen-kit': { label: 'Draft Lead Gen Kit', buildLabel: 'Build Lead Gen Kit', sentLabel: 'Sent to Lead Gen', busyLabel: 'Building the lead gen kit', icon: Magnet, href: '/admin/lead-gen' },
  'email-kit': { label: 'Draft Email Kit', buildLabel: 'Build Email Kit', sentLabel: 'Sent to Email Kit', busyLabel: 'Building the email kit', icon: Mail, href: '/admin/email-marketing' },
  'sales-funnel': { label: 'Create Funnel Draft', buildLabel: 'Build Funnel', sentLabel: 'Funnel Drafted', busyLabel: 'Building the funnel pages', icon: ShoppingBag, href: '/admin/sales-funnels' },
  system: { label: 'Build Full System', sentLabel: 'System Built', busyLabel: 'Building the full system (lead magnet, opt-in, nurture kit, funnel draft, planner cards)', icon: Boxes, href: '/admin' },
};

/** Where the handed-off banner LINKS: the built thing when we know its id. */
function handedOffHref(h: HandedOffRef): string {
  if (h.kind === 'leadgen-kit' && h.id) return `/admin/lead-gen?kit=${h.id}`;
  if (h.kind === 'email-kit' && h.id) return `/admin/email-marketing?kit=${h.id}`;
  return TARGET_META[h.kind].href;
}

export default function ArtifactView({
  artifact,
  sessionId,
  onClose,
  onUpdated,
  onDeleted,
}: {
  artifact: ResearchArtifact;
  sessionId: string;
  onClose: () => void;
  onUpdated: (a: ResearchArtifact) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(artifact.markdown);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  /** Version history (lazy: fetched on first open). */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<ResearchArtifactVersion[] | null>(
    null,
  );
  const [viewingVersion, setViewingVersion] =
    useState<ResearchArtifactVersion | null>(null);

  const toggleHistory = async () => {
    const opening = !historyOpen;
    setHistoryOpen(opening);
    if (opening && versions === null) {
      try {
        setVersions(await client.listArtifactVersions(artifact.id));
      } catch {
        setVersions([]);
      }
    }
    if (!opening) setViewingVersion(null);
  };

  const save = async () => {
    setBusy('save');
    setError('');
    try {
      const updated = await client.upsertArtifact({
        id: artifact.id,
        markdown: draft,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const handoff = async (target: HandedOffRef['kind'], generate = false) => {
    setBusy(generate ? `${target}:build` : target);
    setError('');
    try {
      const res = await client.runHandoff({
        sessionId,
        artifactId: artifact.id,
        target,
        generate,
      });
      onUpdated(res.artifact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Handoff failed');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this artifact? This cannot be undone.')) return;
    setBusy('delete');
    try {
      await client.deleteArtifact(artifact.id);
      onDeleted(artifact.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(null);
    }
  };

  const targets = handoffTargetsFor(artifact.type);
  const handedOff = artifact.handedOffTo;
  /** The build map: everything this artifact became, with statuses + links. */
  const funnelMap = handedOff ? buildFunnelMap({ artifact }) : null;
  /** The busy handoff (button key: target or `${target}:build`), if any. */
  const busyHandoff =
    busy && busy !== 'save' && busy !== 'delete'
      ? (busy.replace(/:build$/, '') as HandedOffRef['kind'])
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-bone/10 bg-ink">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-bone/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass/80">
              {ARTIFACT_TYPE_LABELS[artifact.type]}
            </div>
            <h2 className="mt-0.5 truncate font-display text-xl font-semibold text-bone">
              {artifact.title || 'Untitled artifact'}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-bone/35">
              <span>
                v{artifact.version} · by {artifact.createdBy}
              </span>
              <button
                type="button"
                onClick={toggleHistory}
                className={clsx(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                  historyOpen
                    ? 'bg-brass/15 text-brass'
                    : 'text-bone/40 hover:text-bone/70',
                )}
                title="Version history: who changed what, and when"
              >
                <History className="h-3 w-3" />
                History
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-bone/50 hover:bg-bone/10 hover:text-bone"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Build-initiated strip: the handoff is running — the chat feed
            carries the initiated -> completed beats live. */}
        {busyHandoff && TARGET_META[busyHandoff] && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span>
              <span className="font-semibold">
                {TARGET_META[busyHandoff].busyLabel}…
              </span>{' '}
              initiated — the chat feed tracks it live.
            </span>
          </div>
        )}

        {/* Handed-off banner + the build map: everything this artifact
            became, with per-part statuses and editor links. */}
        {handedOff && (
          <a
            href={handedOffHref(handedOff)}
            className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-brass/25 bg-brass/10 px-3 py-2 text-sm text-brass hover:bg-brass/15"
          >
            <Check className="h-4 w-4" />
            Handed off: {handedOff.label}
            <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-70" />
          </a>
        )}
        {funnelMap && (
          <div className="mx-5 mt-2">
            <FunnelMapCard map={funnelMap} />
          </div>
        )}

        {/* Version history (append-only: who changed what, and when) */}
        {historyOpen && (
          <div className="mx-5 mt-4 rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-xs">
            {versions === null ? (
              <div className="flex items-center gap-2 py-1 text-bone/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                history.
              </div>
            ) : versions.length === 0 ? (
              <p className="py-1 text-bone/40">
                No snapshots yet. They appear the next time the content
                changes.
              </p>
            ) : (
              <ol className="space-y-1">
                {versions.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setViewingVersion(
                          viewingVersion?.id === v.id ? null : v,
                        )
                      }
                      className={clsx(
                        'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left',
                        viewingVersion?.id === v.id
                          ? 'bg-brass/15 text-brass'
                          : 'text-bone/60 hover:text-bone',
                      )}
                    >
                      <span className="font-semibold">v{v.version}</span>
                      <span className="text-bone/40">by {v.createdBy}</span>
                      {v.createdAt && (
                        <span className="ml-auto text-bone/30">
                          {v.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {viewingVersion ? (
            <div>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-brass/20 bg-brass/5 px-3 py-1.5 text-xs text-brass/90">
                Viewing v{viewingVersion.version} by{' '}
                {viewingVersion.createdBy}
                <button
                  type="button"
                  onClick={() => setViewingVersion(null)}
                  className="ml-auto underline hover:text-brass"
                >
                  back to current
                </button>
              </div>
              <Markdown>
                {viewingVersion.markdown || '*Nothing in this version.*'}
              </Markdown>
            </div>
          ) : editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-full min-h-[400px] w-full resize-none rounded-lg border border-bone/15 bg-black/30 p-3 font-mono text-sm text-bone outline-none focus:border-brass/50"
            />
          ) : (
            <Markdown>
              {artifact.markdown || '*Nothing here yet.*'}
            </Markdown>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-bone/10 px-5 py-3">
          {editing ? (
            <button
              type="button"
              onClick={save}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
            >
              {busy === 'save' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(artifact.markdown);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-3 py-1.5 text-sm text-bone/70 hover:bg-bone/10"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}

          {targets.map((target) => {
            const meta = TARGET_META[target];
            const Icon = meta.icon;
            const already = handedOff?.kind === target;
            return (
              <span key={target} className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handoff(target)}
                  disabled={busy !== null || already}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                    already
                      ? 'cursor-default border border-brass/30 text-brass'
                      : 'bg-bone/10 text-bone hover:bg-bone/15 disabled:opacity-50',
                  )}
                >
                  {busy === target ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  {already ? meta.sentLabel : meta.label}
                </button>
                {meta.buildLabel && !already && (
                  <button
                    type="button"
                    onClick={() => handoff(target, true)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
                    title="Create AND run the editor's own generation pipeline"
                  >
                    {busy === `${target}:build` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    {meta.buildLabel}
                  </button>
                )}
              </span>
            );
          })}

          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-bone/40 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
