import IntegrationCard from './IntegrationCard';
import ResendHealthCard from './ResendHealthCard';
import TestReceiptCard from './TestReceiptCard';
import { getIntegration } from '@/utils/integrations/store';
import { getResendWebhookHealth } from '@/utils/email/receipt-log';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import type {
  GenericWebhookConfig,
  GhlConfig,
  MassConfig
} from '@/utils/integrations/types';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const supabase = createClient();
  const [webhook, ghl, mass, user, resendHealth] = await Promise.all([
    getIntegration<GenericWebhookConfig>('generic_webhook'),
    getIntegration<GhlConfig>('ghl'),
    getIntegration<MassConfig>('mass'),
    getUser(supabase),
    getResendWebhookHealth()
  ]);

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
        Connect
      </div>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
        Integrations
      </h1>
      <p className="mt-2 text-white/60 max-w-2xl">
        Fan out every funnel purchase to the systems you already use. Toggle
        per-stage delivery, drop in credentials, and send a test event without
        leaving the dashboard.
      </p>

      <div className="space-y-4 mt-8">
        <IntegrationCard
          provider="generic_webhook"
          title="Webhook (Zapier / Make / custom)"
          description="POSTs each purchase to your URL as JSON. Use this for Zapier Catch Hooks, Make Custom Webhooks, or any in-house endpoint. Optional HMAC-SHA256 signature is sent as the `x-mindshift-signature` header."
          badge={{ label: 'Live', tone: 'live' }}
          fields={[
            {
              key: 'url',
              label: 'Endpoint URL',
              placeholder: 'https://hooks.zapier.com/hooks/catch/...'
            },
            {
              key: 'secret',
              label: 'HMAC secret (optional)',
              type: 'password',
              placeholder: 'used to sign the payload'
            }
          ]}
          initialEnabled={webhook?.enabled ?? false}
          initialEvents={webhook?.events ?? []}
          initialConfig={(webhook?.config as Record<string, unknown>) ?? {}}
        />

        <IntegrationCard
          provider="ghl"
          title="GoHighLevel"
          description="Upserts the buyer as a contact in your GHL location and applies a tag per funnel stage (e.g. `mindshift:fe`). The contact's name is parsed into first / last."
          badge={{ label: 'Live', tone: 'live' }}
          fields={[
            {
              key: 'api_key',
              label: 'Private Integration token',
              type: 'password',
              placeholder: 'pit-...',
              helper: 'Sub-Account → Settings → Private Integrations'
            },
            {
              key: 'location_id',
              label: 'Location ID',
              placeholder: 'ABC123...',
              helper: 'Sub-Account → Settings → Company'
            },
            {
              key: 'tag_prefix',
              label: 'Tag prefix',
              placeholder: 'mindshift',
              helper: 'Tags applied as `<prefix>:<page_type>`'
            },
            {
              key: 'workflow_id',
              label: 'Workflow ID (optional)',
              placeholder: 'Trigger a workflow on each upsert'
            }
          ]}
          initialEnabled={ghl?.enabled ?? false}
          initialEvents={ghl?.events ?? []}
          initialConfig={(ghl?.config as Record<string, unknown>) ?? {}}
        />

        <IntegrationCard
          provider="mass"
          title="Mass (mass.new)"
          description="Push purchases into your Mass workspace to build email & retargeting audiences. Configuration is stored now; outbound dispatch wires up once the Mass ingest API ships."
          badge={{ label: 'Coming soon', tone: 'soon' }}
          fields={[
            {
              key: 'api_key',
              label: 'Mass API key',
              type: 'password',
              placeholder: 'mass_sk_...'
            },
            {
              key: 'workspace_id',
              label: 'Workspace ID',
              placeholder: 'ws_...'
            }
          ]}
          initialEnabled={mass?.enabled ?? false}
          initialEvents={mass?.events ?? []}
          initialConfig={(mass?.config as Record<string, unknown>) ?? {}}
          hideTestButton
        />
      </div>

      <div className="mt-10">
        <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
          Diagnostics
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-4">
          Transactional email
        </h2>
        <div className="space-y-4">
          <ResendHealthCard health={resendHealth} />
          <TestReceiptCard defaultEmail={user?.email ?? ''} />
        </div>
      </div>
    </div>
  );
}
