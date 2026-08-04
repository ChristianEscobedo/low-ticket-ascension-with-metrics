import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  findVariantByHash,
  listVariantsWithMetrics,
  pickWinner,
  recordMetrics,
  recordVariant,
  reelContentHash,
} from '@/lib/mothermode/reel/variants';
import { getReelProject, listReelProjects, markReelComposed, upsertReelProject } from '@/lib/mothermode/reel/store';
import { buildStudioComposePayload, timelineErrors } from '@/lib/mothermode/reel/timeline';
import { assembleTracks } from '@/utils/integrations/fal-ffmpeg';
import {
  claimJob,
  enqueueJob,
  failJob,
  finishJob,
  getJob,
  linkVariantToLink,
  rollupVariantMetrics,
  variantScheduleStatus,
} from '@/lib/mothermode/reel/variantLinks';
import { geneLeaders, spinVariants, type GeneAsset } from '@/lib/mothermode/reel/genes';
import { listVaultAssets } from '@/lib/mothermode/reel/vault';

export const maxDuration = 300;

/** The hash-cached batch compose, shared by the blocking action and the queue drain. */
async function runComposeBatch(ids: unknown, email: string | null) {
  const all = await listReelProjects();
  const wanted = Array.isArray(ids)
    ? new Set((ids as unknown[]).filter((s): s is string => typeof s === 'string'))
    : null;
  const targets = all.filter((p) => p.clips.length > 0 && (!wanted || wanted.has(p.id))).slice(0, 8);
  const results: { id: string; name: string; status: string; url?: string; error?: string }[] = [];
  for (const p of targets) {
    const errs = timelineErrors(p);
    if (errs.length) {
      results.push({ id: p.id, name: p.name, status: 'skipped', error: errs.join(' ') });
      continue;
    }
    const hash = reelContentHash(p);
    const cached = await findVariantByHash(p.id, hash);
    if (cached) {
      results.push({ id: p.id, name: p.name, status: 'cached', url: cached.composedUrl });
      continue;
    }
    const payload = buildStudioComposePayload(p);
    const composed = await assembleTracks(payload);
    if (!composed.ok) {
      results.push({ id: p.id, name: p.name, status: 'failed', error: composed.error });
      continue;
    }
    await markReelComposed(p.id, composed.data.videoUrl);
    await recordVariant({
      projectId: p.id,
      label: `${p.name}`.slice(0, 150),
      composedUrl: composed.data.videoUrl,
      contentHash: hash,
      createdBy: email,
    });
    results.push({ id: p.id, name: p.name, status: 'composed', url: composed.data.videoUrl });
  }
  return results;
}

/**
 * The loop (Phase 4). GET returns variants + rolled metrics + the winner.
 * POST actions:
 *   record-metrics { variantId, day, platform, impressions, clicks, spendCents }
 *     — manual entry now; platform-API sync later (documented).
 *   compose-batch { ids? } — compose reels (default: every reel with clips);
 *     the content-hash cache means an unchanged timeline never re-renders.
 *   weekly-loop — watch → learn → regenerate: clone the winning project into
 *     three descendant drafts (L1..L3) in the reel list.
 */

export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  const rows = await listVariantsWithMetrics();
  const winner = pickWinner(rows);
  const leaders = geneLeaders(rows);
  return NextResponse.json({ success: true, rows, winner, geneLeaders: leaders });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = typeof body.action === 'string' ? body.action : '';

  // -- record metrics (manual entry for now) -----------------------------------
  if (action === 'record-metrics') {
    const variantId = typeof body.variantId === 'string' ? body.variantId : '';
    if (!variantId) {
      return NextResponse.json({ success: false, error: 'variantId is required' }, { status: 400 });
    }
    const ok = await recordMetrics({
      variantId,
      day: typeof body.day === 'string' && body.day ? body.day : new Date().toISOString().slice(0, 10),
      platform: typeof body.platform === 'string' ? body.platform : 'organic',
      impressions: typeof body.impressions === 'number' ? body.impressions : 0,
      clicks: typeof body.clicks === 'number' ? body.clicks : 0,
      spendCents: typeof body.spendCents === 'number' ? body.spendCents : 0,
    });
    return NextResponse.json({ success: ok });
  }

  // -- compose batch (hash-cached, blocking) ------------------------------------
  if (action === 'compose-batch') {
    return NextResponse.json({ success: true, results: await runComposeBatch(body.ids, guard.email ?? null) });
  }

  // -- variant links: attach a variant to a tracked UTM link --------------------
  if (action === 'link-variant') {
    const variantId = typeof body.variantId === 'string' ? body.variantId : '';
    const linkRef = typeof body.link === 'string' ? body.link : '';
    if (!variantId || !linkRef.trim()) {
      return NextResponse.json(
        { success: false, error: 'variantId and link (code/URL/id) are required' },
        { status: 400 },
      );
    }
    const out = await linkVariantToLink(variantId, linkRef);
    return NextResponse.json(out, { status: out.ok ? 200 : 400 });
  }

  // -- rollup: link clicks → variant metrics (also run by the nightly cron) -----
  if (action === 'rollup-metrics') {
    const out = await rollupVariantMetrics();
    return NextResponse.json({ success: true, ...out });
  }

  // -- variant schedules: scoreboard chips (Scheduled · platform · state) --------
  if (action === 'variant-schedules') {
    const statuses = await variantScheduleStatus();
    return NextResponse.json({ success: true, statuses });
  }

  // -- compose queue: park the batch as a job, drain it on poll -----------------
  if (action === 'queue-batch') {
    const id = await enqueueJob('reel-compose-batch');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Could not queue the job (agent_jobs table?)' },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, jobId: id });
  }

  if (action === 'job-status') {
    const id = typeof body.jobId === 'string' ? body.jobId : '';
    if (!id) return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 });
    // Queued → claim and run inline (the page's poll IS the worker; no page-blocking,
    // and the results land in the job row for the final toast).
    const claimed = await claimJob(id);
    if (claimed) {
      try {
        const results = await runComposeBatch(body.ids, guard.email ?? null);
        await finishJob(id, { results });
      } catch (err) {
        await failJob(id, err instanceof Error ? err.message : 'Batch failed');
      }
    }
    const job = await getJob(id);
    if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    return NextResponse.json({ success: true, status: job.status, progress: job.progress, error: job.error });
  }

  // -- Variant Lab: spin hook × body × outro genes into descendant projects ------
  if (action === 'spin-variants') {
    const id = typeof body.id === 'string' ? body.id : '';
    const base = await getReelProject(id);
    if (!base) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    if (!base.clips.length) {
      return NextResponse.json({ success: false, error: 'The base reel has no scenes.' }, { status: 400 });
    }
    // The gene pool: top-★ vault hooks + outros (fall back to most-used when unrated).
    const assets = await listVaultAssets();
    const toGene = (a: (typeof assets)[number]): GeneAsset => ({ name: a.name, url: a.url, durationSec: a.durationSec });
    const hooks = [null, ...assets.filter((a) => a.kind === 'intro' || a.kind === 'reaction').slice(0, 2).map(toGene)];
    const outros = [null, ...assets.filter((a) => a.kind === 'outro').slice(0, 1).map(toGene)];
    const spun = spinVariants({ base, hooks, bodies: ['full', 'tight'], outros, cap: 8 });
    const created: { id: string; name: string }[] = [];
    for (const v of spun) {
      const draft = await upsertReelProject({
        name: v.name,
        clips: v.clips,
        audio: base.audio,
        captions: {},
        updatedBy: guard.email ?? null,
      });
      if (draft) created.push({ id: draft.id, name: draft.name });
    }
    return NextResponse.json({ success: true, created, genes: spun.map((s) => s.geneTag) });
  }

  // -- the weekly loop: watch → learn → regenerate ------------------------------
  if (action === 'weekly-loop') {
    const rows = await listVariantsWithMetrics();
    const winner = pickWinner(rows);
    if (!winner) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No winner yet — variants need at least 50 impressions each. Record metrics on your composed variants first.',
        },
        { status: 400 },
      );
    }
    const base = await getReelProject(winner.variant.projectId);
    if (!base) {
      return NextResponse.json({ success: false, error: 'Winning project not found' }, { status: 404 });
    }
    const created: { id: string; name: string }[] = [];
    for (const suffix of ['L1', 'L2', 'L3']) {
      const draft = await upsertReelProject({
        name: `${base.name} (${suffix})`.slice(0, 150),
        clips: base.clips,
        audio: base.audio,
        captions: base.captions,
        updatedBy: guard.email ?? null,
      });
      if (draft) created.push({ id: draft.id, name: draft.name });
    }
    return NextResponse.json({
      success: true,
      winner: { name: winner.projectName, ctr: winner.ctr },
      created,
    });
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
}
