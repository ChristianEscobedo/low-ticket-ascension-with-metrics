/**
 * Publish a content piece through Outstand — the unified social-publishing
 * integration. Loads the piece (for its platform + its text), maps the
 * platform to the Outstand network, publishes (or schedules), and marks the
 * piece published with the Outstand post id as its publishRef. The planner's
 * publish flow and the System Map's content-node peek call this. Admin-gated.
 *
 *   POST /api/admin/outstand-publish  { pieceId, content?, accounts?, scheduledAt? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { outstandPublish } from '@/utils/integrations/outstand';
import {
  listContentPlan,
  patchContentPlan,
} from '@/lib/mothermode/planner/store';

/** Map the piece's platform to the Outstand network name. */
function outstandNetwork(platform: string): string {
  const p = platform.trim().toLowerCase();
  if (p === 'twitter' || p === 'x') return 'x';
  if (p.includes('linkedin')) return 'linkedin';
  if (p.includes('instagram') || p === 'ig') return 'instagram';
  if (p.includes('facebook') || p === 'fb') return 'facebook';
  if (p.includes('threads')) return 'threads';
  if (p.includes('tiktok')) return 'tiktok';
  if (p.includes('youtube')) return 'youtube';
  if (p.includes('pinterest')) return 'pinterest';
  if (p.includes('bluesky')) return 'bluesky';
  return p; // pass through — Outstand may know it
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

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) {
    return NextResponse.json({ success: false, error: 'Missing pieceId' }, { status: 400 });
  }

  // The piece — for its platform and the text fallback.
  const plans = await listContentPlan();
  const piece = plans.find((p) => p.id === pieceId);
  if (!piece) {
    return NextResponse.json({ success: false, error: 'Piece not found' }, { status: 404 });
  }

  // The post text: the caller's final caption, else the piece's title + notes.
  const content =
    (typeof body.content === 'string' && body.content.trim()) ||
    [piece.title, piece.notes].filter(Boolean).join('\n\n').trim();
  if (!content) {
    return NextResponse.json(
      { success: false, error: 'The post has no text to publish' },
      { status: 400 },
    );
  }

  // The accounts: the caller's pick, else the piece's platform as the network.
  const accounts =
    Array.isArray(body.accounts) && body.accounts.length > 0
      ? body.accounts.map(String)
      : [outstandNetwork(piece.platform)];
  const scheduledAt =
    typeof body.scheduledAt === 'string' && body.scheduledAt ? body.scheduledAt : undefined;

  const result = await outstandPublish({ content, accounts, scheduledAt });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  // Mark the piece published, tracing to the Outstand post.
  await patchContentPlan(pieceId, {
    publishState: result.data.scheduled ? 'scheduled' : 'published',
    publishTarget: 'outstand',
    publishRef: result.data.id ?? null,
    publishSyncedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, post: result.data });
}
