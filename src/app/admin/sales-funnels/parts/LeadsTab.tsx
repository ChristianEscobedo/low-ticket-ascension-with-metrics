'use client';

import { btnGhost } from './ui';

/**
 * Read-only leads table for the funnel editor.
 *
 * The row type is structural on purpose: this tab never writes, so a loose
 * shape here cannot desync from whatever the shell's real lead record type is.
 */
export type LeadRow = {
  id: string;
  email: string;
  firstName?: string | null;
  funnelId: string;
  funnelSlug?: string | null;
  funnelName?: string | null;
  status: string;
  stepReached: string | number;
  purchased: boolean;
  createdAt: string;
};

export default function LeadsTab({
  leads,
  selectedId,
  onExportCsv,
}: {
  leads: LeadRow[];
  selectedId?: string | null;
  onExportCsv: () => void;
}) {
  const shown = selectedId ? leads.filter((l) => l.funnelId === selectedId) : leads;
  return (
    <section className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 overflow-hidden">
      <div className="flex items-center justify-between border-b border-bone/10 px-3 py-2">
        <div className="text-xs text-bone/45">{selectedId ? shown.length + ' for this funnel' : leads.length + ' recent'}</div>
        <button type="button" onClick={onExportCsv} className={btnGhost}>Export CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-bone/10 text-left text-xs uppercase tracking-wide text-bone/45"><th className="px-3 py-2.5 font-semibold">Email</th><th className="px-3 py-2.5 font-semibold">Name</th><th className="px-3 py-2.5 font-semibold">Funnel</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 font-semibold">Step</th><th className="px-3 py-2.5 font-semibold">Purchased</th><th className="px-3 py-2.5 font-semibold">When</th></tr></thead>
          <tbody className="divide-y divide-bone/10">
            {leads.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-bone/40">No leads yet. Publish a funnel and capture a test email.</td></tr>}
            {shown.map((l) => (
              <tr key={l.id} className="text-bone/80">
                <td className="px-3 py-2.5 font-medium text-bone">{l.email}</td>
                <td className="px-3 py-2.5">{l.firstName || ''}</td>
                <td className="px-3 py-2.5 text-bone/55">{l.funnelSlug || l.funnelName || l.funnelId.slice(0, 8)}</td>
                <td className="px-3 py-2.5"><span className={l.purchased ? 'text-emerald-400/90' : 'text-brass/80'}>{l.status}</span></td>
                <td className="px-3 py-2.5 text-bone/55">{l.stepReached}</td>
                <td className="px-3 py-2.5">{l.purchased ? 'Yes' : ''}</td>
                <td className="px-3 py-2.5 text-bone/45 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
