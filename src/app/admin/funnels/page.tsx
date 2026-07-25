import { listFunnelsForAdmin, listLeadsForAdmin } from '@/lib/mothermode/optin/store';
import { listKitsForAdmin } from '@/lib/mothermode/email/store';
import OptinFunnelEditor from './OptinFunnelEditor';

export const dynamic = 'force-dynamic';

/**
 * Admin hub for MotherMode optin funnels. Create / edit / publish lead-capture
 * pages that render at /optin/[slug] in the Editorial Warm brand.
 */
export default async function FunnelsAdminPage() {
  const [funnels, leads, emailKits] = await Promise.all([
    listFunnelsForAdmin(),
    listLeadsForAdmin({ limit: 100 }),
    listKitsForAdmin(),
  ]);

  const emailKitOptions = emailKits.map((k) => ({
    id: k.id,
    slug: k.slug,
    name: k.name || k.slug,
    status: k.status,
  }));

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Funnels
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Optin funnel builder
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Build MotherMode-branded lead capture pages: optin → optional one-time
          offer → thank-you. Publish a slug, share{' '}
          <code className="text-brass/90">/optin/your-slug</code>, and leads land
          here. Link an Email kit to auto-enroll on capture.
        </p>
      </div>

      <OptinFunnelEditor
        initialFunnels={funnels}
        initialLeads={leads}
        emailKits={emailKitOptions}
      />
    </div>
  );
}


