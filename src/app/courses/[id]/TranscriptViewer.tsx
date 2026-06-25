'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Search } from 'lucide-react';

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface Transcription {
  fullText: string;
  segments: Segment[];
  language?: string | null;
  status: string;
}

interface Props {
  lessonId: string;
  currentTime: number;
  onSeek?: (seconds: number) => void;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function TranscriptViewer({
  lessonId,
  currentTime,
  onSeek
}: Props) {
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTranscription(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/courses/transcribe?lessonId=${encodeURIComponent(lessonId)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.transcription) {
          setTranscription(data.transcription);
        }
      } catch {
        /* ignore — transcript is optional */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const segments = transcription?.segments ?? [];
  const activeIndex = useMemo(() => {
    if (segments.length === 0) return -1;
    for (let i = 0; i < segments.length; i++) {
      if (currentTime >= segments[i].start && currentTime < segments[i].end) {
        return i;
      }
    }
    return -1;
  }, [segments, currentTime]);

  const filtered = useMemo(() => {
    if (!query.trim()) return segments.map((s, i) => ({ s, i }));
    const q = query.toLowerCase();
    return segments
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  useEffect(() => {
    if (!autoScroll || activeIndex < 0 || query) return;
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex, autoScroll, query]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6">
        <div className="flex items-center justify-center gap-2 text-white/50 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading transcript…
        </div>
      </div>
    );
  }

  if (
    !transcription ||
    transcription.status !== 'completed' ||
    segments.length === 0
  ) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-gray-900/60 to-gray-950/60 backdrop-blur p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-300/30 flex items-center justify-center">
            <FileText className="w-4 h-4 text-amber-300" />
          </div>
          <h3 className="font-semibold text-white text-sm">Transcript</h3>
          {transcription.language && (
            <span className="text-[10px] uppercase tracking-wider text-white/40 ml-1">
              {transcription.language}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-amber-500"
          />
          Auto-scroll
        </label>
      </div>

      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transcript…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-amber-300/60 focus:outline-none placeholder:text-white/30"
        />
      </div>

      <div
        ref={containerRef}
        className="max-h-[420px] overflow-y-auto pr-1 space-y-1"
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-white/40 py-4 text-center">
            No matches for “{query}”.
          </p>
        ) : (
          filtered.map(({ s, i }) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={i}
                ref={isActive ? activeRef : undefined}
                onClick={() => onSeek?.(s.start)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex gap-3 ${
                  isActive
                    ? 'bg-amber-500/[0.12] border border-amber-300/40 text-amber-100'
                    : 'border border-transparent text-white/70 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span
                  className={`text-[11px] tabular-nums shrink-0 mt-0.5 ${
                    isActive ? 'text-amber-300' : 'text-white/40'
                  }`}
                >
                  {fmt(s.start)}
                </span>
                <span className="text-sm leading-relaxed">{s.text}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
