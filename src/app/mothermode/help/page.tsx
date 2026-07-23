import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { listPublishedArticles } from '@/lib/mothermode/help/store';
import type { KbArticle } from '@/lib/mothermode/help/types';

export const revalidate = 3600;

export const metadata = {
  title: 'Help Center',
  description: 'Guides and answers for getting the most out of MotherMode.',
};

/** Public knowledge base index. Groups published articles by category and
 *  links to each article. Server component so it stays cacheable; the admin
 *  editor revalidates this path on publish. */
export default async function HelpIndexPage() {
  const articles = await listPublishedArticles();

  const grouped = new Map<string, KbArticle[]>();
  for (const a of articles) {
    const list = grouped.get(a.category) ?? [];
    list.push(a);
    grouped.set(a.category, list);
  }
  const categories = Array.from(grouped.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-brass">Help Center</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          How can we help?
        </h1>
        <p className="mt-3 max-w-xl text-ink/60">
          Guides and answers for getting the most out of your resources.
        </p>

        {categories.length === 0 ? (
          <p className="mt-10 text-ink/50">No help articles are published yet.</p>
        ) : (
          <div className="mt-10 space-y-10">
            {categories.map(([category, items]) => (
              <section key={category}>
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink/50">
                  <BookOpen className="h-4 w-4 text-brass" />
                  {category}
                </h2>
                <div className="mt-3 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white/50">
                  {items.map((article) => (
                    <Link
                      key={article.id}
                      href={`/mothermode/help/${article.slug}`}
                      className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white"
                    >
                      <div>
                        <div className="font-semibold text-ink group-hover:text-mode">
                          {article.title}
                        </div>
                        {article.excerpt && (
                          <div className="mt-0.5 text-sm text-ink/55">{article.excerpt}</div>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-ink/30 transition-colors group-hover:text-mode" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 border-t border-ink/10 pt-6">
          <Link
            href="/mothermode/changelog"
            className="text-sm font-semibold text-mode hover:text-mode-deep"
          >
            View the changelog
          </Link>
        </div>
      </main>
    </div>
  );
}
