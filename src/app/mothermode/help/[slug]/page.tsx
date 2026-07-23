import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getArticleBySlug } from '@/lib/mothermode/help/store';

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  const article = await getArticleBySlug(params.slug);
  if (!article) return { title: 'Help Center' };
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
  };
}

/** Public single-article view. Renders the trusted, admin-authored body HTML
 *  in the brand shell. Returns 404 when the slug is not a published article. */
export default async function HelpArticlePage({ params }: PageProps) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-bone/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <Link
            href="/mothermode/help"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-mode"
          >
            <ArrowLeft className="h-4 w-4" />
            Help Center
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-brass">{article.category}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="mt-3 max-w-xl text-ink/60">{article.excerpt}</p>
        )}

        <article
          className="prose prose-neutral mt-8 max-w-none"
          // Body is trusted, hand-authored admin content, never buyer input.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: article.body }}
        />
      </main>

      <footer className="border-t border-ink/10 py-10 text-center">
        <Link
          href="/mothermode/help"
          className="text-sm font-semibold text-mode hover:text-mode-deep"
        >
          Back to Help Center
        </Link>
      </footer>
    </div>
  );
}
