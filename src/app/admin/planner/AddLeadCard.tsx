'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Add a lead straight onto the pipeline board.
 *
 * WHY THIS EXISTS
 * ---------------
 * Without it the lead board only ever shows leads that arrived through a form,
 * which makes it a view of the *funnel* rather than a view of the pipeline. The
 * DM that turned into a call, the referral from a friend, the person who replied
 * to a story — none of those have a form submission behind them, and a board
 * that can't hold them is a board the admin stops trusting and replaces with a
 * spreadsheet.
 *
 * WHY IT POSTS `createLead` AND NOT `upsertLead`
 * ---------------------------------------------
 * `upsertLead` writes the pipeline table, whose `lead_id` is a foreign key into
 * the funnel leads table — handed a fresh id it fails the FK. `createLead`
 * captures the lead first and then decorates it, which is the only order that
 * works. See the case comment in the planner route.
 *
 * WHY THE FUNNEL IS REQUIRED BUT `utm_content` IS NOT
 * --------------------------------------------------
 * Leads are unique per (funnel_id, email), so a lead with no funnel has nowhere
 * to live. `utm_content` is the opposite: it is the piece-of-content join key,
 * and a *guess* there is worse than a blank, because a guessed value is
 * indistinguishable from a tracked click and quietly inflates the credit given
 * to one post. The server already hardcodes source='manual' / medium=
 * 'admin_entry' so these leads never masquerade as attributed traffic.
 */

type Funnel = { id: string; slug: string; name: string; status?: string };

const fieldCls =
  'mt-1 w-full rounded-lg border border-brass/25 bg-ink/40 px-2.5 py-1.5 text-sm text-bone placeholder:text-bone/30 focus:border-brass/60 focus:outline-none';
const labelCls = 'block text-[11px] uppercase tracking-[0.14em] text-bone/45';

export default function AddLeadCard({
  columns,
  defaultStage,
  saving,
  post,
  onCreated,
}: {
  columns: { id: string; name: string }[];
  defaultStage: string;
  saving: boolean;
  post: (
    body: Record<string, unknown>,
  ) => Promise<{ record?: unknown; leadId?: string; isNew?: boolean }>;
  onCreated: (record: unknown, extra: { email: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [funnelsErr, setFunnelsErr] = useState<string | null>(null);
  const [loadingFunnels, setLoadingFunnels] = useState(false);

  const [funnelId, setFunnelId] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [stage, setStage] = useState(defaultStage);
  const [owner, setOwner] = useState('');
  const [value, setValue] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDay, setNextActionDay] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /*
   * Funnels load when the form opens, not when the board does.
   *
   * The lead tab renders for everyone who visits the planner; this list is only
   * needed by the handful of people who actually add a lead by hand. Fetching it
   * on mount would put a request on every planner visit to populate a dropdown
   * that usually never opens.
   */
  const loadFunnels = useCallback(async () => {
    setLoadingFunnels(true);
    setFunnelsErr(null);
    try {
      const res = await fetch('/api/admin/mothermode-sales', {
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        funnels?: Funnel[];
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Funnel load failed (${res.status})`);
      }
      setFunnels(json.funnels ?? []);
    } catch (e) {
      setFunnelsErr(
        e instanceof Error ? e.message : 'Could not load funnels.',
      );
    } finally {
      setLoadingFunnels(false);
    }
  }, []);

  useEffect(() => {
    if (open && !funnels.length && !loadingFunnels && !funnelsErr) {
      void loadFunnels();
    }
  }, [open, funnels.length, loadingFunnels, funnelsErr, loadFunnels]);

  function reset() {
    setFunnelId('');
    setEmail('');
    setFirstName('');
    setStage(defaultStage);
    setOwner('');
    setValue('');
    setNextAction('');
    setNextActionDay('');
    setUtmContent('');
    setErr(null);
  }

  async function submit() {
    const trimmedEmail = email.trim();
    if (!funnelId) {
      setErr('Pick a funnel — a lead is unique per funnel and email.');
      return;
    }
    // Matches the server's check rather than a stricter regex: a false rejection
    // here blocks a real lead, and the server owns the authoritative rule.
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErr('A valid email is required.');
      return;
    }

    /*
     * Dollars in, cents out.
     *
     * The field takes dollars because that is what the admin knows the deal is
     * worth; the column stores cents because storing money as a float is how
     * pipeline totals end up at $2,999.9999998. `Math.round` after the multiply
     * (not before) is what makes 29.99 land on 2999 instead of 2998.
     */
     const dollars = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
    const valueCents = Number.isFinite(dollars)
      ? Math.round(dollars * 100)
      : undefined;

    setErr(null);
    setNote(null);
    try {
      const json = await post({
        action: 'createLead',
        funnelId,
        email: trimmedEmail,
        firstName: firstName.trim(),
        stage,
        owner: owner.trim(),
        nextAction: nextAction.trim(),
        // Noon local, for the same reason AddPlanCard schedules at noon: a
        // midnight-local date becomes the previous day in UTC for anyone west of
        // GMT, which would silently show every follow-up as due a day early.
        nextActionAt: nextActionDay
          ? new Date(`${nextActionDay}T12:00`).toISOString()
          : null,
        ...(valueCents === undefined ? {} : { valueCents }),
        // Sent only when filled. An empty string would overwrite a real
        // utm_content on a lead that already existed on this funnel.
        ...(utmContent.trim() ? { utmContent: utmContent.trim() } : {}),
      });

      if (json.record) {
        // The pipeline record carries no email or name — those live on the leads
        // table — so they are passed alongside it. Without them the new card
        // would render as a bare uuid until the next full reload.
        onCreated(json.record, { email: trimmedEmail, name: firstName.trim() });
      }

      // isNew === false means this email was already a lead on this funnel and
      // has now been staged onto the board. Saying "created" there would claim
      // something that didn't happen, and the admin would go looking for a
      // second card that will never exist.
      setNote(
        json.isNew === false
          ? `${trimmedEmail} already existed on this funnel — moved onto the board.`
          : `${trimmedEmail} added.`,
      );
      reset();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add the lead.');
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-brass/30 px-3 py-1.5 text-sm font-medium text-bone/80 transition-colors hover:border-brass/60 hover:text-bone"
        >
          + Add lead
        </button>
        {note && <p className="text-xs text-bone/50">{note}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-brass/25 bg-ink/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Funnel *</span>
          <select
            value={funnelId}
            onChange={(e) => setFunnelId(e.target.value)}
            className={fieldCls}
          >
            <option value="">
              {loadingFunnels ? 'Loading funnels…' : 'Choose a funnel…'}
            </option>
            {funnels.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name || f.slug}
                {f.status && f.status !== 'published' ? ` (${f.status})` : ''}
              </option>
            ))}
          </select>
          {funnelsErr && (
            <span className="mt-1 block text-xs text-red-300">
              {funnelsErr}{' '}
              <button
                type="button"
                onClick={() => void loadFunnels()}
                className="underline underline-offset-2"
              >
                Retry
              </button>
            </span>
          )}
        </label>

        <label className="block">
          <span className={labelCls}>Email *</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>First name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Stage</span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className={fieldCls}
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Owner</span>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Deal value ($)</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder="497"
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Next action</span>
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Send the proposal"
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Next action date</span>
          <input
            type="date"
            value={nextActionDay}
            onChange={(e) => setNextActionDay(e.target.value)}
            className={fieldCls}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={labelCls}>Came from which post? (optional)</span>
          <input
            value={utmContent}
            onChange={(e) => setUtmContent(e.target.value)}
            placeholder="piece id, e.g. manual_20260726_kd7bq"
            className={fieldCls}
          />
          <span className="mt-1 block text-xs text-bone/40">
            Sets <code>utm_content</code>, which is what credits a post with this
            lead. Leave it blank unless you know — a guess is worse than nothing,
            because it reads exactly like a tracked click.
          </span>
        </label>
      </div>

      {err && <p className="text-xs text-red-300">{err}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="rounded-lg bg-brass/80 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-brass disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add lead'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg border border-brass/25 px-3 py-1.5 text-sm text-bone/70 hover:border-brass/50 hover:text-bone"
        >
          Cancel
        </button>
        <span className="text-xs text-bone/40">
          Tagged <code>manual</code> / <code>admin_entry</code> — it will never
          be counted as funnel traffic.
        </span>
      </div>
    </div>
  );
}
