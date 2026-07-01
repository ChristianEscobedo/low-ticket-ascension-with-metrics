import React from 'react';
import type { ContentPlatform } from '@/lib/mothermode/content';

/** Brand color per channel, for tinting logos and accents in the hub. */
export const PLATFORM_BRAND: Record<ContentPlatform, string> = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  x: '#1A1816',
  tiktok: '#1A1816',
  email: '#A88B5C',
  pinterest: '#E60023',
  blog: '#532B3C',
  aeo: '#8A6D3B',
};

interface PlatformIconProps {
  platform: ContentPlatform;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable brand glyph per channel. Paths use currentColor so the icon tints
 * with its parent text color, with an optional brand color passed via style.
 */
export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  className = 'h-4 w-4',
  style,
}) => {
  const common = {
    className,
    style,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true,
  } as const;

  switch (platform) {
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.08 24 18.09 24 12.07Z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common}>
          <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.12 1.38C1.36 2.67.95 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.8.72 1.47 1.38 2.13.66.66 1.33 1.07 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.31 1.47-.72 2.13-1.38.66-.66 1.07-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.12A5.86 5.86 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common}>
          <path d="M16.6 0h-3.36v15.86a2.85 2.85 0 0 1-2.86 2.78 2.85 2.85 0 0 1-2.85-2.86 2.85 2.85 0 0 1 3.7-2.72v-3.4a6.23 6.23 0 0 0-.85-.06A6.25 6.25 0 0 0 4.13 16a6.25 6.25 0 0 0 6.25 6.25A6.25 6.25 0 0 0 16.63 16V7.7a7.7 7.7 0 0 0 4.5 1.44V5.78a4.52 4.52 0 0 1-4.53-4.5V0Z" />
        </svg>
      );
    case 'email':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
          <path d="m3 6 9 6.5L21 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'pinterest':
      return (
        <svg {...common}>
          <path d="M12 0a12 12 0 0 0-4.37 23.18c-.1-.94-.2-2.4.04-3.43.22-.93 1.4-5.94 1.4-5.94s-.36-.72-.36-1.78c0-1.66.97-2.9 2.17-2.9 1.02 0 1.51.77 1.51 1.69 0 1.03-.65 2.56-1 3.99-.28 1.19.6 2.16 1.77 2.16 2.12 0 3.76-2.24 3.76-5.48 0-2.86-2.06-4.86-5-4.86-3.4 0-5.4 2.55-5.4 5.19 0 1.03.4 2.13.89 2.73.1.12.11.22.08.34l-.33 1.35c-.05.22-.17.27-.4.16-1.48-.69-2.4-2.85-2.4-4.58 0-3.73 2.71-7.15 7.81-7.15 4.1 0 7.29 2.92 7.29 6.83 0 4.07-2.57 7.35-6.13 7.35-1.2 0-2.32-.62-2.71-1.36l-.74 2.81c-.27 1.03-1 2.32-1.48 3.11A12 12 0 1 0 12 0Z" />
        </svg>
      );
    case 'blog':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="18" height="18" rx="2.5" />
          <path
            d="M7 8h10M7 12h10M7 16h6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'aeo':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path
            d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.4-5.2A8.5 8.5 0 1 1 21 11.5Z"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.8 2.4-2.8 2.4M12 16.3h.01"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
};
