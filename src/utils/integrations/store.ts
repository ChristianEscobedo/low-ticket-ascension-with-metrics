import { createClient } from '@supabase/supabase-js';
import type {
  IntegrationProvider,
  IntegrationRow
} from '@/utils/integrations/types';

// Service-role client scoped to this module. Mirrors the pattern in
// src/utils/supabase/admin.ts — never import this from a browser bundle.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function getIntegration<T = Record<string, unknown>>(
  provider: IntegrationProvider
): Promise<IntegrationRow<T> | null> {
  const { data, error } = await (supabase as any)
    .from('integrations')
    .select('provider, enabled, config, events, updated_at')
    .eq('provider', provider)
    .maybeSingle();
  if (error) {
    console.error(`integrations.getIntegration(${provider}) failed:`, error);
    return null;
  }
  return (data as IntegrationRow<T> | null) ?? null;
}

export async function listIntegrations(): Promise<IntegrationRow[]> {
  const { data, error } = await (supabase as any)
    .from('integrations')
    .select('provider, enabled, config, events, updated_at');
  if (error) {
    console.error('integrations.listIntegrations failed:', error);
    return [];
  }
  return (data as IntegrationRow[]) ?? [];
}

export interface UpsertPatch {
  enabled?: boolean;
  config?: Record<string, unknown>;
  events?: string[];
}

export async function upsertIntegration(
  provider: IntegrationProvider,
  patch: UpsertPatch
): Promise<void> {
  const row: Record<string, unknown> = {
    provider,
    updated_at: new Date().toISOString()
  };
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  if (patch.config !== undefined) row.config = patch.config;
  if (patch.events !== undefined) row.events = patch.events;
  const { error } = await (supabase as any)
    .from('integrations')
    .upsert(row, { onConflict: 'provider' });
  if (error) {
    throw new Error(`integrations.upsertIntegration failed: ${error.message}`);
  }
}
