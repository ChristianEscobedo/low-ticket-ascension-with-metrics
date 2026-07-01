// Provider keys recognised by the integrations subsystem. Anything stored
// in the `integrations` table outside this set is ignored by the dispatcher.
export type IntegrationProvider =
  | 'generic_webhook'
  | 'ghl'
  | 'mass'
  | 'stripe'
  | 'openai'
  | 'anthropic'
  | 'email';

export const PAGE_TYPES = ['fe', 'oto1', 'oto2', 'oto3', 'oto4'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export interface GenericWebhookConfig {
  url?: string;
  secret?: string;
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

export interface IntegrationRow<TConfig = Record<string, unknown>> {
  provider: IntegrationProvider;
  enabled: boolean;
  config: TConfig;
  events: string[];
  updated_at: string;
}
