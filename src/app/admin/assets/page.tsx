/**
 * /admin/assets — Asset Hub.
 *
 * Server component: collects every asset from its owning store on each request
 * (via `collectAssetBundle`, which is service-role and must stay server-side),
 * then hands the normalized bundle to the client workspace for tabs, search,
 * filtering, and the derived metrics. Replaces the original hardcoded inventory
 * — the shipped builders and roadmap items now live in the collector's catalog
 * group instead of being duplicated in this file.
 */
import AssetsWorkspace from './AssetsWorkspace';
import { collectAssetBundle } from '@/lib/mothermode/assets/collect';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Asset Hub' };

export default async function AdminAssetsPage() {
  const bundle = await collectAssetBundle();
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <AssetsWorkspace bundle={bundle} />
    </div>
  );
}
