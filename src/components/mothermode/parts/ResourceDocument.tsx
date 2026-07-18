'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import type { DeliverableDoc } from '@/lib/mothermode/deliverables/index';
import { WORKSPACE_REGISTRY } from './workspace/registry';

const SLOT_PATTERN = /<div data-mm-slot="([^"]+)"><\/div>/g;

/** Splits the document HTML into plain-HTML segments and interactive slot
 *  ids, in document order, so static brand copy and live React tools can be
 *  interleaved inside one long-form page. */
function splitOnSlots(html: string): Array<{ type: 'html'; value: string } | { type: 'slot'; id: string }> {
  const parts: Array<{ type: 'html'; value: string } | { type: 'slot'; id: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(SLOT_PATTERN);
  while ((match = re.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'html', value: html.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'slot', id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < html.length) {
    parts.push({ type: 'html', value: html.slice(lastIndex) });
  }
  return parts;
}

/**
 * The branded document shell every resource delivery page renders inside.
 * Matches the sales-page palette (Bone/Ink/Mode/Brass) and typography so a
 * resource feels like a continuation of the purchase, not a separate app.
 * The body HTML is hand-authored brand markup produced by the deliverables
 * kit, never user input, so dangerouslySetInnerHTML is safe here. Any
 * `interactiveSlot()` markers in that markup are swapped for a live React
 * workspace component (see ./workspace/registry) so buyers can fill in and
 * save their own data inline, not just read a static walkthrough.
 */
export const ResourceDocument: React.FC<{
  doc: DeliverableDoc;
  offerName: string;
  offerSlug: string;
}> = ({ doc, offerName, offerSlug }) => {
  const segments = splitOnSlots(doc.html);

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-bone/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={`/mothermode/${offerSlug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-mode print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            {offerName}
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ink/60 transition-colors hover:border-mode/30 hover:text-mode print:hidden"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-brass">{offerName}</p>
        {segments.map((seg, i) =>
          seg.type === 'html' ? (
            // eslint-disable-next-line react/no-danger
            <div key={i} dangerouslySetInnerHTML={{ __html: seg.value }} />
          ) : (
            <WorkspaceSlot key={i} id={seg.id} />
          ),
        )}
      </main>

      <footer className="border-t border-ink/10 py-10 text-center print:hidden">
        <Link
          href={`/mothermode/${offerSlug}`}
          className="text-sm font-semibold text-mode hover:text-mode-deep"
        >
          Back to {offerName}
        </Link>
      </footer>
    </div>
  );
};

const WorkspaceSlot: React.FC<{ id: string }> = ({ id }) => {
  const Component = WORKSPACE_REGISTRY[id];
  if (!Component) return null;
  return <Component />;
};
