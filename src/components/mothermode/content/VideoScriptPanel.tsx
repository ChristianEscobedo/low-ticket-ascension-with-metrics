'use client';

/**
 * Production panel for reel/video pieces: AI second-by-second shooting script
 * (exact voiceover, shot direction, b-roll prompts), per-beat b-roll still
 * generation, and final-cut video upload. Persists to the piece's review state.
 */
import React, { useRef, useState } from 'react';
import {
  Clapperboard,
  Copy,
  Check,
  Film,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
  Sparkles,
} from 'lucide-react';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  TONE_LABEL,
  AUTO_MODEL,
  type ContentPiece,
} from '@/lib/mothermode/content';

import type {
  PieceReview,
  VideoScript,
  VideoScriptBeat,
} from '@/lib/mothermode/content/review';
import {
  setReviewVideo,
  clearReviewVideo,
  setReviewVideoScript,
  clearReviewVideoScript,
} from './reviewClient';
import {
  aiGenerateVideoScript,
  aiGenerateImage,
} from './aiClient';
import {
  useAiAction,
  aiBtnSolid,
  aiBtnGhost,
  Spinner,
  AiError,
  InstructionsInput,
} from './AiControls';

const DURATIONS = [15, 30, 45, 60, 90] as const;

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec * 10) / 10);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(s % 60 === Math.floor(s % 60) ? 0 : 1);
  return m > 0 ? `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${r}s`;
}

function scriptToText(script: VideoScript): string {
  const lines: string[] = [
    `PRODUCTION SCRIPT · ${script.totalSeconds}s`,
    '',
  ];
  script.beats.forEach((b, i) => {
    lines.push(
      `BEAT ${i + 1}  ${fmtTime(b.startSec)} – ${fmtTime(b.endSec)}`,
    );
    if (b.shot) lines.push(`  Shot: ${b.shot}`);
    if (b.onScreen) lines.push(`  On screen: ${b.onScreen}`);
    lines.push(`  VO: ${b.voiceover}`);
    if (b.action) lines.push(`  Action: ${b.action}`);
    if (b.broll) lines.push(`  B-roll: ${b.broll}`);
    if (b.brollPrompt) lines.push(`  B-roll prompt: ${b.brollPrompt}`);
    lines.push('');
  });
  return lines.join('\n').trim();
}

export const VideoScriptPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  /** Optional text model id from the Edit form writer selector. */
  model?: string;
  onReviewChange: (next: PieceReview) => void;
}> = ({ piece, review, offerSlug, model = AUTO_MODEL, onReviewChange }) => {
  const script = review.videoScript;
  const videoUrl = review.video;
  const [duration, setDuration] = useState<number>(
    script?.totalSeconds && DURATIONS.includes(script.totalSeconds as any)
      ? script.totalSeconds
      : 30,
  );
  const [guides, setGuides] = useState('');
  const [copied, setCopied] = useState(false);
  const [brollBusy, setBrollBusy] = useState<number | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gen = useAiAction();

  const generate = () =>
    gen.run(async () => {
      const result = await aiGenerateVideoScript({
        piece: {
          hook: piece.hook,
          hooks: piece.hooks,
          caption: piece.caption,
          body: piece.body,
          script: piece.script,
          theme: piece.theme,
          tone: TONE_LABEL[piece.tone],
          platform: PLATFORM_LABEL[piece.platform],
          format: FORMAT_LABEL[piece.format],
        },
        durationSec: duration,
        guides: guides.trim() || undefined,
        model: model || undefined,
      });
      const nextScript: VideoScript = {
        totalSeconds: result.totalSeconds,
        beats: result.beats.map((b) => ({
          startSec: b.startSec,
          endSec: b.endSec,
          shot: b.shot,
          onScreen: b.onScreen,
          voiceover: b.voiceover,
          action: b.action,
          broll: b.broll,
          brollPrompt: b.brollPrompt,
        })),
        model: result.model,
        generatedAt: new Date().toISOString(),
      };
      onReviewChange(setReviewVideoScript(offerSlug, piece.id, nextScript));
    });

  const clearScript = () => {
    onReviewChange(clearReviewVideoScript(offerSlug, piece.id));
  };

  const updateBeat = (index: number, patch: Partial<VideoScriptBeat>) => {
    if (!script) return;
    const beats = script.beats.map((b, i) =>
      i === index ? { ...b, ...patch } : b,
    );
    onReviewChange(
      setReviewVideoScript(offerSlug, piece.id, { ...script, beats }),
    );
  };

  const generateBroll = async (index: number) => {
    if (!script || brollBusy !== null) return;
    const beat = script.beats[index];
    const prompt = beat?.brollPrompt?.trim() || beat?.broll?.trim();
    if (!prompt) return;
    setBrollBusy(index);
    try {
      const image = await aiGenerateImage(prompt, piece.format);
      updateBeat(index, { brollImage: image });
    } catch (e) {
      gen.setError(e instanceof Error ? e.message : 'B-roll generation failed');
    } finally {
      setBrollBusy(null);
    }
  };

  const copyScript = async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(scriptToText(script));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/mothermode/content/video', {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || typeof json.url !== 'string') {
        throw new Error(json.error || `Upload failed (${res.status})`);
      }
      onReviewChange(setReviewVideo(offerSlug, piece.id, json.url));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadBusy(false);
    }
  };

  const removeVideo = () => {
    onReviewChange(clearReviewVideo(offerSlug, piece.id));
  };

  return (
    <div className="space-y-5 rounded-xl border border-ink/10 bg-mushroom/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brass">
            <Clapperboard className="h-3.5 w-3.5" />
            Video production
          </p>
          <p className="mt-1 text-xs text-ink/55">
            Second-by-second shooting script, b-roll prompts, and final-cut
            upload for this {FORMAT_LABEL[piece.format].toLowerCase()}.
          </p>
        </div>
      </div>

      {/* Final-cut upload */}
      <div className="rounded-lg border border-ink/10 bg-white/50 p-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
          Final cut
        </p>
        {videoUrl ? (
          <div className="mt-2 space-y-2">
            <video
              src={videoUrl}
              controls
              className="max-h-64 w-full rounded-lg bg-ink/90 object-contain"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadBusy}
                className={aiBtnGhost}
              >
                {uploadBusy ? <Spinner /> : <Upload className="h-3.5 w-3.5" />}
                Replace
              </button>
              <button
                type="button"
                onClick={removeVideo}
                className={aiBtnGhost}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadBusy}
              className={aiBtnSolid}
            >
              {uploadBusy ? <Spinner /> : <Film className="h-3.5 w-3.5" />}
              {uploadBusy ? 'Uploading…' : 'Upload video'}
            </button>
            <p className="mt-1.5 text-[11px] text-ink/45">
              mp4, webm, or mov · up to 100 MB
            </p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          className="hidden"
          onChange={onUpload}
        />
        <AiError message={uploadError} />
      </div>

      {/* Script generation controls */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Runtime
          </span>
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                duration === d
                  ? 'border-mode bg-mode/10 font-semibold text-mode'
                  : 'border-ink/15 text-ink/65 hover:border-ink/30'
              }`}
            >
              {d}s
            </button>
          ))}
        </div>

        <InstructionsInput
          value={guides}
          onChange={setGuides}
          placeholder="Production notes? e.g. more b-roll, talking-head only, kitchen setting…"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={gen.busy}
            className={aiBtnSolid}
          >
            {gen.busy ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
            {gen.busy
              ? 'Writing script…'
              : script
                ? 'Regenerate script'
                : 'Generate script'}
          </button>
          {script && (
            <>
              <button
                type="button"
                onClick={copyScript}
                className={aiBtnGhost}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-mode" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied' : 'Copy script'}
              </button>
              <button
                type="button"
                onClick={clearScript}
                className={aiBtnGhost}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </>
          )}
        </div>
        <AiError message={gen.error} />
      </div>

      {/* Beat timeline */}
      {script && script.beats.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Beats · {script.totalSeconds}s
            {script.model ? ` · ${script.model}` : ''}
          </p>
          <ol className="space-y-3">
            {script.beats.map((beat, i) => (
              <li
                key={i}
                className="rounded-lg border border-ink/10 bg-white/60 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-mode/10 px-2 py-0.5 text-[11px] font-semibold text-mode">
                    {fmtTime(beat.startSec)} – {fmtTime(beat.endSec)}
                  </span>
                  {beat.shot && (
                    <span className="text-xs text-ink/55">{beat.shot}</span>
                  )}
                </div>

                {beat.onScreen && (
                  <p className="mt-2 text-xs text-ink/60">
                    <span className="font-semibold text-brass">On screen:</span>{' '}
                    {beat.onScreen}
                  </p>
                )}

                <p className="mt-1.5 text-sm leading-relaxed text-ink">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-brass">
                    VO
                  </span>{' '}
                  {beat.voiceover}
                </p>

                {beat.action && (
                  <p className="mt-1 text-xs text-ink/55">
                    <span className="font-semibold">Action:</span> {beat.action}
                  </p>
                )}

                {(beat.broll || beat.brollPrompt) && (
                  <div className="mt-2 rounded-md border border-dashed border-ink/15 bg-mushroom/10 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brass">
                      B-roll
                    </p>
                    {beat.broll && (
                      <p className="mt-1 text-xs text-ink/70">{beat.broll}</p>
                    )}
                    {beat.brollPrompt && (
                      <p className="mt-1 text-[11px] italic text-ink/50">
                        {beat.brollPrompt}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {beat.brollImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={beat.brollImage}
                          alt={beat.broll ?? 'B-roll still'}
                          className="h-20 w-14 rounded object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => void generateBroll(i)}
                        disabled={brollBusy !== null || !beat.brollPrompt}
                        className={aiBtnGhost}
                      >
                        {brollBusy === i ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5" />
                        )}
                        {beat.brollImage ? 'Regen still' : 'Generate still'}
                      </button>
                      {beat.brollPrompt && (
                        <button
                          type="button"
                          onClick={() =>
                            void navigator.clipboard.writeText(
                              beat.brollPrompt!,
                            )
                          }
                          className={aiBtnGhost}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy prompt
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
