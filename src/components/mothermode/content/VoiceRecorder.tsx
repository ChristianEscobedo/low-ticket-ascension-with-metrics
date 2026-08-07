'use client';

/**
 * The shared voice recorder — MediaRecorder → a Blob the caller owns.
 * Used by the AI Twins "record your voice → clone" flow and the Clone
 * wizard's per-beat scratch VO. Idle → recording (with a live timer, 120s
 * cap) → preview (play it back, use it or redo it).
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Play, RotateCcw, Square } from 'lucide-react';

const MAX_SEC = 120;

export default function VoiceRecorder({
  onTake,
  busy = false,
  label = 'record',
  compact = false,
}: {
  /** The finished take, as a Blob — the caller uploads/sends it. */
  onTake: (blob: Blob) => void;
  busy?: boolean;
  label?: string;
  compact?: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        blobRef.current = blob;
        if (blob.size < 1500) {
          setError('Too short — give it a full read.');
          setPhase('idle');
          return;
        }
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase('preview');
      };
      recRef.current = rec;
      setElapsed(0);
      setPhase('recording');
      rec.start();
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_SEC) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('Microphone access denied — allow the mic and try again.');
      setPhase('idle');
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
  }

  function redo() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setPhase('idle');
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const btn = compact
    ? 'inline-flex items-center gap-1 rounded border border-brass/40 px-1.5 py-0.5 text-[8px] font-semibold text-brass hover:bg-brass/10 disabled:opacity-40'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-brass/40 px-2.5 py-1.5 text-[10px] font-semibold text-brass hover:bg-brass/10 disabled:opacity-40';

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {phase === 'idle' && (
        <button onClick={() => void start()} disabled={busy} className={btn}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
          {busy ? 'working…' : label}
        </button>
      )}
      {phase === 'recording' && (
        <button
          onClick={stop}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-2.5 py-1.5 text-[10px] font-semibold text-white"
        >
          <Square className="h-3 w-3" /> {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)} — stop
        </button>
      )}
      {phase === 'preview' && previewUrl && blobRef.current && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={previewUrl} controls className="h-7 w-36" />
          <button
            onClick={() => {
              if (blobRef.current) onTake(blobRef.current);
            }}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-brass px-2 py-1 text-[9px] font-bold text-ink disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            use this take
          </button>
          <button onClick={redo} className="rounded p-1 text-bone/40 hover:bg-bone/10" title="Redo">
            <RotateCcw className="h-3 w-3" />
          </button>
        </>
      )}
      {error && <span className="text-[9px] text-red-300">{error}</span>}
    </span>
  );
}
