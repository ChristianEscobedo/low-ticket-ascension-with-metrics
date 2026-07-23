import { listKitsForAdmin } from '@/lib/mothermode/community/store';
import { buildContextSourceOptions } from '@/lib/mothermode/context/sources';
import CommunityEditor from './CommunityEditor';

export const dynamic = 'force-dynamic';


/**
 * Admin-gated Community Kit builder. Loads every saved kit (via the
 * service-role store read) and hands them to the client editor. The editor
 * runs the intake -> generate flow through /api/mothermode/community-ai and
 * persists through /api/admin/mothermode-community.
 */
export default async function CommunityAdminPage() {
  const [kits, sources] = await Promise.all([
    listKitsForAdmin(),
    buildContextSourceOptions(),
  ]);


  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Community Kit
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Community launch kit builder
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Fill a short intake and generate a full launch kit: name options, a
          public description, three qualifying questions each for paid and free,
          a DM script, a sales-call script, an ad concept, and the first pinned
          post. Edit any field and regenerate individual sections in place.
        </p>
      </div>

      <CommunityEditor initialKits={kits} sources={sources} />

    </div>
  );
}
