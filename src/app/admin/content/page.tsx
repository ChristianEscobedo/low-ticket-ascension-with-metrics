/**
 * /admin/content — Content Hub.
 *
 * Thin mount for the existing `ContentHub` client component so the hub is
 * reachable from the admin side nav instead of only from the /mothermode
 * routes. No props are passed: the propless form is the shared library view
 * (reviews scope to DEFAULT_OFFER_SLUG), which is what an operator wants from
 * the admin shell. Per-offer views stay at /mothermode/content/[slug].
 *
 * Why the fixed overlay: the hub is a full workspace (its own bone canvas,
 * sticky search rail, side nav, and modal sheets) and does not fit the 220px
 * sidebar + narrow column that /admin/layout.tsx imposes. Rather than opt out
 * of that layout — which would also opt out of its ADMIN_EMAILS gate, since a
 * route group cannot skip an ancestor layout — the page covers the admin chrome
 * with `fixed inset-0` and scrolls itself. The auth gate still runs, the hub
 * gets the whole viewport, and an explicit back link replaces the side nav that
 * is now behind it.
 *
 * The back row is deliberately not sticky: the hub's own search bar is
 * `sticky top-0`, so a sticky header here would sit on top of it once scrolled.
 */
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ContentHub } from '@/components/mothermode/content/ContentHub';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Content Hub · Admin' };

export default function AdminContentPage() {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bone">
      <div className="border-b border-ink/10 px-6 py-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-ink/60 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>
      </div>
      <ContentHub />
    </div>
  );
}
