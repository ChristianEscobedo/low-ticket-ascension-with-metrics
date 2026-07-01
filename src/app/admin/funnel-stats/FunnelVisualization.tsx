// Funnel visualization - renders a horizontal bar per stage in the canonical
// FE → OTO1 → OTO2 → OTO3 → OTO4 order, showing count + take-rate vs FE +
// dollars contributed. "Other" sweeps up any page_type values that don't map
// to a known stage (e.g. legacy data or future stages).

type Row = { page_type: string; count: number; totalCents: number };

const STAGES: Array<{ key: string; label: string }> = [
  { key: 'fe', label: 'FE' },
  { key: 'oto1', label: 'OTO1' },
  { key: 'oto2', label: 'OTO2' },
  { key: 'oto3', label: 'OTO3' },
  { key: 'oto4', label: 'OTO4' }
];

const KNOWN = new Set(STAGES.map((s) => s.key));

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function FunnelVisualization({
  byPageType
}: {
  byPageType: Row[];
}) {
  const lookup = new Map(byPageType.map((r) => [r.page_type, r] as const));
  const feCount = lookup.get('fe')?.count ?? 0;

  const otherRows = byPageType.filter((r) => !KNOWN.has(r.page_type));
  const otherCount = otherRows.reduce((s, r) => s + r.count, 0);
  const otherCents = otherRows.reduce((s, r) => s + r.totalCents, 0);

  const stageData = [
    ...STAGES.map((s) => {
      const row = lookup.get(s.key);
      return {
        label: s.label,
        count: row?.count ?? 0,
        totalCents: row?.totalCents ?? 0
      };
    }),
    ...(otherCount > 0
      ? [{ label: 'Other', count: otherCount, totalCents: otherCents }]
      : [])
  ];

  // Bar widths are normalised to FE so OTO take-rates read as % of front-end.
  // If there's no FE data yet, fall back to the largest stage so the chart
  // still renders something meaningful.
  const maxCount = Math.max(feCount, ...stageData.map((s) => s.count), 1);

  return (
    <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-5 shadow-[0_0_30px_rgba(168,139,92,0.06)]">
      {feCount === 0 && (
        <div className="mb-4 text-xs text-brass/90">
          No <code>page_type: &quot;fe&quot;</code> conversions yet, take-rate
          percentages will read 0% until at least one front-end sale lands.
        </div>
      )}
      <div className="space-y-3">
        {stageData.map((s) => {
          const widthPct = (s.count / maxCount) * 100;
          const takeRate =
            feCount > 0 && s.label !== 'FE'
              ? `${((s.count / feCount) * 100).toFixed(1)}%`
              : s.label === 'FE'
              ? '-'
              : '0%';
          return (
            <div key={s.label} className="grid grid-cols-[60px_1fr_auto] gap-3 items-center">
              <div className="text-sm font-semibold text-brass/90 uppercase tracking-wider">
                {s.label}
              </div>
              <div className="relative h-8 bg-bone/[0.04] rounded-lg overflow-hidden border border-bone/5">
                <div
                  className="h-full bg-gradient-to-r from-brass to-brass/60 flex items-center px-2"
                  style={{ width: `${Math.max(widthPct, s.count > 0 ? 2 : 0)}%` }}
                >
                  {s.count > 0 && widthPct > 12 && (
                    <span className="text-xs font-semibold text-ink tabular-nums">
                      {s.count}
                    </span>
                  )}
                </div>
                {s.count > 0 && widthPct <= 12 && (
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-bone/80 tabular-nums">
                    {s.count}
                  </span>
                )}
              </div>
              <div className="text-xs text-bone/60 tabular-nums whitespace-nowrap min-w-[120px] text-right">
                <span className="text-bone font-medium">
                  {fmt(s.totalCents)}
                </span>
                <span className="ml-2 text-bone/40">{takeRate}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
