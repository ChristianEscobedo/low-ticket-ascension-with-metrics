'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AddPlanCard from './AddPlanCard';
import AddLeadCard from './AddLeadCard';

import { CardLinkDrawer, TrackingTab } from './LinkTracking';
import {
  PlatformRail,
  PublishChip,
} from '@/components/mothermode/planner/PublishBadges';
import { scheduleTimeLabel } from '@/lib/mothermode/planner/publishState';
import type { PublishAccount } from '@/lib/mothermode/planner/types';


/**
 * Planner workspace — the visible surface over /api/admin/mothermode-planner.
 *
 * WHY IT TALKS TO THE API RATHER THAN THE STORE
 * ---------------------------------------------
 * A drag is an interaction, so the board has to be a client component, which
 * means it can't import the service-role store. It fetches the whole planner in
 * the single GET the route was designed around, then writes each drag back
 * through the matching POST action and patches its own state from the response
 * (the server is the authority on `stage` coercion and sort order).
 *
 * Types are declared locally and loosely on purpose: this component only knows
 * the JSON contract of the route, not the store's internals, so a column added
 * to the migration doesn't break the build here.
 */

type Column = { id: string; label?: string; wipLimit?: number | null };
type Board = { id?: string; kind?: string; name?: string; columns: Column[] };
type PlanCard = {
  id: string;
  pieceId: string;
  title?: string | null;
  platform?: string | null;
  format?: string | null;
  stage: string;
  scheduledAt?: string | null;
  owner?: string | null;
  notes?: string | null;
  blocked?: boolean | null;
  sortOrder?: number | null;
  funnelId?: string | null;
  funnelPage?: string | null;
  destinationUrl?: string | null;
  // Publish state (20261007000000). Optional here like every other field on
  // this local type: the component knows the route's JSON contract, not the
  // store's, so an unapplied migration renders "Planned" instead of crashing.
  publishState?: string | null;
  publishTarget?: string | null;
  publishRef?: string | null;
  publishAccounts?: PublishAccount[];
  publishSyncedAt?: string | null;
};
type LeadCard = {
  id?: string;
  leadId: string;
  email?: string | null;
  name?: string | null;
  stage: string;
  owner?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  valueCents?: number | null;
  stageManual?: boolean | null;
};

type Payload = {
  success: boolean;
  error?: string;
  boards?: { content: Board; leads: Board };
  plan?: PlanCard[];
  leads?: LeadCard[];
};

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'content', label: 'Content Board' },
  { id: 'leads', label: 'Lead Pipeline' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'columns', label: 'Columns' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const ENDPOINT = '/api/admin/mothermode-planner';

function label(col: Column) {
  return col.label || col.id;
}

/** YYYY-MM-DD in local time — the calendar's bucket key. */
function dayKey(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Rescheduling preserves the existing time-of-day. A drag on a month grid is a
 * statement about the *date* only; blowing the hour away to midnight would
 * silently retime every post the moment someone tidied the calendar.
 */
function withDate(existing: string | null | undefined, day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const base = existing ? new Date(existing) : null;
  const next =
    base && !Number.isNaN(base.getTime())
      ? new Date(base)
      : new Date(y, m - 1, d, 9, 0, 0);
  next.setFullYear(y, m - 1, d);
  return next.toISOString();
}

function monthDays(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // pad back to Sunday
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function PlannerWorkspace() {
  const [tab, setTab] = useState<TabId>('calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState<{ content: Board; leads: Board } | null>(
    null,
  );
  const [plan, setPlan] = useState<PlanCard[]>([]);
  const [leads, setLeads] = useState<LeadCard[]>([]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [dragging, setDragging] = useState<
    { kind: 'plan' | 'lead'; id: string } | null
  >(null);
  // Card id, not the card object: the drawer must re-read from `plan` so a
  // saved destination shows up in it without a second source of truth.
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' });
      const json = (await res.json()) as Payload;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Planner load failed (${res.status})`);
      }
      setBoards(json.boards ?? null);
      setPlan(json.plan ?? []);
      setLeads(json.leads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planner load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Save failed (${res.status})`);
      }
      return json as { record?: PlanCard & LeadCard; board?: Board };
    } finally {
      setSaving(false);
    }
  }, []);

  /** Optimistic move, then reconcile with whatever the server actually stored. */
  const patchPlan = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setPlan((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...(patch as object) } : c)),
      );
      try {
        const json = await post({ action: 'patchPlan', id, patch });
        if (json.record) {
          const rec = json.record as PlanCard;
          setPlan((prev) => prev.map((c) => (c.id === id ? { ...c, ...rec } : c)));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
        void load();
      }
    },
    [post, load],
  );

  const moveLead = useCallback(
    async (card: LeadCard, stage: string) => {
      setLeads((prev) =>
        prev.map((l) =>
          l.leadId === card.leadId ? { ...l, stage, stageManual: true } : l,
        ),
      );
      try {
        await post({ action: 'upsertLead', leadId: card.leadId, stage });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
        void load();
      }
    },
    [post, load],
  );

  const byStage = useMemo(() => {
    const map = new Map<string, PlanCard[]>();
    for (const card of plan) {
      const list = map.get(card.stage) ?? [];
      list.push(card);
      map.set(card.stage, list);
    }
    return map;
  }, [plan]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, LeadCard[]>();
    for (const card of leads) {
      const list = map.get(card.stage) ?? [];
      list.push(card);
      map.set(card.stage, list);
    }
    return map;
  }, [leads]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlanCard[]>();
    for (const card of plan) {
      const key = dayKey(card.scheduledAt);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(card);
      map.set(key, list);
    }
    return map;
  }, [plan]);

  const unscheduled = useMemo(
    () => plan.filter((c) => !dayKey(c.scheduledAt)),
    [plan],
  );

  // Resolved from `plan` rather than held in state, so the drawer reflects a
  // saved destination immediately and closes itself if the card disappears.
  const openCard = useMemo(
    () => (openCardId ? (plan.find((c) => c.id === openCardId) ?? null) : null),
    [openCardId, plan],
  );

  if (loading) {
    return <p className="p-6 text-sm text-bone/50">Loading planner…</p>;
  }

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-bone">Planner</h1>
        {saving && <span className="text-xs text-bone/50">Saving…</span>}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto rounded border border-bone/15 px-3 py-1 text-xs text-bone/70 hover:bg-bone/5"
        >
          Refresh
        </button>
      </header>

      {error && (
        <p className="rounded border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <nav className="flex gap-2 border-b border-bone/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm ${
              tab === t.id
                ? 'border-b-2 border-brass font-medium text-bone'
                : 'text-bone/50 hover:text-bone'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'calendar' && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-bone/15 px-2 py-1 text-xs text-bone/70"
              onClick={() =>
                setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))
              }
            >
              ←
            </button>
            <span className="text-sm text-bone/70">
              {anchor.toLocaleString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              className="rounded border border-bone/15 px-2 py-1 text-xs text-bone/70"
              onClick={() =>
                setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))
              }
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="p-1 text-xs uppercase text-bone/40">
                {d}
              </div>
            ))}
            {monthDays(anchor).map((d) => {
              const key = dayKey(d.toISOString())!;
              const cards = byDay.get(key) ?? [];
              const dim = d.getMonth() !== anchor.getMonth();
              return (
                <div
                  key={key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragging?.kind !== 'plan') return;
                    const card = plan.find((c) => c.id === dragging.id);
                    if (!card) return;
                    void patchPlan(card.id, {
                      scheduledAt: withDate(card.scheduledAt, key),
                    });
                    setDragging(null);
                  }}
                  className={`min-h-[84px] rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-1 ${
                    dim ? 'opacity-40' : ''
                  }`}
                >
                  <div className="text-[10px] text-bone/40">{d.getDate()}</div>
                  {cards.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragging({ kind: 'plan', id: c.id })}
                      onDoubleClick={() => setOpenCardId(c.id)}
                      className="mt-1 cursor-grab rounded bg-mode/30 px-1 py-0.5 text-[11px] text-bone"
                      title={`${c.title || c.pieceId} — double-click for details`}
                    >
                      {/*
                        Logo instead of the platform's name in text: a calendar
                        cell is ~90px wide, and "instagram · " ate most of it
                        before the title had a chance. Double-click rather than
                        click to open, because a single click here is how a drag
                        that ends where it started reports itself.
                      */}
                      <div className="flex items-center gap-1">
                        <PlatformRail
                          accounts={c.publishAccounts}
                          fallbackPlatform={c.platform}
                          size={11}
                          max={2}
                          className="text-bone/70"
                        />
                        <span className="truncate">{c.title || c.pieceId}</span>
                      </div>
                      {/* Draft vs Scheduled is the entire reason this row
                          exists: both have a date, so the date alone can't say
                          whether this will go out by itself. */}
                      <PublishChip
                        state={c.publishState}
                        detail={scheduleTimeLabel(c.scheduledAt)}
                        className="mt-0.5 !px-1 !py-0 !text-[9px]"
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div>
            <h2 className="mb-1 text-sm font-medium text-bone/70">
              Unscheduled ({unscheduled.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {unscheduled.map((c) => (
                <span
                  key={c.id}
                  draggable
                  onDragStart={() => setDragging({ kind: 'plan', id: c.id })}
                  onDoubleClick={() => setOpenCardId(c.id)}
                  className="inline-flex cursor-grab items-center gap-1.5 rounded border border-bone/15 px-2 py-1 text-xs text-bone/70"
                  title={`${c.title || c.pieceId} — double-click for details`}
                >
                  <PlatformRail
                    accounts={c.publishAccounts}
                    fallbackPlatform={c.platform}
                    size={12}
                    max={2}
                  />
                  {c.title || c.pieceId}
                  {/* An undated card can still be a draft sitting in GHL, so the
                      chip belongs here too — "unscheduled" is about our
                      calendar, not about what the scheduler is holding. */}
                  {c.publishState ? (
                    <PublishChip
                      state={c.publishState}
                      className="!px-1 !py-0 !text-[9px]"
                    />
                  ) : null}
                </span>
              ))}
              {!unscheduled.length && (
                <span className="text-xs text-bone/40">
                  Everything planned has a date.
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'content' && boards && (
        <AddPlanCard
          columns={boards.content.columns.map((c) => ({
            id: c.id,
            name: label(c),
          }))}
          defaultStage={boards.content.columns[0]?.id ?? 'idea'}
          saving={saving}
          post={post}
          onCreated={(record) => {
            // Prepend rather than reload: the server already returned the stored
            // record, and a full reload would drop any in-flight optimistic drag.
            setPlan((prev) => [record as PlanCard, ...prev]);
          }}
        />
      )}

      {tab === 'content' && boards && (
        <section className="flex gap-3 overflow-x-auto pb-2">
          {boards.content.columns.map((col) => {

            const cards = byStage.get(col.id) ?? [];
            const over =
              typeof col.wipLimit === 'number' &&
              col.wipLimit > 0 &&
              cards.length > col.wipLimit;
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging?.kind !== 'plan') return;
                  void patchPlan(dragging.id, { stage: col.id });
                  setDragging(null);
                }}
                className="min-w-[220px] flex-1 rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-2"
              >
                <h3 className="mb-2 flex items-center gap-2 text-xs uppercase text-bone/50">
                  {label(col)}
                  <span className={over ? 'text-amber-400' : 'text-bone/40'}>
                    {cards.length}
                    {typeof col.wipLimit === 'number' && col.wipLimit > 0
                      ? `/${col.wipLimit}`
                      : ''}
                  </span>
                </h3>
                {cards.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragging({ kind: 'plan', id: c.id })}
                    className="mb-2 cursor-grab rounded bg-mode/30 p-2 text-xs text-bone"
                  >
                    <div className="flex items-start gap-1.5">
                      <PlatformRail
                        accounts={c.publishAccounts}
                        fallbackPlatform={c.platform}
                        size={14}
                        className="mt-0.5 text-bone/70"
                      />
                      <div className="font-medium">{c.title || c.pieceId}</div>
                    </div>
                    <div className="text-[11px] text-bone/50">
                      {[c.format, c.owner].filter(Boolean).join(' · ')}
                    </div>
                    {/* Platform moved into the logo rail above, so it is dropped
                        from this line rather than said twice. */}
                    <div className="mt-1">
                      <PublishChip
                        state={c.publishState}
                        detail={scheduleTimeLabel(c.scheduledAt)}
                      />
                    </div>
                    {c.blocked && (
                      <div className="mt-1 text-[11px] text-red-300">Blocked</div>
                    )}
                    {/*
                      A button rather than a click handler on the card itself:
                      the card is draggable, and on a drag that ends where it
                      started the browser still fires a click -- so a whole-card
                      handler would pop the drawer open every time someone
                      changed their mind mid-drag.
                    */}
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenCardId(c.id)}
                        className="text-[11px] text-bone/50 underline-offset-2 hover:text-bone hover:underline"
                      >
                        Details
                      </button>
                      {(c.funnelId || c.destinationUrl) && (
                        <span
                          className="text-[11px] text-brass/70"
                          title={
                            c.destinationUrl ||
                            `Funnel page: ${c.funnelPage || 'optin'}`
                          }
                        >
                          → {c.destinationUrl ? 'external' : c.funnelPage || 'optin'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}

      {tab === 'leads' && boards && (
        <AddLeadCard
          columns={boards.leads.columns.map((c) => ({
            id: c.id,
            name: label(c),
          }))}
          defaultStage={boards.leads.columns[0]?.id ?? 'new'}
          saving={saving}
          post={post}
          onCreated={(record, extra) => {
            // Prepend, like the content board does — a full reload would drop an
            // in-flight optimistic drag. The email and name are merged in from
            // the form because the pipeline record doesn't carry them (they live
            // on the leads table), and without them the card would show a bare
            // uuid until the next load.
            const card = record as LeadCard;
            setLeads((prev) => [
              {
                ...card,
                email: card.email ?? extra.email,
                name: card.name ?? (extra.name || null),
              },
              ...prev,
            ]);
          }}
        />
      )}

      {tab === 'leads' && boards && (
        <section className="flex gap-3 overflow-x-auto pb-2">

          {boards.leads.columns.map((col) => {
            const cards = leadsByStage.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging?.kind !== 'lead') return;
                  const card = leads.find((l) => l.leadId === dragging.id);
                  if (card) void moveLead(card, col.id);
                  setDragging(null);
                }}
                className="min-w-[220px] flex-1 rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-2"
              >
                <h3 className="mb-2 text-xs uppercase text-bone/50">
                  {label(col)}{' '}
                  <span className="text-bone/40">{cards.length}</span>
                </h3>
                {cards.map((l) => (
                  <div
                    key={l.leadId}
                    draggable
                    onDragStart={() => setDragging({ kind: 'lead', id: l.leadId })}
                    className="mb-2 cursor-grab rounded bg-mode/30 p-2 text-xs text-bone"
                  >
                    <div className="font-medium">
                      {l.name || l.email || l.leadId}
                    </div>
                    {l.nextAction && (
                      <div className="text-[11px] text-bone/50">
                        {l.nextAction}
                      </div>
                    )}
                    {l.stageManual && (
                      <div className="mt-1 text-[11px] text-sky-300">
                        Manual stage
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}

      {tab === 'tracking' && <TrackingTab />}

      {tab === 'columns' && boards && (
        <section className="space-y-6">
          {(['content', 'leads'] as const).map((kind) => (
            <ColumnEditor
              key={kind}
              kind={kind}
              board={boards[kind]}
              onSave={async (columns) => {
                try {
                  const json = await post({ action: 'saveColumns', kind, columns });
                  if (json.board) {
                    setBoards((prev) =>
                      prev ? { ...prev, [kind]: json.board! } : prev,
                    );
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Save failed');
                }
              }}
            />
          ))}
        </section>
      )}

      {openCard && (
        <CardLinkDrawer
          card={openCard}
          onClose={() => setOpenCardId(null)}
          // Destinations are plan-row fields, so they save through the planner
          // route; only the links themselves go to the link registry. Reusing
          // patchPlan keeps the optimistic update and error handling identical
          // to a drag.
          onSaveDestination={(patch) => patchPlan(openCard.id, patch)}
          // Same write path as the destination fields. Routed through
          // `patchPlan` so the board, the calendar and the drawer all update
          // from one response — a status corrected here has to change the chip
          // on the card behind the drawer, or it reads as not having saved.
          onSavePublish={(patch) => patchPlan(openCard.id, patch)}
        />
      )}
    </div>
  );
}

/**
 * Column editor. Edits a local draft and only POSTs on save, because every
 * keystroke of a renamed column would otherwise re-slug ids server-side and
 * strand the cards that were sitting in the old one.
 */
function ColumnEditor({
  kind,
  board,
  onSave,
}: {
  kind: 'content' | 'leads';
  board: Board;
  onSave: (columns: Column[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Column[]>(board.columns);
  useEffect(() => setDraft(board.columns), [board.columns]);

  return (
    <div className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-3">
      <h3 className="mb-2 text-sm font-medium capitalize text-bone/70">
        {kind} columns
      </h3>
      <div className="space-y-2">
        {draft.map((col, i) => (
          <div key={`${col.id}-${i}`} className="flex items-center gap-2">
            <input
              value={col.label ?? col.id}
              onChange={(e) =>
                setDraft((prev) =>
                  prev.map((c, j) =>
                    j === i ? { ...c, label: e.target.value } : c,
                  ),
                )
              }
              className="flex-1 rounded border border-bone/15 bg-ink/60 px-2 py-1 text-sm text-bone"
            />
            <input
              type="number"
              min={0}
              value={col.wipLimit ?? 0}
              onChange={(e) =>
                setDraft((prev) =>
                  prev.map((c, j) =>
                    j === i ? { ...c, wipLimit: Number(e.target.value) } : c,
                  ),
                )
              }
              className="w-20 rounded border border-bone/15 bg-ink/60 px-2 py-1 text-sm text-bone"
              title="WIP limit (0 = none)"
            />
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => prev.filter((_, j) => j !== i))
              }
              className="rounded border border-bone/15 px-2 py-1 text-xs text-bone/60"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() =>
            setDraft((prev) => [...prev, { id: '', label: 'New column' }])
          }
          className="rounded border border-bone/15 px-3 py-1 text-xs text-bone/70"
        >
          Add column
        </button>
        <button
          type="button"
          onClick={() => void onSave(draft)}
          className="rounded bg-brass px-3 py-1 text-xs font-medium text-ink"
        >
          Save
        </button>
      </div>
      <p className="mt-2 text-[11px] text-bone/40">
        Blank ids are slugged from the label on save. Removing a column leaves its
        cards to coerce into the first remaining column on next load.
      </p>
    </div>
  );
}
