'use client';

/**
 * /admin/gates (roadmap UI/UX thread): the mobile gate screen. Every run
 * paused on a human yes, with the gated step's note and two BIG tap targets
 * (Approve / Cancel) — nothing else. Built phone-first: full-width cards,
 * 48px buttons, 5s poll while any gate waits.
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, PauseCircle, XCircle } from 'lucide-react';
import {
  gatedRuns,
  formatAgo,
  type ExpertInfo,
} from '@/lib/mothermode/research/recipes/crew';
import type { Recipe, RecipeRun } from '@/lib/mothermode/research/recipes/types';

const API = '/api/admin/mothermode-recipes';

export default function GatesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [runs, setRuns] = useState<RecipeRun[]>([]);
  const [experts, setExperts] = useState<ExpertInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>('');
  const [note, setNote] = useState('');

  const load = useCallback(async (quiet?: boolean) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(API, { cache: 'no-store' });
      const json = await res.json();
      setRecipes(json.recipes ?? []);
      setRuns(json.runs ?? []);
      setExperts(json.experts ?? []);
    } catch {
      /* a failed poll keeps the last good list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const hasGates = gatedRuns(runs).length > 0;
    if (!hasGates) return;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [load, runs]);

  const act = async (runId: string, action: 'approve' | 'cancel') => {
    setBusy(runId);
    setNote('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, runId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `${action} failed`);
      setNote(action === 'approve' ? 'Approved — the run resumes.' : 'Canceled.');
      await load(true);
    } catch (err) {
      setNote(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setBusy('');
    }
  };

  const gates = gatedRuns(runs);
  const recipeFor = (run: RecipeRun) =>
    recipes.find((r) => r.id === run.recipeId);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-5 flex items-center gap-2.5">
        <PauseCircle className="h-5 w-5 text-amber-300" />
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">
            Gates
          </h1>
          <p className="text-xs text-bone/45">
            Runs paused on your yes. Approve or cancel — nothing else here.
          </p>
        </div>
      </div>

      {note && (
        <p className="mb-3 rounded-lg border border-brass/25 bg-brass/10 px-3 py-2 text-xs text-brass">
          {note}
        </p>
      )}

      {loading && gates.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-bone/40">
          <Loader2 className="h-4 w-4 animate-spin" /> checking for gates…
        </div>
      ) : gates.length === 0 ? (
        <div className="rounded-xl border border-bone/10 bg-bone/[0.02] px-4 py-10 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-300/70" />
          <p className="mt-2 text-sm text-bone/45">
            Nothing waiting on you. The crew is either working or done.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {gates.map((run) => {
            const recipe = recipeFor(run);
            const gatedStep = run.stepsState.find((s) => s.status === 'gated');
            const expert = gatedStep
              ? experts.find(
                  (e) => e.slug === (recipe?.steps[run.currentStep]?.expert ?? ''),
                )
              : undefined;
            return (
              <div
                key={run.id}
                className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-bone">
                      {recipe?.name ?? 'a play'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-bone/45">
                      step {run.currentStep + 1} of {run.stepsState.length}
                      {expert ? ` · ${expert.name}` : ''}
                      {run.createdAt ? ` · paused ${formatAgo(run.createdAt)}` : ''}
                    </p>
                  </div>
                  {busy === run.id && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-300" />
                  )}
                </div>
                {gatedStep?.note && (
                  <p className="mt-2 rounded-lg bg-black/20 px-2.5 py-2 text-xs leading-relaxed text-bone/65">
                    {gatedStep.note}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy === run.id}
                    onClick={() => act(run.id, 'approve')}
                    className="flex h-12 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/90 text-sm font-semibold text-[#10150f] active:brightness-110 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy === run.id}
                    onClick={() => act(run.id, 'cancel')}
                    className="flex h-12 items-center justify-center gap-1.5 rounded-lg border border-red-400/40 text-sm font-semibold text-red-300 active:bg-red-400/10 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
