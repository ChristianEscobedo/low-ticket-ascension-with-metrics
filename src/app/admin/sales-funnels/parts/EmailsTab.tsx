'use client';

import EmailKitAutobuildPanel, {
  type AutobuildPlanRow,
  type AutobuildResultRow,
} from '@/components/mothermode/sales/EmailKitAutobuildPanel';
import {
  SALES_EMAIL_EVENTS,
  SALES_EMAIL_EVENT_LABELS,
  type SalesEmailEvent,
} from '@/lib/mothermode/sales/types';
import { inputClass, selectClass, labelClass, btnPrimary, btnGhost, panelClass } from './ui';

/**
 * Only the fields this select renders, so the tab does not depend on the exact
 * kit summary shape the shell keeps in state.
 */
export interface EmailKitOption {
  id: string;
  name: string;
  status: string;
}

interface Props {
  /** Kits available to bind (from Email Marketing). */
  emailKits: EmailKitOption[];
  /** Current event → kit id bindings. */
  emailKitsMap: Partial<Record<SalesEmailEvent, string>>;
  /** Legacy single-kit column; still mirrors the opt-in event. */
  emailKitId: string;
  setKitForEvent: (event: SalesEmailEvent, kitId: string) => void;
  /** Null until the funnel row exists — autobuild needs a saved funnel. */
  funnelId: string | null;
  autobuildPlans: AutobuildPlanRow[] | null;
  autobuildPlanError: string | null;
  autobuildBusy: SalesEmailEvent | 'all' | null;
  autobuildResults: AutobuildResultRow[];
  autobuildNotice: string | null;
  onAutobuild: (events?: SalesEmailEvent[], onlyMissing?: boolean) => void;
}

/**
 * `Emails > Kits`: bind one Email Marketing kit per funnel event, and
 * auto-write the ones that are still missing.
 *
 * Stateless by design — the bindings live in the shell (they are saved with the
 * funnel row) and so does the autobuild run state, so switching tabs mid-run
 * does not throw away the result.
 */
export default function EmailsTab({
  emailKits,
  emailKitsMap,
  emailKitId,
  setKitForEvent,
  funnelId,
  autobuildPlans,
  autobuildPlanError,
  autobuildBusy,
  autobuildResults,
  autobuildNotice,
  onAutobuild,
}: Props) {
  return (
    <section className={panelClass + ' space-y-4'}>
      <div className="min-w-0">
        <label className={labelClass}>Email kits by funnel event</label>
        <p className="mb-2 text-xs text-bone/40">
          Bind a different Email Marketing kit to each step. Opt-in still mirrors the legacy
          single kit field.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SALES_EMAIL_EVENTS.map((event) => (
            <div key={event} className="rounded-lg border border-bone/10 bg-ink/30 p-2">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-bone/45">
                {SALES_EMAIL_EVENT_LABELS[event]}
              </label>
              <select
                className={selectClass}
                value={emailKitsMap[event] || (event === 'optin' ? emailKitId : '') || ''}
                onChange={(e) => setKitForEvent(event, e.target.value)}
              >
                <option value="">None — no auto-enroll</option>
                {emailKits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.status})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      <EmailKitAutobuildPanel
        funnelId={funnelId}
        boundKitIds={emailKitsMap}
        plans={autobuildPlans}
        planError={autobuildPlanError}
        busy={autobuildBusy}
        results={autobuildResults}
        notice={autobuildNotice}
        onGenerate={onAutobuild}
        btnPrimary={btnPrimary}
        btnGhost={btnGhost}
      />
    </section>
  );
}
