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
} from 'lucide-react';
import {
  ARTIFACT_TYPE_LABELS,
  handoffTargetsFor,
  type HandedOffRef,
  type ResearchArtifact,
} from '@/lib/mothermode/research/types';
import * as client from './researchClient';
import Markdown from './Markdown';

const TARGET_META: Record<
  HandedOffRef['kind'],
  { label: string; buildLabel?: string; icon: typeof CalendarDays; href: string }
> = {
  'planner-cards': { label: 'Send to Planner', icon: CalendarDays, href: '/admin/planner' },
  'leadgen-kit': { label: 'Draft Lead Gen Kit', buildLabel: 'Build Lead Gen Kit', icon: Magnet, href: '/admin/lead-gen' },
  'email-kit': { label: 'Draft Email Kit', buildLabel: 'Build Email Kit', icon: Mail, href: '/admin/email-marketing' },
  'sales-funnel': { label: 'Create Funnel Draft', icon: ShoppingBag, href: '/admin/sales-funnels' },
  system: { label: 'Build Full System', icon: Boxes, href: '/admin' },
};

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

        {/* Handed-off banner */}
        {handedOff && (
          <a
            href={TARGET_META[handedOff.kind].href}
            className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-brass/25 bg-brass/10 px-3 py-2 text-sm text-brass hover:bg-brass/15"
          >
            <Check className="h-4 w-4" />
            Handed off: {handedOff.label}
            <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-70" />
          </a>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {editing ? (
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
                  {already ? 'Sent' : meta.label}
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
