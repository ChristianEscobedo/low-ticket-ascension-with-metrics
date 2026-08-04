import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  createMediaFolder,
  deleteMediaAsset,
  deleteMediaFolder,
  ingestMediaAsset,
  listMediaAssets,
  listMediaFolders,
  patchMediaAsset,
  renameMediaFolder,
  type MediaKind,
  type MediaSource,
} from '@/lib/mothermode/reel/mediaLibrary';

/**
 * The media library's single admin endpoint.
 *
 * GET returns the whole library in one payload (folders + assets, optionally
 * filtered). POST dispatches on an `action` discriminator:
 *   ingest        { name, url, kind, source, ... }  — upsert by URL
 *   patchAsset    { id, patch }                     — rename / move / retag / rethumb
 *   deleteAsset   { id }
 *   createFolder  { name, parentId?, color? }
 *   renameFolder  { id, name }
 *   deleteFolder  { id }
 *
 * The store degrades gracefully (unconfigured Supabase or unapplied migration
 * returns empty lists), so GET is always safe to call.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') as MediaKind | null;
  const source = url.searchParams.get('source') as MediaSource | null;
  const tag = url.searchParams.get('tag');

  try {
    const [folders, assets] = await Promise.all([
      listMediaFolders(),
      listMediaAssets({
        kind: kind || undefined,
        source: source || undefined,
        tag: tag || undefined,
      }),
    ]);
    return NextResponse.json({ success: true, admin: true, folders, assets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Library load failed';
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
        const kind = body.kind as MediaKind;
        const source = body.source as MediaSource;
        if (!name || !url || !kind || !source) {
          return NextResponse.json(
            { success: false, error: 'name, url, kind, and source are required' },
            { status: 400 },
          );
        }
        const asset = await ingestMediaAsset({
          name,
          url,
          kind,
          source,
          durationSec: typeof body.durationSec === 'number' ? body.durationSec : null,
          thumbnailUrl: typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : null,
          folderId: typeof body.folderId === 'string' && body.folderId ? body.folderId : null,
          tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
          refId: typeof body.refId === 'string' && body.refId ? body.refId : null,
          refKind: typeof body.refKind === 'string' && body.refKind ? body.refKind : null,
        });
        return NextResponse.json({ success: Boolean(asset), asset });
      }

      case 'patchAsset': {
        const id = typeof body.id === 'string' ? body.id : '';
        const patch = (body.patch ?? {}) as Record<string, unknown>;
        if (!id) {
          return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }
        const ok = await patchMediaAsset(id, {
          name: typeof patch.name === 'string' ? patch.name : undefined,
          folderId: patch.folderId === undefined ? undefined : (patch.folderId as string | null),
          tags: Array.isArray(patch.tags) ? (patch.tags as string[]) : undefined,
          thumbnailUrl:
            patch.thumbnailUrl === undefined ? undefined : (patch.thumbnailUrl as string | null),
        });
        return NextResponse.json({ success: ok });
      }

      case 'deleteAsset': {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) {
          return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }
        return NextResponse.json({ success: await deleteMediaAsset(id) });
      }

      case 'createFolder': {
        const name = typeof body.name === 'string' ? body.name : '';
        if (!name.trim()) {
          return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
        }
        const folder = await createMediaFolder({
          name,
          parentId: typeof body.parentId === 'string' && body.parentId ? body.parentId : null,
          color: typeof body.color === 'string' && body.color ? body.color : null,
        });
        return NextResponse.json({ success: Boolean(folder), folder });
      }

      case 'renameFolder': {
        const id = typeof body.id === 'string' ? body.id : '';
        const name = typeof body.name === 'string' ? body.name : '';
        if (!id || !name.trim()) {
          return NextResponse.json(
            { success: false, error: 'id and name are required' },
            { status: 400 },
          );
        }
        return NextResponse.json({ success: await renameMediaFolder(id, name) });
      }

      case 'deleteFolder': {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) {
          return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }
        return NextResponse.json({ success: await deleteMediaFolder(id) });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Library action failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
