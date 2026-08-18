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
  MainAppConfig,
  MassConfig,
  OpenAiConfig,
  AnthropicConfig,
  EmailConfig,
  MonidConfig,
  RapidApiConfig,
  ApifyConfig,
  OutstandConfig
} from '@/utils/integrations/types';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const supabase = createClient();
  const [
    webhook,
    ghl,
    mass,
    mainApp,
    openai,
    anthropic,
    email,
    monid,
    rapidapi,
    apify,
    outstand,
    user,
    resendHealth
  ] = await Promise.all([
    getIntegration<GenericWebhookConfig>('generic_webhook'),
    getIntegration<GhlConfig>('ghl'),
    getIntegration<MassConfig>('mass'),
    getIntegration<MainAppConfig>('main_app'),
    getIntegration<OpenAiConfig>('openai'),
    getIntegration<AnthropicConfig>('anthropic'),
    getIntegration<EmailConfig>('email'),
    getIntegration<MonidConfig>('monid'),
    getIntegration<RapidApiConfig>('rapidapi'),
    getIntegration<ApifyConfig>('apify'),
    getIntegration<OutstandConfig>('outstand'),
    getUser(supabase),
    getResendWebhookHealth()
  ]);

  // Strip secrets before they reach the client cards; pass only configured +
  // last4 status so the UI can show a "saved, leave blank to keep" hint.
  const asCfg = (c: unknown) => c as Record<string, unknown> | undefined;
  const webhookMask = maskConfig(asCfg(webhook?.config), ['secret']);
  const ghlMask = maskConfig(asCfg(ghl?.config), ['api_key']);
  const massMask = maskConfig(asCfg(mass?.config), ['api_key']);
  const mainAppMask = maskConfig(asCfg(mainApp?.config), ['secret']);
  const openaiMask = maskConfig(asCfg(openai?.config), ['api_key']);
  const anthropicMask = maskConfig(asCfg(anthropic?.config), ['api_key']);
  const emailMask = maskConfig(asCfg(email?.config), [
    'resend_api_key',
    'postmark_api_token'
  ]);
  const monidMask = maskConfig(asCfg(monid?.config), ['api_key']);
  const rapidapiMask = maskConfig(asCfg(rapidapi?.config), ['api_key']);
  const apifyMask = maskConfig(asCfg(apify?.config), ['api_token']);
  const outstandMask = maskConfig(asCfg(outstand?.config), ['api_key']);

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

        <IntegrationCard
          provider="main_app"
          title="Main app (mothermode) delivery"
          description="The delivery channel for purchases fulfilled in the main app. POSTs signed lifecycle events (purchase, refund, comp granted/revoked, subscription canceled) with line items, delivery instructions, and license requests. Signature goes in the `x-mothermode-signature` header. Receiver spec: docs/MAIN_APP_WEBHOOK_INTEGRATION.md."
          badge={{ label: 'Live', tone: 'live' }}
          fields={[
            {
              key: 'url',
              label: 'Main app webhook URL',
              placeholder: 'https://app.mothermode.com/api/webhooks/funnel'
            },
            {
              key: 'secret',
              label: 'Signing secret',
              type: 'password',
              placeholder: 'shared secret for HMAC-SHA256',
              helper: 'Same value the main app verifies signatures with.'
            },
            {
              key: 'app_name',
              label: 'App label (optional)',
              placeholder: 'mothermode-production'
            }
          ]}
          initialEnabled={mainApp?.enabled ?? false}
          initialEvents={mainApp?.events ?? []}
          initialConfig={mainAppMask.safeConfig}
          secretStatus={mainAppMask.secretStatus}
        />
      </div>

      <div className="mt-10">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Publishing
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight mb-2">
          Social publishing
        </h2>
        <p className="text-sm text-bone/60 max-w-2xl mb-4">
          Publish + schedule posts to the connected social accounts from inside
          the app — the planner's publish flow and the System Map's content
          peek post through it.
        </p>
        <div className="space-y-4">
          <IntegrationCard
            provider="outstand"
            title="Outstand (social publishing)"
            description="One key publishes + schedules posts across X, LinkedIn, Instagram, Facebook, Threads, TikTok, YouTube, Pinterest, and more. The planner's publish flow and the System Map's content-node peek post through it."
            badge={{ label: 'Live', tone: 'live' }}
            fields={[
              {
                key: 'api_key',
                label: 'Outstand API key',
                type: 'password',
                placeholder: 'paste the key from your Outstand dashboard',
                helper: 'outstand.so → your dashboard → API keys.'
              }
            ]}
            initialEnabled={outstand?.enabled ?? false}
            initialEvents={outstand?.events ?? []}
            initialConfig={outstandMask.safeConfig}
            secretStatus={outstandMask.secretStatus}
            hideEventsFilter
            hideTestButton
          />
        </div>
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
          Research data
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight mb-2">
          Research Lab sources
        </h2>
        <p className="text-sm text-bone/60 max-w-2xl mb-4">
          Paid data sources the Research Lab agent can call. Both bill per run,
          so results are cached in the app; the matching environment variable
          stays as a fallback when a field is blank.
        </p>
        <div className="space-y-4">
          <IntegrationCard
            provider="monid"
            title="Monid (social scraping)"
            description="The discover -> inspect -> run gateway the agent uses for social_search (X, TikTok, Instagram, Reddit, YouTube). Endpoint pins are optional: fill one to skip discovery for that platform."
            fields={[
              {
                key: 'api_key',
                label: 'API key',
                type: 'password',
                placeholder: 'monid_...',
                helper: 'Dashboard -> API keys. Falls back to MONID_API_KEY.'
              },
              {
                key: 'base_url',
                label: 'Base URL (optional)',
                placeholder: 'https://api.monid.ai'
              },
              {
                key: 'endpoint_x',
                label: 'Pin: X/Twitter endpoint (optional)',
                placeholder: '/apidojo/tweet-scraper'
              },
              {
                key: 'endpoint_tiktok',
                label: 'Pin: TikTok endpoint (optional)',
                placeholder: 'endpoint path from /v1/discover'
              },
              {
                key: 'endpoint_instagram',
                label: 'Pin: Instagram endpoint (optional)',
                placeholder: 'endpoint path from /v1/discover'
              },
              {
                key: 'endpoint_reddit',
                label: 'Pin: Reddit endpoint (optional)',
                placeholder: 'endpoint path from /v1/discover'
              },
              {
                key: 'endpoint_youtube',
                label: 'Pin: YouTube endpoint (optional)',
                placeholder: 'endpoint path from /v1/discover'
              }
            ]}
            initialEnabled={monid?.enabled ?? false}
            initialEvents={monid?.events ?? []}
            initialConfig={monidMask.safeConfig}
            secretStatus={monidMask.secretStatus}
            hideEventsFilter
            hideTestButton
          />

          <IntegrationCard
            provider="rapidapi"
            title="RapidAPI (Amazon reviews)"
            description="One key covers the Amazon product + review data the agent mines with amazon_reviews. Defaults to the real-time-amazon-data API; change the host only if you subscribe to a different Amazon API."
            fields={[
              {
                key: 'api_key',
                label: 'RapidAPI key',
                type: 'password',
                placeholder: 'xxxxxxxxxxxxxxxx',
                helper: 'rapidapi.com -> My Apps -> security. Falls back to RAPIDAPI_KEY.'
              },
              {
                key: 'amazon_host',
                label: 'Amazon API host (optional)',
                placeholder: 'real-time-amazon-data.p.rapidapi.com'
              },
              {
                key: 'engine',
                label: 'Engine preference (optional)',
                placeholder: 'rapidapi or apify',
                helper: 'Set to apify to skip RapidAPI for reviews entirely (query searches still use RapidAPI to resolve the ASIN).'
              }
            ]}
            initialEnabled={rapidapi?.enabled ?? false}
            initialEvents={rapidapi?.events ?? []}
            initialConfig={rapidapiMask.safeConfig}
            secretStatus={rapidapiMask.secretStatus}
            hideEventsFilter
            hideTestButton
          />

          <IntegrationCard
            provider="apify"
            title="Apify (Amazon fallback)"
            description="The fallback engine for Amazon review mining: if RapidAPI fails (unsubscribed, rate-limited, down), the agent tries a maintained Apify reviews actor next. Leave the actor blank to use the default."
            fields={[
              {
                key: 'api_token',
                label: 'Apify API token',
                type: 'password',
                placeholder: 'apify_api_...',
                helper: 'apify.com -> Settings -> Integrations. Falls back to APIFY_API_TOKEN.'
              },
              {
                key: 'reviews_actor',
                label: 'Reviews actor (optional)',
                placeholder: 'apify/amazon-reviews-scraper',
                helper: 'Only change if the default actor 404s.'
              }
            ]}
            initialEnabled={apify?.enabled ?? false}
            initialEvents={apify?.events ?? []}
            initialConfig={apifyMask.safeConfig}
            secretStatus={apifyMask.secretStatus}
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
