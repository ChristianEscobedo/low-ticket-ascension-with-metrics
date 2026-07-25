/**
 * Persistence for email sequence enrollment analytics (Phase 5).
 *
 * Reads/writes the `mothermode_email_enrollments` and `mothermode_email_events`
 * tables with the service-role client (admin API / ingestion route only). The
 * client is lazy so the module never throws on missing env at import time.
 * All shaping goes through the pure helpers in `enrollment.ts`.
 *
 * NOTE: nothing populates these tables yet — the kit generates/exports copy
 * and does not send mail. An ESP webhook will upsert rows later;
 * `readEnrollmentData` returns an empty (but well-formed) shape until then,
 * which the dashboard renders as a "connect your ESP" empty state.
 */
import { createClient } from '@supabase/supabase-js';
import {
  emptyEnrollmentData,
  normalizeEnrollment,
  type EmailEvent,
  type Enrollment,
  type EnrollmentData,
} from './enrollment';

const ENROLLMENTS_TABLE = 'mothermode_email_enrollments';
const EVENTS_TABLE = 'mothermode_email_events';

const ENROLLMENT_COLUMNS =
  'id, kit_id, subscriber_id, email_id, status, enrolled_at, last_event_at, metadata';
const EVENT_COLUMNS =
  'id, kit_id, subscriber_id, email_id, event_type, occurred_at, metadata';

interface EnrollmentRow {
  id: string;
  kit_id: string;
  subscriber_id: string;
  email_id: string;
  status: string;
  enrolled_at: string;
  last_event_at: string;
  metadata: unknown;
}

interface EventRow {
  id: string;
  kit_id: string;
  subscriber_id: string;
  email_id: string;
  event_type: string;
  occurred_at: string;
  metadata: unknown;
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
 * Read enrollment data for a kit. Returns an empty, well-formed
 * `EnrollmentData` on any failure or when no rows exist.
 */
export async function readEnrollmentData(kitId: string): Promise<EnrollmentData> {
  const empty = emptyEnrollmentData(kitId);
  if (!kitId) return empty;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(ENROLLMENTS_TABLE)
      .select(ENROLLMENT_COLUMNS)
      .eq('kit_id', kitId);
    if (error || !data || data.length === 0) return empty;

    const enrollments: Enrollment[] = (data as EnrollmentRow[]).map((row) =>
      normalizeEnrollment({
        subscriberId: row.subscriber_id,
        emailId: row.email_id,
        status: row.status,
        enrolledAt: row.enrolled_at,
        lastEventAt: row.last_event_at,
        metadata: row.metadata,
      }),
    );

    // Find the latest last_event_at for updatedAt.
    let latest: string | null = null;
    for (const row of data as EnrollmentRow[]) {
      if (row.last_event_at && (!latest || row.last_event_at > latest)) {
        latest = row.last_event_at;
      }
    }

    return { kitId, enrollments, updatedAt: latest };
  } catch {
    return empty;
  }
}

/**
 * Read the event stream for a single subscriber in a kit. Returns an empty
 * array on any failure or when no rows exist.
 */
export async function readSubscriberEvents(
  kitId: string,
  subscriberId: string,
): Promise<EmailEvent[]> {
  if (!kitId || !subscriberId) return [];
  try {
    const { data, error } = await (serviceClient() as any)
      .from(EVENTS_TABLE)
      .select(EVENT_COLUMNS)
      .eq('kit_id', kitId)
      .eq('subscriber_id', subscriberId)
      .order('occurred_at', { ascending: true });
    if (error || !data) return [];

    return (data as EventRow[]).map((row) => ({
      subscriberId: row.subscriber_id,
      emailId: row.email_id,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      ...(row.metadata && typeof row.metadata === 'object'
        ? { metadata: row.metadata as Record<string, unknown> }
        : {}),
    }));
  } catch {
    return [];
  }
}

/**
 * Idempotently upsert enrollments for a kit. This is the seam a real ESP
 * webhook will normalize into; provider-specific mapping is out of scope
 * until a provider is chosen.
 */
export async function upsertEnrollments(
  kitId: string,
  enrollments: Enrollment[],
): Promise<number> {
  if (!kitId || !Array.isArray(enrollments) || enrollments.length === 0) return 0;
  const rows = enrollments
    .filter((e) => e.subscriberId)
    .map((e) => ({
      kit_id: kitId,
      subscriber_id: e.subscriberId,
      email_id: e.emailId || '',
      status: e.status,
      enrolled_at: e.enrolledAt || new Date().toISOString(),
      last_event_at: e.lastEventAt || new Date().toISOString(),
      metadata: e.metadata ?? {},
    }));
  if (rows.length === 0) return 0;

  const { error } = await (serviceClient() as any)
    .from(ENROLLMENTS_TABLE)
    .upsert(rows, { onConflict: 'kit_id,subscriber_id' });
  if (error) {
    throw new Error(`upsertEnrollments failed: ${error.message}`);
  }
  return rows.length;
}

/**
 * Append events to the event stream. This is the seam a real ESP webhook
 * will normalize into; provider-specific mapping is out of scope until a
 * provider is chosen.
 */
export async function insertEvents(kitId: string, events: EmailEvent[]): Promise<number> {
  if (!kitId || !Array.isArray(events) || events.length === 0) return 0;
  const rows = events
    .filter((e) => e.subscriberId)
    .map((e) => ({
      kit_id: kitId,
      subscriber_id: e.subscriberId,
      email_id: e.emailId || '',
      event_type: e.eventType,
      occurred_at: e.occurredAt || new Date().toISOString(),
      metadata: e.metadata ?? {},
    }));
  if (rows.length === 0) return 0;

  const { error } = await (serviceClient() as any).from(EVENTS_TABLE).insert(rows);
  if (error) {
    throw new Error(`insertEvents failed: ${error.message}`);
  }
  return rows.length;
}