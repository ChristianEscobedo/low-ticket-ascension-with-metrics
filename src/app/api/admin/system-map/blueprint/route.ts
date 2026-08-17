/**
 * /api/admin/system-map/blueprint — the System Blueprint Creator.
 *
 * One action — "Create a blueprint" — materializes a whole system (the
 * funnel's pages + the email sequence + the tracked links + the content) as
 * one connected, ready-to-run subgraph on the System Map. Three entry modes:
 * from research (an artifact becomes the blueprint), from an optimization (the
 * leak detector's output becomes the fix), or from a clone variant (a winning
 * funnel clones into a variant).
 *
 * THE GATED PATTERN, ALWAYS:
 *   POST { action: 'propose', ... }  — a drafter maps the source → a pending
 *     subgraph and persists it as 'proposed'. NO source table is written; the
 *     only write is the blueprint record itself (the overlay the map renders).
 *   POST { action: 'approve', blueprintId }  — the skills (research/skills/
 *     blueprint.ts) materialize each node into its source table. This is the
 *     ONLY write path, and it only runs on an explicit human approve.
 *   POST { action: 'reject', blueprintId }  — discard the proposal.
 *
 *   GET  — the blueprints (the map reads the 'proposed' ones as the overlay).
 */
import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  blueprintDraftErrors,
  draftFromClone,
  draftFromOptimization,
  draftFromResearch,
  toBlueprintMode,
  type DraftedBlueprint,
} from '@/lib/mothermode/blueprint';
import {
  createBlueprint,
  getBlueprint,
  listBlueprints,
  setBlueprintStatus,
} from '@/lib/mothermode/blueprintStore';
import { materializeBlueprint } from '@/lib/mothermode/research/skills/blueprint';
import { getArtifact } from '@/lib/mothermode/research/store';
import { normalizeOfferBrief } from '@/lib/mothermode/research/types';
import { getFunnelById as getSalesFunnelById } from '@/lib/mothermode/sales/store';
import { getFunnelById as getOptinFunnelById } from '@/lib/mothermode/optin/store';

export const dynamic = 'force-dynamic';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Admin read: the blueprints, newest first. `?status=proposed` filters. */
export async function GET(request: Request) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response;

  const status = str(new URL(request.url).searchParams.get('status'));
  const blueprints = await listBlueprints(
    status === 'proposed' ||
      status === 'approved' ||
      status === 'materialized' ||
      status === 'rejected'
      ? { status }
      : undefined,
  );
  return NextResponse.json({ success: true, blueprints });
}

/** Load + validate the parent funnel a clone/optimization descends from. */
async function loadParent(kind: string, parentFunnelId: string) {
  const parent =
    kind === 'optin'
      ? await getOptinFunnelById(parentFunnelId)
      : await getSalesFunnelById(parentFunnelId);
  return parent;
}

export async function POST(request: Request) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }
  const action = str(body.action);

  try {
    // ——— APPROVE: the only write path. The skills materialize the subgraph. ———
    if (action === 'approve') {
      const blueprintId = str(body.blueprintId);
      if (!blueprintId) {
        return NextResponse.json(
          { success: false, error: 'blueprintId is required' },
          { status: 400 },
        );
      }
      const blueprint = await getBlueprint(blueprintId);
      if (!blueprint) {
        return NextResponse.json(
          { success: false, error: 'Blueprint not found' },
          { status: 404 },
        );
      }
      if (blueprint.status !== 'proposed') {
        return NextResponse.json(
          {
            success: false,
            error: `This blueprint is already ${blueprint.status} — only a proposed one can be approved.`,
          },
          { status: 409 },
        );
      }
      // The skills write the real records. A failure leaves the blueprint
      // 'proposed' (retryable — the deterministic slugs make a retry an
      // update, not a duplicate) and surfaces the reason loudly.
      const { created } = await materializeBlueprint(blueprint, {
        updatedBy: guard.email ?? null,
      });
      await setBlueprintStatus(blueprintId, 'materialized');
      return NextResponse.json({ success: true, created });
    }

    // ——— REJECT: discard the proposal. ———
    if (action === 'reject') {
      const blueprintId = str(body.blueprintId);
      if (!blueprintId) {
        return NextResponse.json(
          { success: false, error: 'blueprintId is required' },
          { status: 400 },
        );
      }
      await setBlueprintStatus(blueprintId, 'rejected');
      return NextResponse.json({ success: true });
    }

    // ——— PROPOSE: draft the pending subgraph. NO source table is written. ———
    if (action === 'propose') {
      const mode = toBlueprintMode(body.mode);
      let drafted: DraftedBlueprint | null = null;

      if (mode === 'research') {
        const artifactId = str(body.artifactId);
        if (!artifactId) {
          return NextResponse.json(
            { success: false, error: 'artifactId is required' },
            { status: 400 },
          );
        }
        const artifact = await getArtifact(artifactId);
        if (!artifact) {
          return NextResponse.json(
            { success: false, error: 'Research artifact not found' },
            { status: 404 },
          );
        }
        const brief = normalizeOfferBrief(artifact.structured);
        if (!brief.name && !artifact.title) {
          return NextResponse.json(
            {
              success: false,
              error: 'This artifact has no offer brief to build from.',
            },
            { status: 400 },
          );
        }
        drafted = draftFromResearch({
          artifactId: artifact.id,
          title: artifact.title,
          brief,
        });
      } else if (mode === 'clone') {
        const kind = str(body.kind) === 'optin' ? 'optin' : 'sales';
        const parentFunnelId = str(body.parentFunnelId);
        const parent = parentFunnelId ? await loadParent(kind, parentFunnelId) : null;
        if (!parent) {
          return NextResponse.json(
            { success: false, error: 'The funnel to clone was not found' },
            { status: 404 },
          );
        }
        drafted = draftFromClone({
          parentFunnelId: parent.id,
          parentName: parent.name || parent.slug,
          parentSlug: parent.slug,
          kind,
          pageKeys: Array.isArray(body.pageKeys)
            ? body.pageKeys.map((k) => str(k)).filter(Boolean)
            : undefined,
        });
      } else {
        // optimization
        const kind = str(body.kind) === 'optin' ? 'optin' : 'sales';
        const parentFunnelId = str(body.parentFunnelId);
        const parent = parentFunnelId ? await loadParent(kind, parentFunnelId) : null;
        if (!parent) {
          return NextResponse.json(
            { success: false, error: 'The funnel to optimize was not found' },
            { status: 404 },
          );
        }
        const leakPageKey = str(body.leakPageKey) || 'checkout';
        drafted = draftFromOptimization({
          parentFunnelId: parent.id,
          parentName: parent.name || parent.slug,
          parentSlug: parent.slug,
          kind,
          leakPageKey,
          leakLabel: str(body.leakLabel) || `${leakPageKey} rate`,
          leakEdgeId: str(body.leakEdgeId) || undefined,
        });
      }

      // The gated invariant's first line: a malformed subgraph never persists.
      const errors = blueprintDraftErrors({
        name: drafted.name,
        mode,
        nodes: drafted.nodes,
      });
      if (errors.length > 0) {
        return NextResponse.json(
          { success: false, error: `The blueprint needs ${errors.join(', ')}` },
          { status: 400 },
        );
      }

      const blueprint = await createBlueprint({
        name: drafted.name,
        mode,
        source: drafted.source,
        nodes: drafted.nodes,
        recipeRunId: str(body.recipeRunId) || null,
      });
      return NextResponse.json({ success: true, blueprint });
    }

    return NextResponse.json(
      { success: false, error: 'unknown action (propose, approve, or reject)' },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Blueprint failed' },
      { status: 500 },
    );
  }
}
