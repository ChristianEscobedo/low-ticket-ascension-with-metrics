import { listFunnelsForAdmin, listLeadsForAdmin } from '@/lib/mothermode/sales/store';
import SalesFunnelEditor from './SalesFunnelEditor';

export const dynamic = 'force-dynamic';

export default async function SalesFunnelsPage() {
  const [funnels, leads] = await Promise.all([
    listFunnelsForAdmin(),
    listLeadsForAdmin({ limit: 200 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-bone">Sales Funnels</h1>
        <p className="mt-1 text-sm text-bone/55">
          Full purchase path: optin, sales, VSL, checkout, upsells, success, access.
          Modeled on the optin funnel builder.
        </p>
      </div>
      <SalesFunnelEditor initialFunnels={funnels} initialLeads={leads} />
    </div>
  );
}
