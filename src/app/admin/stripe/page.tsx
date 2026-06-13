import IntegrationCard from '../integrations/IntegrationCard';
import { getIntegration } from '@/utils/integrations/store';
import { getLastWebhookEventAt } from '@/utils/supabase/admin';
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
  const envSecret =
    process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY ?? '';
  const envPub =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    '';
  const envWh = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  const mode = detectMode(envSecret) || detectMode(envPub);
  const webhookEndpoint = getURL('api/webhooks');
  const status: Array<{ key: string; ok: boolean; label: string }> = [
    {
      key: 'pub',
      label: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      ok: present(envPub)
    },
    { key: 'sec', label: 'STRIPE_SECRET_KEY', ok: present(envSecret) },
    { key: 'wh', label: 'STRIPE_WEBHOOK_SECRET', ok: present(envWh) }
  ];
  const allOk = status.every((s) => s.ok);
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
        Payments
      </div>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
        Stripe Connection
      </h1>
      <p className="mt-2 text-white/60 max-w-2xl">
        Health check for the Stripe credentials your deployment is running
        with. Runtime always reads from environment variables; the editor
        below stores a reference copy in the integrations table so you can
        manage keys without grepping `.env` files.
      </p>

      <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6 mt-8 shadow-[0_0_30px_rgba(251,191,36,0.04)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className={
                allOk
                  ? 'inline-block h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.7)]'
                  : 'inline-block h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]'
              }
            />
            <div className="text-lg font-semibold tracking-tight">
              {allOk ? 'Stripe is configured' : 'Stripe needs attention'}
            </div>
            <span
              className={
                mode === 'live'
                  ? 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : mode === 'test'
                    ? 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-300 border border-sky-500/30'
                    : 'text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-white/[0.06] text-white/50 border border-white/10'
              }
            >
              {mode === 'unknown' ? 'no key' : `${mode} mode`}
            </span>
          </div>
          <a
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noreferrer"
            className="text-amber-300 text-sm hover:text-amber-200 hover:underline whitespace-nowrap"
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
                    ? 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold'
                    : 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500/15 text-red-300 text-xs font-bold'
                }
              >
                {s.ok ? '✓' : '!'}
              </span>
              <code className="text-white/80">{s.label}</code>
              <span className="text-white/40">
                {s.ok ? 'set' : 'missing from environment'}
              </span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
          <div>
            <div className="text-xs uppercase tracking-wider text-amber-200/70 font-semibold mb-1.5">
              Webhook endpoint
            </div>
            <code className="block break-all text-xs text-white/70 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
              {webhookEndpoint}
            </code>
            <a
              href="https://dashboard.stripe.com/webhooks"
              target="_blank"
              rel="noreferrer"
              className="text-amber-300 text-xs hover:text-amber-200 hover:underline mt-2 inline-block"
            >
              Configure in Stripe ↗
            </a>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-amber-200/70 font-semibold mb-1.5">
              Last funnel event recorded
            </div>
            <div className="text-sm text-white/80">
              {lastEventAt
                ? new Date(lastEventAt).toLocaleString()
                : 'No events yet.'}
            </div>
            <div className="text-xs text-white/40 mt-1">
              From <code>funnel_purchases.created_at</code>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">Editable copy</h2>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">
          Keys saved here are a managed reference, not the runtime source.
          Paste them into your hosting provider's environment (Vercel, fly,
          etc.) and redeploy for changes to take effect.
        </p>
        <div className="mt-4">
          <IntegrationCard
            provider="stripe"
            title="Stripe keys"
            description="Stored encrypted-at-rest in Supabase. Runtime still reads STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET from process.env."
            badge={{ label: 'Reference', tone: 'soon' }}
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
            initialConfig={(row?.config as Record<string, unknown>) ?? {}}
            hideEventsFilter
            hideTestButton
          />
        </div>
      </div>
    </div>
  );
}
