import { listKitsForAdmin } from '@/lib/mothermode/highticket/store';
import { buildContextSourceOptions } from '@/lib/mothermode/context/sources';
import HighTicketEditor from './HighTicketEditor';

export const dynamic = 'force-dynamic';


/**
 * Admin-gated High Ticket Kit builder. Loads every saved kit (via the
 * service-role store read) and hands them to the client editor. The editor
 * runs the intake -> generate flow through /api/mothermode/highticket-ai and
 * persists through /api/admin/mothermode-highticket.
 */
export default async function HighTicketAdminPage() {
  const [kits, sources] = await Promise.all([
    listKitsForAdmin(),
    buildContextSourceOptions(),
  ]);


  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          High Ticket Kit
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          High-ticket offer kit builder
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Fill a short intake and generate a complete high-ticket selling system:
          name options, the full offer stack, a give-away value resource, a
          15-minute triage script, the closing sales-call script, and an ad angle.
          Edit any field and regenerate individual sections in place.
        </p>
      </div>

      <HighTicketEditor initialKits={kits} sources={sources} />

    </div>
  );
}
