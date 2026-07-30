import { Suspense } from 'react';
import { listArticlesForAdmin } from '@/lib/mothermode/help/store';
import { ARTICLE_BODY_STYLES } from '@/lib/mothermode/help/articleStyles';
import AdminDocsBrowser from './AdminDocsBrowser';

export const dynamic = 'force-dynamic';

/**
 * Admin-only documentation browser. Shows the ADMIN-audience knowledge base
 * articles (how to run the app) inside the admin shell, with search and a
 * reader pane. This is the in-app home for the 33 seeded guides, kept separate
 * from the buyer-facing help center at /mothermode/help.
 */
export default async function AdminHelpDocsPage() {
  const articles = await listArticlesForAdmin('admin');

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: ARTICLE_BODY_STYLES }} />
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Documentation
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Admin help docs
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Every guide for running the app, searchable in one place. Edit the
          source content in Help Center; this is the read view.
        </p>
      </div>

      <Suspense>
        <AdminDocsBrowser articles={articles} />
      </Suspense>
    </div>
  );
}
