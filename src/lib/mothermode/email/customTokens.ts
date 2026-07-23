/**
 * Admin-defined custom merge tokens.
 *
 * Complements the static {@link EMAIL_MERGE_TOKENS} catalog with editable
 * `{{key}}` markers an admin can create in the email-marketing admin page. Each
 * carries a default value that resolves at render/export time (see
 * {@link applyEmailTokens}), while callers may still override per-recipient.
 *
 * Persistence is a single `mothermode_custom_tokens` table. Reads/writes use the
 * service-role client (admin API only); the client is lazy so the module never
 * throws on missing env at import time.
 */
import { createClient } from '@supabase/supabase-js';

const TABLE = 'mothermode_custom_tokens';
const COLUMNS = 'id, key, label, description, default_value, created_at, updated_at';

export interface CustomToken {
  id: string;
  /** Bare key, e.g. 'coach_name'. The full marker is `{{key}}`. */
  key: string;
  label: string;
  description: string;
  defaultValue: string;
}

interface CustomTokenRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  default_value: string | null;
  created_at?: string;
  updated_at?: string;
}

function rowToToken(row: CustomTokenRow): CustomToken {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description ?? '',
    defaultValue: row.default_value ?? '',
  };
}

/** Normalize a raw key to the allowed `[a-z0-9_]` shape. */
export function normalizeTokenKey(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** List every custom token, ordered by key. Returns [] on any failure. */
export async function listCustomTokens(): Promise<CustomToken[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('key', { ascending: true });
    if (error || !data) return [];
    return (data as CustomTokenRow[]).map(rowToToken);
  } catch {
    return [];
  }
}

export interface UpsertCustomTokenInput {
  id?: string | null;
  key: string;
  label: string;
  description?: string | null;
  defaultValue?: string | null;
}

/** Admin-only upsert. Insert when `id` is absent, update in place otherwise. */
export async function upsertCustomToken(
  input: UpsertCustomTokenInput,
): Promise<CustomToken> {
  const key = normalizeTokenKey(input.key);
  if (!key) throw new Error('A token key is required (letters, numbers, underscore).');

  const row: Record<string, unknown> = {
    key,
    label: input.label.trim() || key,
    description: (input.description ?? '').trim(),
    default_value: input.defaultValue ?? '',
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;

  const { data, error } = await (serviceClient() as any)
    .from(TABLE)
    .upsert(row, { onConflict: 'id' })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`upsertCustomToken failed: ${error?.message ?? 'no row returned'}`);
  }
  return rowToToken(data as CustomTokenRow);
}

/** Admin-only removal by id. */
export async function deleteCustomToken(id: string): Promise<void> {
  const { error } = await (serviceClient() as any).from(TABLE).delete().eq('id', id);
  if (error) {
    throw new Error(`deleteCustomToken failed: ${error.message}`);
  }
}

/** Build a `{ key: defaultValue }` map for {@link applyEmailTokens}. */
export function customTokenValues(tokens: CustomToken[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const t of tokens) {
    if (t.defaultValue) values[t.key] = t.defaultValue;
  }
  return values;
}
