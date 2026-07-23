import {
  listArticlesForAdmin,
  listChangelogForAdmin,
} from '@/lib/mothermode/help/store';
import HelpEditor from './HelpEditor';

export const dynamic = 'force-dynamic';

/**
 * Admin-gated Help Center editor. Loads every knowledge base article and
 * changelog entry (drafts included, via the service-role store reads) and
 * hands them to the two-tab client editor. Writes go back through the guarded
 * /api/admin/mothermode-help and /api/admin/mothermode-changelog routes.
 */
export default async function HelpAdminPage() {
  const [articles, changelog] = await Promise.all([
    listArticlesForAdmin(),
    listChangelogForAdmin(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Help Center
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Knowledge base and changelog
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Author help articles and release notes in the app. Drafts stay
          private. Publish to make an item visible on the public viewer, edit
          any time, and the page updates without a deploy.
        </p>
      </div>

      <HelpEditor initialArticles={articles} initialChangelog={changelog} />
    </div>
  );
}
