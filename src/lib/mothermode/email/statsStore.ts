/**
 * Persistence for email sequence analytics (Phase 4).
 *
 * Reads/writes the `mothermode_email_stats` table with the service-role client
 * (admin API / ingestion route only). The client is lazy so the module never
 * throws on missing env at import time. All shaping goes through the pure
 * helpers in `analytics.ts`.
 *
 * NOTE: nothing populates this table yet — the kit generates/exports copy and
 * does not send mail. An ESP webhook will upsert rows later; `readSequenceStats`
 * returns an empty (but well-formed) shape until then, which the canvas overlay
 * renders as a "connect your ESP" empty state.
 */
import { createClient } from '@supabase/supabase-js';
import {
  emptySequenceStats,
  normalizeStat,
  type EmailStat,
  type SequenceStats,
} from './analytics';

const TABLE = 'mothermode_email_stats';
const COLUMNS =
  'kit_id, email_id, period, sent, delivered, opened, clicked, unsubscribed, bounced, revenue, updated_at';

interface StatRow {
  kit_id: string;
  email_id: string;
  period: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  revenue: number | string;
  updated_at?: string;
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

/**
 * Read the roll-up stats for a kit (defaults to the `'all'` period). Returns an
 * empty, well-formed `SequenceStats` on any failure or when no rows exist.
 */
export async function readSequenceStats(
  kitId: string,
  period = 'all',
): Promise<SequenceStats> {
  const empty = emptySequenceStats(kitId);
  if (!kitId) return empty;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('kit_id', kitId)
      .eq('period', period);
    if (error || !data || data.length === 0) return empty;

    const byEmail: Record<string, EmailStat> = {};
    let latest: string | null = null;
    for (const row of data as StatRow[]) {
      byEmail[row.email_id] = normalizeStat(
        {
          emailId: row.email_id,
          sent: row.sent,
          delivered: row.delivered,
          opened: row.opened,
          clicked: row.clicked,
          unsubscribed: row.unsubscribed,
          bounced: row.bounced,
          revenue: row.revenue,
        },
        row.email_id,
      );
      if (row.updated_at && (!latest || row.updated_at > latest)) {
        latest = row.updated_at;
      }
    }
    return { kitId, byEmail, updatedAt: latest };
  } catch {
    return empty;
  }
}

/**
 * Idempotently upsert per-email counters for a kit/period. This is the seam a
 * real ESP webhook will normalize into; provider-specific mapping is out of
 * scope until a provider is chosen.
 */
export async function upsertSequenceStats(
  kitId: string,
  stats: EmailStat[],
  period = 'all',
): Promise<number> {
  if (!kitId || !Array.isArray(stats) || stats.length === 0) return 0;
  const now = new Date().toISOString();
  const rows = stats
    .map((raw) => normalizeStat(raw))
    .filter((s) => s.emailId)
    .map((s) => ({
      kit_id: kitId,
      email_id: s.emailId,
      period,
      sent: s.sent,
      delivered: s.delivered,
      opened: s.opened,
      clicked: s.clicked,
      unsubscribed: s.unsubscribed,
      bounced: s.bounced,
      revenue: s.revenue ?? 0,
      updated_at: now,
    }));
  if (rows.length === 0) return 0;

  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .upsert(rows, { onConflict: 'kit_id,email_id,period' });
  if (error) {
    throw new Error(`upsertSequenceStats failed: ${error.message}`);
  }
  return rows.length;
}
