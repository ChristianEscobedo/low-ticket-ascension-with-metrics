/**
 * Twitter screen-grab cards: the screenshot-of-a-tweet unit posted to IG, FB,
 * and TikTok. Helpers resolve the card chrome (name, handle, badge, theme) and
 * render a shareable square PNG with the full tweet chrome — avatar, display
 * name, verified badge, text, timestamp, engagement row — on a clean backdrop.
 */
import {
  DEFAULT_TWEET_HANDLE,
  DEFAULT_TWEET_NAME,
  TWEET_MAX_CHARS,
} from './constants';
import type { ContentPiece, TweetCardStyle } from './types';

/** The card chrome with every default filled. */
export interface ResolvedTweetCard {
  name: string;
  handle: string;
  verified: boolean;
  theme: 'light' | 'dark';
  showMetrics: boolean;
  showTimestamp: boolean;
}

/** The active chrome for a piece: explicit `tweetCard` wins, brand otherwise. */
export function tweetCardFor(piece: ContentPiece): ResolvedTweetCard {
  const t = piece.tweetCard ?? {};
  return {
    name: t.name?.trim() || DEFAULT_TWEET_NAME,
    handle: t.handle?.trim() || DEFAULT_TWEET_HANDLE,
    verified: t.verified ?? true,
    theme: t.theme ?? 'light',
    showMetrics: t.showMetrics ?? true,
    showTimestamp: t.showTimestamp ?? true,
  };
}

/** True when the text fits the tweet ceiling. */
export function fitsTweet(text: string): boolean {
  return text.trim().length <= TWEET_MAX_CHARS;
}

export interface TweetThemeColors {
  /** Page backdrop behind the card. */
  backdrop: string;
  /** The card surface. */
  card: string;
  /** Primary text. */
  ink: string;
  /** Secondary text (handle, timestamp, metrics). */
  sub: string;
  /** Hairline around the card. */
  border: string;
  /** Avatar circle fill. */
  avatarBg: string;
  /** Avatar initial letter. */
  avatarText: string;
  /** Verified badge fill. */
  badge: string;
}

/** Palette for a card theme, on-brand either way. */
export function tweetThemeColors(theme: 'light' | 'dark'): TweetThemeColors {
  return theme === 'dark'
    ? {
        backdrop: '#1C1917',
        card: '#26221F',
        ink: '#F4F0E8',
        sub: '#A79E94',
        border: '#3A342F',
        avatarBg: '#532B3C',
        avatarText: '#F4F0E8',
        badge: '#B08D57',
      }
    : {
        backdrop: '#F4F0E8',
        card: '#FFFDF9',
        ink: '#1C1917',
        sub: '#6E655B',
        border: '#E4DCCF',
        avatarBg: '#532B3C',
        avatarText: '#F4F0E8',
        badge: '#B08D57',
      };
}

/** Small rounded-rect path (ctx.roundRect is not universal). */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Render a tweet screen-grab to a square PNG data URL. Browser-only: uses an
 * offscreen canvas.
 */
export async function renderTweetCardToDataUrl(args: {
  text: string;
  style?: TweetCardStyle;
  size?: number;
}): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Tweet card render requires a browser');
  }
  const size = args.size ?? 1080;
  const chrome: ResolvedTweetCard = {
    name: args.style?.name?.trim() || DEFAULT_TWEET_NAME,
    handle: args.style?.handle?.trim() || DEFAULT_TWEET_HANDLE,
    verified: args.style?.verified ?? true,
    theme: args.style?.theme ?? 'light',
    showMetrics: args.style?.showMetrics ?? true,
    showTimestamp: args.style?.showTimestamp ?? true,
  };
  const colors = tweetThemeColors(chrome.theme);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  if (typeof document.fonts?.ready?.then === 'function') {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const FONT =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // Backdrop.
  ctx.fillStyle = colors.backdrop;
  ctx.fillRect(0, 0, size, size);

  // Card.
  const cardPad = Math.round(size * 0.07);
  const cardX = cardPad;
  const cardW = size - cardPad * 2;
  const cardY = Math.round(size * 0.16);
  const cardH = size - cardY - Math.round(size * 0.16);
  roundedRect(ctx, cardX, cardY, cardW, cardH, Math.round(size * 0.03));
  ctx.fillStyle = colors.card;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  const pad = Math.round(cardW * 0.07);
  let y = cardY + pad + Math.round(size * 0.012);

  // Avatar: filled circle with the initial letter.
  const avatarR = Math.round(size * 0.038);
  const avatarX = cardX + pad + avatarR;
  const avatarY = y + avatarR - Math.round(size * 0.012);
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = colors.avatarBg;
  ctx.fill();
  ctx.font = `700 ${Math.round(avatarR * 1.05)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.avatarText;
  ctx.fillText(chrome.name.trim().charAt(0).toUpperCase() || 'M', avatarX, avatarY + 1);

  // Name + verified badge, handle below.
  const nameX = avatarX + avatarR + Math.round(size * 0.02);
  ctx.textAlign = 'left';
  ctx.font = `700 ${Math.round(size * 0.03)}px ${FONT}`;
  ctx.fillStyle = colors.ink;
  ctx.textBaseline = 'alphabetic';
  const nameY = y + Math.round(size * 0.006);
  ctx.fillText(chrome.name, nameX, nameY);
  if (chrome.verified) {
    const badgeR = Math.round(size * 0.016);
    const badgeX = nameX + ctx.measureText(chrome.name).width + badgeR + Math.round(size * 0.008);
    const badgeY = nameY - badgeR + Math.round(size * 0.004);
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = colors.badge;
    ctx.fill();
    // Simple check mark.
    ctx.beginPath();
    ctx.moveTo(badgeX - badgeR * 0.45, badgeY + badgeR * 0.02);
    ctx.lineTo(badgeX - badgeR * 0.1, badgeY + badgeR * 0.4);
    ctx.lineTo(badgeX + badgeR * 0.5, badgeY - badgeR * 0.35);
    ctx.strokeStyle = '#FFFDF9';
    ctx.lineWidth = Math.max(2, Math.round(badgeR * 0.28));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.font = `500 ${Math.round(size * 0.026)}px ${FONT}`;
  ctx.fillStyle = colors.sub;
  ctx.fillText(chrome.handle, nameX, nameY + Math.round(size * 0.036));

  // Tweet text, wrapped left-aligned.
  y = avatarY + avatarR + Math.round(size * 0.045);
  const fontPx = Math.round(size * 0.036);
  ctx.font = `500 ${fontPx}px ${FONT}`;
  ctx.fillStyle = colors.ink;
  const maxW = cardW - pad * 2;
  const words = args.text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const lineH = Math.round(fontPx * 1.45);
  for (const line of lines) {
    ctx.fillText(line, cardX + pad, y);
    y += lineH;
  }

  // Timestamp.
  if (chrome.showTimestamp) {
    y += Math.round(size * 0.02);
    ctx.font = `500 ${Math.round(size * 0.024)}px ${FONT}`;
    ctx.fillStyle = colors.sub;
    const now = new Date();
    const stamp = `${now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })} · ${now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
    ctx.fillText(stamp, cardX + pad, y);
    y += Math.round(size * 0.03);
  }

  // Engagement row.
  if (chrome.showMetrics) {
    y += Math.round(size * 0.012);
    ctx.font = `600 ${Math.round(size * 0.024)}px ${FONT}`;
    ctx.fillStyle = colors.sub;
    ctx.fillText('84 replies    213 reposts    1.9K likes', cardX + pad, y);
  }

  return canvas.toDataURL('image/png');
}
