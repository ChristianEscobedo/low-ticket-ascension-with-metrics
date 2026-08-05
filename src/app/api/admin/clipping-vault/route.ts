import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  bumpVaultUseCount,
  createVaultAsset,
  deleteVaultAsset,
  listVaultAssets,
  syncVaultWinRates,
  VAULT_KINDS,
  type VaultKind,
} from '@/lib/mothermode/reel/vault';



/**
 * Clipping Studio Vault API.
 *
 * GET  ?kind=            → { success, assets } — win-rate ranked
 * POST { action:'save', kind, name, url, durationSec, tags?, emotion?, source? }
 * POST { action:'delete', id }
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  const kind = request.nextUrl.searchParams.get('kind') as VaultKind | null;
  const assets = await listVaultAssets(kind && VAULT_KINDS.includes(kind) ? kind : undefined);
  return NextResponse.json({ success: true, assets });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action === 'touch') {
    if (typeof body.id === 'string' && body.id) await bumpVaultUseCount(body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === 'sync-win-rates') {

    const result = await syncVaultWinRates();
    return NextResponse.json({ success: true, ...result });
  }

  if (body.action === 'delete') {

    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    const ok = await deleteVaultAsset(id);
    return NextResponse.json({ success: ok });
  }

  if (body.action === 'save') {
    const kind = body.kind as VaultKind;
    const url = typeof body.url === 'string' ? body.url : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const durationSec = Number(body.durationSec);
    if (!VAULT_KINDS.includes(kind) || !name || !/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { success: false, error: 'kind, name, and a public url are required' },
        { status: 400 },
      );
    }
    if (!(durationSec > 0 && durationSec < 600)) {
      return NextResponse.json({ success: false, error: 'Bad durationSec' }, { status: 400 });
    }
    const asset = await createVaultAsset({
      kind,
      name,
      url,
      thumbnailUrl: typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : null,
      durationSec,
      tags: Array.isArray(body.tags) ? (body.tags as string[]).slice(0, 12) : [],
      emotion: typeof body.emotion === 'string' ? body.emotion : null,
      source:
        body.source === 'licensed' || body.source === 'reference-only' ? body.source : 'mine',
    });
    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Save failed — is the clipping_vault migration applied?' },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, asset });
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
}
