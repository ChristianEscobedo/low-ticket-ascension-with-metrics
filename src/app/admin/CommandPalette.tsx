'use client';

/**
 * The ⌘K command palette (roadmap UI/UX thread): approve a waiting gate,
 * jump to a play's card, or open a research session — from anywhere in the
 * admin. Deliberately NO "run" action: a play spends money, so the palette
 * navigates to the card with its context around the run button.
 *
 * The action list is built from the SAME reads Mission Control uses
 * (recipes GET + research sessions GET) and ordered by the shared pure
 * helper (gates first, plays, sessions) — pinned in the helper's tests.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  CheckCircle2,
  Command,
  Loader2,
  Map as MapIcon,
  Play,
  Search,
  X,
} from 'lucide-react';
import {
  buildPaletteActions,
  paletteMatches,
  researchLabHref,
  type PaletteAction,
} from '@/lib/mothermode/research/recipes/crew';

const RECIPES_API = '/api/admin/mothermode-recipes';
const SESSIONS_API = '/api/admin/mothermode-research';

function KindGlyph({ kind }: { kind: PaletteAction['kind'] }) {
  if (kind === 'gate')
    return <CheckCircle2 className="h-3.5 w-3.5 text-amber-300" />;
  if (kind === 'play') return <Play className="h-3.5 w-3.5 text-brass" />;
  return <MapIcon className="h-3.5 w-3.5 text-bone/40" />;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [actions, setActions] = useState<PaletteAction[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // The global shortcut: ⌘K / Ctrl+K toggles; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load the action list when the palette opens (fresh every open — a gate
  // that got answered elsewhere must not linger).
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setNote('');
    Promise.all([
      fetch(RECIPES_API, { cache: 'no-store' }).then((r) => r.json()),
      fetch(SESSIONS_API, { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([recipesJson, sessionsJson]) => {
        setActions(
          buildPaletteActions({
            recipes: recipesJson.recipes ?? [],
            runs: recipesJson.runs ?? [],
            sessions: (sessionsJson.sessions ?? []).map(
              (s: { id: string; title: string }) => ({
                id: s.id,
                title: s.title,
              }),
            ),
          }),
        );
      })
      .catch(() => setActions([]));
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const visible = useMemo(
    () => actions.filter((a) => paletteMatches(a, query)).slice(0, 12),
    [actions, query],
  );

  const execute = useCallback(
    async (action: PaletteAction) => {
      if (action.kind === 'gate') {
        setBusy(true);
        try {
          const res = await fetch(RECIPES_API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'approve', runId: action.target }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) throw new Error(json.error || 'approve failed');
          setNote(`${action.label.replace('Approve: ', '')} approved — the run resumes.`);
          setActions((prev) => prev.filter((a) => a.id !== action.id));
          setTimeout(() => setOpen(false), 700);
        } catch (err) {
          setNote(err instanceof Error ? err.message : 'approve failed');
        } finally {
          setBusy(false);
        }
        return;
      }
      setOpen(false);
      if (action.kind === 'play') {
        router.push(`/admin/recipes?focus=${encodeURIComponent(action.target)}`);
      } else {
        router.push(researchLabHref({ sessionId: action.target }));
      }
    },
    [router],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-bone/10 bg-[#1a1512] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-bone/10 px-3 py-2.5">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-brass" />
          ) : (
            <Search className="h-4 w-4 text-bone/40" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && visible.length > 0) execute(visible[0]);
            }}
            placeholder="Approve a gate, find a play, open a session…"
            className="flex-1 bg-transparent text-sm text-bone outline-none placeholder:text-bone/30"
          />
          <span className="hidden items-center gap-1 rounded border border-bone/15 px-1.5 py-0.5 text-[9px] text-bone/35 sm:flex">
            <Command className="h-2.5 w-2.5" />K
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-bone/40 hover:text-bone"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {note && (
            <p className="px-2 py-1.5 text-xs text-brass/80">{note}</p>
          )}
          {visible.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-bone/35">
              nothing matches — try a play name or a session title
            </p>
          ) : (
            visible.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={() => execute(action)}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brass/10 disabled:opacity-50',
                )}
              >
                <KindGlyph kind={action.kind} />
                <span className="min-w-0 flex-1 truncate text-sm text-bone/85">
                  {action.label}
                </span>
                <span className="shrink-0 text-[10px] text-bone/35">
                  {action.hint}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
