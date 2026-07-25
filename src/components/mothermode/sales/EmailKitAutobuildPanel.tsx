'use client';

import {
  SALES_EMAIL_EVENT_LABELS,
  type SalesEmailEvent,
} from '@/lib/mothermode/sales/types';

/**
 * Shapes are declared locally rather than imported from `emailPlan.ts` /
 * `emailAutobuild.ts` so this client component does not drag the planning and
 * generation modules (and their store/OpenAI imports) into the browser bundle.
 * Only the fields the UI renders are described.
 */
export interface AutobuildPlanRow {
  event: SalesEmailEvent;
  eventLabel: string;
  campaignType: string;
  name: string;
  slug: string;
  alreadyBound: boolean;
  intake?: { audience?: string; goal?: string };
}

export interface AutobuildResultRow {
  event: SalesEmailEvent;
  eventLabel: string;
  ok: boolean;
  kitId?: string;
  kitName?: string;
  emailCount?: number;
  error?: string;
}

/**
 * Presentation only. Every piece of run state (the plan, the in-flight event,
 * the per-event results, the notice) lives in `SalesFunnelEditor`.
 *
 * That is not decoration: this panel now sits inside the `Emails > Kits` tab,
 * and the nav unmounts a tab on every switch. Holding the run state here would
 * mean starting a generation, switching tabs, and losing the only UI that could
 * report what the still-running server job did.
 */
interface Props {
  /** Null until the funnel has been saved once — generation needs a real row. */
  funnelId: string | null;
  /** Current event → kit id bindings from the editor. */
  boundKitIds: Partial<Record<SalesEmailEvent, string>>;
  /** Planned kit per event; `null` while the plan is still being read. */
  plans: AutobuildPlanRow[] | null;
  planError: string | null;
  /** Which event is generating, or 'all' for the bulk run. */
  busy: SalesEmailEvent | 'all' | null;
  results: AutobuildResultRow[];
  notice: string | null;
  /** Kick off a run in the shell; `onlyMissing` skips already-bound events. */
  onGenerate: (events?: SalesEmailEvent[], onlyMissing?: boolean) => void;
  btnPrimary: string;
  btnGhost: string;
}

export default function EmailKitAutobuildPanel({
  funnelId,
  boundKitIds,
  plans,
  planError,
  busy,
  results,
  notice,
  onGenerate,
  btnPrimary,
  btnGhost,
}: Props) {
  if (!funnelId) {
    return (
      <div className="rounded-lg border border-bone/10 bg-ink/30 px-3 py-2 text-xs text-bone/45">
        Save the funnel once to auto-generate its email sequences — the generator reads the
        saved offer, price and promise to write the copy.
      </div>
    );
  }

  const missingCount = plans ? plans.filter((p) => !p.alreadyBound).length : 0;

  return (
    <div className="rounded-lg border border-bone/10 bg-ink/30 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-bone/50">
            Auto-build sequences
          </div>
          <p className="text-xs text-bone/40">
            Writes one kit per event from this funnel&apos;s offer. New kits land as drafts in
            Email Marketing; a kit that is already live keeps its status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onGenerate(undefined, true)}
            disabled={busy !== null || missingCount === 0}
            className={btnPrimary}
            title={
              missingCount === 0
                ? 'Every event already has a kit bound'
                : `Generate the ${missingCount} unbound event${missingCount === 1 ? '' : 's'}`
            }
          >
            {busy === 'all' ? 'Generating…' : `Generate missing (${missingCount})`}
          </button>
          <a href="/admin/email-marketing" target="_blank" rel="noreferrer" className={btnGhost}>
            Open Email Marketing
          </a>
        </div>
      </div>

      {notice && <div className="mb-2 text-xs text-brass/80">{notice}</div>}
      {planError && <div className="mb-2 text-xs text-red-300/80">{planError}</div>}

      <div className="grid gap-1.5">
        {(plans ?? []).map((plan) => {
          const result = results.find((r) => r.event === plan.event);
          const isBound = plan.alreadyBound || Boolean(boundKitIds[plan.event]);
          return (
            <div
              key={plan.event}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bone/10 bg-ink/40 px-2.5 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-xs text-bone/80">
                  {SALES_EMAIL_EVENT_LABELS[plan.event] || plan.eventLabel}
                  <span className="ml-2 rounded bg-bone/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-bone/45">
                    {plan.campaignType}
                  </span>
                </div>
                <div className="truncate text-[11px] text-bone/40">{plan.name}</div>
                {result && (
                  <div
                    className={
                      'truncate text-[11px] ' +
                      (result.ok ? 'text-emerald-400/80' : 'text-red-300/80')
                    }
                  >
                    {result.ok
                      ? `Built ${result.emailCount ?? 0} emails${result.kitName ? ' — ' + result.kitName : ''}`
                      : result.error || 'Failed'}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onGenerate([plan.event])}
                disabled={busy !== null}
                className={btnGhost}
                // Regenerating overwrites copy someone may have edited by hand,
                // so the label says so instead of quietly reusing "Generate".
                title={isBound ? 'Overwrites the copy in the bound kit' : 'Write this sequence'}
              >
                {busy === plan.event ? 'Generating…' : isBound ? 'Regenerate' : 'Generate'}
              </button>
            </div>
          );
        })}
        {plans !== null && plans.length === 0 && (
          <div className="text-xs text-bone/40">No funnel events to plan.</div>
        )}
        {plans === null && !planError && (
          <div className="text-xs text-bone/40">Reading the funnel…</div>
        )}
      </div>
    </div>
  );
}
