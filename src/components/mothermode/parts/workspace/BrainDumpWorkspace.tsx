'use client';

import { useResourceWorkspace } from '@/hooks/mothermode/useResourceWorkspace';
import {
  WorkspaceCard,
  EmailGate,
  SaveIndicator,
  WorkspaceTextarea,
  AppLeadIn,
} from './ui';

const DOMAINS: { key: string; label: string; hint: string }[] = [
  { key: 'school', label: 'School', hint: 'Permission slips, supply lists, deadlines, pickup changes.' },
  { key: 'health', label: 'Health', hint: 'Appointments, prescriptions, symptoms to watch, growth logistics.' },
  { key: 'home', label: 'Home', hint: 'Repairs, maintenance, supplies, seasonal swaps, services to book.' },
  { key: 'money', label: 'Money', hint: 'Bills, subscriptions, reimbursements, upcoming costs.' },
  { key: 'food', label: 'Food', hint: 'This week, groceries, lunches, special requests.' },
  { key: 'social', label: 'Social', hint: 'Invitations, gifts, playdates, your own plans.' },
  { key: 'work', label: 'Work', hint: 'Schedule conflicts, time off, loose threads.' },
  { key: 'extended', label: 'Extended family', hint: 'Dates, care coordination, visits.' },
];

interface BrainDumpData extends Record<string, unknown> {
  topOfMind: string;
  domains: Record<string, string>;
}

const DEFAULT_DATA: BrainDumpData = {
  topOfMind: '',
  domains: DOMAINS.reduce((acc, d) => ({ ...acc, [d.key]: '' }), {} as Record<string, string>),
};

/**
 * The live, savable version of The Brain Dump Template. Mirrors the eight
 * domains from the static walkthrough above it, but typed and stored instead
 * of just read. One ongoing record, not weekly, since a brain dump is meant
 * to be revisited and edited in place as new things surface.
 */
export const BrainDumpWorkspace: React.FC = () => {
  const { email, setEmail, data, setData, status, loaded } = useResourceWorkspace<BrainDumpData>({
    slug: 'brain-dump-system',
    key: 'brain-dump-template',
    mode: 'single',
    defaultData: DEFAULT_DATA,
  });

  const filledCount = DOMAINS.filter((d) => (data.domains?.[d.key] || '').trim().length > 0).length;

  return (
    <WorkspaceCard
      eyebrow="Do it here"
      title="Your brain dump, typed and saved"
      subtitle="Fill each domain below. It saves as you type, so you can close this and come back mid-week without losing anything."
    >
      <EmailGate email={email} onSubmit={setEmail} />

      {email && !loaded ? (
        <p className="text-sm text-ink/50">Loading your last dump&hellip;</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink/40">
              {filledCount} of {DOMAINS.length} domains started
            </span>
            <SaveIndicator status={status} />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-ink">The one thing already nagging you</label>
            <div className="mt-2">
              <WorkspaceTextarea
                value={data.topOfMind}
                onChange={(v) => setData((prev) => ({ ...prev, topOfMind: v }))}
                placeholder="Get it out of the way first..."
                rows={2}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {DOMAINS.map((d) => (
              <div key={d.key}>
                <label className="block text-sm font-medium text-ink">{d.label}</label>
                <p className="mt-0.5 text-xs text-ink/45">{d.hint}</p>
                <div className="mt-2">
                  <WorkspaceTextarea
                    value={data.domains?.[d.key] || ''}
                    onChange={(v) =>
                      setData((prev) => ({ ...prev, domains: { ...prev.domains, [d.key]: v } }))
                    }
                    placeholder="Write in fragments. Do not organize yet."
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </div>

          <AppLeadIn
            text="This page empties your head once. The MotherMode OS is the assistant that keeps it empty, planning meals, routines, and the grocery list around your family automatically."
            ctaLabel="See the OS"
          />
        </>
      )}
    </WorkspaceCard>
  );
};
