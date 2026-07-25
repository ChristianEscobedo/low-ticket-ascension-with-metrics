'use client';

import React from 'react';

/** Turn a YouTube watch/share URL into an embed URL, or return null. */
function toYoutubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace(/^\//, '');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      const parts = u.pathname.split('/');
      const embedIdx = parts.indexOf('embed');
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIdx + 1]}`;
      }
    }
  } catch {
    /* not a URL */
  }
  return null;
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

/**
 * Renders an image and/or video for optin/OTO pages.
 * Video takes priority when both are set. Supports YouTube embeds and MP4.
 */
export function MediaBlock({
  imageUrl,
  videoUrl,
  alt = '',
  className = '',
}: {
  imageUrl?: string;
  videoUrl?: string;
  alt?: string;
  className?: string;
}) {
  const video = (videoUrl || '').trim();
  const image = (imageUrl || '').trim();
  if (!video && !image) return null;

  if (video) {
    const yt = toYoutubeEmbed(video);
    if (yt) {
      return (
        <div className={`overflow-hidden rounded-xl border border-ink/10 bg-ink/5 ${className}`}>
          <div className="relative aspect-video w-full">
            <iframe
              src={yt}
              title={alt || 'Video'}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
    }
    if (isVideoFile(video) || video.startsWith('http')) {
      return (
        <div className={`overflow-hidden rounded-xl border border-ink/10 bg-ink/5 ${className}`}>
          <video
            src={video}
            controls
            playsInline
            className="w-full"
            poster={image || undefined}
          >
            <track kind="captions" />
          </video>
        </div>
      );
    }
  }

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={alt}
        className={`w-full rounded-xl border border-ink/10 object-cover ${className}`}
      />
    );
  }

  return null;
}
