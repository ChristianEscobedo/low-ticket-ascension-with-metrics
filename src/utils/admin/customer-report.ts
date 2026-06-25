import type {
  CustomerActivity,
  CustomerDetail
} from '@/utils/supabase/admin';

/** RFC 4180-style escape: wrap when needed, double embedded quotes. */
function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s =
    typeof value === 'string'
      ? value
      : typeof value === 'boolean'
        ? value
            ? 'true'
            : 'false'
        : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const usd = (cents: number | null | undefined): string =>
  cents == null ? '' : (cents / 100).toFixed(2);

/**
 * Build a single multi-section CSV that captures everything currently shown
 * on /admin/customers/[id]: a header block plus tables for purchases, receipt
 * deliveries, CTA clicks and lesson progress. Each section is preceded by a
 * `# Name` comment so the file stays human-readable when opened in Excel /
 * Sheets while still being parseable section-by-section.
 */
export function buildCustomerReportCsv(
  detail: CustomerDetail,
  activity: CustomerActivity
): string {
  const lines: string[] = [];
  const push = (row: Array<string | number | boolean | null | undefined>) =>
    lines.push(row.map(csvCell).join(','));
  const section = (name: string) => {
    if (lines.length > 0) lines.push('');
    lines.push(`# ${name}`);
  };

  section('Customer');
  push(['user_id', 'email', 'joined_at', 'stripe_customer_id', 'lifetime_usd']);
  push([
    detail.user.id,
    detail.user.email,
    detail.user.created_at,
    detail.stripe_customer_id,
    usd(detail.lifetimeCents)
  ]);

  section('Subscriptions');
  push(['id', 'status', 'product', 'unit_amount_usd', 'interval', 'created', 'current_period_end']);
  for (const s of detail.subscriptions as any[]) {
    push([
      s.id,
      s.status,
      s.prices?.products?.name ?? null,
      usd(s.prices?.unit_amount ?? null),
      s.prices?.interval ?? null,
      s.created ?? null,
      s.current_period_end ?? null
    ]);
  }

  section('Purchases');
  push(['created_at', 'product_id', 'page_type', 'amount_usd', 'currency']);
  for (const p of detail.purchases) {
    push([
      p.created_at,
      p.product_id ?? null,
      p.page_type ?? null,
      usd(p.amount_cents ?? null),
      (p as any).currency ?? null
    ]);
  }

  section('Receipt deliveries');
  push([
    'created_at',
    'status',
    'delivery_status',
    'provider',
    'amount_usd',
    'currency',
    'payment_intent_id',
    'message_id',
    'bounce_reason',
    'error',
    'skipped_reason'
  ]);
  for (const r of activity.receiptLog) {
    push([
      r.created_at,
      r.status,
      r.delivery_status,
      r.provider,
      usd(r.amount_cents),
      r.currency,
      r.payment_intent_id,
      r.message_id,
      r.bounce_reason,
      r.error,
      r.skipped_reason
    ]);
  }

  section('CTA clicks');
  push(['created_at', 'course_id', 'course_title', 'lesson_id', 'lesson_title', 'cta_id']);
  for (const c of activity.ctaClicks) {
    push([
      c.created_at,
      c.course_id,
      c.course_title,
      c.lesson_id,
      c.lesson_title,
      c.cta_id
    ]);
  }

  section('Lesson progress');
  push([
    'last_watched_at',
    'course_id',
    'course_title',
    'lesson_id',
    'lesson_title',
    'progress_seconds',
    'is_completed',
    'completed_at'
  ]);
  for (const p of activity.lessonProgress) {
    push([
      p.last_watched_at,
      p.course_id,
      p.course_title,
      p.lesson_id,
      p.lesson_title,
      p.progress_seconds,
      p.is_completed,
      p.completed_at
    ]);
  }

  return lines.join('\r\n') + '\r\n';
}
