'use client';

import { useEffect, useRef, useState } from 'react';
import VideoCTAOverlay from '@/app/courses/[id]/VideoCTAOverlay';
import type { VideoCTA } from './types';

interface Props {
  videoUrl: string;
  ctas: VideoCTA[];
}

/**
 * Author-time preview of the time-triggered CTA overlays. Mirrors the
 * student-facing player surface (relative aspect-video container with the
 * overlay stacked above) so timing/positioning previews exactly match what
 * a viewer will see. Driven by the native video timeupdate event.
 */
export default function LessonCtasPreview({ videoUrl, ctas }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, [videoUrl]);

  const seek = (s: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, s);
    setCurrentTime(el.currentTime);
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-amber-200/15 bg-black/40 p-3">
      <div className="relative rounded-lg overflow-hidden aspect-video bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          className="w-full h-full"
        />
        <VideoCTAOverlay
          key={ctas.map((c) => c.id).join('|')}
          ctas={ctas}
          lessonId="__preview__"
          currentTime={currentTime}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-white/50">
        <span>Preview @ {currentTime.toFixed(1)}s</span>
        {ctas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ctas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => seek(c.showAfterSeconds + 0.2)}
                className="px-2 py-0.5 rounded-md border border-amber-300/30 text-amber-200 hover:bg-amber-300/[0.08]"
              >
                Jump to {c.showAfterSeconds}s
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
