/**
 * Clipping Studio "Later" items 1+2 (store side, house pattern: lazy service
 * client, degrades to null/[] and never throws on missing env/table).
 *
 * 1) Variant links: join variants to UTM-tracked links and roll link clicks
 *    onto variant metrics. Honesty note: a tracked link proves CLICKS, never
 *    impressions (platforms own those) — rollup rows record clicks with
 *    impressions 0, so unrated variants stay unrated instead of inventing a
 *    CTR. Clicks come from `click_count` (the counter documented in
 *    planner/links.ts: a read-modify-write that may collapse concurrent
 *    increments — accepted, same as the dashboards).
 * 2) Compose queue: thin helpers over mothermode_agent_jobs so a batch can
 *    queue as a job row and drain on poll instead of blocking the page.
 */
import { createClient } from '@supabase/supabase-js';
import { recordMetrics } from './variants';

const VARIANT_LINKS = 'clipping_variant_links';
const UTM_LINKS = 'mothermode_utm_links';
const JOBS = 'mothermode_agent_jobs';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pure: sum each variant's clicks across its linked UTM links. */
export function clicksByVariant(
  variantLinks: { variantId: string; linkId: string }[],
  clickCountByLinkId: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const vl of variantLinks) {
    const c = clickCountByLinkId.get(vl.linkId) ?? 0;
    out.set(vl.variantId, (out.get(vl.variantId) ?? 0) + c);
  }
  return out;
}

/** Resolve a link the user pasted: full URL with ?code=, bare code, or a uuid. */
export function parseLinkRef(input: string): { kind: 'id' | 'code'; value: string } | null {
  const s = (input || '').trim();
  if (!s) return null;
  if (UUID_RE.test(s)) return { kind: 'id', value: s.toLowerCase() };
  const codeMatch = s.match(/[?&]code=([A-Za-z0-9_-]{3,64})/);
  if (codeMatch) return { kind: 'code', value: codeMatch[1] };
  if (/^[A-Za-z0-9_-]{3,64}$/.test(s)) return { kind: 'code', value: s };
  return null;
}

/** Attach a variant to a tracked link (idempotent via the unique pair). */
export async function linkVariantToLink(
  variantId: string,
  linkRef: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ref = parseLinkRef(linkRef);
    if (!ref) return { ok: false, error: 'Paste a tracked-link code, URL, or id.' };
    const supa = serviceClient() as any;
    const q = supa.from(UTM_LINKS).select('id').limit(1);
    const { data: link } = await (ref.kind === 'id'
      ? q.eq('id', ref.value)
      : q.eq('code', ref.value)
    ).maybeSingle();
    if (!link) return { ok: false, error: `No tracked link matches "${linkRef.slice(0, 40)}".` };
    const { error } = await supa
      .from(VARIANT_LINKS)
      .upsert({ variant_id: variantId, link_id: link.id }, { onConflict: 'variant_id,link_id' });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch {
    return { ok: false, error: 'Link failed (is the variant_links migration applied?)' };
  }
}

/**
 * Variant schedule status: join variant links → UTM links → planner cards.
 *
 * The chain: a variant is linked to a UTM link (`clipping_variant_links`),
 * that link carries `utm_content` = the planner card's piece id, and the
 * planner card holds the platform/format/state. This returns the Scoreboard
 * a per-variant schedule chip ("Scheduled · YouTube Shorts") without a new
 * table.
 */
export interface VariantScheduleStatus {
  variantId: string;
  scheduled: boolean;
  platform?: string | null;
  format?: string | null;
  scheduledAt?: string | null;
  publishState?: string | null;
  /** The tracked link's short code (e.g. "abc123") when one is attached. */
  linkCode?: string | null;
  /** The tracked link's click count. */
  linkClicks?: number;
}

export async function variantScheduleStatus(): Promise<VariantScheduleStatus[]> {
  try {
    const supa = serviceClient() as any;

    // 1 — variant links → link ids
    const { data: vls } = await supa
      .from(VARIANT_LINKS)
      .select('variant_id, link_id')
      .limit(5000);
    const variantLinks = (vls ?? []).map((r: Record<string, unknown>) => ({
      variantId: String(r.variant_id),
      linkId: String(r.link_id),
    }));
    if (!variantLinks.length) return [];
    const linkIds = Array.from(new Set(variantLinks.map((v: { linkId: string }) => v.linkId)));

    // 2 — UTM links → piece ids (utm_content), codes, and click counts
    const { data: links } = await supa
      .from(UTM_LINKS)
      .select('id, utm_content, code, click_count')
      .in('id', linkIds);
    const pieceIdByLink = new Map<string, string>();
    const linkMetaByLink = new Map<string, { code: string; clicks: number }>();
    for (const l of (links ?? []) as Record<string, unknown>[]) {
      const content = typeof l.utm_content === 'string' ? l.utm_content : '';
      if (content) pieceIdByLink.set(String(l.id), content);
      linkMetaByLink.set(String(l.id), {
        code: typeof l.code === 'string' ? l.code : '',
        clicks: Number(l.click_count) || 0,
      });
    }
    const pieceIds = Array.from(new Set(pieceIdByLink.values()));
    if (!pieceIds.length) return [];

    // 3 — planner cards → platform/format/scheduled_at/publish_state
    const { data: plans } = await supa
      .from('mothermode_content_plan')
      .select('piece_id, platform, format, scheduled_at, publish_state')
      .in('piece_id', pieceIds);
    const planByPiece = new Map<string, Record<string, unknown>>();
    for (const p of (plans ?? []) as Record<string, unknown>[]) {
      // latest card wins when a piece is planned more than once
      planByPiece.set(String(p.piece_id), p);
    }

    return variantLinks.map((vl: { variantId: string; linkId: string }) => {
      const pieceId = pieceIdByLink.get(vl.linkId);
      const plan = pieceId ? planByPiece.get(pieceId) : null;
      const meta = linkMetaByLink.get(vl.linkId);
      return {
        variantId: vl.variantId,
        scheduled: Boolean(plan?.scheduled_at),
        platform: plan?.platform ? String(plan.platform) : null,
        format: plan?.format ? String(plan.format) : null,
        scheduledAt: plan?.scheduled_at ? String(plan.scheduled_at) : null,
        publishState: plan?.publish_state != null ? String(plan.publish_state) : null,
        linkCode: meta?.code || null,
        linkClicks: meta?.clicks ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Roll every linked variant's clicks into today's metrics row. Platform is
 * 'auto-rollup' so manual rows never collide with it; impressions are 0 on
 * purpose (links can't see them — the Scoreboard's CTR stays manual-honest).
 */
export async function rollupVariantMetrics(): Promise<{ updated: number; clicksTotal: number }> {
  try {
    const supa = serviceClient() as any;
    const { data: vls } = await supa.from(VARIANT_LINKS).select('variant_id, link_id').limit(2000);
    const variantLinks = (vls ?? []).map((r: Record<string, unknown>) => ({
      variantId: String(r.variant_id),
      linkId: String(r.link_id),
    }));
    if (!variantLinks.length) return { updated: 0, clicksTotal: 0 };
    const ids = Array.from(new Set(variantLinks.map((v: { linkId: string }) => v.linkId)));
    const { data: links } = await supa.from(UTM_LINKS).select('id, click_count').in('id', ids);
    const clickCountByLinkId = new Map<string, number>(
      (links ?? []).map((l: Record<string, unknown>) => [String(l.id), Number(l.click_count) || 0]),
    );
    const rolled = clicksByVariant(variantLinks, clickCountByLinkId);
    const day = new Date().toISOString().slice(0, 10);
    let updated = 0;
    let clicksTotal = 0;
    const entries = Array.from(rolled.entries());
    for (let i = 0; i < entries.length; i += 1) {
      const [variantId, clicks] = entries[i];
      clicksTotal += clicks;
      await recordMetrics({ variantId, day, platform: 'auto-rollup', impressions: 0, clicks, spendCents: 0 });
      updated += 1;
    }
    return { updated, clicksTotal };
  } catch {
    return { updated: 0, clicksTotal: 0 };
  }
}

// ---------------------------------------------------------------------------
// Compose queue (mothermode_agent_jobs)
// ---------------------------------------------------------------------------

export interface JobRow {
  id: string;
  kind: string;
  refId: string;
  status: string;
  progress: Record<string, unknown>;
  error: string;
}

function rowToJob(r: Record<string, unknown>): JobRow {
  return {
    id: String(r.id),
    kind: String(r.kind ?? ''),
    refId: String(r.ref_id ?? ''),
    status: String(r.status ?? ''),
    progress: (r.progress ?? {}) as Record<string, unknown>,
    error: String(r.error ?? ''),
  };
}

export async function enqueueJob(kind: string): Promise<string | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(JOBS)
      .insert({ kind, ref_id: crypto.randomUUID(), status: 'queued' })
      .select('id')
      .maybeSingle();
    return error || !data ? null : String(data.id);
  } catch {
    return null;
  }
}

export async function claimJob(id: string): Promise<JobRow | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(JOBS)
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'queued')
      .select('id, kind, ref_id, status, progress, error')
      .maybeSingle();
    return error || !data ? null : rowToJob(data);
  } catch {
    return null;
  }
}

export async function getJob(id: string): Promise<JobRow | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(JOBS)
      .select('id, kind, ref_id, status, progress, error')
      .eq('id', id)
      .maybeSingle();
    return error || !data ? null : rowToJob(data);
  } catch {
    return null;
  }
}

export async function finishJob(id: string, progress: Record<string, unknown>): Promise<void> {
  try {
    await (serviceClient() as any)
      .from(JOBS)
      .update({ status: 'done', progress, finished_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    /* best effort */
  }
}

export async function failJob(id: string, message: string): Promise<void> {
  try {
    await (serviceClient() as any)
      .from(JOBS)
      .update({ status: 'failed', error: message.slice(0, 300), finished_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    /* best effort */
  }
}
