'use client';

/**
 * The cast — the Content Hub handoff for the AI Clone foundry. Character
 * sheets forged in the Clone tab land in the Media Library tagged
 * `character-sheet`; this picker lists them and hands one back as the
 * storyboard's @reference, so the same character shows up INSIDE the
 * generated footage (the omni-reference Seedance models read it).
 *
 * Renders nothing when the cast is empty — no forged sheets, no noise.
 */
import { useEffect, useState } from 'react';
import { Loader2, PersonStanding, Plus } from 'lucide-react';
import { characterSheetAssets } from '@/lib/mothermode/reel/mediaLibrary';

interface CastSheet {
  url: string;
  name: string;
}

export default function CloneCastPicker({
  onPick,
  label = 'the cast — character sheets',
}: {
  /** Called with the sheet's hosted URL (append it to the board's refs). */
  onPick: (url: string) => void;
  label?: string;
}) {
  const [sheets, setSheets] = useState<CastSheet[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/media-library', { cache: 'no-store' });
        const json = await res.json();
        const rows = (json.assets ?? json.records ?? []) as {
          url?: string;
          kind?: string;
          tags?: string[];
          name?: string;
        }[];
        setSheets(
          characterSheetAssets(rows).map((a) => ({
            url: a.url as string,
            name: (a.name as string) ?? 'Character sheet',
          })),
        );
      } catch {
        setSheets([]);
      }
    })();
  }, []);

  if (sheets === null) {
    return (
      <p className="flex items-center gap-1.5 py-1 text-[9px] text-ink/40">
        <Loader2 className="h-3 w-3 animate-spin" /> the cast…
      </p>
    );
  }
  if (sheets.length === 0) return null; // no cast yet — forge one in the Clone tab

  return (
    <div className="mt-1.5">
      <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-ink/40">
        <PersonStanding className="h-3 w-3" /> {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sheets.slice(0, 8).map((s) => (
          <button
            key={s.url}
            type="button"
            onClick={() => onPick(s.url)}
            title={`${s.name} — use as the @reference (the character shows up in the footage)`}
            className="group relative h-14 w-14 overflow-hidden rounded-lg border border-brass/30 hover:border-brass"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt={s.name} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-ink/0 transition group-hover:bg-ink/40">
              <Plus className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
