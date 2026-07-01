import { ExternalLink, Download, Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

// The PDF is served by an admin-gated route, never from public/. The iframe and
// the buttons all point at the same protected endpoint.
const BRAND_GUIDE_URL = '/api/admin/brand-guide';

export default function BrandPage() {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
        Reference
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
        Brand System
      </h1>
      <p className="mt-2 text-bone/60 max-w-2xl">
        The MotherMode brand system: voice, palette, type, and usage. The source
        of truth for every page and post. Read it in full below.
      </p>

      <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brass/25 bg-brass/[0.08] px-3 py-1.5 text-xs text-brass">
        <Lock className="w-3.5 h-3.5" />
        Confidential. Admin only. Do not share outside the team.
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={BRAND_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-bone/15 bg-bone/[0.05] px-4 py-2 text-sm font-semibold text-bone hover:bg-bone/[0.1] transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open in new tab
        </a>
        <a
          href={BRAND_GUIDE_URL}
          download="mothermode-brand-system.pdf"
          className="inline-flex items-center gap-2 rounded-lg border border-brass/30 bg-brass/[0.12] px-4 py-2 text-sm font-semibold text-brass hover:bg-brass/[0.18] transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </a>
      </div>

      <div className="mt-6 rounded-2xl border border-bone/10 bg-ink/40 overflow-hidden">
        <iframe
          src={BRAND_GUIDE_URL}
          title="MotherMode Brand System"
          className="w-full h-[80vh] bg-bone"
        />
      </div>
    </div>
  );
}
