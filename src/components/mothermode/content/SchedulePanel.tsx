'use client';

/**
 * The content sheet's Schedule tab. Lists the social accounts connected to the
 * GoHighLevel location (via /api/mothermode/social, admin-only), prefills a
 * clean publishable caption from the computed view, and publishes now or
 * schedules for later through the GHL Social Planner.
 */
import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { CONTENT_OFFER_URL, type ContentPiece } from '@/lib/mothermode/content';
import type { PieceReview } from '@/lib/mothermode/content/review';
import { buildView } from './previews/PlatformPreview';
import type { SocialAccount } from '@/utils/integrations/social';

/** Assemble a publishable caption (no production notes) from the view. */
function buildSummary(piece: ContentPiece, review: PieceReview, link: string) {
  const v = buildView(piece, review);
  const blocks: string[] = [];
  const opener = v.caption ?? v.hook;
  if (opener) blocks.push(opener);
  if (v.body.length) blocks.push(v.body.join('\n\n'));
  if (piece.cta) blocks.push(piece.cta);
  if (link) blocks.push(link);
  if (piece.hashtags?.length)
    blocks.push(piece.hashtags.map((t) => `#${t}`).join(' '));
  return blocks.join('\n\n').trim();
}

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';

export const SchedulePanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerUrl?: string;
}> = ({ piece, review, offerUrl }) => {
  const link = piece.link ?? offerUrl ?? CONTENT_OFFER_URL;
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState(() => buildSummary(piece, review, link));
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/mothermode/social');
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setLoadError(json.error ?? `Could not load accounts (${res.status})`);
        setAccounts([]);
      } else {
        setAccounts(json.accounts ?? []);
      }
    } catch {
      setLoadError('Could not reach the scheduler');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    setBusy(true);
    setResult(null);
    const type =
      piece.format === 'story' || piece.format === 'reel' ? piece.format : 'post';
    const image = review.image ?? piece.media?.src;
    const mediaUrls =
      image && /^https?:\/\//i.test(image) ? [image] : undefined;
    try {
      const res = await fetch('/api/mothermode/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountIds: selected,
          summary,
          type,
          mediaUrls,
          scheduleDate: when || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setResult({ ok: false, msg: json.error ?? `Failed (${res.status})` });
      } else {
        setResult({
          ok: true,
          msg: json.scheduled ? 'Scheduled in GoHighLevel.' : 'Published to GoHighLevel.',
        });
      }
    } catch {
      setResult({ ok: false, msg: 'Could not reach the scheduler' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-ink/55">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading connected accounts...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-brass/40 bg-brass/10 p-3 text-sm text-ink/75">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" />
          <div>
            <p>{loadError}</p>
            <p className="mt-1 text-xs text-ink/55">
              Connect GoHighLevel under Admin then Integrations, then refresh.
            </p>
            <button
              onClick={load}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/70 hover:border-ink/30"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      )}

      {!loadError && accounts.length === 0 && (
        <p className="py-6 text-sm text-ink/55">
          No social accounts are connected in GoHighLevel yet. Connect them in
          the GHL Social Planner, then refresh.
        </p>
      )}

      {accounts.length > 0 && (
        <div>
          <span className={labelCls}>Post to</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {accounts.map((a) => {
              const on = selected.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    on
                      ? 'border-mode bg-mode/10 font-semibold text-mode'
                      : 'border-ink/15 text-ink/65 hover:border-ink/30'
                  }`}
                >
                  <span className="capitalize">{a.platform}</span> · {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="block">
        <span className={labelCls}>Post content</span>
        <textarea
          rows={8}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-3 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
        />
      </label>

      <label className="block">
        <span className={labelCls}>Schedule for (leave blank to publish now)</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink focus:border-mode focus:outline-none"
        />
      </label>

      <button
        onClick={submit}
        disabled={busy || selected.length === 0 || summary.trim() === ''}
        className="inline-flex items-center gap-2 rounded-full bg-mode px-4 py-2 text-sm font-semibold text-bone hover:bg-mode-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {when ? 'Schedule post' : 'Publish now'}
      </button>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            result.ok
              ? 'border-mode/30 bg-mode/5 text-ink/80'
              : 'border-brass/40 bg-brass/10 text-ink/80'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mode" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" />
          )}
          <p>{result.msg}</p>
        </div>
      )}
    </div>
  );
};
