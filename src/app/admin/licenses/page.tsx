import LicensesPanel from '@/components/admin/LicensesPanel';

export const dynamic = 'force-dynamic';

export default function AdminLicensesPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
          Course Area
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          License Keys
        </h1>
        <p className="text-sm text-white/60 mt-2 max-w-2xl">
          Generate redeemable keys that grant access to a specific course or
          everything in the library — useful for gifts, promos, and bulk
          partnerships.
        </p>
      </div>
      <LicensesPanel />
    </div>
  );
}
