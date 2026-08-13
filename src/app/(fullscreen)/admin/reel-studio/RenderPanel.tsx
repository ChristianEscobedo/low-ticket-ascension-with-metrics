'use client';

/**
 * Render panel — the full-size render UI under the Post tab.
 *
 * It used to own the job: its own state, its own poll loop, its own availability
 * probe. It doesn't any more. The job moved to `useRenderJob`, called ONCE by
 * the page, because the same render is now startable from the header and the
 * Publish view too — and three components each polling would mean three timers
 * and three different answers to "is it done yet?".
 *
 * So this is a pure view now: it reads `job` and calls `job.start()`. The
 * behaviour it used to enforce still holds, it just lives in the hook:
 *  - the browser NEVER waits on an open request; we start, then poll.
 *  - availability is probed up front, so a missing env var reads as a plain
 *    sentence instead of a mystery failure at click time.
 *
 * This panel keeps the two things the compact `RenderButton` has no room for:
 * the aspect picker and the finished-video player.
 */
import { ASPECTS, type RenderJob } from './useRenderJob';

export default function RenderPanel({ job }: { job: RenderJob }) {
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Render &amp; burn captions</h3>
        {job.available === false ? (
          <span className="text-[11px] text-amber-400">Not configured</span>
        ) : null}
      </div>

      {/* The aspect lives on the shared job, so switching it here is what the
          header button will render too. One dial, not three. */}
      <div className="flex gap-2">
        {ASPECTS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => job.setAspect(a.value)}
            disabled={job.busy}
            title={a.hint}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              job.aspect === a.value
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            } disabled:opacity-50`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Output resolution. 1080p is the canvas size (full res — needs a beefy
          worker); 720p downsamples on the worker and fits a small container.
          Same shared-job dial as the aspect — what you pick here is what the
          header button renders too. */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/50">Quality</span>
        {(['1080', '720'] as const).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => job.setQuality(q)}
            disabled={job.busy}
            title={q === '1080' ? 'Full canvas resolution (needs ~2-4GB on the worker)' : 'Downsampled — renders on a small worker'}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              job.quality === q
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            } disabled:opacity-50`}
          >
            {q}p
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={job.start}
        disabled={!job.canStart}
        className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {job.busy ? job.status || 'Rendering…' : 'Render video'}
      </button>

      {job.busy ? (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(3, job.progress)}%` }}
            />
          </div>
          {/* Repeat the status under the bar. The button label is truncated by
              its own width on narrow panels, and this is the line people watch. */}
          <p className="text-[11px] tabular-nums text-white/60">{job.status || 'Starting…'}</p>
        </div>
      ) : null}

      {/* The real reason it can't run, not a generic error. */}
      {job.available === false && job.hint ? (
        <p className="text-[11px] text-white/50">{job.hint}</p>
      ) : null}
      {job.error ? <p className="text-xs text-red-400">{job.error}</p> : null}

      {job.videoUrl ? (
        <div className="space-y-2">
          <video src={job.videoUrl} controls className="w-full rounded-md bg-black" />
          <a
            href={job.videoUrl}
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
