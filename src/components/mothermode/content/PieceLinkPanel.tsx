'use client';

/**
 * Tracked link for a single hub piece — mint it, see it, copy it, see what it did.
 *
 * This is the "assign a UTM on the post" half of the feature; the export half
 * reads the same map (`pieceLinks.ts`), which is why minting here makes the next
 * CSV carry the link with no further action.
 *
 * WHY IT REUSES `suggestUtm` AND NEVER LETS YOU EDIT `utm_content`
 * ---------------------------------------------------------------
 * `utm_content` **is** the piece id. That equality is the entire join: the
 * planner's link table, the lead's captured UTMs, and the export bridge all find
 * each other through it. A free-text box here would eventually be typed into,
 * and the resulting link would look perfect while attributing nothing. So it is
 * rendered as read-only fact, not as a field.
 *
 * `planId` is deliberately omitted. The API treats it as optional, and a hub
 * piece often has no planner card — requiring one would mean you couldn't track a
 * post until you'd also scheduled it, which is backwards.
 *
 * WHY THE NUMBERS ARE HERE AND NOT ONLY ON /admin/funnel-stats
 * -----------------------------------------------------------
 * funnel-stats answers "which offer is selling"; this panel answers "did THIS
 * post do anything". The second question is the one that changes what an admin
 * writes next, and it has to be answerable at the moment they're looking at the
 * post — not after cross-referencing a piece id against a separate table.
 *
 * The clicks/opt-ins pair matters more than either number alone: clicks with no
 * opt-ins means the hook works and the landing page doesn't, which is the single
 * most actionable signal in the whole system. That comparison is called out
 * explicitly rather than left for the reader to notice.
 */

import React, { useMemo, useState } from 'react';
import {
  Link2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  MousePointerClick
} from 'lucide-react';
import type { ContentPiece } from '@/lib/mothermode/content';
import {
  FUNNEL_PAGES,
  OPTIN_PAGES,
  funnelPageLabel,
  optinPageLabel,
  suggestUtm
} from '@/lib/mothermode/planner/utm';

import { refreshPieceLinks, usePieceLinks, usePieceMetrics } from './pieceLinks';
// `Metric` and the availability rules live with the Metrics-tab block so the two
// surfaces render the same numbers from the same fetch by construction.
import {
  Metric,
  PeopleLine,
  PieceMoneyLines,
  pieceMetricValues,
} from './PieceClickMetrics';




const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const fieldCls =
  'mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-sm text-ink focus:border-mode focus:outline-none';

/**
 * Which kind of destination the admin is pointing at.
 *
 * A three-way discriminator rather than one merged funnel dropdown, because a
 * sales funnel and a lead magnet do not share a step vocabulary: 'checkout' and
 * 'upsell1' don't exist on an opt-in funnel, and 'oto' / 'thank-you' don't exist
 * on a sales funnel. One merged list would happily offer a step the chosen
 * destination doesn't have and mint a link that 404s in production only.
 */
type DestKind = 'funnel' | 'optin' | 'url';


export const PieceLinkPanel: React.FC<{
  piece: ContentPiece;
  offerSlug: string;
  offerUrl?: string;
}> = ({ piece, offerSlug, offerUrl }) => {
  const { linkByPieceId, funnels, optinFunnels, ready, error, reload } =
    usePieceLinks(offerSlug);

  const metrics = usePieceMetrics();

  const [destKind, setDestKind] = useState<DestKind>('funnel');
  const [funnelId, setFunnelId] = useState('');
  const [optinFunnelId, setOptinFunnelId] = useState('');
  const [funnelPage, setFunnelPage] = useState<string>('optin');
  const [destinationUrl, setDestinationUrl] = useState(offerUrl || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const existing = linkByPieceId[piece.id] || '';
  const funnel = funnels.find((f) => f.id === funnelId);
  const optinFunnel = optinFunnels.find((f) => f.id === optinFunnelId);

  /*
   * Derived by the shared helper, which the Metrics tab also calls. Both surfaces
   * read the same fetch, so the `n/a` vs `0` rule has to come from one place —
   * duplicated, one copy would eventually treat a failed read as a measured zero
   * and tell an admin a post failed when it was simply never counted.
   */
  const metricValues = pieceMetricValues(metrics, piece.id);
  const { clicks, optins, purchases, trafficNoConversion } = metricValues;


  // Selected destination's slug feeds utm_campaign, whichever kind it is.

  const campaignSlug =
    destKind === 'funnel'
      ? (funnel?.slug ?? null)
      : destKind === 'optin'
        ? (optinFunnel?.slug ?? null)
        : null;

  const utm = useMemo(
    () =>
      suggestUtm({
        platform: piece.platform,
        format: piece.format,
        pieceId: piece.id,
        funnelSlug: campaignSlug
      }),
    [piece.platform, piece.format, piece.id, campaignSlug]
  );

  // Steps for the chosen destination kind — never the union of both.
  const pageOptions =
    destKind === 'optin'
      ? OPTIN_PAGES.map((p) => ({ value: p, label: optinPageLabel(p) }))
      : FUNNEL_PAGES.map((p) => ({ value: p, label: funnelPageLabel(p) }));

  /**
   * Switching destination kind resets the step to 'optin'.
   *
   * 'optin' is the only step name the two vocabularies share, so it is the one
   * safe landing value. Without the reset, picking 'checkout' on a sales funnel
   * and then switching to a lead magnet would POST funnelPage='checkout' against
   * an optin funnel, and `optinPagePath` would cheerfully build /optin/<slug>/checkout.
   */
  const changeKind = (kind: DestKind) => {
    setDestKind(kind);
    setFunnelPage('optin');
    setErr(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(existing);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr('Clipboard blocked — select the link and copy manually.');
    }
  };

  const mint = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/mothermode-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createLink',
          pieceId: piece.id,
          label: piece.title || piece.hook || piece.id,
          // Exactly one destination is ever populated. The route rejects both at
          // once with a 400 and the DB has a CHECK behind that, but sending a
          // clean payload means neither guard has to fire.
          funnelId: destKind === 'funnel' ? funnelId : '',
          optinFunnelId: destKind === 'optin' ? optinFunnelId : '',
          funnelPage: destKind === 'url' ? '' : funnelPage,
          // Only sent for a custom URL: the route derives the base URL from the
          // funnel when one is picked, and a stale pasted URL winning over a real
          // funnel page is exactly the bug that produces 404s.
          destinationUrl: destKind === 'url' ? destinationUrl.trim() : '',
          utmSource: utm.source,
          utmMedium: utm.medium,
          utmCampaign: utm.campaign,
          utmContent: utm.content,
          utmTerm: utm.term,
          /*
           * REQUIRED for clicks to exist at all.
           *
           * Without a short code the link map falls back to `fullUrl` — the raw
           * destination with UTMs on it — which sends traffic straight to
           * /funnel/... and never through /go/[code]. That URL looks completely
           * correct and is completely untracked: the only place a click is ever
           * recorded is the redirect handler. Every link minted from this panel
           * before this flag existed is un-countable, which is why a real click
           * showed up in the server log as a /funnel hit and left the counter at
           * zero.
           */
          withShortLink: true
        })

      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Mint failed (${res.status})`);
      }
      // Drop the shared cache before reloading, or the export panel keeps
      // serving the pre-mint map and the CSV misses the link just created.
      refreshPieceLinks(offerSlug);
      reload();
      // Metrics are deliberately NOT refreshed: a link one second old has zero
      // clicks by definition, so re-reading them would spend a request to
      // confirm the 0 already on screen.
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create link');
    } finally {
      setBusy(false);
    }
  };

  const canMint =
    destKind === 'funnel'
      ? Boolean(funnelId)
      : destKind === 'optin'
        ? Boolean(optinFunnelId)
        : Boolean(destinationUrl.trim());

  return (
    <section className="rounded-xl border border-ink/10 bg-white/50 px-4 py-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-mode" />
        <h3 className="text-sm font-semibold text-ink">Tracked link</h3>
      </div>

      {/*
        utm_content shown as fact, not as an input — see the header comment.
        It's surfaced at all because when attribution looks wrong, this is the
        first value anyone needs to see.
      */}
      <p className="mt-1 text-xs text-ink/50">
        <code className="rounded bg-ink/5 px-1 py-0.5">
          utm_content = {piece.id}
        </code>{' '}
        — this is what joins clicks and opt-ins back to this post.
      </p>

      {!ready && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for an
          existing link…
        </p>
      )}

      {ready && existing && (
        <div className="mt-3">
          <span className={labelCls}>Live link</span>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={existing}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-ink/15 bg-white/80 px-2.5 py-1.5 font-mono text-xs text-ink"
            />
            <button
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/75 hover:border-ink/30"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-mode" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink/45">
            Already carried by the next export. To change the destination, mint
            a new link below — the newest one wins.
          </p>
        </div>
      )}

      {/*
        The performance strip. Rendered only once a link exists: before that
        there is nothing to have clicked, and three zeros next to "create a
        link" reads as a bug rather than as an accurate absence of history.
      */}
      {ready && existing && (
        <div className="mt-3 rounded-lg border border-ink/10 bg-white/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-3.5 w-3.5 text-mode" />
            <span className={labelCls}>What this post did</span>
          </div>

          {!metrics.ready ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-ink/45">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading clicks…
            </p>
          ) : (
            <>
              <div className="mt-2 flex items-start gap-6">
                <Metric label="Clicks" value={clicks} />
                <Metric label="Opt-ins" value={optins} />
                <Metric label="Purchases" value={purchases} />
              </div>

              {/*
                All-time money, so it sits directly under the all-time grid and
                ABOVE the 30-day people line. Imported rather than rebuilt for the
                same reason `pieceMetricValues` is shared: the floor note, the
                paid-only bid ceiling and the blend caveat are qualifications, and
                one that appears on the Metrics tab but not here teaches a reader
                that its absence means the number is safe to bid on.
              */}
              <PieceMoneyLines values={metricValues} />

              {/*
                Same component as the Metrics tab, same derived values. The
                "40 clicks from 3 people" read is only honest when both halves
                come from the same window, and that pairing is done once inside
                `pieceMetricValues` rather than assembled again here.
              */}
              <PeopleLine values={metricValues} />



              {trafficNoConversion && (

                <p className="mt-2.5 rounded-lg border border-brass/40 bg-brass/10 px-2.5 py-2 text-xs text-ink/75">
                  {clicks} clicks, no opt-ins. The hook is working and the page
                  it lands on isn&apos;t — check the destination before writing
                  another post like this one.
                </p>
              )}

              {(!metrics.clicksAvailable || !metrics.attributionAvailable) && (
                <p className="mt-2.5 text-xs text-ink/45">
                  {/*
                    Named explicitly. "n/a" without a reason is indistinguishable
                    from a bug in this panel, and the actual cause is almost
                    always an unapplied planner migration.
                  */}
                  Showing <code>n/a</code> where numbers couldn&apos;t be read
                  {metrics.error ? `: ${metrics.error}` : ''}. Clicks and opt-ins
                  are separate reads — one can fail while the other is accurate.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {ready && (
        <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
          <span className={labelCls}>
            {existing ? 'Replace with a new link' : 'Create a tracked link'}
          </span>

          <label className="block">
            <span className={labelCls}>Send traffic to</span>
            <select
              value={destKind}
              onChange={(e) => changeKind(e.target.value as DestKind)}
              className={fieldCls}
            >
              <option value="funnel">Sales funnel</option>
              <option value="optin">Lead magnet (opt-in funnel)</option>
              <option value="url">Custom URL</option>
            </select>
          </label>

          {destKind === 'funnel' && (
            <label className="block">
              <span className={labelCls}>Funnel</span>
              <select
                value={funnelId}
                onChange={(e) => setFunnelId(e.target.value)}
                className={fieldCls}
              >
                <option value="">Choose a funnel…</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.status && f.status !== 'published'
                      ? ` (${f.status})`
                      : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {destKind === 'optin' && (
            <label className="block">
              <span className={labelCls}>Lead magnet</span>
              <select
                value={optinFunnelId}
                onChange={(e) => setOptinFunnelId(e.target.value)}
                className={fieldCls}
              >
                <option value="">Choose a lead magnet…</option>
                {optinFunnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.status && f.status !== 'published'
                      ? ` (${f.status})`
                      : ''}
                  </option>
                ))}
              </select>
              {!optinFunnels.length && (
                <span className="mt-1.5 block text-xs text-ink/40">
                  No lead magnets built yet — create one under Opt-in Funnels.
                </span>
              )}
            </label>
          )}

          {destKind === 'url' ? (
            <label className="block">
              <span className={labelCls}>Destination URL</span>
              <input
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://…"
                className={fieldCls}
              />
            </label>
          ) : (
            <label className="block">
              <span className={labelCls}>
                {destKind === 'optin' ? 'Step' : 'Page'}
              </span>
              <select
                value={funnelPage}
                onChange={(e) => setFunnelPage(e.target.value)}
                className={fieldCls}
              >
                {pageOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="text-xs text-ink/45">
            Tags as <code>{utm.source}</code> / <code>{utm.medium}</code> ·
            campaign <code>{utm.campaign || '—'}</code>
          </p>

          <button
            onClick={mint}
            disabled={busy || !canMint}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-mode px-4 py-2 text-sm font-semibold text-bone hover:bg-mode-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {existing ? 'Mint replacement' : 'Create tracked link'}
          </button>
          {!canMint && (
            <p className="text-xs text-ink/40">
              {destKind === 'url'
                ? 'Paste a destination URL first.'
                : destKind === 'optin'
                  ? 'Pick a lead magnet first.'
                  : 'Pick a funnel first.'}
            </p>
          )}
        </div>
      )}

      {(err || error) && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-brass/40 bg-brass/10 p-2.5 text-xs text-ink/75">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" />
          {err || error}
        </p>
      )}
    </section>
  );
};
