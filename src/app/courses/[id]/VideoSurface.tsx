'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';

export interface VideoSurfaceHandle {
  seek: (seconds: number) => void;
}

interface Props {
  src: string;
  poster?: string;
  startSeconds?: number;
  onTimeUpdate?: (seconds: number) => void;
  onEnded?: () => void;
  // Imperative handle for external seek (e.g. transcript click-to-seek).
  // Only works for direct <video> playback; iframe embeds expose no API.
  handleRef?: React.Ref<VideoSurfaceHandle>;
}

// Detect embed vs direct mp4. Tella / YouTube / Vimeo / Loom render as
// iframes (no time-update callbacks); native <video> handles direct URLs
// and surfaces seek-resume + progress saves.
function resolveEmbed(url: string): { embedUrl?: string; direct: boolean } {
  if (!url) return { direct: true };
  if (url.includes('tella.tv')) {
    return {
      embedUrl: url.includes('/embed') ? url : `${url}/embed`,
      direct: false
    };
  }
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (yt) {
    return { embedUrl: `https://www.youtube.com/embed/${yt[1]}`, direct: false };
  }
  const vimeo = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeo) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`,
      direct: false
    };
  }
  const loom = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loom) {
    return { embedUrl: `https://www.loom.com/embed/${loom[1]}`, direct: false };
  }
  return { direct: true };
}

export default function VideoSurface({
  src,
  poster,
  startSeconds,
  onTimeUpdate,
  onEnded,
  handleRef
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const info = resolveEmbed(src);

  useImperativeHandle(
    handleRef,
    () => ({
      seek: (seconds: number) => {
        const el = videoRef.current;
        if (!el) return;
        try {
          el.currentTime = Math.max(0, seconds);
          el.play().catch(() => null);
        } catch {
          /* ignore */
        }
      }
    }),
    []
  );

  // Seek to resume position once metadata loads. Avoids restarting from 0
  // when the user already watched some of this lesson.
  useEffect(() => {
    if (!info.direct || !videoRef.current || !startSeconds || startSeconds < 5) {
      return;
    }
    const el = videoRef.current;
    const handler = () => {
      if (Math.abs(el.currentTime - startSeconds) > 1) {
        el.currentTime = startSeconds;
      }
    };
    el.addEventListener('loadedmetadata', handler, { once: true });
    return () => el.removeEventListener('loadedmetadata', handler);
  }, [src, startSeconds, info.direct]);

  if (!info.direct && info.embedUrl) {
    return (
      <iframe
        src={info.embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{ border: 'none' }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className="w-full h-full"
      controls
      controlsList="nodownload"
      onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
      onEnded={onEnded}
      style={{ backgroundColor: 'black' }}
    />
  );
}
