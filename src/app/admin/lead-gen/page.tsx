import { listKitsForAdmin } from '@/lib/mothermode/leadgen/store';
import LeadGenEditor from './LeadGenEditor';

export const dynamic = 'force-dynamic';

/**
 * Admin-gated Lead Gen Kit builder. Loads every saved kit (via the service-role
 * store read) and hands them to the client editor. The editor runs the intake
 * -> outline -> per-section expand flow through /api/mothermode/leadgen-ai,
 * persists through /api/admin/mothermode-leadgen, and can publish the finished
 * document straight into the buyer-facing Deliverables system.
 */
export default async function LeadGenAdminPage() {
  const kits = await listKitsForAdmin();

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Lead Gen Kit
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Lead-magnet document builder
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Fill a short intake, pick a format (ebook, guide, SOP, checklist,
          worksheet, swipe file, mini-course, and more), then generate a complete,
          long-form, brand-styled document. Build it in one pass or section by
          section, edit any block in place, then publish it to Deliverables.
        </p>
      </div>

      <LeadGenEditor initialKits={kits} />
    </div>
  );
}
