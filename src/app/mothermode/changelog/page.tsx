import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listPublishedChangelog } from '@/lib/mothermode/help/store';
import ChangelogList from './ChangelogList';

export const revalidate = 3600;

export const metadata = {
  title: 'Changelog',
  description: 'What is new, improved, and fixed in MotherMode.',
};

/** Public changelog. Published entries, newest first, as expandable cards:
 *  a summary row per release that opens to the full change/fix detail. */
export default async function ChangelogPage() {
  const entries = await listPublishedChangelog();

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
        <p className="text-xs uppercase tracking-[0.2em] text-brass">Changelog</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          What is new
        </h1>
        <p className="mt-3 max-w-xl text-ink/60">
          Every release, newest first.
        </p>

        {entries.length === 0 ? (
          <p className="mt-10 text-ink/50">No changelog entries are published yet.</p>
        ) : (
          <ChangelogList entries={entries} />
        )}
      </main>
    </div>
  );
}
