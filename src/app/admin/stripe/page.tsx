import IntegrationCard from '../integrations/IntegrationCard';
import { getIntegration } from '@/utils/integrations/store';
import { getLastWebhookEventAt } from '@/utils/supabase/admin';
import { maskConfig } from '@/utils/integrations/mask';
import {
  getStripeSecretKey,
  getStripeWebhookSecret,
  getStripePublishableKey
} from '@/utils/integrations/runtime-config';
import type { StripeConfig } from '@/utils/integrations/types';
import { getURL } from '@/utils/helpers';

export const dynamic = 'force-dynamic';

const detectMode = (key?: string | null): 'live' | 'test' | 'unknown' => {
  if (!key) return 'unknown';
  if (key.startsWith('sk_live_') || key.startsWith('pk_live_')) return 'live';
  if (key.startsWith('sk_test_') || key.startsWith('pk_test_')) return 'test';
  return 'unknown';
};

const present = (v?: string | null) => Boolean(v && v.length > 0);

export default async function StripeAdminPage() {
  const [row, lastEventAt] = await Promise.all([
    getIntegration<StripeConfig>('stripe'),
    getLastWebhookEventAt()
  ]);
  // Only an enabled row overrides at runtime, matching the resolver semantics.
  const cfg =
    (row?.enabled ? (row?.config as StripeConfig | undefined) : undefined) ?? {};
  const dbHas = (k: keyof StripeConfig) =>
    Boolean(cfg[k] && String(cfg[k]).trim());

  // Resolve exactly like runtime does: enabled DB row first, then env.
  const [secretKey, pubKey, whSecret] = await Promise.all([
    getStripeSecretKey(),
    getStripePublishableKey(),
    getStripeWebhookSecret()
  ]);
  const mode = detectMode(secretKey) || detectMode(pubKey);
  const webhookEndpoint = getURL('api/webhooks');

  const sourceLabel = (resolved: string | null, dbKey: keyof StripeConfig) =>
    !present(resolved)
      ? 'missing'
      : dbHas(dbKey)
        ? 'from database'
        : 'from environment';

  const status: Array<{
    key: string;
    ok: boolean;
    label: string;
    source: string;
  }> = [
    {
      key: 'pub',
      label: 'Publishable key',
      ok: present(pubKey),
      source: sourceLabel(pubKey, 'publishable_key')
    },
    {
      key: 'sec',
      label: 'Secret key',
      ok: present(secretKey),
      source: sourceLabel(secretKey, 'secret_key')
    },
    {
      key: 'wh',
      label: 'Webhook signing secret',
      ok: present(whSecret),
      source: sourceLabel(whSecret, 'webhook_secret')
    }
  ];
  const allOk = status.every((s) => s.ok);
  const stripeMask = maskConfig(
    row?.config as Record<string, unknown> | undefined,
    ['secret_key', 'webhook_secret']
  );
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Payments
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
        Stripe Connection
      </h1>
      <p className="mt-2 text-bone/60 max-w-2xl">
        Health check for the Stripe credentials your deployment is running
        with. Runtime reads the editor below first when this integration is
        enabled, then falls back to the environment variables. Each row shows
        which source is in effect.
      </p>

      <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-6 mt-8 shadow-[0_0_30px_rgba(168,139,92,0.06)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className={
                allOk
                  ? 'inline-block h-2.5 w-2.5 rounded-full bg-brass shadow-[0_0_12px_rgba(168,139,92,0.7)]'
                  : 'inline-block h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]'
              }
            />
            <div className="text-lg font-semibold tracking-tight">
              {allOk ? 'Stripe is configured' : 'Stripe needs attention'}
            </div>
            <span
              className={
                mode === 'live'
                  ? 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-brass/15 text-brass border border-brass/30'
                  : mode === 'test'
                    ? 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-300 border border-sky-500/30'
                    : 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-bone/[0.06] text-bone/50 border border-bone/10'
              }
            >
              {mode === 'unknown' ? 'no key' : `${mode} mode`}
            </span>
          </div>
          <a
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noreferrer"
            className="text-brass text-sm hover:text-brass/80 hover:underline whitespace-nowrap"
          >
            Open Stripe Dashboard ↗
          </a>
        </div>

        <ul className="mt-5 space-y-2">
          {status.map((s) => (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                className={
                  s.ok
                    ? 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-brass/15 text-brass text-xs font-bold'
                    : 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500/15 text-red-300 text-xs font-bold'
                }
              >
                {s.ok ? '✓' : '!'}
              </span>
              <code className="text-bone/80">{s.label}</code>
              <span className="text-bone/40">{s.source}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-bone/10">
          <div>
            <div className="text-xs uppercase tracking-wider text-brass/70 font-semibold mb-1.5">
              Webhook endpoint
            </div>
            <code className="block break-all text-xs text-bone/70 bg-bone/[0.03] border border-bone/10 rounded-lg px-3 py-2">
              {webhookEndpoint}
            </code>
            <a
              href="https://dashboard.stripe.com/webhooks"
              target="_blank"
              rel="noreferrer"
              className="text-brass text-xs hover:text-brass/80 hover:underline mt-2 inline-block"
            >
              Configure in Stripe ↗
            </a>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-brass/70 font-semibold mb-1.5">
              Last funnel event recorded
            </div>
            <div className="text-sm text-bone/80">
              {lastEventAt
                ? new Date(lastEventAt).toLocaleString()
                : 'No events yet.'}
            </div>
            <div className="text-xs text-bone/40 mt-1">
              From <code>funnel_purchases.created_at</code>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">Runtime keys</h2>
        <p className="text-sm text-bone/60 mt-1 max-w-2xl">
          Enable this integration and the keys saved here are used at runtime,
          DB-first, with no redeploy. Leave it disabled to keep running on the
          STRIPE_* environment variables. Secrets are write-only; a blank field
          keeps the stored value.
        </p>
        <div className="mt-4">
          <IntegrationCard
            provider="stripe"
            title="Stripe keys"
            description="Stored in Supabase and read DB-first when enabled. Falls back to STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET."
            badge={{ label: 'Live', tone: 'live' }}
            fields={[
              {
                key: 'publishable_key',
                label: 'Publishable key',
                placeholder: 'pk_test_... or pk_live_...'
              },
              {
                key: 'secret_key',
                label: 'Secret key',
                type: 'password',
                placeholder: 'sk_test_... or sk_live_...'
              },
              {
                key: 'webhook_secret',
                label: 'Webhook signing secret',
                type: 'password',
                placeholder: 'whsec_...'
              }
            ]}
            initialEnabled={row?.enabled ?? false}
            initialEvents={row?.events ?? []}
            initialConfig={stripeMask.safeConfig}
            secretStatus={stripeMask.secretStatus}
            hideEventsFilter
            hideTestButton
          />
        </div>
      </div>
    </div>
  );
}
