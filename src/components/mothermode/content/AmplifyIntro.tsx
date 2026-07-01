'use client';

/**
 * The first-run state for a Refine run. Before anything is generated it shows
 * the source post exactly as it reads on platform (the same preview pipeline the
 * versions use) beside a short explainer of what Amplify produces: variant
 * hooks, fresh angles, reworked bodies, and stronger CTAs. It is purely
 * informational, so it takes only the piece it is about to amplify.
 */
import React from 'react';
import {
  Sparkles,
  Type,
  Compass,
  AlignLeft,
  MousePointerClick,
} from 'lucide-react';
import type { ContentPiece, VersionParts } from '@/lib/mothermode/content';
import { VersionPreview } from './VersionPreview';

/** The source piece's own parts, so the original renders through the version
 *  preview pipeline (and inherits the same readable reflow). */
function originalParts(piece: ContentPiece): VersionParts {
  return { hook: piece.hook ?? '', body: piece.body ?? [], cta: piece.cta ?? '' };
}

/** One capability row in the explainer. */
const CAPABILITIES: {
  Icon: React.FC<{ className?: string }>;
  title: string;
  blurb: string;
}[] = [
  {
    Icon: Type,
    title: 'Variant hooks',
    blurb: 'New first lines that open the same post a dozen different ways.',
  },
  {
    Icon: Compass,
    title: 'Fresh angles',
    blurb: 'The same offer reframed: a new entry point, objection, or promise.',
  },
  {
    Icon: AlignLeft,
    title: 'Reworked bodies',
    blurb: 'Alternate middles that carry the idea in a different rhythm.',
  },
  {
    Icon: MousePointerClick,
    title: 'Stronger CTAs',
    blurb: 'Closing lines that ask for the click without changing the voice.',
  },
];

export const AmplifyIntro: React.FC<{ piece: ContentPiece }> = ({ piece }) => (
  <div className="mx-auto flex h-full max-w-4xl flex-col justify-center gap-8 px-2 py-6 md:flex-row md:items-center">
    {/* The post as it reads today, the baseline every variation builds on. */}
    <div className="shrink-0">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-ink/45">
        Your post today
      </p>
      <VersionPreview piece={piece} version={originalParts(piece)} width={300} />
    </div>

    {/* What Amplify will do with it. */}
    <div className="min-w-0 flex-1 space-y-5">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-mode/10 px-3 py-1 text-xs font-semibold text-mode">
          <Sparkles className="h-3.5 w-3.5" />
          Amplify
        </div>
        <h3 className="font-display text-2xl leading-tight text-ink">
          Turn this one post into many.
        </h3>
        <p className="max-w-md text-sm text-ink/60">
          Set the recipe on the left and amplify. Amplify keeps the brand voice
          and remakes the parts you pick, then assembles them into whole versions
          you can preview, schedule, and publish.
        </p>
      </div>

      <ul className="space-y-3">
        {CAPABILITIES.map(({ Icon, title, blurb }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brass/15 text-brass">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="text-sm text-ink/55">{blurb}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);
