'use client';

/**
 * Render panel ??? the only UI that produces a final MP4.
 *
 * Contract with the server (see src/app/api/admin/reel-render/route.ts):
 *   1. POST { id, aspect }            ??? { renderId, bucketName }
 *   2. POST { renderId, bucketName }  ??? { done, progress, videoUrl, errorMessage }
 *
 * Two rules this component exists to enforce:
 *  - The browser NEVER waits on an open request for a render. We start, then
 *    poll every 3s. That's why long reels no longer die on a function timeout.
 *  - Availability is probed up front, so a missing env var shows as a plain
 *    sentence in the panel instead of a mystery failure at click time.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type Aspect = 'vertical' | 'square' | 'landscape';

const ASPECTS: { value: Aspect; label: string; hint: string }[] = [
  { value: 'vertical', label: '9:16', hint: 'Reels ?? TikTok ?? Shorts' },
  { value: 'square', label: '1:1', hint: 'Feed' },
  { value: 'landscape', label: '16:9', hint: 'YouTube' },
];

const POLL_MS = 3000;

export default function RenderPanel({
  reelId,
  onRendered,
}: {
  reelId: string;
  /** Called once with the finished URL so the parent can persist it. */
  onRendered?: (videoUrl: string) => void;
}) {
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

  const poll = useCallback(
    async (renderId: string, bucketName: string) => {
      if (cancelled.current) return;
      try {
        const res = await fetch('/api/admin/reel-render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ renderId, bucketName }),
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

        const pct = Math.round(Number(json.progress ?? 0) * 100);
        setProgress(pct);
        setStatus(`Rendering??? ${pct}%`);

        if (json.done && json.videoUrl) {
          setVideoUrl(json.videoUrl);
          setProgress(100);
          setStatus('Done');
          setBusy(false);
          onRendered?.(json.videoUrl);
          return;
        }
        // Not finished ??? check again shortly.
        timer.current = setTimeout(() => void poll(renderId, bucketName), POLL_MS);
      } catch {
        // A dropped poll is not a failed render; keep watching.
        timer.current = setTimeout(() => void poll(renderId, bucketName), POLL_MS);
      }
    },
    [onRendered],
  );

  const start = useCallback(async () => {
    setBusy(true);
    setError('');
    setVideoUrl('');
    setProgress(0);
    setStatus('Building the render plan???');
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
      setStatus(`Queued ?? ${json.clips} clips ?? ${json.words} words ?? ~${json.durationSec}s`);
      timer.current = setTimeout(() => void poll(json.renderId, json.bucketName), POLL_MS);
    } catch {
      setError('Could not reach the render service.');
      setBusy(false);
    }
  }, [aspect, poll, reelId]);

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Render &amp; burn captions</h3>
        {available === false ? (
          <span className="text-[11px] text-amber-400">Not configured</span>
        ) : null}
      </div>

      <div className="flex gap-2">
        {ASPECTS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAspect(a.value)}
            disabled={busy}
            title={a.hint}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              aspect === a.value
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            } disabled:opacity-50`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || available === false}
        className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? status || 'Rendering???' : 'Render video'}
      </button>

      {busy ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${Math.max(3, progress)}%` }}
          />
        </div>
      ) : null}

      {/* The real reason it can't run, not a generic error. */}
      {available === false && hint ? <p className="text-[11px] text-white/50">{hint}</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {videoUrl ? (
        <div className="space-y-2">
          <video src={videoUrl} controls className="w-full rounded-md bg-black" />
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-emerald-400 underline"
          >
            Download MP4
          </a>
        </div>
      ) : null}
    </div>
  );
}
