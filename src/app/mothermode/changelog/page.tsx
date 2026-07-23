import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listPublishedChangelog } from '@/lib/mothermode/help/store';
import type { ChangelogType } from '@/lib/mothermode/help/types';

export const revalidate = 3600;

export const metadata = {
  title: 'Changelog',
  description: 'What is new, improved, and fixed in MotherMode.',
};

const TYPE_STYLES: Record<ChangelogType, string> = {
  added: 'border-emerald-500/40 bg-emerald-50 text-emerald-700',
  improved: 'border-sky-500/40 bg-sky-50 text-sky-700',
  fixed: 'border-amber-500/40 bg-amber-50 text-amber-700',
  removed: 'border-red-500/40 bg-red-50 text-red-700',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Public changelog. Published entries, newest first, with a colored type tag
 *  and the trusted, admin-authored body HTML. */
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
          <div className="mt-10 space-y-8">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-ink/10 bg-white/50 p-6"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${TYPE_STYLES[entry.entryType]}`}
                  >
                    {entry.entryType}
                  </span>
                  {entry.version && (
                    <span className="text-sm font-semibold text-ink/70">
                      {entry.version}
                    </span>
                  )}
                  <span className="text-sm text-ink/45">{formatDate(entry.releasedOn)}</span>
                </div>

                <h2 className="mt-3 font-display text-xl font-semibold tracking-tight">
                  {entry.title}
                </h2>

                <div
                  className="prose prose-neutral mt-3 max-w-none prose-sm"
                  // Body is trusted, hand-authored admin content, never buyer input.
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: entry.body }}
                />
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
