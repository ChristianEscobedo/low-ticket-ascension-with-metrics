'use client';

/**
 * Live result cards (roadmap 2.2): the structured, pinnable face of a data
 * tool call — post ladders with engagement, comment threads, review tables —
 * rendered under the reasoning trace of the message that produced them.
 * Every item is one-click pinnable into the evidence base.
 */
import { clsx } from 'clsx';
import { Pin, Check, ExternalLink } from 'lucide-react';
import type {
  LiveResultCard,
  LiveCardItem,
} from '@/lib/mothermode/research/liveCards';

function CardRow({
  item,
  onPin,
  pinned,
}: {
  item: LiveCardItem;
  onPin?: (item: LiveCardItem) => void;
  pinned: boolean;
}) {
  return (
    <li className="group rounded-lg border border-bone/10 bg-black/20 px-2.5 py-1.5">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-xs leading-snug text-bone/75">
          {item.text}
        </p>
        <span className="flex shrink-0 items-center gap-1">
          {item.meta && (
            <span className="rounded bg-brass/15 px-1 py-0.5 text-[9px] font-semibold text-brass/85">
              {item.meta}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-bone/30 hover:text-brass"
              aria-label="Open source"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {onPin && (
            <button
              type="button"
              onClick={() => onPin(item)}
              className={clsx(
                'rounded p-0.5',
                pinned
                  ? 'text-brass'
                  : 'text-bone/30 opacity-0 transition-opacity hover:text-brass group-hover:opacity-100',
              )}
              title={pinned ? 'Pinned' : 'Pin as evidence'}
              aria-label="Pin as evidence"
            >
              {pinned ? (
                <Check className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
            </button>
          )}
        </span>
      </div>
      {item.lines.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-l-2 border-bone/10 pl-2">
          {item.lines.map((line, i) => (
            <li key={i} className="text-[11px] leading-snug text-bone/50">
              {line}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function LiveCards({
  cards,
  onPin,
  pinnedBodies,
}: {
  cards: LiveResultCard[];
  /** Called with an item to pin (parent handles the POST + evidence state). */
  onPin?: (item: LiveCardItem) => void;
  /** Bodies already in the evidence rail (renders the check instead). */
  pinnedBodies?: Set<string>;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="mt-2 space-y-3">
      {cards.map((card, ci) => (
        <div key={`${card.kind}-${ci}`}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/35">
            {card.title}
          </div>
          <ul className="space-y-1">
            {card.items.map((item, ii) => (
              <CardRow
                key={ii}
                item={item}
                onPin={onPin}
                pinned={!!pinnedBodies?.has(item.text)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
