'use client';

/**
 * The content sheet's Schedule tab. Lists the social accounts connected to the
 * GoHighLevel location (via /api/mothermode/social, admin-only), prefills a
 * clean publishable caption from the computed view, and sends the post to the
 * GHL Social Planner as a **draft**, a live **schedule**, or **published now**.
 *
 * WHY THREE STATES AND NOT A CHECKBOX
 * -----------------------------------
 * A drafted post and a scheduled post both carry a date. The only thing that
 * separates them is whether GHL will fire it without anyone touching it again,
 * and that is not something a date can express. Drafting is also the normal way
 * to work: get it queued at the right time, then have someone approve it. So the
 * choice is explicit, labelled in words, and sent to GHL rather than inferred.
 *
 * Every send also writes a card to the planner, so the calendar reflects what
 * the scheduler is actually holding instead of what someone remembered to
 * mirror by hand.
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
import { PlatformPreview, buildView } from './previews/PlatformPreview';
import type { SocialAccount } from '@/utils/integrations/social';
import {
  SENDABLE_PUBLISH_STATES,
  publishStateHelp,
  publishStateLabel,
  localInputToIso,
  stageForPublishState,
  type SendablePublishState,
} from '@/lib/mothermode/planner/publishState';
import { PlatformGlyph } from '@/components/mothermode/planner/PublishBadges';

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
  /** Scopes the planner card to its offer — see the `offerSlug` note below. */
  offerSlug: string;
}> = ({ piece, review, offerUrl, offerSlug }) => {
  const link = piece.link ?? offerUrl ?? CONTENT_OFFER_URL;
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState(() => buildSummary(piece, review, link));
  const [when, setWhen] = useState('');
  // Draft is the default deliberately. The destructive option here is a post
  // going out unreviewed, so the state that needs an extra click is the live one.
  const [state, setState] = useState<SendablePublishState>('draft');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [plannerNote, setPlannerNote] = useState<string | null>(null);

  /**
   * The caption as generated. Kept so the panel can say when the box has been
   * edited away from it — the preview renders from the piece, not from this
   * textarea, and silently showing two different captions side by side is worse
   * than not showing the preview at all.
   */
  const generated = React.useMemo(
    () => buildSummary(piece, review, link),
    [piece, review, link],
  );
  const edited = summary.trim() !== generated.trim();

  /**
   * The image the preview paints. Only an absolute http(s) URL can actually ride
   * along to the scheduler, so the two are tracked separately: a local or
   * data-URL image looks attached in the preview and would silently post without
   * it.
   */
  const previewImage = review.image ?? piece.media?.src;
  const attachable =
    previewImage && /^https?:\/\//i.test(previewImage) ? previewImage : null;

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

  /**
   * Mirror the send onto the planner board.
   *
   * Deliberately best-effort and reported separately: the post is already in
   * GoHighLevel by the time this runs, so a planner failure must not read as a
   * failed send. It surfaces as its own note instead, because a card silently
   * missing from the calendar is the bug this whole feature exists to fix.
   */
  const mirrorToPlanner = async (
    sent: SendablePublishState,
    iso: string | null,
    /**
     * `''` when nothing was sent to a scheduler. The column exists precisely to
     * distinguish "GHL is holding this" from "this only exists on our board",
     * and writing 'ghl' for a planner-only card would make the drawer claim a
     * post is queued somewhere it isn't.
     */
    target: 'ghl' | '' = 'ghl',
  ) => {
    const chosen = accounts.filter((a) => selected.includes(a.id));
    const failure =
      target === 'ghl'
        ? 'Sent to GoHighLevel, but the planner card could not be updated. Open the Planner tab and refresh.'
        : 'The planner card could not be saved. Nothing was sent to a scheduler, so it is safe to try again.';

    try {
      const res = await fetch('/api/admin/mothermode-planner', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertPlan',
          pieceId: piece.id,
          /**
           * Not decoration, and not optional in practice: `offer_slug` is the
           * other half of the key the review store is scoped by, so a card saved
           * without it can never find its own edits or uploaded image. The
           * planner drawer could only show the unedited catalog copy for every
           * card mirrored from here until this was passed.
           */
          offerSlug,
          title: piece.title,
          platform: piece.platform,
          format: piece.format,
          stage: stageForPublishState(sent),
          scheduledAt: iso,
          publishState: sent,
          publishTarget: target,
          publishAccounts: chosen.map((a) => ({
            id: a.id,
            name: a.name,
            platform: a.platform,
            avatar: a.avatar,
          })),
          publishSyncedAt: new Date().toISOString(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      // The planner route answers `{ success: true, record }` — it does NOT use
      // `ok`. Checking `json.ok` here reported a failure on every single write,
      // including the 200s that had already saved the card, which is the worst
      // way to be wrong: it invites a retry and doubles the row.
      if (!res.ok || json.success !== true) {
        setPlannerNote(failure);
        return;
      }
      setPlannerNote(null);
      return true;
    } catch {
      setPlannerNote(failure);
    }
  };

  /**
   * No connected accounts means there is nothing to send to, but the piece can
   * still be planned. Without this the button sat permanently disabled with no
   * stated reason, which reads as a broken control rather than a missing
   * integration — and it blocked the planner, which doesn't need GHL at all.
   */
  const plannerOnly = accounts.length === 0;

  const submitPlannerOnly = async () => {
    setBusy(true);
    setResult(null);
    setPlannerNote(null);
    const iso =
      state === 'published' ? new Date().toISOString() : localInputToIso(when);
    const ok = await mirrorToPlanner(state, iso, '');
    if (ok) {
      setResult({
        ok: true,
        msg: `Added to the planner as ${publishStateLabel(state).toLowerCase()}. GoHighLevel is not connected, so nothing was sent to a scheduler — it will not post on its own.`,
      });
      setPlannerNote(null);
    }
    setBusy(false);
  };

  const submit = async () => {
    if (plannerOnly) return submitPlannerOnly();
    setBusy(true);
    setResult(null);
    setPlannerNote(null);
    const type =
      piece.format === 'story' || piece.format === 'reel' ? piece.format : 'post';
    const mediaUrls = attachable ? [attachable] : undefined;
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
          status: state,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setResult({ ok: false, msg: json.error ?? `Failed (${res.status})` });
      } else {
        const sent: SendablePublishState =
          json.status === 'draft' ||
          json.status === 'scheduled' ||
          json.status === 'published'
            ? json.status
            : state;
        setResult({
          ok: true,
          msg:
            sent === 'draft'
              ? 'Saved as a draft in GoHighLevel. Nothing will post until it is approved.'
              : sent === 'scheduled'
                ? 'Scheduled in GoHighLevel. It will post itself at that time.'
                : 'Published to GoHighLevel.',
        });
        // 'published' has no future date to record, so the planner gets the
        // moment it actually went out rather than an empty cell.
        await mirrorToPlanner(
          sent,
          sent === 'published'
            ? new Date().toISOString()
            : localInputToIso(when),
        );
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
                  <PlatformGlyph platform={a.platform} size={14} />
                  <span className="capitalize">{a.platform}</span> · {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* The same PlatformPreview the Preview tab renders, not a lookalike, so
          the two can't drift apart. Scheduling blind was the complaint: you were
          approving a wall of text with no idea what would actually appear. */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>Preview</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink/45">
            <PlatformGlyph platform={piece.platform} size={13} />
            <span className="capitalize">{piece.platform}</span>
            {piece.format ? <span>· {piece.format}</span> : null}
          </span>
        </div>
        <div className="mt-2 flex justify-center rounded-lg border border-ink/10 bg-white/40 p-3">
          <PlatformPreview piece={piece} review={review} />
        </div>

        {/* The preview paints from the piece, so once the caption below is
            edited it is no longer showing what will be sent. Saying so is the
            difference between a preview and a decoration. */}
        {edited && (
          <p className="mt-2 text-xs text-brass">
            The caption below has been edited, so the preview above no longer
            matches what will be sent.{' '}
            <button
              type="button"
              onClick={() => setSummary(generated)}
              className="underline hover:no-underline"
            >
              Reset it
            </button>
            .
          </p>
        )}

        {/* An image that shows in the preview but can't be attached is the
            quietest failure available here — the post goes out bare. */}
        {previewImage && !attachable && (
          <p className="mt-2 text-xs text-brass">
            The image above is not a public URL, so it cannot be attached. The
            caption will post without it.
          </p>
        )}
        {!previewImage && (
          <p className="mt-2 text-xs text-ink/45">
            No image on this piece — it will post as text only.
          </p>
        )}
      </div>

      <label className="block">
        <span className={labelCls}>Post content</span>
        <textarea
          rows={8}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-3 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
        />
        <span className="mt-1 block text-xs text-ink/45">
          This exact text is what gets sent
          {attachable ? ', with the image attached' : ''}.
        </span>
      </label>

      {/* The state picker sits *above* the date, because it changes what the
          date means: a time on a draft is an intention, a time on a schedule is
          a commitment. Reading them in the other order invites the assumption
          that picking a time is what schedules the post. */}
      <div>
        <span className={labelCls}>{plannerOnly ? 'Save as' : 'Send as'}</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {SENDABLE_PUBLISH_STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setState(s)}
              aria-pressed={state === s}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                state === s
                  ? 'border-mode bg-mode/10 font-semibold text-mode'
                  : 'border-ink/15 text-ink/65 hover:border-ink/30'
              }`}
            >
              {publishStateLabel(s)}
            </button>
          ))}
        </div>
        {/* `publishStateHelp` describes what the *scheduler* will do, which is
            not the truth when there is no scheduler attached. */}
        <p className="mt-1.5 text-xs text-ink/55">
          {plannerOnly
            ? `Records this on the planner as ${publishStateLabel(state).toLowerCase()}. Nothing is sent anywhere.`
            : publishStateHelp(state)}
        </p>
      </div>

      {/* Publishing now ignores a date, so the field is hidden rather than shown
          and quietly disregarded. */}
      {state !== 'published' && (
        <label className="block">
          <span className={labelCls}>
            {state === 'draft' ? 'Intended time (optional)' : 'Post at'}
          </span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink focus:border-mode focus:outline-none"
          />
          {state === 'scheduled' && !when && (
            <span className="mt-1.5 block text-xs text-brass">
              A scheduled post needs a time. Pick one, or send it as a draft.
            </span>
          )}
        </label>
      )}

      <button
        onClick={submit}
        disabled={
          busy ||
          (!plannerOnly && selected.length === 0) ||
          summary.trim() === '' ||
          // Guarded here as well as in the route: a "scheduled" post with no
          // time is the one combination that would silently never fire.
          (state === 'scheduled' && !when)
        }
        className="inline-flex items-center gap-2 rounded-full bg-mode px-4 py-2 text-sm font-semibold text-bone hover:bg-mode-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {plannerOnly
          ? 'Add to planner'
          : state === 'draft'
            ? 'Save as draft'
            : state === 'scheduled'
              ? 'Schedule post'
              : 'Publish now'}
      </button>

      {/* A disabled button with no stated reason is indistinguishable from a
          broken one, so whatever is blocking the send is named. */}
      {(() => {
        const reason = busy
          ? null
          : summary.trim() === ''
            ? 'Add some post content first.'
            : state === 'scheduled' && !when
              ? 'Pick a time, or send it as a draft.'
              : !plannerOnly && selected.length === 0
                ? 'Choose at least one account to post to.'
                : plannerOnly
                  ? 'GoHighLevel is not connected, so this only saves a planner card. Connect it to send the post itself.'
                  : null;
        return reason ? (
          <p className="text-xs text-ink/55">{reason}</p>
        ) : null;
      })()}

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

      {/* Separate from `result` on purpose: the post did land in GHL, and saying
          otherwise would invite someone to send it a second time. */}
      {plannerNote && (
        <div className="flex items-start gap-2 rounded-lg border border-brass/40 bg-brass/10 p-3 text-sm text-ink/80">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" />
          <p>{plannerNote}</p>
        </div>
      )}
    </div>
  );
};
