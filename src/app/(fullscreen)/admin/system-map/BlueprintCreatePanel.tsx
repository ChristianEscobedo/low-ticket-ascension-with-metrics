'use client';

/**
 * The "Create a blueprint" panel — the three entry modes into the Blueprint
 * Creator. One action drafts a connected, ready-to-run subgraph and lands it
 * on the canvas as a PENDING overlay (dashed) for approval:
 *
 *   - From research      — a research artifact (the offer brief) becomes the
 *                          whole system.
 *   - From an optimization — the leak detector's worst edge becomes the fix.
 *   - From a clone variant — a winning funnel clones into a variant to A/B.
 *
 * Every path POSTs { action: 'propose' } — the proposal only. Nothing
 * materializes until the pending blueprint is approved on the canvas (the
 * gated pattern).
 */
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { SystemMapInput } from '@/lib/mothermode/systemMap';
import type { SystemMapAnalysis } from '@/lib/mothermode/systemMapAnalysis';

type Mode = 'research' | 'optimization' | 'clone';

interface ResearchSessionOption {
  id: string;
  title: string;
}
interface ResearchArtifactOption {
  id: string;
  title: string;
  type: string;
}

export default function BlueprintCreatePanel({
  open,
  onClose,
  funnels,
  leaks,
  onProposed,
}: {
  open: boolean;
  onClose: () => void;
  /** The map's funnels (the clone picker's options). */
  funnels: SystemMapInput['funnels'];
  /** The analysis's leaks (the optimization picker's options). */
  leaks: SystemMapAnalysis['leaks'];
  /** Refetch the map + blueprints after a proposal lands. */
  onProposed: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('clone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clone: the funnel to clone.
  const [cloneFunnelId, setCloneFunnelId] = useState('');
  // Optimization: the leak to fix (the analysis's edge id).
  const [leakEdgeId, setLeakEdgeId] = useState('');
  // Research: the session → its offer-brief artifacts.
  const [sessions, setSessions] = useState<ResearchSessionOption[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [artifacts, setArtifacts] = useState<ResearchArtifactOption[]>([]);
  const [artifactId, setArtifactId] = useState('');
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);

  // Load the research sessions when the research mode opens.
  useEffect(() => {
    if (!open || mode !== 'research') return;
    void (async () => {
      try {
        const res = await fetch('/api/admin/mothermode-research', {
          cache: 'no-store',
        });
        const json = await res.json();
        if (json.ok) {
          setSessions(
            (json.sessions ?? []).map((s: { id: string; title?: string }) => ({
              id: s.id,
              title: s.title || 'Untitled research',
            })),
          );
        }
      } catch {
        /* the picker stays empty */
      }
    })();
  }, [open, mode]);

  // Load a session's offer-brief artifacts when one is picked.
  useEffect(() => {
    if (!sessionId) {
      setArtifacts([]);
      return;
    }
    void (async () => {
      setLoadingArtifacts(true);
      try {
        const res = await fetch(`/api/admin/mothermode-research?id=${sessionId}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (json.ok) {
          setArtifacts(
            (json.artifacts ?? [])
              .filter((a: { type?: string }) => a.type === 'offer-brief')
              .map((a: { id: string; title?: string; type?: string }) => ({
                id: a.id,
                title: a.title || 'Untitled offer',
                type: a.type ?? '',
              })),
          );
        }
      } catch {
        /* the picker stays empty */
      } finally {
        setLoadingArtifacts(false);
      }
    })();
  }, [sessionId]);

  if (!open) return null;

  const propose = async () => {
    setBusy(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (mode === 'clone') {
        const funnel = funnels.find((f) => f.id === cloneFunnelId);
        if (!funnel) throw new Error('Pick the funnel to clone.');
        body = {
          action: 'propose',
          mode: 'clone',
          parentFunnelId: funnel.id,
          kind: funnel.kind,
          pageKeys: funnel.pages.map((p) => p.key),
        };
      } else if (mode === 'optimization') {
        const leak = leaks.find((l) => l.edgeId === leakEdgeId);
        if (!leak) throw new Error('Pick the leak to fix.');
        const funnel = funnels.find((f) => f.id === leak.funnelId);
        // The page key rides the leak's node id: page:<funnelId>:<pageKey>.
        const pageKey = leak.nodeId.split(':').pop() || 'checkout';
        body = {
          action: 'propose',
          mode: 'optimization',
          parentFunnelId: leak.funnelId,
          kind: funnel?.kind ?? 'sales',
          leakPageKey: pageKey,
          leakLabel: leak.label,
          leakEdgeId: leak.edgeId,
        };
      } else {
        if (!artifactId) throw new Error('Pick the offer brief to build from.');
        body = { action: 'propose', mode: 'research', artifactId };
      }
      const res = await fetch('/api/admin/system-map/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Propose failed');
      onProposed(`Blueprint drafted — review it on the canvas and approve to build.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Propose failed');
    } finally {
      setBusy(false);
    }
  };

  const selectClass =
    'w-full rounded-lg border border-bone/15 bg-ink px-2.5 py-2 text-xs text-bone/90 outline-none focus:border-brass/50';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-noir/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-bone/15 bg-ink p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-bone">
            Create a blueprint
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-bone/40 hover:text-bone"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-bone/45">
          A whole system — the funnel, the emails, the links, the content —
          drafted as one connected subgraph. It lands on the map as a pending
          overlay; nothing is built until you approve it.
        </p>

        {/* the mode picker */}
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {(
            [
              { key: 'clone', label: 'Clone a winner' },
              { key: 'optimization', label: 'Fix a leak' },
              { key: 'research', label: 'From research' },
            ] as { key: Mode; label: string }[]
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                mode === m.key
                  ? 'border-brass/60 bg-brass/10 text-brass'
                  : 'border-bone/15 text-bone/50 hover:bg-bone/5'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {mode === 'clone' && (
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-bone/40">
                The winning funnel to clone
              </label>
              <select
                value={cloneFunnelId}
                onChange={(e) => setCloneFunnelId(e.target.value)}
                className={selectClass}
              >
                <option value="">Pick a funnel…</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name || f.slug} ({f.kind})
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'optimization' && (
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-bone/40">
                The leak to fix
              </label>
              {leaks.length === 0 ? (
                <p className="rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-[11px] text-bone/40">
                  No leaks detected — every edge is performing. Run the map with
                  live funnels to surface one.
                </p>
              ) : (
                <select
                  value={leakEdgeId}
                  onChange={(e) => setLeakEdgeId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Pick a leak…</option>
                  {leaks.map((l) => (
                    <option key={l.edgeId} value={l.edgeId}>
                      {l.funnelName} · {l.label} {Math.round(l.rate * 100)}%
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {mode === 'research' && (
            <>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-bone/40">
                  The research session
                </label>
                <select
                  value={sessionId}
                  onChange={(e) => {
                    setSessionId(e.target.value);
                    setArtifactId('');
                  }}
                  className={selectClass}
                >
                  <option value="">Pick a session…</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-bone/40">
                  The offer brief
                </label>
                <select
                  value={artifactId}
                  onChange={(e) => setArtifactId(e.target.value)}
                  disabled={!sessionId || loadingArtifacts}
                  className={selectClass}
                >
                  <option value="">
                    {loadingArtifacts ? 'Loading…' : 'Pick an offer brief…'}
                  </option>
                  {artifacts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-[11px] text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-bone/15 px-3 py-1.5 text-xs text-bone/60 hover:bg-bone/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={propose}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brass/50 bg-brass/15 px-3 py-1.5 text-xs font-semibold text-brass hover:bg-brass/25 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            Draft the blueprint
          </button>
        </div>
      </div>
    </div>
  );
}
