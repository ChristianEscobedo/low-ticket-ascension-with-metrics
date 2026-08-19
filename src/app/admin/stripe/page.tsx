import IntegrationCard from '../integrations/IntegrationCard';
import { getIntegration } from '@/utils/integrations/store';
import { getLastWebhookEventAt } from '@/utils/supabase/admin';
import { maskConfig } from '@/utils/integrations/mask';
import { listFunnelsForAdmin } from '@/lib/mothermode/sales/store';
import { listAllAssignments } from '@/lib/mothermode/sales/productAssignments';
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
  // Stripe is a credential-only provider (always-on): the saved keys read
  // DB-first whenever they're present, no "Enabled" gate. Match the resolver.
  const cfg = (row?.config as StripeConfig | undefined) ?? {};
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

  // ── Funnel checkout readiness ──────────────────────────────────────────
  // Every published funnel, every enabled money step: can it actually charge?
  // A step is chargeable when it has a product assignment (Products tab), a
  // Stripe price id on the step content, or a legacy cents amount.
  const [funnels, assignments] = await Promise.all([
    listFunnelsForAdmin().catch(() => []),
    listAllAssignments().catch(() => []),
  ]);
  const readiness = funnels
    .filter((f) => f.status === 'published')
    .map((f) => {
      const steps: { key: string; label: string; chargeable: boolean; via: string }[] = [];
      const push = (
        key: string,
        label: string,
        content: { priceCents?: number; stripePriceId?: string; productId?: string },
      ) => {
        const assigned = assignments.some(
          (a) => a.funnelSlug === f.slug && a.step === key && a.role === 'main',
        );
        const via = assigned
          ? 'assignment'
          : content.stripePriceId
            ? 'price id'
            : (content.priceCents ?? 0) > 0
              ? 'amount'
              : '';
        steps.push({ key, label, chargeable: Boolean(via), via: via || 'nothing set' });
      };
      push('checkout', 'Checkout', f.checkout);
      if (f.upsell1?.enabled) push('upsell1', 'Upsell 1', f.upsell1);
      if (f.upsell2?.enabled) push('upsell2', 'Upsell 2', f.upsell2);
      if (f.upsell3?.enabled) push('upsell3', 'Upsell 3', f.upsell3);
      if (f.upsell4?.enabled) push('upsell4', 'Upsell 4', f.upsell4);
      return { slug: f.slug, name: f.name || f.slug, steps };
    });

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
    ['secret_key', 'secret_key_test', 'webhook_secret']
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

      {readiness.length > 0 && (
        <div className="rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 backdrop-blur p-6 mt-6">
          <div className="text-xs uppercase tracking-wider text-brass/70 font-semibold mb-1">
            Funnel checkout readiness
          </div>
          <p className="text-xs text-bone/50 mb-4">
            Published funnels and whether each enabled money step can charge.
            Fix gaps in Products → Assign to funnel page, or on the step's
            Pricing fields in the funnel builder.
          </p>
          <div className="space-y-3">
            {readiness.map((f) => (
              <div key={f.slug} className="rounded-lg border border-bone/10 bg-bone/[0.02] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-bone/85">{f.name}</span>
                  {f.steps.every((s) => s.chargeable) ? (
                    <span className="text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-brass/15 text-brass border border-brass/30">
                      ready
                    </span>
                  ) : (
                    <span className="text-[10px] rounded px-2 py-0.5 font-semibold uppercase tracking-wider bg-red-500/10 text-red-300 border border-red-500/30">
                      needs setup
                    </span>
                  )}
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {f.steps.map((s) => (
                    <li key={s.key} className="flex items-center gap-1.5 text-xs">
                      <span className={s.chargeable ? 'text-brass' : 'text-red-300'}>
                        {s.chargeable ? '✓' : '!'}
                      </span>
                      <span className="text-bone/70">{s.label}</span>
                      <span className="text-bone/35">({s.via})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">Runtime keys</h2>
        <p className="text-sm text-bone/60 mt-1 max-w-2xl">
          The keys saved here are used at runtime, DB-first, with no redeploy —
          a saved key is the config (no "Enabled" gate). With no key saved, the
          STRIPE_* environment variables are the fallback. Secrets are
          write-only; a blank field keeps the stored value.
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
                label: 'Secret key (live)',
                type: 'password',
                placeholder: 'sk_live_...'
              },
              {
                key: 'secret_key_test',
                label: 'Test secret key — for test-mode funnels',
                type: 'password',
                placeholder: 'sk_test_...'
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
