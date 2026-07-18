'use client';

import { useResourceWorkspace } from '@/hooks/mothermode/useResourceWorkspace';
import {
  WorkspaceCard,
  EmailGate,
  SaveIndicator,
  PeriodNav,
  WorkspaceTextarea,
  WorkspaceCheckbox,
  AppLeadIn,
} from './ui';

const STEPS: { key: string; label: string; description: string }[] = [
  { key: 'newCaptured', label: 'New items captured', description: 'Whatever landed on you since the last reset.' },
  { key: 'newSorted', label: 'New items sorted', description: 'Every one placed in Drop, Automate, Delegate, or Keep.' },
  { key: 'delegateChecked', label: 'Delegate bucket checked', description: 'Anything that boomeranged back, addressed with a script.' },
  { key: 'nextWeekScanned', label: 'Next 7 days scanned', description: 'Any deadline that needs a decision before it becomes urgent.' },
  { key: 'automationsHolding', label: 'Automations still holding', description: 'Nothing quietly reverted to manual.' },
];

interface WeeklyResetData extends Record<string, unknown> {
  newThisWeek: string;
  boomeranged: string;
  steps: Record<string, boolean>;
}

const DEFAULT_DATA: WeeklyResetData = {
  newThisWeek: '',
  boomeranged: '',
  steps: STEPS.reduce((acc, s) => ({ ...acc, [s.key]: false }), {} as Record<string, boolean>),
};

/**
 * The live, weekly-recurring version of The Weekly Reset. One record per
 * ISO week, so a buyer builds an actual streak of resets over time and can
 * page back to see prior weeks, or clone the current one forward into next
 * Sunday's blank slate.
 */
export const WeeklyResetWorkspace: React.FC = () => {
  const {
    email,
    setEmail,
    periods,
    periodKey,
    periodLabel,
    data,
    setData,
    status,
    loaded,
    goToPeriod,
    startNextWeek,
  } = useResourceWorkspace<WeeklyResetData>({
    slug: 'brain-dump-system',
    key: 'weekly-reset',
    mode: 'weekly',
    defaultData: DEFAULT_DATA,
  });

  const sorted = [...periods].sort((a, b) => (a.periodKey < b.periodKey ? -1 : 1));
  const idx = sorted.findIndex((p) => p.periodKey === periodKey);
  const canGoBack = idx > 0;
  const canGoForward = idx >= 0 && idx < sorted.length - 1;
  const isCurrentActual = periodKey === sorted[sorted.length - 1]?.periodKey || sorted.length === 0;
  const completedCount = STEPS.filter((s) => data.steps?.[s.key]).length;
  const streak = periods.filter((p) => {
    const done = STEPS.filter((s) => (p.data as WeeklyResetData).steps?.[s.key]).length;
    return done === STEPS.length;
  }).length;

  return (
    <WorkspaceCard
      eyebrow="Run it here"
      title="This week's reset"
      subtitle="Ten minutes, once a week. Check each step off as you go, then start next week whenever you are ready."
    >
      <EmailGate email={email} onSubmit={setEmail} />

      {email && !loaded ? (
        <p className="text-sm text-ink/50">Loading your reset history&hellip;</p>
      ) : (
        <>
          <PeriodNav
            periodLabel={periodLabel}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={() => canGoBack && goToPeriod(sorted[idx - 1].periodKey)}
            onForward={() => canGoForward && goToPeriod(sorted[idx + 1].periodKey)}
            onStartNext={(clone) => startNextWeek(clone)}
            isCurrent={isCurrentActual}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink/40">
              {completedCount} of {STEPS.length} steps done
              {streak > 1 && <span className="text-mode"> &middot; {streak} week streak</span>}
            </span>
            <SaveIndicator status={status} />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-ink">New items that landed this week</label>
            <div className="mt-2">
              <WorkspaceTextarea
                value={data.newThisWeek}
                onChange={(v) => setData((prev) => ({ ...prev, newThisWeek: v }))}
                placeholder="Catch it here before you sort it..."
                rows={2}
              />
            </div>
          </div>

          <div className="mt-5 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white/50 px-4">
            {STEPS.map((s) => (
              <WorkspaceCheckbox
                key={s.key}
                checked={!!data.steps?.[s.key]}
                onChange={(v) => setData((prev) => ({ ...prev, steps: { ...prev.steps, [s.key]: v } }))}
                label={s.label}
                description={s.description}
              />
            ))}
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-ink">Anything that boomeranged back to you</label>
            <div className="mt-2">
              <WorkspaceTextarea
                value={data.boomeranged}
                onChange={(v) => setData((prev) => ({ ...prev, boomeranged: v }))}
                placeholder="Use the &quot;when it comes back&quot; line from The Delegate Scripts."
                rows={2}
              />
            </div>
          </div>

          <AppLeadIn
            text="You are already running a weekly rhythm by hand. The MotherMode OS dashboard aggregates tasks, groceries, and the calendar automatically, with real-time notifications when something new lands."
            ctaLabel="See the dashboard"
          />
        </>
      )}
    </WorkspaceCard>
  );
};
