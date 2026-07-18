'use client';

import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useResourceWorkspace } from '@/hooks/mothermode/useResourceWorkspace';
import { WorkspaceCard, EmailGate, SaveIndicator, WorkspaceInput, WorkspaceSelect, AppLeadIn } from './ui';

const RECIPIENTS = ['A partner', 'Kids', 'Extended family', 'A friend or helper'];
const STATUSES = ['Not sent yet', 'Sent, waiting', 'Confirmed', 'Boomeranged back'];

interface DelegateItem {
  id: string;
  task: string;
  recipient: string;
  status: string;
}

interface DelegateData extends Record<string, unknown> {
  items: DelegateItem[];
}

const DEFAULT_DATA: DelegateData = { items: [] };

const statusTone = (s: string) => {
  if (s === 'Confirmed') return 'bg-mode/10 text-mode';
  if (s === 'Boomeranged back') return 'bg-red-50 text-red-600';
  if (s === 'Sent, waiting') return 'bg-brass/10 text-brass';
  return 'bg-ink/5 text-ink/50';
};

/**
 * A running tracker for whatever landed in the Delegate bucket during The
 * Sorting Pass. One ongoing list a buyer adds to as items come up, marking
 * each sent, confirmed, or boomeranged back, so handoffs stop living only
 * in memory the same way the original brain dump did.
 */
export const DelegateTrackerWorkspace: React.FC = () => {
  const { email, setEmail, data, setData, status, loaded } = useResourceWorkspace<DelegateData>({
    slug: 'brain-dump-system',
    key: 'delegate-scripts',
    mode: 'single',
    defaultData: DEFAULT_DATA,
  });
  const [draft, setDraft] = useState('');

  const items = data.items || [];

  function addItem() {
    if (!draft.trim()) return;
    const item: DelegateItem = {
      id: `${Date.now()}`,
      task: draft.trim(),
      recipient: RECIPIENTS[0],
      status: STATUSES[0],
    };
    setData((prev) => ({ ...prev, items: [...(prev.items || []), item] }));
    setDraft('');
  }

  function updateItem(id: string, patch: Partial<DelegateItem>) {
    setData((prev) => ({
      ...prev,
      items: (prev.items || []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }

  function removeItem(id: string) {
    setData((prev) => ({ ...prev, items: (prev.items || []).filter((i) => i.id !== id) }));
  }

  const confirmedCount = items.filter((i) => i.status === 'Confirmed').length;

  return (
    <WorkspaceCard
      eyebrow="Track it here"
      title="Your delegate tracker"
      subtitle="Add every item that landed in Delegate during the sorting pass, then move each one from sent to confirmed."
    >
      <EmailGate email={email} onSubmit={setEmail} />

      {email && !loaded ? (
        <p className="text-sm text-ink/50">Loading your tracker&hellip;</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink/40">
              {confirmedCount} of {items.length} confirmed
            </span>
            <SaveIndicator status={status} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addItem();
            }}
            className="mt-4 flex gap-2"
          >
            <WorkspaceInput
              value={draft}
              onChange={setDraft}
              placeholder="e.g. Dentist scheduling"
            />
            <button
              type="submit"
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-mode px-4 py-2.5 text-sm font-semibold text-bone transition-colors hover:bg-mode-deep"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </form>

          {items.length === 0 ? (
            <p className="mt-6 text-sm text-ink/45">
              Nothing tracked yet. Add the first item from your Delegate bucket above.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-ink/10 bg-white/70 p-4 sm:flex sm:items-center sm:gap-3"
                >
                  <div className="flex flex-1 items-center gap-2">
                    {item.status === 'Confirmed' && <Check className="h-4 w-4 flex-shrink-0 text-mode" />}
                    <span className={`font-medium text-ink ${item.status === 'Confirmed' ? 'text-ink/50 line-through' : ''}`}>
                      {item.task}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
                    <div className="w-36">
                      <WorkspaceSelect
                        value={item.recipient}
                        onChange={(v) => updateItem(item.id, { recipient: v })}
                        options={RECIPIENTS}
                      />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                      <select
                        value={item.status}
                        onChange={(e) => updateItem(item.id, { status: e.target.value })}
                        className="bg-transparent text-xs font-semibold focus:outline-none"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-lg p-1.5 text-ink/30 transition-colors hover:text-red-500"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <AppLeadIn
            text="The OS turns a handoff into a real assignment: your partner gets a notification, taps accept, and it moves off your list for good, with a gentle nudge if it stalls."
            ctaLabel="See how handoffs work"
          />
        </>
      )}
    </WorkspaceCard>
  );
};
