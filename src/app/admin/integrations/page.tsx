import IntegrationCard from './IntegrationCard';
import ResendHealthCard from './ResendHealthCard';
import TestReceiptCard from './TestReceiptCard';
import { getIntegration } from '@/utils/integrations/store';
import { getResendWebhookHealth } from '@/utils/email/receipt-log';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { maskConfig } from '@/utils/integrations/mask';
import type {
  GenericWebhookConfig,
  GhlConfig,
  MassConfig,
  OpenAiConfig,
  AnthropicConfig,
  EmailConfig
} from '@/utils/integrations/types';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const supabase = createClient();
  const [webhook, ghl, mass, openai, anthropic, email, user, resendHealth] =
    await Promise.all([
      getIntegration<GenericWebhookConfig>('generic_webhook'),
      getIntegration<GhlConfig>('ghl'),
      getIntegration<MassConfig>('mass'),
      getIntegration<OpenAiConfig>('openai'),
      getIntegration<AnthropicConfig>('anthropic'),
      getIntegration<EmailConfig>('email'),
      getUser(supabase),
      getResendWebhookHealth()
    ]);

  // Strip secrets before they reach the client cards; pass only configured +
  // last4 status so the UI can show a "saved, leave blank to keep" hint.
  const asCfg = (c: unknown) => c as Record<string, unknown> | undefined;
  const webhookMask = maskConfig(asCfg(webhook?.config), ['secret']);
  const ghlMask = maskConfig(asCfg(ghl?.config), ['api_key']);
  const massMask = maskConfig(asCfg(mass?.config), ['api_key']);
  const openaiMask = maskConfig(asCfg(openai?.config), ['api_key']);
  const anthropicMask = maskConfig(asCfg(anthropic?.config), ['api_key']);
  const emailMask = maskConfig(asCfg(email?.config), [
    'resend_api_key',
    'postmark_api_token'
  ]);

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Connect
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
        Integrations
      </h1>
      <p className="mt-2 text-bone/60 max-w-2xl">
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
          initialConfig={webhookMask.safeConfig}
          secretStatus={webhookMask.secretStatus}
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
          initialConfig={ghlMask.safeConfig}
          secretStatus={ghlMask.secretStatus}
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
          initialConfig={massMask.safeConfig}
          secretStatus={massMask.secretStatus}
          hideTestButton
        />
      </div>

      <div className="mt-10">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          AI
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight mb-2">
          Content generation
        </h2>
        <p className="text-sm text-bone/60 max-w-2xl mb-4">
          Keys and model defaults for the Content Hub. Anything set here is read
          first; the matching environment variable stays as a fallback, so an
          empty field uses the deployed default.
        </p>
        <div className="space-y-4">
          <IntegrationCard
            provider="openai"
            title="OpenAI"
            description="Powers image generation (gpt-image-2) and, when no Anthropic key is set, the text rewrites. The model fields override the deployed defaults."
            fields={[
              {
                key: 'api_key',
                label: 'API key',
                type: 'password',
                placeholder: 'sk-...'
              },
              {
                key: 'image_model',
                label: 'Image model',
                placeholder: 'gpt-image-2',
                helper: 'Default image model for the Content Hub.'
              },
              {
                key: 'text_model',
                label: 'Text model (optional)',
                placeholder: 'gpt-5.5'
              },
              {
                key: 'text_provider',
                label: 'Text provider (optional)',
                placeholder: 'openai or anthropic',
                helper: 'Force which provider runs text rewrites.'
              }
            ]}
            initialEnabled={openai?.enabled ?? false}
            initialEvents={openai?.events ?? []}
            initialConfig={openaiMask.safeConfig}
            secretStatus={openaiMask.secretStatus}
            hideEventsFilter
            hideTestButton
          />

          <IntegrationCard
            provider="anthropic"
            title="Anthropic"
            description="When a key is present, text rewrites run on Claude Opus 4.8 instead of OpenAI. Leave the model blank to use the deployed default."
            fields={[
              {
                key: 'api_key',
                label: 'API key',
                type: 'password',
                placeholder: 'sk-ant-...'
              },
              {
                key: 'text_model',
                label: 'Text model (optional)',
                placeholder: 'claude-opus-4-8'
              }
            ]}
            initialEnabled={anthropic?.enabled ?? false}
            initialEvents={anthropic?.events ?? []}
            initialConfig={anthropicMask.safeConfig}
            secretStatus={anthropicMask.secretStatus}
            hideEventsFilter
            hideTestButton
          />
        </div>
      </div>

      <div className="mt-10">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Email
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight mb-2">
          Sending + sender identity
        </h2>
        <p className="text-sm text-bone/60 max-w-2xl mb-4">
          Provider credentials and the From / Reply-To identity used for receipts
          and sequences. These override the RECEIPT_* environment variables; use
          the test card below to confirm delivery after saving.
        </p>
        <div className="space-y-4">
          <IntegrationCard
            provider="email"
            title="Email delivery"
            description="Choose the provider and drop in its credential, then set the sender identity applied to every receipt and sequence email."
            fields={[
              {
                key: 'provider',
                label: 'Provider',
                placeholder: 'resend or postmark',
                helper: 'Defaults to resend when blank.'
              },
              {
                key: 'resend_api_key',
                label: 'Resend API key',
                type: 'password',
                placeholder: 're_...'
              },
              {
                key: 'postmark_api_token',
                label: 'Postmark server token',
                type: 'password',
                placeholder: 'used when provider is postmark'
              },
              {
                key: 'postmark_stream',
                label: 'Postmark stream (optional)',
                placeholder: 'outbound'
              },
              {
                key: 'from_email',
                label: 'From address',
                placeholder: 'noreply@yourdomain.com',
                helper: 'Must be a verified sender on your provider.'
              },
              {
                key: 'from_name',
                label: 'From name (optional)',
                placeholder: 'MotherMode',
                helper: 'Shown as the sender; combined with the From address.'
              },
              {
                key: 'reply_to',
                label: 'Reply-To (optional)',
                placeholder: 'hello@yourdomain.com'
              },
              {
                key: 'subject_prefix',
                label: 'Subject prefix (optional)',
                placeholder: '[MotherMode]'
              },
              {
                key: 'bcc',
                label: 'BCC (optional)',
                placeholder: 'comma-separated addresses',
                helper: 'Copied on every email, e.g. a CRM ingest inbox.'
              }
            ]}
            initialEnabled={email?.enabled ?? false}
            initialEvents={email?.events ?? []}
            initialConfig={emailMask.safeConfig}
            secretStatus={emailMask.secretStatus}
            hideEventsFilter
            hideTestButton
          />
        </div>
      </div>

      <div className="mt-10">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Diagnostics
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight mb-4">
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
