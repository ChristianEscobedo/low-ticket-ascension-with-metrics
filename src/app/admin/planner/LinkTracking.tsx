'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FUNNEL_PAGES,
  funnelPageLabel,
  suggestUtm,
} from '@/lib/mothermode/planner/utm';
// The same reading the content hub uses. Imported rather than re-derived so the
// "is this just me clicking my own link" judgement is identical on every surface.
import { peopleLabel, readPeople } from '@/lib/mothermode/planner/clickPeople';
// Publish state + logos, shared with the Content Hub's Schedule tab so "Draft"
// cannot come to mean two different things on two screens.
import {
  SENDABLE_PUBLISH_STATES,
  normalizePublishState,
  publishStateHelp,
  publishStateLabel,
  scheduleDateTimeLabel,
  isoToLocalInput,
  localInputToIso,
  type PublishState,
} from '@/lib/mothermode/planner/publishState';
import { platformLabel } from '@/lib/mothermode/planner/platformGlyph';
import {
  PlatformGlyph,
  PublishChip,
} from '@/components/mothermode/planner/PublishBadges';
import type { PublishAccount } from '@/lib/mothermode/planner/types';
import { PlanPiecePreview } from '@/components/mothermode/planner/PlanPiecePreview';
// Money formatting and — critically — the totals. `summarizeLinkRows` exists
// because this table's rows are per LINK while attribution is per `utm_content`:
// summing the revenue column down the page would count a piece with two links
// twice and print an account total larger than the one on /admin.
import {
  ATTRIBUTED_REVENUE_FLOOR_NOTE,
  duplicatedPieceKeys,
  formatCents,
  formatCentsPrecise,
  pieceEconomics,
  summarizeLinkRows,
} from '@/lib/mothermode/planner/adMetrics';




/**
 * The two surfaces over /api/admin/mothermode-links: the per-card drawer that
 * mints a link, and the Tracking tab that reports on all of them.
 *
 * They live in one file because they are two views of one table and share the
 * fetch layer, the row shape, and the copy-to-clipboard behaviour — the same
 * reason the planner keeps its calendar and content board together.
 *
 * WHAT THE ADMIN IS ACTUALLY ASKING
 * ---------------------------------
 * "Which piece of content produced leads?" So the table's job is not to list
 * links; it is to put clicks and opt-ins in the same row, because the
 * interesting cell is the one with clicks and no opt-ins. Everything else here
 * (copy buttons, short codes) is plumbing in service of that comparison.
 *
 * Types are declared locally and loosely, matching the convention in
 * PlannerWorkspace: this component knows the route's JSON contract, not the
 * store's internals.
 */

const ENDPOINT = '/api/admin/mothermode-links';

export type TrackingRow = {
  id: string;
  planId: string | null;
  funnelId: string | null;
  funnelPage: string;
  pieceId: string;
  label: string;
  fullUrl: string;
  shortCode: string | null;
  shortUrl: string | null;
  clicks: number;
  recentClicks: number;
  botClicks: number;
  /** Distinct people behind `recentClicks` — same window, so comparable. */
  uniqueClicks: number;
  /** Window clicks with no IP hash, which make `uniqueClicks` a floor. */
  unattributedClicks: number;
  lastClickedAt: string | null;

  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  /** Null means "we could not run the join", NOT "zero opt-ins". */
  optins: number | null;
  purchases: number | null;
  /**
   * Attributed revenue in cents for the PIECE, not for this link.
   *
   * Every link sharing a `utm_content` carries the same figure, because a lead
   * records the piece it came from and not which of the piece's links it used.
   * So this column must never be added up by hand — `summarizeLinkRows` sums it
   * over distinct `utmContent`, and the strip above the table uses that.
   *
   * Null tracks `optins`: one join produces both, so they fail together.
   */
  revenueCents: number | null;
  createdAt: string | null;
};


export type FunnelOption = {
  id: string;
  slug: string;
  name?: string | null;
  status?: string | null;
};

type Registry = {
  rows: TrackingRow[];
  funnels: FunnelOption[];
  warnings: string[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  create: (body: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/**
 * Shared data layer.
 *
 * `planId` scopes the fetch so the drawer asks for one card's links instead of
 * filtering the whole registry client-side — a card drawer should not get
 * slower as the registry grows.
 */
function useLinkRegistry(planId?: string | null): Registry {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = planId ? `?planId=${encodeURIComponent(planId)}` : '';
      const res = await fetch(`${ENDPOINT}${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Load failed');
      setRows(json.rows ?? []);
      setFunnels(json.funnels ?? []);
      setWarnings(json.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const write = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        // The 409 duplicate message is written for a human, so surface it as-is
        // rather than replacing it with a generic failure string.
        throw new Error(json.error || 'Save failed');
      }
      await reload();
    },
    [reload],
  );

  const create = useCallback(
    (body: Record<string, unknown>) => write({ action: 'createLink', ...body }),
    [write],
  );
  const remove = useCallback(
    (id: string) => write({ action: 'deleteLink', id }),
    [write],
  );

  return { rows, funnels, warnings, loading, error, reload, create, remove };
}

/**
 * Copy that works on http:// origins too.
 *
 * navigator.clipboard is undefined outside a secure context, which includes a
 * plain-http LAN address — a realistic way to demo an admin panel. Failing
 * silently there would look like a broken button, so fall back to execCommand.
 */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ value, children }: { value: string; children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(value);
        setCopied(ok);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded border border-bone/15 px-2 py-0.5 text-[11px] text-bone/70 hover:bg-bone/5"
      title={value}
    >
      {copied ? 'Copied' : children}
    </button>
  );
}

function shortDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Opt-ins per click, as a percentage. Undefined when there's nothing to divide. */
function conversionRate(row: TrackingRow): string {
  if (row.optins === null) return '—';
  if (!row.clicks) return '—';
  return `${Math.round((row.optins / row.clicks) * 100)}%`;
}

// ---------------------------------------------------------------------------
// (d2 + d3) Tracking tab
// ---------------------------------------------------------------------------

export function TrackingTab() {
  const { rows, warnings, loading, error, reload, remove } = useLinkRegistry();
  const [busy, setBusy] = useState<string | null>(null);

  // Most-clicked first: the tab is a report, and a report that opens on the
  // oldest row makes the reader do the sorting.
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.clicks - a.clicks),
    [rows],
  );

  /*
   * NOT a reduce over rows any more, and that is the point.
   *
   * Rows are per LINK; opt-ins and revenue are per `utm_content`. A piece with a
   * boosted link and an organic link appears twice, each row carrying the whole
   * piece's lead figures, so adding the columns down the page inflates both —
   * and the inflated total would sit two clicks away from /admin's account
   * total, which sums the same money once. `summarizeLinkRows` sums clicks over
   * rows (correct: a click belongs to one link) and money over distinct pieces.
   */
  const totals = useMemo(() => summarizeLinkRows(rows), [rows]);

  // EPC through the shared helper, never `totals.revenueCents / totals.clicks`
  // inline: this is the one file where the tempting denominator (row clicks) is
  // right and the tempting numerator (row revenue) is wrong.
  const overall = useMemo(
    () =>
      pieceEconomics({
        clicks: totals.clicks,
        slice: totals.slice,
        // No per-medium split on this payload, so paid figures stay `n/a` rather
        // than silently reusing the blend. /admin is where the split lives.
        clicksByTrafficType: null,
        split: null,
        spendCents: null,
      }),
    [totals],
  );

  // Which `utm_content` values appear on more than one row. Derived from the
  // same helper the totals use, so the cells that get dimmed are exactly the
  // ones `summarizeLinkRows` collapsed — the explanation and the arithmetic
  // cannot drift apart.
  const sharedPieces = useMemo(() => new Set(duplicatedPieceKeys(rows)), [rows]);

  if (loading) return <p className="text-sm text-bone/50">Loading links…</p>;


  return (
    <section className="space-y-3">
      {error && (
        <p className="rounded border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {/*
        Not decoration. When the opt-in join fails, the opt-in column shows "—"
        and this explains why -- otherwise a broken join reads as "this content
        converts nobody", which is the single most expensive way for this
        feature to be wrong.
      */}
      {warnings.map((w) => (
        <p
          key={w}
          className="rounded border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200"
        >
          {w}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-3 text-xs text-bone/50">
        <span>{totals.links} tracked links</span>
        <span>{totals.clicks} clicks</span>
        {/* "—" not "0": a failed join is not a measurement of zero. */}
        <span>{totals.optins === null ? '—' : totals.optins} opt-ins</span>
        <span title={ATTRIBUTED_REVENUE_FLOOR_NOTE}>
          {formatCents(totals.revenueCents)} attributed
          {/*
            Stated on the strip, not buried in a tooltip nobody opens: the
            number is summed over {pieces} pieces, which is smaller than the
            link count whenever a piece has more than one link — the reason
            these totals are not the column sums a reader would compute.
          */}
          <span className="ml-1 text-bone/35">
            over {totals.pieces} {totals.pieces === 1 ? 'piece' : 'pieces'}
          </span>
        </span>
        <span title="Attributed revenue ÷ clicks, blended across paid and organic">
          {formatCentsPrecise(overall.blended.epcCents)}/click
        </span>
        <button

          type="button"
          onClick={() => void reload()}
          className="ml-auto rounded border border-bone/15 px-3 py-1 text-bone/70 hover:bg-bone/5"
        >
          Refresh
        </button>
      </div>

      {!rows.length ? (
        <p className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-6 text-sm text-bone/50">
          No tracked links yet. Open a card on the Content Board and use “Tracked
          links” to mint one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70">
          <table className="w-full text-left text-xs text-bone/80">
            <thead className="text-[11px] uppercase text-bone/40">
              <tr>
                <th className="p-2">Piece</th>
                <th className="p-2">Source / Medium</th>
                <th className="p-2">Campaign</th>
                <th className="p-2 text-right">Clicks</th>
                <th className="p-2 text-right" title="Human clicks in the last 30 days">
                  30d
                </th>
                <th className="p-2 text-right">Opt-ins</th>
                <th className="p-2 text-right">CVR</th>
                {/*
                  "Piece $" and not "Revenue": the header itself has to say the
                  figure belongs to the piece, because two rows for one piece
                  show the same amount and a column called "Revenue" makes that
                  look like a duplication bug instead of the join it is.
                */}
                <th
                  className="p-2 text-right"
                  title={`Attributed revenue for the whole piece, repeated on every link that shares its utm_content. ${ATTRIBUTED_REVENUE_FLOOR_NOTE}`}
                >
                  Piece $
                </th>

                <th className="p-2">Last click</th>
                <th className="p-2">Link</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                // The whole point of the tab, called out visually: traffic that
                // produced nothing. Only flagged once there are enough clicks to
                // mean something -- one click and no opt-in is not a signal.
                const dud = row.optins === 0 && row.clicks >= 5;
                return (
                  <tr key={row.id} className="border-t border-bone/10 align-top">
                    <td className="p-2">
                      <div className="font-medium text-bone">
                        {row.label || row.pieceId || '(untitled)'}
                      </div>
                      <div className="text-[11px] text-bone/40">
                        {row.utmContent || '— no utm_content —'}
                      </div>
                    </td>
                    <td className="p-2">
                      {row.utmSource || '—'}
                      <span className="text-bone/40"> / {row.utmMedium || '—'}</span>
                    </td>
                    <td className="p-2">{row.utmCampaign || '—'}</td>
                    <td className="p-2 text-right tabular-nums">{row.clicks}</td>
                    <td className="p-2 text-right tabular-nums text-bone/60">
                      {row.recentClicks}
                      {/*
                        People are attached to the WINDOW column, never to the
                        all-time one two cells over. Repeats are the signal here:
                        30 clicks from 2 people is you checking your own link,
                        and that only reads correctly when both numbers describe
                        the same period.
                      */}
                      {(() => {
                        const reading = readPeople(row);
                        if (!reading.people || !row.recentClicks) return null;
                        return (
                          <span
                            className="ml-1 text-[10px] text-bone/40"
                            title={
                              `${peopleLabel(reading)} in the same window` +
                              (reading.selfTrafficLikely
                                ? ' — that ratio usually means you, not an audience'
                                : '')
                            }
                          >
                            /{reading.people}p
                          </span>
                        );
                      })()}
                      {row.botClicks > 0 && (

                        <span
                          className="ml-1 text-[10px] text-bone/30"
                          title={`${row.botClicks} bot/preview hits, logged but never counted as clicks`}
                        >
                          +{row.botClicks}🤖
                        </span>
                      )}
                    </td>
                    <td
                      className={`p-2 text-right tabular-nums ${
                        dud ? 'text-amber-300' : ''
                      }`}
                      title={
                        row.optins === null
                          ? 'Attribution unavailable — see the warning above'
                          : dud
                            ? 'Clicks but no opt-ins — the page or the promise may be off'
                            : undefined
                      }
                    >
                      {row.optins === null ? '—' : row.optins}
                    </td>
                    <td className="p-2 text-right tabular-nums text-bone/60">
                      {conversionRate(row)}
                    </td>
                    {/*
                      Dimmed when the piece is on more than one row, so identical
                      amounts read as "the same piece, seen twice" rather than as
                      two separate earnings to be added.
                    */}
                    <td
                      className={`p-2 text-right tabular-nums ${
                        sharedPieces.has(row.utmContent)
                          ? 'text-bone/40'
                          : 'text-bone/70'
                      }`}
                      title={
                        sharedPieces.has(row.utmContent)
                          ? 'This piece has more than one link — the same amount appears on each. Do not add them; the strip above sums it once.'
                          : ATTRIBUTED_REVENUE_FLOOR_NOTE
                      }
                    >
                      {row.revenueCents === null
                        ? '—'
                        : formatCents(row.revenueCents)}
                    </td>

                    <td className="p-2 text-bone/60">{shortDate(row.lastClickedAt)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {row.shortUrl && (
                          <CopyButton value={row.shortUrl}>
                            {`/go/${row.shortCode}`}
                          </CopyButton>
                        )}
                        <CopyButton value={row.fullUrl}>Full URL</CopyButton>
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        disabled={busy === row.id}
                        onClick={async () => {
                          // Deleting a link orphans its click rows' meaning, so
                          // make the person say yes to that specifically.
                          if (
                            !window.confirm(
                              `Delete this link? Its ${row.clicks} recorded clicks go with it, and any copy of the URL already published will stop resolving.`,
                            )
                          ) {
                            return;
                          }
                          setBusy(row.id);
                          try {
                            await remove(row.id);
                          } finally {
                            setBusy(null);
                          }
                        }}
                        className="rounded border border-bone/15 px-2 py-0.5 text-[11px] text-bone/50 hover:bg-bone/5"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// (d1) Card drawer
// ---------------------------------------------------------------------------

export type DrawerCard = {
  id: string;
  pieceId: string;
  /**
   * Needed to look up the piece's review (its edits and replacement image), so
   * the drawer's preview shows the post as it was actually written rather than
   * the untouched catalog copy.
   */
  offerSlug?: string | null;
  title?: string | null;
  platform?: string | null;
  format?: string | null;
  funnelId?: string | null;
  funnelPage?: string | null;
  destinationUrl?: string | null;
  /** Publish detail, mirrored from the scheduler by the Content Hub. */
  scheduledAt?: string | null;
  publishState?: PublishState | string | null;
  publishTarget?: string | null;
  publishAccounts?: PublishAccount[] | null;
  publishSyncedAt?: string | null;
};

/**
 * The "where is this post right now" block at the top of the drawer.
 *
 * Sits above Destination because it answers the question that made the admin
 * click the card: a link's UTMs matter later, but whether the post is a draft
 * waiting on approval or already live decides whether they need to act today.
 *
 * The account list is the SNAPSHOT taken at send time, not a live read of the
 * scheduler. That is a deliberate trade: showing the accounts as they were when
 * the post was sent is honest and offline-safe, whereas re-fetching from GHL on
 * every drawer open would make an admin panel depend on a third party being up,
 * and would silently rewrite history when an account is later disconnected.
 */
function PublishDetail({
  card,
  onSavePublish,
}: {
  card: DrawerCard;
  onSavePublish?: (patch: {
    publishState?: string;
    scheduledAt?: string | null;
  }) => Promise<void>;
}) {
  const current = normalizePublishState(card.publishState);
  const [state, setState] = useState<PublishState>(current);
  const [when, setWhen] = useState(isoToLocalInput(card.scheduledAt));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Re-seed when the drawer is pointed at another card: this component is kept
  // mounted across selections, and stale local state would show card A's status
  // under card B's title.
  useEffect(() => {
    setState(normalizePublishState(card.publishState));
    setWhen(isoToLocalInput(card.scheduledAt));
    setSaved(false);
    setErr(null);
  }, [card.id, card.publishState, card.scheduledAt]);

  const accounts = card.publishAccounts ?? [];
  const dirty =
    state !== current || when !== isoToLocalInput(card.scheduledAt);

  return (
    <section className="mb-5 space-y-2 rounded border border-bone/10 bg-mode/20 p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs uppercase text-bone/40">Publishing</h3>
        <PublishChip state={current} className="ml-auto" />
      </div>

      <p className="text-xs text-bone/70">
        {scheduleDateTimeLabel(card.scheduledAt)}
      </p>
      <p className="text-[11px] text-bone/40">
        {publishStateHelp(current)}
      </p>

      {/* Accounts with logos AND names. Two Instagram accounts are a routine
          setup, and a rail of identical glyphs would not tell them apart. */}
      {accounts.length > 0 ? (
        <ul className="space-y-1">
          {accounts.map((a, i) => (
            <li
              key={a.id || `${a.platform}-${i}`}
              className="flex items-center gap-1.5 text-[11px] text-bone/70"
            >
              <PlatformGlyph platform={a.platform} size={13} />
              <span>{a.name || platformLabel(a.platform)}</span>
              {a.name ? (
                <span className="text-bone/35">{platformLabel(a.platform)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-bone/40">
          {card.platform
            ? `Planned for ${platformLabel(card.platform)} — not sent to a scheduler from here.`
            : 'No channel set on this card.'}
        </p>
      )}

      {card.publishSyncedAt && (
        <p className="text-[11px] text-bone/35">
          Last synced {scheduleDateTimeLabel(card.publishSyncedAt)}
          {card.publishTarget ? ` · ${card.publishTarget.toUpperCase()}` : ''}
        </p>
      )}

      {onSavePublish && (
        <div className="space-y-2 border-t border-bone/10 pt-2">
          <select
            value={state}
            onChange={(e) => {
              setState(normalizePublishState(e.target.value));
              setSaved(false);
            }}
            className="w-full rounded border border-bone/15 bg-ink/40 px-2 py-1 text-xs text-bone"
          >
            {/* '' is offered as a real option: a card can legitimately go back to
                being merely planned if the post was pulled from the scheduler. */}
            <option value="">{publishStateLabel('')}</option>
            {SENDABLE_PUBLISH_STATES.map((s) => (
              <option key={s} value={s}>
                {publishStateLabel(s)}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={when}
            onChange={(e) => {
              setWhen(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded border border-bone/15 bg-ink/40 px-2 py-1 text-xs text-bone"
          />

          {/* Says "correct", not "set": this only changes the planner's record.
              GoHighLevel does not hear about it, and implying otherwise would
              have someone marking a draft "Scheduled" and expecting it to fire. */}
          <p className="text-[11px] text-bone/40">
            Corrects what the planner shows. It does not change anything in the
            scheduler.
          </p>

          {err && <p className="text-[11px] text-red-300">{err}</p>}

          <button
            type="button"
            disabled={busy || !dirty}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await onSavePublish({
                  publishState: state,
                  scheduledAt: localInputToIso(when),
                });
                setSaved(true);
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Save failed');
              } finally {
                setBusy(false);
              }
            }}
            className="rounded border border-bone/15 px-3 py-1 text-xs text-bone/70 hover:bg-bone/5 disabled:opacity-40"
          >
            {busy ? 'Saving…' : saved && !dirty ? 'Saved' : 'Correct status'}
          </button>
        </div>
      )}
    </section>
  );
}

export function CardLinkDrawer({
  card,
  onClose,
  onSaveDestination,
  onSavePublish,
}: {
  card: DrawerCard;
  onClose: () => void;
  /** Writes through the planner route — destinations live on the plan row. */
  onSaveDestination: (patch: {
    funnelId?: string | null;
    funnelPage?: string;
    destinationUrl?: string | null;
  }) => Promise<void>;
  /**
   * Correct the publish state by hand.
   *
   * Needed because the scheduler is the source of truth but only speaks to the
   * planner at send time: someone who approves a GHL draft inside GHL leaves
   * this card reading "Draft" forever, and a confidently stale label is worse
   * than no label.
   */
  onSavePublish?: (patch: {
    publishState?: string;
    scheduledAt?: string | null;
  }) => Promise<void>;
}) {
  const { rows, funnels, loading, error, create, remove } = useLinkRegistry(card.id);

  const [funnelId, setFunnelId] = useState(card.funnelId ?? '');
  const [funnelPage, setFunnelPage] = useState(card.funnelPage || 'optin');
  const [destinationUrl, setDestinationUrl] = useState(card.destinationUrl ?? '');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const funnel = funnels.find((f) => f.id === funnelId);

  // Recomputed from the current selection rather than stored in state, so the
  // preview can never drift from what the mint button will actually send.
  const suggested = useMemo(
    () =>
      suggestUtm({
        platform: card.platform,
        format: card.format,
        pieceId: card.pieceId,
        funnelSlug: funnel?.slug ?? null,
      }),
    [card.platform, card.format, card.pieceId, funnel?.slug],
  );

  const [utm, setUtm] = useState(suggested);
  // Keep the fields in step with the funnel choice until the admin edits them;
  // once they've typed, their value wins.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setUtm(suggested);
  }, [suggested, touched]);

  const field =
    'w-full rounded border border-bone/15 bg-ink/40 px-2 py-1 text-xs text-bone';

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-brass/20 bg-ink p-4 shadow-2xl">
      <header className="mb-4 flex items-start gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-bone">
            <PlatformGlyph platform={card.platform} size={16} />
            {card.title || card.pieceId}
          </h2>
          <p className="text-[11px] text-bone/40">{card.pieceId}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded border border-bone/15 px-2 py-1 text-xs text-bone/60 hover:bg-bone/5"
        >
          Close
        </button>
      </header>

      {(error || formError) && (
        <p className="mb-3 rounded border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-200">
          {formError || error}
        </p>
      )}

      <PublishDetail card={card} onSavePublish={onSavePublish} />

      {/* The card knows what the post is, not what it says — the preview has to
          resolve the piece and its edits itself. See PlanPiecePreview. */}
      <PlanPiecePreview
        pieceId={card.pieceId}
        offerSlug={card.offerSlug ?? ''}
      />

      <section className="mb-5 space-y-2">
        <h3 className="text-xs uppercase text-bone/40">Destination</h3>
        <select
          value={funnelId}
          onChange={(e) => {
            setFunnelId(e.target.value);
            // A funnel and a pasted URL are alternatives; picking one clears the
            // other so the row can never claim two destinations.
            if (e.target.value) setDestinationUrl('');
          }}
          className={field}
        >
          <option value="">— External / no funnel —</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name || f.slug}
              {f.status && f.status !== 'published' ? ` (${f.status})` : ''}
            </option>
          ))}
        </select>

        {funnelId ? (
          <select
            value={funnelPage}
            onChange={(e) => setFunnelPage(e.target.value)}
            className={field}
          >
            {FUNNEL_PAGES.map((p) => (
              <option key={p} value={p}>
                {funnelPageLabel(p)}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            placeholder="https://…"
            className={field}
          />
        )}

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFormError(null);
            try {
              await onSaveDestination({
                funnelId: funnelId || null,
                funnelPage: funnelId ? funnelPage : '',
                destinationUrl: funnelId ? null : destinationUrl.trim() || null,
              });
            } catch (err) {
              setFormError(err instanceof Error ? err.message : 'Save failed');
            } finally {
              setBusy(false);
            }
          }}
          className="rounded border border-bone/15 px-3 py-1 text-xs text-bone/70 hover:bg-bone/5"
        >
          Save destination
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs uppercase text-bone/40">Mint a tracked link</h3>

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. bio link, story swipe-up)"
          className={field}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={utm.source}
            onChange={(e) => {
              setTouched(true);
              setUtm({ ...utm, source: e.target.value });
            }}
            placeholder="utm_source"
            className={field}
          />
          <input
            value={utm.medium}
            onChange={(e) => {
              setTouched(true);
              setUtm({ ...utm, medium: e.target.value });
            }}
            placeholder="utm_medium"
            className={field}
          />
        </div>
        <input
          value={utm.campaign}
          onChange={(e) => {
            setTouched(true);
            setUtm({ ...utm, campaign: e.target.value });
          }}
          placeholder="utm_campaign"
          className={field}
        />
        <input
          value={utm.content}
          onChange={(e) => {
            setTouched(true);
            setUtm({ ...utm, content: e.target.value });
          }}
          placeholder="utm_content"
          className={field}
        />
        {/*
          utm_content is the join key to the lead row. Editing it is allowed --
          sometimes you want two links to report as one piece -- but it should be
          a deliberate act, not an accident, so the consequence is stated.
        */}
        <p className="text-[11px] text-bone/40">
          utm_content is what ties opt-ins back to this card. Change it only if
          you want this link reported as a different piece.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFormError(null);
            try {
              await create({
                planId: card.id,
                funnelId: funnelId || '',
                funnelPage: funnelId ? funnelPage : '',
                pieceId: card.pieceId,
                label,
                destinationUrl: funnelId ? '' : destinationUrl.trim(),
                utmSource: utm.source,
                utmMedium: utm.medium,
                utmCampaign: utm.campaign,
                utmContent: utm.content,
                utmTerm: utm.term,
                withShortLink: true,
              });
              setLabel('');
            } catch (err) {
              setFormError(err instanceof Error ? err.message : 'Save failed');
            } finally {
              setBusy(false);
            }
          }}
          className="rounded bg-brass px-3 py-1 text-xs font-medium text-ink disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Create tracked link'}
        </button>
      </section>

      <section className="mt-5 space-y-2">
        <h3 className="text-xs uppercase text-bone/40">
          Links for this card ({rows.length})
        </h3>
        {loading && <p className="text-xs text-bone/40">Loading…</p>}
        {!loading && !rows.length && (
          <p className="text-xs text-bone/40">None yet.</p>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded border border-bone/10 bg-mode/20 p-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-bone">
                {row.label || row.utmSource || 'link'}
              </span>
              {/* "—" for a failed join, never "0": the drawer is where someone
                  decides a piece flopped, and "0 opt-ins" is a verdict while a
                  broken join is an unknown. */}
              <span className="text-bone/40">
                {row.clicks} clicks
                {row.optins !== null ? ` · ${row.optins} opt-ins` : ' · — opt-ins'}
              </span>
              <button
                type="button"
                onClick={() => void remove(row.id)}
                className="ml-auto text-bone/40 hover:text-red-300"
                title="Delete link"
              >
                ×
              </button>
            </div>
            {/* Coming back to a card weeks later, all-time clicks alone can't
                tell a live post from a dead one, and can't tell an audience from
                you refreshing your own link. The 30-day window and the people
                count behind it are the two readings that can — attached to each
                other, because a repeat rate only means anything within one
                window. */}
            <div className="mt-0.5 text-[11px] text-bone/40">
              {(() => {
                const reading = readPeople(row);
                const parts = [`${row.recentClicks} in 30d`];
                if (reading.people && row.recentClicks) {
                  parts.push(peopleLabel(reading));
                }
                parts.push(`last ${shortDate(row.lastClickedAt)}`);
                return parts.join(' · ');
              })()}
              {readPeople(row).selfTrafficLikely && row.recentClicks > 0 && (
                <span
                  className="ml-1 text-brass"
                  title="Nearly all of this window's clicks came from one or two people — usually you checking your own link, not an audience."
                >
                  · likely you
                </span>
              )}
            </div>

            {/* The destination, spelled out. A tracked link's whole job is to
                send someone somewhere, and the short code hides where. */}
            <p
              className="mt-1 truncate text-[11px] text-bone/35"
              title={row.fullUrl}
            >
              {row.fullUrl}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-1">
              {row.shortUrl && (
                <CopyButton value={row.shortUrl}>{`/go/${row.shortCode}`}</CopyButton>
              )}
              <CopyButton value={row.fullUrl}>Full URL</CopyButton>
            </div>
          </div>
        ))}
      </section>
    </aside>
  );
}
