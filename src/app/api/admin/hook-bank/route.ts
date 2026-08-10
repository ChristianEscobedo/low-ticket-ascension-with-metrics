import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  deleteHookClip,
  ingestHookClip,
  listHookClips,
  patchHookClip,
  syncHookToVault,
  type HookReaction,
  type HookRights,
  type HookSource,
} from '@/lib/mothermode/reel/hookBank';

/**
 * The hook bank's single admin endpoint.
 *
 * GET returns the bank (optionally filtered by source/reaction).
 * POST dispatches on an `action` discriminator:
 *   ingest      { name, url, source?, reaction?, rights?, durationSec?, ... }
 *   patch       { id, patch }  — rename / re-react / re-rights / score / retag
 *   delete      { id }
 *
 * The store degrades gracefully (unapplied migration returns empty lists), so
 * GET is always safe to call.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  const source = url.searchParams.get('source') as HookSource | null;
  const reaction = url.searchParams.get('reaction') as HookReaction | null;

  try {
    const hooks = await listHookClips({
      source: source || undefined,
      reaction: reaction || undefined,
    });
    return NextResponse.json({ success: true, admin: true, hooks });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hook bank load failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';

  try {
    switch (action) {
      case 'ingest': {
        const name = typeof body.name === 'string' ? body.name : '';
        const url = typeof body.url === 'string' ? body.url : '';
        if (!name || !url) {
          return NextResponse.json(
            { success: false, error: 'name and url are required' },
            { status: 400 },
          );
        }
        const hook = await ingestHookClip({
          name,
          url,
          source: body.source as HookSource | undefined,
          reaction: body.reaction as HookReaction | undefined,
          rights: body.rights as HookRights | undefined,
          durationSec: typeof body.durationSec === 'number' ? body.durationSec : null,
          spriteUrl: typeof body.spriteUrl === 'string' ? body.spriteUrl : null,
          sheetRef: typeof body.sheetRef === 'string' && body.sheetRef ? body.sheetRef : null,
          hookScore: typeof body.hookScore === 'number' ? body.hookScore : null,
          tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
          notes: typeof body.notes === 'string' ? body.notes : null,
        });
        // Mirror into the clipping vault so the reel studio's vault rail picks
        // it up. Best-effort — a vault miss never fails the bank ingest.
        if (hook) await syncHookToVault(hook);
        return NextResponse.json({ success: Boolean(hook), hook });
      }

      case 'patch': {
        const id = typeof body.id === 'string' ? body.id : '';
        const patch = (body.patch ?? {}) as Record<string, unknown>;
        if (!id) {
          return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }
        const ok = await patchHookClip(id, {
          name: typeof patch.name === 'string' ? patch.name : undefined,
          reaction: patch.reaction as HookReaction | undefined,
          rights: patch.rights as HookRights | undefined,
          hookScore:
            patch.hookScore === undefined
              ? undefined
              : patch.hookScore === null
                ? null
                : Number(patch.hookScore),
          tags: Array.isArray(patch.tags) ? (patch.tags as string[]) : undefined,
          notes: patch.notes === undefined ? undefined : (patch.notes as string | null),
          spriteUrl:
            patch.spriteUrl === undefined ? undefined : (patch.spriteUrl as string | null),
        });
        return NextResponse.json({ success: ok });
      }

      case 'delete': {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) {
          return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }
        return NextResponse.json({ success: await deleteHookClip(id) });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hook bank action failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
