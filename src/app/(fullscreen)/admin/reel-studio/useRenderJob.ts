'use client';

/**
 * ONE render job, shared by every surface that can start a render.
 *
 * Why this file exists
 * -------------------
 * The render control now appears in three places — the header next to
 * `Caption MP4`, the Post panel (`RenderPanel`), and the Publish view. All
 * three must show the SAME job: start it in the header, walk over to Publish
 * view, and the progress has to be there waiting for you.
 *
 * So the state lives here and is called ONCE, in `ReelStudioPage`, then handed
 * down as a prop. That is deliberate:
 *
 *  - One `useRenderJob()` call = one polling timer. Three components each
 *    owning their own state would mean three timers hammering the endpoint and
 *    three different answers to "is it done yet?".
 *  - Passing it explicitly (rather than a context) keeps the data flow legible
 *    in a 7k-line file: you can see at the mount site which job a button drives.
 *
 * Contract with the server (src/app/api/admin/reel-render/route.ts) is
 * unchanged:
 *   1. POST { id, aspect }  → { jobId }
 *   2. POST { jobId }       → { done, progress, stage, elapsedSec, videoUrl, errorMessage }
 *
 * And the rule that made long renders survivable stays: the browser NEVER
 * waits on an open request. We start, then poll.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type Aspect = 'vertical' | 'square' | 'landscape';

export const ASPECTS: { value: Aspect; label: string; hint: string }[] = [
  { value: 'vertical', label: '9:16', hint: 'Reels · TikTok · Shorts' },
  { value: 'square', label: '1:1', hint: 'Feed' },
  { value: 'landscape', label: '16:9', hint: 'YouTube' },
];

const POLL_MS = 3000;

/** What every render surface reads. Deliberately flat — it's a view model. */
export type RenderJob = {
  /** null = still probing. false = env not configured, and `hint` says why. */
  available: boolean | null;
  hint: string;
  aspect: Aspect;
  setAspect: (a: Aspect) => void;
  busy: boolean;
  /** 0-100, for a bar. Only moves during frame rendering — see `status`. */
  progress: number;
  status: string;
  error: string;
  videoUrl: string;
  /** Disabled surfaces should explain themselves rather than silently no-op. */
  canStart: boolean;
  start: () => void;
};

/**
 * Turn a worker stage into a sentence a human can act on.
 *
 * The percentage alone is misleading: it only moves during frame rendering.
 * Bundling happens before the first frame and uploading after the last, so a
 * bare "0%" or "100%" can sit still for a long time on a render that is
 * perfectly healthy. Say which phase we're in, and how long it's been.
 */
export function describeStage(stage: unknown, progress: unknown, elapsedSec: unknown): string {
  const secs = typeof elapsedSec === 'number' && elapsedSec > 0 ? ` · ${formatElapsed(elapsedSec)}` : '';
  const pct = typeof progress === 'number' ? Math.round(progress * 100) : 0;

  switch (stage) {
    case 'starting':
    case 'bundling':
      return `Preparing the composition…${secs}`;
    case 'uploading':
      return `Uploading the MP4…${secs}`;
    case 'waiting':
      return `Waiting on the render worker…${secs}`;
    case 'rendering':
      return `Rendering… ${pct}%${secs}`;
    default:
      return `Rendering… ${pct}%${secs}`;
  }
}

export function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function useRenderJob({
  getReelId,
  onRendered,
}: {
  /**
   * Read lazily, at CLICK time, not at render time.
   *
   * The caller sits near the top of a 7k-line component where `project` is not
   * guaranteed to be declared above it — reading `project.id` eagerly to pass a
   * plain string would be a temporal-dead-zone crash that only shows up at
   * runtime. A thunk sidesteps the ordering question entirely, and as a bonus
   * the job always renders whichever reel is open at the moment you click.
   *
   * Returns null when no reel is open; `start` then no-ops.
   */
  getReelId: () => string | null;
  /** Called once with the finished URL so the page can persist it. */
  onRendered?: (videoUrl: string) => void;
}): RenderJob {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [hint, setHint] = useState('');
  const [aspect, setAspect] = useState<Aspect>('vertical');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Kept in a ref so the unmount cleanup can always cancel the live timer.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  // The callback lives in a ref so `poll` has a stable identity. Otherwise a
  // parent that re-creates `onRendered` every render (the common case — it's an
  // inline arrow) would rebuild `poll`, and the effect chain around it, on
  // every keystroke elsewhere in the studio.
  const rendered = useRef(onRendered);
  useEffect(() => {
    rendered.current = onRendered;
  }, [onRendered]);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Probe availability once so the button can explain itself before it's clicked.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/reel-render');
        const json = await res.json();
        if (!alive) return;
        setAvailable(Boolean(json?.configured));
        setHint(typeof json?.hint === 'string' ? json.hint : '');
      } catch {
        if (alive) {
          setAvailable(false);
          setHint('Could not reach the render service.');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const poll = useCallback(async (jobId: string) => {
    if (cancelled.current) return;
    try {
      const res = await fetch('/api/admin/reel-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();

      if (!json?.success) {
        setError(json?.error || 'Render failed.');
        setBusy(false);
        return;
      }
      if (json.errorMessage) {
        setError(json.errorMessage);
        setBusy(false);
        return;
      }

      if (json.done && json.videoUrl) {
        setVideoUrl(json.videoUrl);
        setProgress(100);
        setStatus('Done');
        setBusy(false);
        rendered.current?.(json.videoUrl);
        return;
      }

      // Show what the worker is actually doing. A render spends real time in
      // stages that report no frame progress — bundling before the first frame,
      // uploading after the last — and a bar frozen at 0% or 100% during those
      // looks broken. Naming the stage is the difference between "it's working"
      // and "it's hung".
      setStatus(describeStage(json.stage, json.progress, json.elapsedSec));
      if (typeof json.progress === 'number') {
        setProgress(Math.round(json.progress * 100));
      }

      // Not finished — check again shortly.
      timer.current = setTimeout(() => void poll(jobId), POLL_MS);
    } catch {
      // A dropped poll is not a failed render; keep watching.
      timer.current = setTimeout(() => void poll(jobId), POLL_MS);
    }
  }, []);

  const start = useCallback(() => {
    const reelId = getReelId();
    if (!reelId || busy) return;
    void (async () => {
      setBusy(true);
      setError('');
      setVideoUrl('');
      setProgress(0);
      setStatus('Building the render plan…');
      try {
        const res = await fetch('/api/admin/reel-render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: reelId, aspect }),
        });
        const json = await res.json();
        if (!json?.success) {
          // Plan validation errors land here (empty timeline, blob: URLs, no env).
          setError(json?.error || 'Could not start the render.');
          setBusy(false);
          return;
        }
        setStatus(`Queued · ${json.clips} clips · ${json.words} words · ~${json.durationSec}s`);
        // Poll straight away rather than after a full interval — the first tick
        // is what replaces "Queued" with a real stage, and 3s of nothing right
        // after a click is exactly when this feels broken.
        void poll(json.jobId);
      } catch {
        setError('Could not reach the render service.');
        setBusy(false);
      }
    })();
  }, [aspect, busy, getReelId, poll]);

  return {
    available,
    hint,
    aspect,
    setAspect,
    busy,
    progress,
    status,
    error,
    videoUrl,
    canStart: available !== false && !busy,
    start,
  };
}
