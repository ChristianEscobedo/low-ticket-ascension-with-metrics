'use client';

/**
 * The compact render control, for surfaces that are not the Post panel.
 *
 * Mounted beside `Caption MP4` in the studio header and under the mock in the
 * Publish view. It renders NO state of its own — it is a view onto the single
 * `RenderJob` the page owns (see useRenderJob.ts). Start it in the header, walk
 * over to Publish view, and the same progress is already there.
 *
 * The full-size panel under Post (`RenderPanel`) keeps the aspect picker and the
 * finished-video player; this one is deliberately just "go, and tell me where it
 * is", because both of its homes are tight on horizontal room.
 */
import { Clapperboard, Loader2 } from 'lucide-react';

import type { RenderJob } from './useRenderJob';

export default function RenderButton({
  job,
  label = 'Render MP4',
  className,
}: {
  job: RenderJob;
  label?: string;
  className?: string;
}) {
  // Say WHY it's disabled on hover rather than presenting a dead button. The
  // usual cause is a missing env var, and `hint` is the server's own words.
  const title = job.busy
    ? job.status || 'Rendering…'
    : job.available === false
      ? job.hint || 'The render service is not configured.'
      : `Render the final MP4 at ${job.aspect === 'vertical' ? '9:16' : job.aspect === 'square' ? '1:1' : '16:9'} with captions and animations burned in`;

  return (
    <div className={className ?? 'flex shrink-0 items-center gap-2'}>
      <button
        onClick={job.start}
        disabled={!job.canStart}
        title={title}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/[0.07] px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/15 disabled:opacity-40"
      >
        {job.busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Clapperboard className="h-3.5 w-3.5" />
        )}
        {job.busy ? 'Rendering…' : label}
      </button>

      {/* Progress rides alongside the button so the header doesn't reflow. The
          stage sentence matters more than the number — see describeStage. */}
      {job.busy ? (
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-bone/15">
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(3, job.progress)}%` }}
            />
          </div>
          <span className="truncate text-[10px] tabular-nums text-bone/50">
            {job.status || 'Starting…'}
          </span>
        </div>
      ) : null}

      {!job.busy && job.videoUrl ? (
        <a
          href={job.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[10px] font-semibold text-emerald-300 underline"
        >
          Open MP4
        </a>
      ) : null}

      {job.error ? (
        <span className="truncate text-[10px] text-red-300" title={job.error}>
          {job.error}
        </span>
      ) : null}
    </div>
  );
}
