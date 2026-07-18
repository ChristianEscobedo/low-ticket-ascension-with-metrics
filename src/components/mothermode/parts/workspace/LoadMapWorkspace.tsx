'use client';

import { useResourceWorkspace } from '@/hooks/mothermode/useResourceWorkspace';
import { WorkspaceCard, EmailGate, SaveIndicator, WorkspaceSelect, AppLeadIn } from './ui';

const DOMAINS = ['School', 'Health', 'Home', 'Money', 'Food', 'Social', 'Work logistics', 'Extended family'];
const OWNERS = ['You', 'Partner', 'Split', 'A kid', 'Nobody yet'];
const WEIGHTS = ['Light', 'Medium', 'Heavy'];

interface LoadMapRow {
  owner: string;
  weight: string;
}

interface LoadMapData extends Record<string, unknown> {
  rows: Record<string, LoadMapRow>;
}

const DEFAULT_DATA: LoadMapData = {
  rows: DOMAINS.reduce(
    (acc, d) => ({ ...acc, [d]: { owner: 'You', weight: 'Medium' } }),
    {} as Record<string, LoadMapRow>,
  ),
};

/**

 * The live, fillable version of The Load Map. One ongoing record so the
 * shape can be revisited and adjusted as the household actually changes,
 * with a live bar chart of who is carrying what recalculated on every edit.
 */
export const LoadMapWorkspace: React.FC = () => {
  const { email, setEmail, data, setData, status, loaded } = useResourceWorkspace<LoadMapData>({
    slug: 'brain-dump-system',
    key: 'load-map',
    mode: 'single',
    defaultData: DEFAULT_DATA,
  });

  const rows = data.rows || DEFAULT_DATA.rows;
  const ownerCounts = OWNERS.reduce((acc, o) => ({ ...acc, [o]: 0 }), {} as Record<string, number>);
  DOMAINS.forEach((d) => {
    const owner = rows[d]?.owner || 'You';
    ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
  });
  const total = DOMAINS.length;

  return (
    <WorkspaceCard
      eyebrow="Build it here"
      title="Your household's load map"
      subtitle="Set who currently holds each domain and how heavy it actually is. The chart below updates as you go."
    >
      <EmailGate email={email} onSubmit={setEmail} />

      {email && !loaded ? (
        <p className="text-sm text-ink/50">Loading your saved map&hellip;</p>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <SaveIndicator status={status} />
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">Domain</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">Held by</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {DOMAINS.map((d) => (
                  <tr key={d}>
                    <td className="px-4 py-2.5 font-medium text-ink">{d}</td>
                    <td className="px-4 py-2.5">
                      <WorkspaceSelect
                        value={rows[d]?.owner || 'You'}
                        onChange={(v) =>
                          setData((prev) => ({
                            ...prev,
                            rows: { ...prev.rows, [d]: { ...prev.rows[d], owner: v } },
                          }))
                        }
                        options={OWNERS}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <WorkspaceSelect
                        value={rows[d]?.weight || 'Medium'}
                        onChange={(v) =>
                          setData((prev) => ({
                            ...prev,
                            rows: { ...prev.rows, [d]: { ...prev.rows[d], weight: v } },
                          }))
                        }
                        options={WEIGHTS}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink/40">The shape, at a glance</p>
            <div className="mt-3 space-y-3">
              {OWNERS.filter((o) => ownerCounts[o] > 0).map((o) => {
                const pct = Math.round((ownerCounts[o] / total) * 100);
                return (
                  <div key={o}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-ink">{o}</span>
                      <span className="text-ink/50">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
                      <div
                        className={`h-full rounded-full ${o === 'You' ? 'bg-mode' : 'bg-brass'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <AppLeadIn
            text="MotherMode OS turns this map into a living system: assign tasks to your co-parent with an accept and decline workflow, share grocery lists, and let the AI understand your whole family's context, not just yours."
            ctaLabel="See family collaboration"
          />
        </>
      )}
    </WorkspaceCard>
  );
};
