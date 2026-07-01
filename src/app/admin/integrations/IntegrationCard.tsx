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
  /** Write-only secret: never echoed back, blank submit keeps the stored value. */
  secret?: boolean;
}

export interface SecretStatus {
  configured: boolean;
  last4?: string;
}

interface Props {
  provider: IntegrationProvider;
  title: string;
  description: string;
  fields: FieldDef[];
  initialEnabled: boolean;
  initialEvents: string[];
  initialConfig: Record<string, unknown>;
  /** Per-key status for secret fields, computed server-side (no raw values). */
  secretStatus?: Record<string, SecretStatus>;
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
  secretStatus,
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
      className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-6 shadow-[0_0_30px_rgba(168,139,92,0.06)]"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
            {badge && (
              <span
                className={
                  badge.tone === 'live'
                    ? 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-brass/15 text-brass border border-brass/30'
                    : 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-bone/[0.06] text-bone/50 border border-bone/10'
                }
              >
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-sm text-bone/60 mt-1 max-w-2xl">{description}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-bone/70 select-none">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initialEnabled}
            disabled={disableSave}
            className="h-4 w-4 accent-brass"
          />
          Enabled
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        {fields.map((f) => {
          const isSecret = f.secret || f.type === 'password';
          const status = secretStatus?.[f.key];
          // Secrets are write-only: render empty, never echo the stored value.
          const defaultValue = isSecret
            ? ''
            : String(initialConfig[f.key] ?? '');
          const secretHint = isSecret
            ? status?.configured
              ? `Saved ••••${status.last4 ?? ''}. Leave blank to keep.`
              : 'Not set'
            : null;
          return (
            <label key={f.key} className="block text-sm">
              <span className="text-bone/70">{f.label}</span>
              <input
                name={`config.${f.key}`}
                type={f.type ?? 'text'}
                placeholder={f.placeholder}
                defaultValue={defaultValue}
                autoComplete={isSecret ? 'off' : undefined}
                disabled={disableSave}
                className="mt-1 w-full rounded-lg bg-bone/[0.03] border border-bone/10 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/60 focus:bg-bone/[0.05] transition-colors disabled:opacity-50"
              />
              {secretHint && (
                <span className="text-xs text-bone/40 mt-1 block">
                  {secretHint}
                </span>
              )}
              {f.helper && (
                <span className="text-xs text-bone/40 mt-1 block">{f.helper}</span>
              )}
            </label>
          );
        })}
      </div>

      {!hideEventsFilter && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-brass/70 font-semibold mb-2">
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
                  className="inline-flex items-center gap-2 text-xs rounded-full px-3 py-1.5 bg-bone/[0.04] border border-bone/10 hover:border-brass/40 hover:text-brass transition-colors cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    name="events"
                    value={pt}
                    defaultChecked={checked}
                    disabled={disableSave}
                    className="h-3 w-3 accent-brass"
                  />
                  {pt}
                </label>
              );
            })}
          </div>
          <div className="text-xs text-bone/40 mt-2">
            Leave all unchecked to fire on every funnel purchase.
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={pending || disableSave}
          className="rounded-lg bg-brass hover:bg-brass/90 text-ink px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {!hideTestButton && (
          <button
            type="button"
            onClick={onTest}
            disabled={testing || disableSave}
            className="rounded-lg border border-brass/20 px-4 py-2 text-sm text-brass hover:bg-brass/[0.06] hover:border-brass/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? 'Sending…' : 'Send test event'}
          </button>
        )}
        {result && <span className="text-sm text-bone/60">{result}</span>}
      </div>
    </form>
  );
}
