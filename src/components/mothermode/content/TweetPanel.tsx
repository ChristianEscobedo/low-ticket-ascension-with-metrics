'use client';

/**
 * Composer for a Twitter screen-grab card: edit the card identity (name,
 * handle, badge), flip light/dark, watch the tweet chrome update live, then
 * render a shareable square PNG to the review gallery for posting to IG / FB /
 * TikTok.
 */
import React, { useState } from 'react';
import { BadgeCheck, Check, Download, MessageSquare } from 'lucide-react';
import {
  TWEET_MAX_CHARS,
  fitsTweet,
  renderTweetCardToDataUrl,
  tweetCardFor,
  tweetThemeColors,
  type ContentPiece,
  type TweetCardStyle,
} from '@/lib/mothermode/content';
import { setReviewImages } from './reviewClient';
import { aiHostImage } from './aiClient';
import { Spinner } from './AiControls';
import type { PieceReview } from '@/lib/mothermode/content/review';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';

export const TweetPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  /** Active hook text shown on the card (catalog + edits resolved). */
  hook: string;
  onReviewChange: (next: PieceReview) => void;
}> = ({ piece, review, offerSlug, hook, onReviewChange }) => {
  const [style, setStyle] = useState<TweetCardStyle>(() => ({ ...piece.tweetCard }));
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const chrome = tweetCardFor({ ...piece, tweetCard: style });
  const colors = tweetThemeColors(chrome.theme);
  const overLimit = !fitsTweet(hook);

  const render = async () => {
    setError(null);
    setDone(false);
    setRendering(true);
    try {
      const dataUrl = await renderTweetCardToDataUrl({ text: hook, style });
      let finalUrl = dataUrl;
      try {
        finalUrl = await aiHostImage(dataUrl);
      } catch {
        /* keep data URL */
      }
      const merged = setReviewImages(offerSlug, piece.id, [finalUrl], 0);
      onReviewChange(merged);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not render the card');
    } finally {
      setRendering(false);
    }
  };

  const set = (patch: Partial<TweetCardStyle>) =>
    setStyle((prev) => ({ ...prev, ...patch }));

  return (
    <div className="space-y-3">
      <span className={labelCls}>
        <MessageSquare className="mr-1 inline h-3.5 w-3.5" /> Tweet screen grab
      </span>

      {/* Live card preview (matches the canvas render). */}
      <div
        className="w-full max-w-[340px] rounded-lg p-4"
        style={{ background: colors.backdrop }}
      >
        <div
          className="rounded-xl border p-4"
          style={{ background: colors.card, borderColor: colors.border }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: colors.avatarBg, color: colors.avatarText }}
            >
              {chrome.name.trim().charAt(0).toUpperCase() || 'M'}
            </span>
            <div className="min-w-0 leading-tight">
              <p
                className="flex items-center gap-1 truncate text-[13px] font-bold"
                style={{ color: colors.ink }}
              >
                {chrome.name}
                {chrome.verified && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: colors.badge }} />
                )}
              </p>
              <p className="truncate text-[12px]" style={{ color: colors.sub }}>
                {chrome.handle}
              </p>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-snug" style={{ color: colors.ink }}>
            {hook}
          </p>
          {chrome.showTimestamp && (
            <p className="mt-2.5 text-[11px]" style={{ color: colors.sub }}>
              10:24 PM · Jul 28, 2026
            </p>
          )}
          {chrome.showMetrics && (
            <p className="mt-2 text-[11px] font-semibold" style={{ color: colors.sub }}>
              84 replies&nbsp;&nbsp;&nbsp;213 reposts&nbsp;&nbsp;&nbsp;1.9K likes
            </p>
          )}
        </div>
      </div>

      {overLimit && (
        <p className="text-xs text-amber-700">
          Over {TWEET_MAX_CHARS} characters: real tweets cap at 280. Tighten to one
          screenshot-worthy thought.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input
            value={chrome.name}
            onChange={(e) => set({ name: e.target.value })}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1 text-xs"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Handle</span>
          <input
            value={chrome.handle}
            onChange={(e) => set({ handle: e.target.value })}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1 text-xs"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink/60">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={chrome.verified}
            onChange={(e) => set({ verified: e.target.checked })}
            className="accent-mode"
          />
          Verified
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={chrome.showTimestamp}
            onChange={(e) => set({ showTimestamp: e.target.checked })}
            className="accent-mode"
          />
          Timestamp
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={chrome.showMetrics}
            onChange={(e) => set({ showMetrics: e.target.checked })}
            className="accent-mode"
          />
          Metrics
        </label>
        <label className="flex items-center gap-1.5">
          <span className={labelCls}>Theme</span>
          <select
            value={chrome.theme}
            onChange={(e) => set({ theme: e.target.value as 'light' | 'dark' })}
            className="rounded-md border border-ink/15 bg-white px-2 py-1 text-xs"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={render}
        disabled={rendering}
        className="inline-flex items-center gap-1.5 rounded-full bg-mode px-3.5 py-2 text-xs font-semibold text-bone hover:bg-mode-deep disabled:opacity-60"
      >
        {rendering ? <Spinner /> : done ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        {rendering ? 'Rendering…' : done ? 'Added to gallery' : 'Render as image (1080×1080)'}
      </button>
      <p className="text-[11px] leading-snug text-ink/45">
        The card renders natively with the full tweet chrome. Post the PNG to IG,
        FB, or TikTok; the surrounding caption carries the CTA.
      </p>
    </div>
  );
};
