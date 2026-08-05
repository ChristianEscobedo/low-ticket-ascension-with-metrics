/**
 * Reel Studio Phase 4 — the loop. Variants (composed renders with a content
 * hash so identical timelines never re-render) and their metrics, plus the
 * pure winner-detection math. Store is service-role only, house pattern:
 * lazy client, degrades to null/[] and never 500s a page.
 */
import { createClient } from '@supabase/supabase-js';
import type { ReelProject } from './types';

const VARIANTS = 'mothermode_reel_variants';
const METRICS = 'mothermode_reel_variant_metrics';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

export interface ReelVariant {
  id: string;
  projectId: string;
  label: string;
  composedUrl: string;
  contentHash: string;
  createdAt: string | null;
}

export interface VariantMetricRow {
  id: string;
  variantId: string;
  day: string;
  platform: string;
  impressions: number;
  clicks: number;
  spendCents: number;
}

/** Stable content hash of the parts that change the rendered MP4. */
export function reelContentHash(project: Pick<ReelProject, 'clips' | 'audio'>): string {
  const raw = JSON.stringify({
    c: project.clips.map((c) => [c.url, c.trimEndSec]),
    a: project.audio ? [project.audio.url, project.audio.offsetSec] : null,
  });
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export async function recordVariant(input: {
  projectId: string;
  label: string;
  composedUrl: string;
  contentHash: string;
  createdBy?: string | null;
}): Promise<ReelVariant | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(VARIANTS)
      .insert({
        project_id: input.projectId,
        label: input.label.slice(0, 160),
        composed_url: input.composedUrl,
        content_hash: input.contentHash,
        created_by: input.createdBy ?? null,
      })
      .select('id, project_id, label, composed_url, content_hash, created_at')
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      projectId: data.project_id,
      label: data.label || '',
      composedUrl: data.composed_url,
      contentHash: data.content_hash || '',
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

/** Latest variant per content hash for a project (cache: identical timeline = free). */
export async function findVariantByHash(
  projectId: string,
  contentHash: string,
): Promise<ReelVariant | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(VARIANTS)
      .select('id, project_id, label, composed_url, content_hash, created_at')
      .eq('project_id', projectId)
      .eq('content_hash', contentHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      projectId: data.project_id,
      label: data.label || '',
      composedUrl: data.composed_url,
      contentHash: data.content_hash || '',
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

export async function listVariantsWithMetrics(): Promise<
  { variant: ReelVariant; projectName: string; impressions: number; clicks: number }[]
> {
  try {
    const supa = serviceClient() as any;
    const { data: vs, error: vErr } = await supa
      .from(VARIANTS)
      .select('id, project_id, label, composed_url, content_hash, created_at, mothermode_reel_projects(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (vErr || !vs) return [];
    const { data: ms } = await supa
      .from(METRICS)
      .select('variant_id, impressions, clicks')
      .limit(500);
    const byVariant = new Map<string, { impressions: number; clicks: number }>();
    for (const m of (ms ?? []) as Record<string, unknown>[]) {
      const id = String(m.variant_id);
      const cur = byVariant.get(id) ?? { impressions: 0, clicks: 0 };
      cur.impressions += typeof m.impressions === 'number' ? m.impressions : 0;
      cur.clicks += typeof m.clicks === 'number' ? m.clicks : 0;
      byVariant.set(id, cur);
    }
    return (vs as Record<string, unknown>[]).map((v) => {
      const roll = byVariant.get(String(v.id)) ?? { impressions: 0, clicks: 0 };
      const proj = v.mothermode_reel_projects as { name?: string } | null;
      return {
        variant: {
          id: String(v.id),
          projectId: String(v.project_id),
          label: String(v.label ?? ''),
          composedUrl: String(v.composed_url ?? ''),
          contentHash: String(v.content_hash ?? ''),
          createdAt: (v.created_at as string) ?? null,
        },
        projectName: proj?.name || 'Untitled reel',
        impressions: roll.impressions,
        clicks: roll.clicks,
      };
    });
  } catch {
    return [];
  }
}

export async function recordMetrics(input: {
  variantId: string;
  day: string;
  platform: string;
  impressions: number;
  clicks: number;
  spendCents: number;
}): Promise<boolean> {
  try {
    const { error } = await (serviceClient() as any).from(METRICS).upsert(
      {
        variant_id: input.variantId,
        day: input.day,
        platform: input.platform.slice(0, 40) || 'organic',
        impressions: Math.max(0, Math.floor(input.impressions)),
        clicks: Math.max(0, Math.floor(input.clicks)),
        spend_cents: Math.max(0, Math.floor(input.spendCents)),
      },
      { onConflict: 'variant_id,day,platform' },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Winner = highest CTR among variants with a statistically-meaningful floor of impressions. */
export function pickWinner(
  rows: { variant: ReelVariant; projectName: string; impressions: number; clicks: number }[],
  minImpressions = 50,
): { variant: ReelVariant; projectName: string; ctr: number } | null {
  let best: { variant: ReelVariant; projectName: string; ctr: number } | null = null;
  for (const r of rows) {
    if (r.impressions < minImpressions) continue;
    const ctr = r.clicks / r.impressions;
    if (!best || ctr > best.ctr) best = { variant: r.variant, projectName: r.projectName, ctr };
  }
  return best;
}
