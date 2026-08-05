'use client';

import { useMemo, useState } from 'react';

import {
  auditIntakeFunnel,
  toAsciiMap,
  orphanedEmails,
  type AscensionIssueCode,
  type AscensionStage,
  type DownsellPlacement,
  type IntakeAscensionNoteCode,
} from '@/lib/mothermode/sales';
import type { SalesAiIntake } from '@/lib/mothermode/sales/aiIntake';

import FunnelFlowCanvas from '@/components/mothermode/sales/FunnelFlowCanvas';
import { StatChip, panelClass } from './ui';

/**
 * The ascension validator, wired to a real funnel.
 *
 * Everything on this screen is derived from the intake at render time. Nothing
 * here is stored, and nothing here edits the funnel — it reads the operator's
 * own words back to them and says what the ladder does and does not support.
 * If a verdict looks wrong, the fix is in the Offer tab, not here.
 */

const STAGE_LABEL: Record<AscensionStage, string> = {
  frontEnd: 'Front end',
  oto1: 'OTO 1',
  oto2: 'OTO 2',
  oto3: 'OTO 3',
};

const PLACEMENT_LABEL: Record<DownsellPlacement, string> = {
  none: 'No downsells',
  inline: 'Downsell inline',
  after: 'Downsell after',
};

/** Plain-language restatement of each validator code. */
const ISSUE_LABEL: Record<AscensionIssueCode, string> = {
  'price-not-ascending': 'Price does not go up',
  'no-escalation': 'Nothing escalates',
  'duplicate-outcome': 'Repeats an earlier outcome',
  'missing-outcome': 'No outcome stated',
  'exceeds-elasticity': 'Priced past what the front end supports',
  'downsell-not-cheaper': 'Downsell is not cheaper',
  'stage-out-of-order': 'Stages are out of order',
};

/**
 * What the adapter had to assume. These are not funnel defects — they are the
 * gap between what the intake stores and what the ladder needs, and they exist
 * so a verdict can be traced back to the wording that produced it.
 */
const NOTE_LABEL: Record<IntakeAscensionNoteCode, string> = {
  'price-missing': 'Price could not be read',
  'outcome-missing': 'No promise text to compare',
  'escalation-inferred': 'Escalation guessed from wording',
  'escalation-unstated': 'Wording named no escalation',
  'recurring-price-as-first-payment': 'Subscription read as first payment',
  'upsell-beyond-oto3': 'Upsell slot past OTO 3 ignored',
  'downsells-not-expressible': 'Intake cannot express downsells',
  'extra-order-bumps': 'Extra order bumps not drawn',
};

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export default function ArchitectureTab({ intake }: { intake: SalesAiIntake }) {
  // Recomputed whenever the intake changes so the verdict always describes the
  // funnel currently in the editor, not the one that was last saved.
  const audit = useMemo(() => auditIntakeFunnel(intake), [intake]);
  const ascii = useMemo(() => toAsciiMap(audit.map), [audit.map]);
  const orphans = useMemo(() => orphanedEmails(audit.map), [audit.map]);

  // Which form of the flow map is showing. Local and unpersisted: it is a way
  // of looking at the funnel, not a property of it.
  const [view, setView] = useState<'diagram' | 'text'>('diagram');

  const best = audit.placements[audit.bestPlacement];
  const clean = audit.issues.length === 0;

  return (
    <div className="space-y-4">
      <section className={panelClass + ' space-y-3'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-bone">Funnel architecture</h3>
            <p className="mt-0.5 text-xs text-bone/45">
              Read from the Offer tab every render. Nothing here is saved or edited.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatChip label="Rungs" value={String(audit.rungs.length)} />
            <StatChip label="Issues" value={String(audit.issues.length)} />
            <StatChip label="Assumed" value={String(audit.notes.length)} />
            <StatChip label="Projected AOV" value={money(best.total)} />
          </div>
        </div>

        {audit.rungs.length === 0 ? (
          <p className="rounded-lg border border-bone/10 bg-ink/40 px-3 py-2 text-xs text-bone/50">
            No rungs yet. Fill in the front-end offer and at least one upsell on the Offer tab and
            the ladder will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-bone/40">
                  <th className="pb-1.5 pr-3 font-medium">Stage</th>
                  <th className="pb-1.5 pr-3 font-medium">Offer</th>
                  <th className="pb-1.5 pr-3 font-medium">Outcome</th>
                  <th className="pb-1.5 pr-3 font-medium">Price</th>
                  <th className="pb-1.5 font-medium">Escalates on</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {audit.rungs.map((r) => (
                  <tr key={r.stage} className="border-t border-bone/10">
                    <td className="py-1.5 pr-3 text-bone/70">{STAGE_LABEL[r.stage]}</td>
                    <td className="py-1.5 pr-3 text-bone">{r.name || <span className="text-bone/35">—</span>}</td>
                    <td className="py-1.5 pr-3 text-bone/70">{r.outcome || <span className="text-bone/35">—</span>}</td>
                    <td className="py-1.5 pr-3 text-bone/70">{money(r.price)}</td>
                    <td className="py-1.5">
                      {r.escalates.length === 0 ? (
                        <span className="text-amber-300/80">nothing</span>
                      ) : (
                        <span className="text-bone/70">{r.escalates.join(', ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={panelClass + ' space-y-2'}>
        <h3 className="text-sm font-semibold text-bone">Ladder verdict</h3>
        {audit.rungs.length === 0 ? (
          <p className="text-xs text-bone/45">Nothing to validate yet.</p>
        ) : clean ? (
          <p className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            No structural problems found. Prices ascend, every rung escalates on something, and no
            outcome repeats.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {audit.issues.map((i, n) => (
              <li
                key={i.code + i.stage + n}
                className="rounded-lg border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2 text-xs"
              >
                <span className="font-semibold text-amber-200">{STAGE_LABEL[i.stage]}</span>
                <span className="mx-1.5 text-bone/30">/</span>
                <span className="text-amber-200/80">{ISSUE_LABEL[i.code]}</span>
                <div className="mt-0.5 text-bone/60">{i.message}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panelClass + ' space-y-2'}>
        <h3 className="text-sm font-semibold text-bone">What was assumed</h3>
        <p className="text-xs text-bone/45">
          The intake does not store an ascension ladder, so some values are derived. Each one is
          listed here — a verdict above traces back to this list, not to a hidden default.
        </p>
        {audit.notes.length === 0 ? (
          <p className="text-xs text-bone/50">Nothing was inferred. Every value came from the intake.</p>
        ) : (
          <ul className="space-y-1.5">
            {audit.notes.map((n, i) => (
              <li
                key={n.code + (n.stage ?? '') + i}
                className="rounded-lg border border-bone/10 bg-ink/40 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-bone/70">
                  {n.stage ? STAGE_LABEL[n.stage] : 'Funnel'}
                </span>
                <span className="mx-1.5 text-bone/30">/</span>
                <span className="text-bone/60">{NOTE_LABEL[n.code]}</span>
                <div className="mt-0.5 text-bone/50">{n.detail}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panelClass + ' space-y-2'}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-bone">Downsell placement</h3>
          <span className="text-xs text-bone/45">
            Best: <span className="text-brass">{PLACEMENT_LABEL[audit.bestPlacement]}</span>
          </span>
        </div>
        <p className="text-xs text-bone/45">
          Projected from default conversion rates, not from your traffic. Treat it as a comparison
          between structures, not a revenue forecast. Ties go to fewer decisions.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-bone/40">
                <th className="pb-1.5 pr-3 font-medium">Structure</th>
                <th className="pb-1.5 pr-3 font-medium">Buyer decisions</th>
                <th className="pb-1.5 font-medium">Projected AOV</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(audit.placements) as DownsellPlacement[]).map((p) => {
                const proj = audit.placements[p];
                const isBest = p === audit.bestPlacement;
                return (
                  <tr key={p} className="border-t border-bone/10">
                    <td className={'py-1.5 pr-3 ' + (isBest ? 'text-brass font-semibold' : 'text-bone/70')}>
                      {PLACEMENT_LABEL[p]}
                    </td>
                    <td className="py-1.5 pr-3 text-bone/60">{proj.decisions}</td>
                    <td className={'py-1.5 ' + (isBest ? 'text-brass font-semibold' : 'text-bone/70')}>
                      {money(proj.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {best.lines.length > 0 && (
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-bone/40">
                  <th className="pb-1.5 pr-3 font-medium">Step</th>
                  <th className="pb-1.5 pr-3 font-medium">Kind</th>
                  <th className="pb-1.5 pr-3 font-medium">Price</th>
                  <th className="pb-1.5 pr-3 font-medium">Assumed take</th>
                  <th className="pb-1.5 font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {best.lines.map((l, i) => (
                  <tr key={l.stage + l.kind + i} className="border-t border-bone/10">
                    <td className="py-1.5 pr-3 text-bone/70">{l.name || STAGE_LABEL[l.stage]}</td>
                    <td className="py-1.5 pr-3 text-bone/50">{l.kind}</td>
                    <td className="py-1.5 pr-3 text-bone/60">{money(l.price)}</td>
                    <td className="py-1.5 pr-3 text-bone/50">{pct(l.conversionRate)}</td>
                    <td className="py-1.5 text-bone/70">{money(l.contribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={panelClass + ' space-y-2'}>
        <h3 className="text-sm font-semibold text-bone">Flow map</h3>
        {orphans.length > 0 && (
          <p className="rounded-lg border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200/90">
            {orphans.length} email{orphans.length === 1 ? '' : 's'} fire on events this funnel never
            reaches: {orphans.map((o) => o.label).join(', ')}
          </p>
        )}
        {/*
          The ASCII map is kept, not replaced.

          It is the only form of this diagram that survives a copy-paste into a
          ticket, a commit message or a model prompt, and `toAsciiMap` is the
          function the funnel-map tests assert against. The canvas is the better
          default because it shows branch structure at a glance; the text is one
          click away because it is the one you can paste.
        */}
        <div className="mb-2 inline-flex rounded-lg border border-bone/15 p-0.5">
          {(['diagram', 'text'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                view === v
                  ? 'bg-brass/[0.14] text-brass'
                  : 'text-bone/50 hover:text-bone'
              }`}
            >
              {v === 'diagram' ? 'Diagram' : 'Text'}
            </button>
          ))}
        </div>

        {view === 'diagram' ? (
          <FunnelFlowCanvas map={audit.map} issues={audit.issues} />
        ) : (
          <pre className="overflow-x-auto rounded-lg border border-bone/10 bg-ink/50 p-3 text-[11px] leading-relaxed text-bone/70">
            {ascii}
          </pre>
        )}
      </section>
    </div>
  );
}
