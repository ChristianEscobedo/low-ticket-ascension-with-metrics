import { listKitsForAdmin } from '@/lib/mothermode/email/store';
import { buildContextSourceOptions } from '@/lib/mothermode/context/sources';
import EmailKitEditor from './EmailKitEditor';


export const dynamic = 'force-dynamic';

/**
 * Admin-gated Email Marketing Kit builder. Loads every saved kit (via the
 * service-role store read) and hands them to the client editor. The editor runs
 * the intake -> outline -> per-email expand flow through
 * /api/mothermode/email-ai, resolving any attached context sources (offers,
 * lead magnets, high-ticket offers, community kits) at generation time, and
 * persists finished sequences through /api/admin/mothermode-email.
 */
export default async function EmailMarketingAdminPage() {
  const [kits, sources] = await Promise.all([
    listKitsForAdmin(),
    buildContextSourceOptions(),
  ]);


  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Email Marketing Kit
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Outcome-driven email sequences
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Fill a short intake, pick a campaign type (lead magnet to low-ticket,
          nurture to offer, cart abandonment, webinar, onboarding, win-back, and
          more), attach the offers or kits it should promote, then generate a
          complete sequence. Build it in one pass or email by email, edit any
          message in place, and copy the plain-text or brand-styled HTML.
        </p>
      </div>

      <EmailKitEditor initialKits={kits} sources={sources} />

    </div>
  );
}
