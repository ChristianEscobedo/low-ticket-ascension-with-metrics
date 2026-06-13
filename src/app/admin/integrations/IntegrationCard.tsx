'use client';

import { useState, useTransition } from 'react';
import { saveIntegrationAction, sendTestEventAction } from './actions';
import { PAGE_TYPES } from '@/utils/integrations/types';
import type { IntegrationProvider } from '@/utils/integrations/types';

export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
  helper?: string;
}

interface Props {
  provider: IntegrationProvider;
  title: string;
  description: string;
  fields: FieldDef[];
  initialEnabled: boolean;
  initialEvents: string[];
  initialConfig: Record<string, unknown>;
  badge?: { label: string; tone: 'live' | 'soon' };
  hideEventsFilter?: boolean;
  hideTestButton?: boolean;
  disableSave?: boolean;
}

export default function IntegrationCard({
  provider,
  title,
  description,
  fields,
  initialEnabled,
  initialEvents,
  initialConfig,
  badge,
  hideEventsFilter,
  hideTestButton,
  disableSave
}: Props) {
  const [pending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    formData.set('provider', provider);
    startTransition(async () => {
      setResult(null);
      try {
        await saveIntegrationAction(formData);
        setResult('Saved.');
      } catch (err: any) {
        setResult(err?.message ?? 'Save failed.');
      }
    });
  };

  const onTest = async () => {
    setTesting(true);
    setResult(null);
    const res = await sendTestEventAction(provider);
    setResult(res.message);
    setTesting(false);
  };

  return (
    <form
      action={onSubmit}
      className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6 shadow-[0_0_30px_rgba(251,191,36,0.04)]"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
            {badge && (
              <span
                className={
                  badge.tone === 'live'
                    ? 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-white/[0.06] text-white/50 border border-white/10'
                }
              >
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-sm text-white/60 mt-1 max-w-2xl">{description}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-white/70 select-none">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initialEnabled}
            disabled={disableSave}
            className="h-4 w-4 accent-amber-400"
          />
          Enabled
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="text-white/70">{f.label}</span>
            <input
              name={`config.${f.key}`}
              type={f.type ?? 'text'}
              placeholder={f.placeholder}
              defaultValue={String(initialConfig[f.key] ?? '')}
              disabled={disableSave}
              className="mt-1 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-300/60 focus:bg-white/[0.05] transition-colors disabled:opacity-50"
            />
            {f.helper && (
              <span className="text-xs text-white/40 mt-1 block">{f.helper}</span>
            )}
          </label>
        ))}
      </div>

      {!hideEventsFilter && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-amber-200/70 font-semibold mb-2">
            Fire on
          </div>
          <div className="flex flex-wrap gap-2">
            {PAGE_TYPES.map((pt) => {
              const checked = initialEvents.length === 0
                ? false
                : initialEvents.includes(pt);
              return (
                <label
                  key={pt}
                  className="inline-flex items-center gap-2 text-xs rounded-full px-3 py-1.5 bg-white/[0.04] border border-white/10 hover:border-amber-200/40 hover:text-amber-200 transition-colors cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    name="events"
                    value={pt}
                    defaultChecked={checked}
                    disabled={disableSave}
                    className="h-3 w-3 accent-amber-400"
                  />
                  {pt}
                </label>
              );
            })}
          </div>
          <div className="text-xs text-white/40 mt-2">
            Leave all unchecked to fire on every funnel purchase.
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={pending || disableSave}
          className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {!hideTestButton && (
          <button
            type="button"
            onClick={onTest}
            disabled={testing || disableSave}
            className="rounded-lg border border-amber-200/20 px-4 py-2 text-sm text-amber-200 hover:bg-amber-200/[0.06] hover:border-amber-200/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? 'Sending…' : 'Send test event'}
          </button>
        )}
        {result && <span className="text-sm text-white/60">{result}</span>}
      </div>
    </form>
  );
}
