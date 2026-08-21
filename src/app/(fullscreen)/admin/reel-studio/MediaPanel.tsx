'use client';

/**
 * MediaPanel — the Media tab. Every fly-in + layer asset in ONE place:
 *
 *   Images        — Media Library grid + upload + AI generate
 *   Stickers/GIFs — GIPHY search (animated stickers)
 *   Lottie        — upload a .json or paste a URL (the attach path that
 *                   didn't exist — the data model + render path were ready)
 *   B-roll        — Pexels search + a direct URL, added as overlay layers
 *
 * A click attaches the asset as a cue at the PLAYHEAD's word (the cue model
 * is word-keyed — the page resolves which word) or adds the clip as an
 * overlay at the playhead. The word-click flow in the Captions tab is
 * untouched — this tab is where assets LIVE.
 */
import React, { useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  Image as ImageIcon,
  Layers,
  Loader2,
  Sparkles,
  Sticker,
  Upload,
} from 'lucide-react';
import { aiGenerateImage } from '@/components/mothermode/content/aiClient';
import { makeClipId, type ReelOverlayClip } from '@/lib/mothermode/reel/types';
import type { GiphySticker } from '@/utils/integrations/giphy';
import type { PexelsClip } from '@/utils/integrations/pexels';

const UPLOAD_API = '/api/admin/reel-upload-url';

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round((s - m * 60) * 10) / 10;
  return m > 0 ? `${m}:${String(Math.round(r)).padStart(2, '0')}` : `${r}s`;
}

/** Probe a video's runtime client-side via a detached element. */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (n: number) => {
      v.removeAttribute('src');
      v.load();
      resolve(n);
    };
    v.onloadedmetadata = () =>
      done(Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration * 10) / 10 : 0);
    v.onerror = () => done(0);
    v.src = url;
  });
}

/** A labeled section card. */
function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.03] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-bone/50">
        {icon}
        {title}
        {hint && (
          <span className="ml-auto text-[8px] font-normal normal-case text-bone/30">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function MediaPanel({
  hasWords,
  onAttach,
  onAddOverlay,
  getOffsetSec,
  onNote,
  onError,
}: {
  /** Does the scene under the playhead have transcript words (cues key to words). */
  hasWords: boolean;
  /** Attach an image/sticker/lottie as a fly-in at the playhead's word. */
  onAttach: (url: string, opts?: { animated?: boolean; lottie?: boolean }) => void;
  /** Add a b-roll overlay layer (the panel builds the clip, the page patches). */
  onAddOverlay: (o: ReelOverlayClip) => void;
  /** The playhead's timeline second, read at click time. */
  getOffsetSec: () => number;
  onNote: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  // ---- images -------------------------------------------------------------
  const [images, setImages] = useState<{ url: string; name: string }[] | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  // ---- stickers -----------------------------------------------------------
  const [stickerQuery, setStickerQuery] = useState('');
  const [stickerResults, setStickerResults] = useState<GiphySticker[] | null>(null);
  const [stickerBusy, setStickerBusy] = useState(false);
  // ---- lottie -------------------------------------------------------------
  const [lottieUrl, setLottieUrl] = useState('');
  const lottieInput = useRef<HTMLInputElement>(null);
  // ---- b-roll -------------------------------------------------------------
  const [brollQuery, setBrollQuery] = useState('');
  const [brollResults, setBrollResults] = useState<PexelsClip[] | null>(null);
  const [brollBusy, setBrollBusy] = useState(false);
  const [overlayUrl, setOverlayUrl] = useState('');

  async function loadImages() {
    if (images !== null) return;
    try {
      const res = await fetch('/api/admin/media-library', { cache: 'no-store' });
      const json = await res.json();
      const rows = (json.assets ?? json.records ?? []) as {
        url?: string;
        name?: string;
        kind?: string;
      }[];
      setImages(
        rows
          .filter((a) => a.url && /^https?:\/\//i.test(a.url) && (a.kind === 'image' || !a.kind))
          .map((a) => ({ url: a.url as string, name: a.name ?? '' })),
      );
    } catch {
      setImages([]);
    }
  }

  /** Signed-URL upload → the Media Library → the public URL (or null). */
  async function uploadFile(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    try {
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind: 'image' }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) {
        onError(mintJson.error || 'Could not mint an upload URL');
        return null;
      }
      const put = await fetch(mintJson.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) {
        onError(`Upload rejected (${put.status})`);
        return null;
      }
      const url = String(mintJson.publicUrl || '');
      if (!url) {
        onError('Upload returned no public URL');
        return null;
      }
      // the library keeps it (best-effort — the attach doesn't depend on it)
      try {
        await fetch('/api/admin/media-library', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'ingest',
            name: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Media',
            url,
            kind: 'image',
            source: 'upload',
            tags: ['cue'],
          }),
        });
      } catch {
        /* convenience */
      }
      setImages((prev) =>
        prev ? [{ url, name: file.name }, ...prev.filter((a) => a.url !== url)] : prev,
      );
      return url;
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed');
      return null;
    }
  }

  async function uploadImage(file: File) {
    setUpBusy(true);
    try {
      const url = await uploadFile(file);
      if (url) onAttach(url);
    } finally {
      setUpBusy(false);
    }
  }

  async function generateImage() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;
    setAiBusy(true);
    try {
      const url = await aiGenerateImage(prompt, 'reel');
      try {
        await fetch('/api/admin/media-library', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'ingest',
            name: `${prompt.slice(0, 60)} (AI)`,
            url,
            kind: 'image',
            source: 'generated',
            tags: ['ai-image', 'cue'],
          }),
        });
      } catch {
        /* convenience */
      }
      setImages((prev) => (prev ? [{ url, name: prompt.slice(0, 60) }, ...prev] : prev));
      setAiPrompt('');
      onAttach(url);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'AI image failed');
    } finally {
      setAiBusy(false);
    }
  }

  async function searchStickers() {
    const q = stickerQuery.trim();
    if (!q || stickerBusy) return;
    setStickerBusy(true);
    try {
      const res = await fetch(`/api/admin/reel-stickers?q=${encodeURIComponent(q)}`);
      const j = (await res.json()) as {
        success?: boolean;
        stickers?: GiphySticker[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        onError(j.error || 'Sticker search failed.');
        setStickerResults([]);
        return;
      }
      setStickerResults(j.stickers ?? []);
    } catch {
      setStickerResults([]);
    } finally {
      setStickerBusy(false);
    }
  }

  async function uploadLottie(file: File) {
    setUpBusy(true);
    try {
      const url = await uploadFile(file);
      if (url) onAttach(url, { lottie: true });
    } finally {
      setUpBusy(false);
    }
  }

  function attachLottieUrl() {
    const url = lottieUrl.trim();
    if (!/^https?:\/\//i.test(url)) return;
    onAttach(url, { lottie: true });
    setLottieUrl('');
  }

  async function searchBroll() {
    const q = brollQuery.trim();
    if (!q || brollBusy) return;
    setBrollBusy(true);
    try {
      const res = await fetch(`/api/admin/reel-broll?q=${encodeURIComponent(q)}`);
      const j = (await res.json()) as { success?: boolean; clips?: PexelsClip[]; error?: string };
      if (!res.ok || !j.success) {
        onError(j.error || 'B-roll search failed.');
        setBrollResults([]);
        return;
      }
      setBrollResults(j.clips ?? []);
    } catch {
      setBrollResults([]);
    } finally {
      setBrollBusy(false);
    }
  }

  function addBroll(c: PexelsClip) {
    onAddOverlay({
      id: makeClipId(),
      name: (brollQuery.trim() || 'B-roll').slice(0, 60),
      url: c.videoUrl,
      durationSec: c.durationSec || 5,
      trimEndSec: 0,
      offsetSec: Math.round(getOffsetSec() * 10) / 10,
    });
    onNote(`B-roll added at ${fmtSec(getOffsetSec())} — drag it on the overlay lane.`);
  }

  async function addOverlayByUrl() {
    const url = overlayUrl.trim();
    if (!/^https?:\/\//i.test(url)) return;
    const dur = await probeDuration(url);
    if (!dur) {
      onError('Could not read that video URL — it must be a direct, public MP4/WebM link.');
      return;
    }
    onAddOverlay({
      id: makeClipId(),
      name: url.split('/').pop()?.split('?')[0]?.slice(0, 60) || 'Overlay',
      url,
      durationSec: dur,
      trimEndSec: 0,
      offsetSec: Math.round(getOffsetSec() * 10) / 10,
    });
    setOverlayUrl('');
    onNote('Overlay layer added at the playhead — drag it on the overlay lane.');
  }

  return (
    <div className="space-y-2">
      <p className="rounded-xl border border-bone/10 bg-bone/[0.03] px-2.5 py-2 text-[10px] leading-relaxed text-bone/45">
        Click an asset to fly it in <strong className="text-bone/70">at the playhead's word</strong>
        {!hasWords && (
          <span className="text-amber-300/80">
            {' '}
            — this scene has no transcript yet, hit CC on the toolbar first
          </span>
        )}
        . B-roll layers land at the playhead on the overlay lane.
      </p>

      {/* IMAGES */}
      <Section
        icon={<ImageIcon className="h-3 w-3 text-fuchsia-300/80" />}
        title="Images"
        hint="click = fly in at the playhead"
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => imageInput.current?.click()}
            disabled={upBusy || aiBusy}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-fuchsia-400/40 px-1.5 py-1 text-[9px] font-semibold text-fuchsia-200/90 hover:bg-fuchsia-500/15 disabled:opacity-40"
          >
            {upBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            upload
          </button>
          <input
            ref={imageInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
              e.target.value = '';
            }}
          />
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void generateImage();
            }}
            placeholder="or describe it — AI generates + attaches"
            className="min-w-0 flex-1 rounded border border-fuchsia-400/25 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
          />
          <button
            onClick={() => void generateImage()}
            disabled={aiBusy || upBusy || !aiPrompt.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-fuchsia-500 px-1.5 py-1 text-[9px] font-semibold text-white hover:bg-fuchsia-500/90 disabled:opacity-40"
          >
            {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            generate
          </button>
        </div>
        {images === null ? (
          <button
            onClick={() => void loadImages()}
            className="text-[10px] text-bone/40 hover:underline"
          >
            Load the Media Library…
          </button>
        ) : images.length === 0 ? (
          <p className="px-1 py-2 text-[10px] text-bone/35">
            No images in the Media Library yet — upload or generate one above.
          </p>
        ) : (
          <div className="grid max-h-40 grid-cols-4 gap-1 overflow-y-auto">
            {images.slice(0, 32).map((a) => (
              <button
                key={a.url}
                onClick={() => onAttach(a.url)}
                title={`${a.name || a.url} — fly in at the playhead`}
                className="overflow-hidden rounded border border-fuchsia-400/20 hover:border-fuchsia-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-12 w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* STICKERS & GIFs */}
      <Section
        icon={<Sticker className="h-3 w-3 text-fuchsia-300/80" />}
        title="Stickers & GIFs"
        hint="GIPHY — animated"
      >
        <div className="flex items-center gap-1">
          <input
            value={stickerQuery}
            onChange={(e) => setStickerQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void searchStickers();
            }}
            placeholder="search stickers (fire, arrow, 100…)"
            className="min-w-0 flex-1 rounded border border-fuchsia-400/25 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
          />
          <button
            onClick={() => void searchStickers()}
            disabled={stickerBusy || !stickerQuery.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-fuchsia-400/40 px-1.5 py-1 text-[9px] font-semibold text-fuchsia-200/90 hover:bg-fuchsia-500/15 disabled:opacity-40"
          >
            {stickerBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            search
          </button>
        </div>
        {stickerResults && stickerResults.length > 0 && (
          <div className="grid max-h-36 grid-cols-4 gap-1 overflow-y-auto">
            {stickerResults.slice(0, 24).map((s) => (
              <button
                key={s.id}
                onClick={() => onAttach(s.gifUrl, { animated: true })}
                title={`${s.title} — animated sticker at the playhead`}
                className="overflow-hidden rounded border border-fuchsia-400/20 bg-[repeating-conic-gradient(#1c1c1c_0%_25%,#262626_0%_50%)] bg-[length:12px_12px] hover:border-fuchsia-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.webpUrl} alt={s.title} className="h-12 w-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* LOTTIE */}
      <Section
        icon={<Sparkles className="h-3 w-3 text-fuchsia-300/80" />}
        title="Lottie"
        hint="vector animations"
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => lottieInput.current?.click()}
            disabled={upBusy}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-fuchsia-400/40 px-1.5 py-1 text-[9px] font-semibold text-fuchsia-200/90 hover:bg-fuchsia-500/15 disabled:opacity-40"
            title="Upload a .json lottie file — it flies in at the playhead"
          >
            {upBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            .json
          </button>
          <input
            ref={lottieInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadLottie(f);
              e.target.value = '';
            }}
          />
          <input
            value={lottieUrl}
            onChange={(e) => setLottieUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') attachLottieUrl();
            }}
            placeholder="or paste a lottie .json URL (lottiefiles…)"
            className="min-w-0 flex-1 rounded border border-fuchsia-400/25 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
          />
          <button
            onClick={attachLottieUrl}
            disabled={!lottieUrl.trim()}
            className="shrink-0 rounded bg-fuchsia-500 px-1.5 py-1 text-[9px] font-semibold text-white hover:bg-fuchsia-500/90 disabled:opacity-40"
          >
            attach
          </button>
        </div>
        <p className="text-[8px] leading-3 text-bone/30">
          A lottie plays its vector animation in the preview and burns into the MP4.
        </p>
      </Section>

      {/* B-ROLL (overlay layers) */}
      <Section
        icon={<Layers className="h-3 w-3 text-violet-300/80" />}
        title="B-roll"
        hint="overlay at the playhead"
      >
        <div className="flex items-center gap-1">
          <input
            value={brollQuery}
            onChange={(e) => setBrollQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void searchBroll();
            }}
            placeholder="search Pexels b-roll (city, money, gym…)"
            className="min-w-0 flex-1 rounded border border-violet-500/25 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
          />
          <button
            onClick={() => void searchBroll()}
            disabled={brollBusy || !brollQuery.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-500/40 px-1.5 py-1 text-[9px] font-semibold text-violet-200 hover:bg-violet-500/15 disabled:opacity-40"
          >
            {brollBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            search
          </button>
        </div>
        {brollResults && brollResults.length > 0 && (
          <div className="grid max-h-32 grid-cols-3 gap-1 overflow-y-auto">
            {brollResults.slice(0, 12).map((c) => (
              <button
                key={c.id}
                onClick={() => addBroll(c)}
                title={`${fmtSec(c.durationSec)} — add as an overlay at the playhead`}
                className="group relative overflow-hidden rounded border border-violet-400/20 hover:border-violet-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbUrl} alt="" className="h-14 w-full object-cover" loading="lazy" />
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[8px] font-semibold text-white/90">
                  {fmtSec(c.durationSec)}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          <input
            value={overlayUrl}
            onChange={(e) => setOverlayUrl(e.target.value)}
            placeholder="or a direct b-roll MP4/WebM URL"
            className="min-w-0 flex-1 rounded border border-violet-500/25 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
          />
          <button
            onClick={() => void addOverlayByUrl()}
            disabled={!overlayUrl.trim()}
            className="shrink-0 rounded bg-violet-500 px-1.5 py-1 text-[9px] font-semibold text-white hover:bg-violet-500/90 disabled:opacity-40"
          >
            + layer
          </button>
        </div>
      </Section>
    </div>
  );
}
