// Provider keys recognised by the integrations subsystem. Anything stored
// in the `integrations` table outside this set is ignored by the dispatcher.
export type IntegrationProvider =
  | 'generic_webhook'
  | 'ghl'
  | 'mass'
  | 'main_app'
  | 'stripe'
  | 'openai'
  | 'anthropic'
  | 'email'
  | 'monid'
  | 'rapidapi'
  | 'apify'
  | 'assemblyai'
  | 'elevenlabs';


export const PAGE_TYPES = ['fe', 'oto1', 'oto2', 'oto3', 'oto4'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export interface GenericWebhookConfig {
  url?: string;
  secret?: string;
}

/**
 * Main app (mothermode) — the first-class delivery destination. Receives
 * signed lifecycle events (purchase, refund, comp granted/revoked,
 * subscription created/canceled) with line items + delivery instructions so
 * products built in the main app's product builder are provisioned and its
 * licensing feature issues keys. See docs/MAIN_APP_WEBHOOK_INTEGRATION.md.
 */
export interface MainAppConfig {
  url?: string;
  secret?: string;
  /** Display label only, e.g. 'mothermode-production'. */
  app_name?: string;
}


export interface GhlConfig {
  api_key?: string;
  location_id?: string;
  tag_prefix?: string;
  workflow_id?: string;
}

export interface MassConfig {
  api_key?: string;
  workspace_id?: string;
}

export interface StripeConfig {
  publishable_key?: string;
  secret_key?: string;
  webhook_secret?: string;
}

export interface OpenAiConfig {
  api_key?: string;
  image_model?: string;
  text_model?: string;
  text_provider?: string;
}

export interface AnthropicConfig {
  api_key?: string;
  text_model?: string;
}

export interface EmailConfig {
  provider?: string;
  resend_api_key?: string;
  postmark_api_token?: string;
  postmark_stream?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  subject_prefix?: string;
  bcc?: string;
}

/**
 * Monid (monid.ai) — the discover/inspect/run scraping gateway the Research
 * Lab uses for social data. The `endpoint_*` keys optionally pin an endpoint
 * id per platform so the agent skips discovery; blank means "discover at run
 * time".
 */
export interface MonidConfig {
  api_key?: string;
  base_url?: string;
  endpoint_x?: string;
  endpoint_tiktok?: string;
  endpoint_instagram?: string;
  endpoint_reddit?: string;
  endpoint_youtube?: string;
}

/**
 * RapidAPI — one key covers every marketplace API. The Research Lab's Amazon
 * tools default to the real-time-amazon-data host; override `amazon_host` to
 * point the same code at a different Amazon API subscription.
 */
export interface RapidApiConfig {
  api_key?: string;
  amazon_host?: string;
}

/**
 * Apify — the fallback engine for the Research Lab's Amazon review mining
 * (mature actors with proxy rotation built in). `reviews_actor` defaults to
 * 'apify/amazon-reviews-scraper'; if that actor 404s, pick any reviews actor
 * from apify.com/store and paste its id here.
 */
export interface ApifyConfig {
  api_token?: string;
  reviews_actor?: string;
}

export interface IntegrationRow<TConfig = Record<string, unknown>> {
  provider: IntegrationProvider;
  enabled: boolean;
  config: TConfig;
  events: string[];
  updated_at: string;
}
