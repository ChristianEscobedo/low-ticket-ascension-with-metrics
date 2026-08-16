'use client';

/**
 * Script Lab — variation scripts from the reel's OWN transcript.
 *
 * The Content Hub's amplify flow, pointed at the reel: the Whisper words are
 * the grounding, so every variant is a rewrite of what is ACTUALLY said —
 * the full script re-voiced, hook/intro variants, body variants, and CTA
 * variants — never a hallucinated script about the topic. One click runs all
 * four sections (aiAmplifyParts); each section also refreshes on its own.
 *
 * STEERING: a sophistication dial (Everyday / Sharp / Expert) + free notes
 * ("make it punchier, more personal") ride every call as extra guide lines
 * (steeredGuides). A hook variant can be grown into a FULL script with one
 * click (the hook becomes the seed the bodies amplify from).
 *
 * EXPORT: any variant opens in the TELEPROMPTER (big text, auto-scroll,
 * speed + size controls — the record-a-new-take view), and the whole lab
 * downloads as one .txt.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Loader2,
  Mic,
  Pause,
  Play,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import type { ContentPiece } from '@/lib/mothermode/content/types';
import { aiAmplify, aiAmplifyParts } from '@/components/mothermode/content/aiClient';
import {
  SOPHISTICATION_LEVELS,
  scriptToText,
  steeredGuides,
  transcriptCta,
  transcriptHook,
  type Sophistication,
} from '@/lib/mothermode/reel/scriptLab';

type Section = 'full' | 'hooks' | 'body' | 'ctas';

/**
 * The teleprompter — the "record a new version on screen" view. Big text,
 * auto-scroll at a words-per-minute pace, play/pause, speed + font-size
 * controls, and a mirror-friendly high-contrast layout. Esc or × closes.
 */
function Teleprompter({
  text,
  title,
  onClose,
}: {
  text: string;
  title: string;
  onClose: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [wpm, setWpm] = useState(150);
  const [fontPx, setFontPx] = useState(44);
  const scrollRef = useRef<HTMLDivElement>(null);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);
  const seconds = Math.max(5, (words / Math.max(40, wpm)) * 60);

  // The auto-scroll: ease the scrollTop from 0 to the bottom over `seconds`.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    let raf = 0;
    const start = performance.now();
    const from = el.scrollTop;
    const distance = el.scrollHeight - el.clientHeight - from;
    if (distance <= 0) return;
    const tick = (ts: number) => {
      const t = Math.min(1, (ts - start) / (seconds * 1000));
      el.scrollTop = from + distance * t;
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, seconds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      {/* the control bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="truncate text-[11px] font-semibold text-white/70">{title}</span>
        <span className="text-[9px] text-white/30">
          {words} words · ≈{Math.round(seconds)}s
        </span>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[9px] text-white/40">
            speed
            <input
              type="range"
              min={80}
              max={240}
              step={10}
              value={wpm}
              onChange={(e) => setWpm(Number(e.target.value))}
              className="w-20 accent-brass"
            />
            <span className="w-10 text-white/60">{wpm}wpm</span>
          </label>
          <label className="flex items-center gap-1.5 text-[9px] text-white/40">
            size
            <input
              type="range"
              min={28}
              max={72}
              step={2}
              value={fontPx}
              onChange={(e) => setFontPx(Number(e.target.value))}
              className="w-16 accent-brass"
            />
          </label>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1 rounded-lg bg-brass px-2.5 py-1.5 text-[10px] font-bold text-ink"
            title="Play / pause (Space)"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* the scrolling script — centered, huge, high-contrast */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-[12vw] py-[38vh]"
      >
        <p
          className="whitespace-pre-wrap text-center font-semibold leading-[1.5] text-white"
          style={{ fontSize: fontPx, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

export default function ScriptLabPanel({
  transcript,
  theme,
  onUseAsVoiceover,
  onTranscribe,
  transcribing,
  onNote,
}: {
  /** The reel's transcript (transcriptForProject). '' = nothing transcribed yet. */
  transcript: string;
  /** The reel's name — the AI's theme context. */
  theme: string;
  /** Load a variant into the Scenes panel's voiceover box. */
  onUseAsVoiceover: (text: string) => void;
  /** The reel has no transcript yet — offer to transcribe the current scene. */
  onTranscribe: () => void;
  transcribing: boolean;
  onNote: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<Section | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState<string[]>([]);
  const [hooks, setHooks] = useState<string[]>([]);
  const [body, setBody] = useState<string[]>([]);
  const [ctas, setCtas] = useState<string[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  /** Steering: the sophistication dial + free notes (ride every AI call). */
  const [sophistication, setSophistication] = useState<Sophistication>('sharp');
  const [notes, setNotes] = useState('');
  /** The teleprompter's script (null = closed). */
  const [prompt, setPrompt] = useState<{ text: string; title: string } | null>(null);

  const wordCount = useMemo(
    () => transcript.split(/\s+/).filter(Boolean).length,
    [transcript],
  );

  /** The piece the amplify calls ground in (the Content Hub's own shape). */
  const aiSource = useMemo(
    () =>
      ({
        id: 'reel-script-lab',
        platform: 'tiktok',
        format: 'reel',
        kind: 'organic',
        tone: 'raw',
        theme,
        hook: transcriptHook(transcript),
        body: [transcript],
        cta: transcriptCta(transcript),
      }) as unknown as ContentPiece,
    [transcript, theme],
  );
  /** The guides WITH the current steering (rebuilt when the dial/notes change). */
  const guides = useMemo(
    () => steeredGuides(transcript, { sophistication, notes }),
    [transcript, sophistication, notes],
  );

  async function run(key: Section | 'all', job: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await job();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI failed');
    } finally {
      setBusy(null);
    }
  }

  const generateAll = () =>
    run('all', async () => {
      const parts = await aiAmplifyParts({
        parts: [
          { dimension: 'hooks', count: 4 },
          { dimension: 'bodies', count: 2 },
          { dimension: 'angles', count: 2 },
          { dimension: 'ctas', count: 4 },
        ],
        source: aiSource,
        guides,
      });
      if (parts.hooks?.length) setHooks(parts.hooks);
      if (parts.bodies?.length) setFull(parts.bodies);
      if (parts.angles?.length) setBody(parts.angles);
      if (parts.ctas?.length) setCtas(parts.ctas);
      onNote('Script Lab filled — every variant is grounded in the transcript.');
    });

  const refresh = (section: Section) =>
    run(section, async () => {
      if (section === 'full') {
        setFull(
          await aiAmplify({ dimension: 'bodies', count: 2, source: aiSource, guides }),
        );
      } else if (section === 'hooks') {
        setHooks(
          await aiAmplify({ dimension: 'hooks', count: 4, source: aiSource, guides }),
        );
      } else if (section === 'body') {
        setBody(
          await aiAmplify({ dimension: 'angles', count: 2, source: aiSource, guides }),
        );
      } else {
        setCtas(
          await aiAmplify({ dimension: 'ctas', count: 4, source: aiSource, guides }),
        );
      }
    });

  /**
   * Hook → full script: grow ONE hook variant into a complete script. The
   * picked hook becomes the seed (the source's hook), the bodies amplify
   * from it with the same steering — so the script OPENS with the hook you
   * chose, in the voice the dial + notes set.
   */
  const hookToScript = (hook: string) =>
    run('full', async () => {
      const seeded = { ...aiSource, hook } as unknown as ContentPiece;
      const scripts = await aiAmplify({
        dimension: 'bodies',
        count: 2,
        source: seeded,
        guides:
          guides +
          `\n\nThe script MUST open with this exact hook (word-for-word), then carry it through: "${hook}"`,
      });
      setFull(scripts);
      onNote('Full script grown from the picked hook — teleprompter it or load it as VO.');
    });

  /** The whole lab as ONE .txt download. */
  function downloadTxt() {
    const text = scriptToText({ full, hooks, body, ctas }, theme);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(theme || 'reel-script').replace(/[^\w-]+/g, '-').slice(0, 60)}-scripts.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onNote('Scripts downloaded as .txt.');
  }

  if (!transcript.trim()) {
    return (
      <div className="space-y-2 rounded-xl border border-dashed border-bone/15 px-3 py-4 text-[10px] leading-relaxed text-bone/40">
        <p>
          The Script Lab rewrites what the reel actually SAYS — but nothing is
          transcribed yet. Transcribe a scene first (Whisper word timings), then
          the full script + hook / body / CTA variants generate from it.
        </p>
        <button
          onClick={onTranscribe}
          disabled={transcribing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-2.5 py-1.5 text-[10px] font-semibold text-ink hover:bg-brass/90 disabled:opacity-40"
        >
          {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
          Transcribe the current scene
        </button>
      </div>
    );
  }

  const SectionHead = ({ id, label, hint }: { id: Section; label: string; hint: string }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wide text-bone/45">{label}</span>
      <span className="text-[8px] text-bone/25">{hint}</span>
      <button
        onClick={() => void refresh(id)}
        disabled={busy !== null}
        className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-semibold text-brass/80 hover:bg-brass/10 disabled:opacity-40"
        title={`Regenerate the ${label} variants`}
      >
        {busy === id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5" />}
        refresh
      </button>
    </div>
  );

  const VariantCard = ({
    text,
    vo,
    onGrowScript,
  }: {
    text: string;
    vo?: boolean;
    /** Hook cards only: grow this hook into a full script. */
    onGrowScript?: () => void;
  }) => (
    <div className="group rounded-lg border border-bone/10 bg-ink/60 px-2 py-1.5">
      <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-bone/80">{text}</p>
      <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(text);
            onNote('Copied.');
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-semibold text-bone/50 hover:bg-bone/10 hover:text-bone"
        >
          <Copy className="h-2.5 w-2.5" /> copy
        </button>
        <button
          onClick={() => setPrompt({ text, title: theme || 'Script' })}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-semibold text-bone/50 hover:bg-bone/10 hover:text-bone"
          title="Open in the teleprompter — record a new take reading it on screen"
        >
          <Play className="h-2.5 w-2.5" /> teleprompter
        </button>
        {onGrowScript && (
          <button
            onClick={onGrowScript}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-semibold text-brass/80 hover:bg-brass/10 disabled:opacity-40"
            title="Grow this hook into a FULL script (it opens with this hook, word-for-word)"
          >
            <Sparkles className="h-2.5 w-2.5" /> → full script
          </button>
        )}
        {vo && (
          <button
            onClick={() => onUseAsVoiceover(text)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-semibold text-brass/80 hover:bg-brass/10"
            title="Load this into the Scenes panel's voiceover box"
          >
            <Mic className="h-2.5 w-2.5" /> use as VO
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="rounded-xl border border-brass/25 bg-brass/[0.05] px-2.5 py-2 text-[10px] leading-relaxed text-bone/50">
        <strong className="text-brass/90">Script Lab.</strong> Variations of what this reel
        actually says — the full script re-voiced, plus hook / body / CTA variants. Grounded in
        the transcript, never invented.
      </p>

      {/* STEERING — the sophistication dial + free notes, riding every call */}
      <div className="space-y-1.5 rounded-xl border border-bone/10 bg-bone/[0.03] p-2">
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-bold uppercase tracking-wide text-bone/35">
            sophistication
          </span>
          {SOPHISTICATION_LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => setSophistication(l.id)}
              title={l.hint}
              className={
                sophistication === l.id
                  ? 'rounded bg-brass px-2 py-0.5 text-[8px] font-bold text-ink'
                  : 'rounded px-2 py-0.5 text-[8px] font-semibold text-bone/45 hover:bg-bone/10'
              }
            >
              {l.label}
            </button>
          ))}
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Steer the next run — 'punchier', 'more personal', 'add a story beat'…"
          className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
          title="Free steering notes — appended to the AI's direction on the next generate"
        />
      </div>

      {/* the transcript itself (collapsible) */}
      <button
        onClick={() => setShowTranscript((v) => !v)}
        className="w-full rounded-lg border border-bone/10 bg-ink/50 px-2 py-1.5 text-left text-[9px] text-bone/40 hover:bg-bone/5"
      >
        {showTranscript ? '▾' : '▸'} the transcript ({wordCount} words)
        {showTranscript && (
          <span className="mt-1 block whitespace-pre-wrap text-[9px] leading-relaxed text-bone/55">
            {transcript}
          </span>
        )}
      </button>

      <div className="flex gap-1.5">
        <button
          onClick={() => void generateAll()}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brass px-3 py-2 text-[11px] font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
        >
          {busy === 'all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {busy === 'all' ? 'Writing variations…' : 'Generate all variations'}
        </button>
        <button
          onClick={downloadTxt}
          disabled={!full.length && !hooks.length && !body.length && !ctas.length}
          className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-2 text-[10px] font-semibold text-bone/60 hover:bg-bone/10 disabled:opacity-40"
          title="Download the whole lab as one .txt (print or share)"
        >
          <Download className="h-3.5 w-3.5" /> .txt
        </button>
      </div>
      {error && <p className="text-[10px] text-red-300">{error}</p>}

      {/* FULL SCRIPT */}
      <div className="space-y-1">
        <SectionHead id="full" label="Full script" hint="the whole thing, re-voiced" />
        {full.map((t, i) => (
          <VariantCard key={`full-${i}`} text={t} vo />
        ))}
      </div>

      {/* HOOKS */}
      <div className="space-y-1">
        <SectionHead id="hooks" label="Hook / intro" hint="the first beat, 4 ways" />
        {hooks.map((t, i) => (
          <VariantCard key={`hook-${i}`} text={t} onGrowScript={() => void hookToScript(t)} />
        ))}
      </div>

      {/* BODY */}
      <div className="space-y-1">
        <SectionHead id="body" label="Body" hint="the middle, 2 angles" />
        {body.map((t, i) => (
          <VariantCard key={`body-${i}`} text={t} vo />
        ))}
      </div>

      {/* CTA */}
      <div className="space-y-1">
        <SectionHead id="ctas" label="CTA" hint="the ask, 4 ways" />
        {ctas.map((t, i) => (
          <VariantCard key={`cta-${i}`} text={t} />
        ))}
      </div>

      <p className="text-[8px] leading-relaxed text-bone/25">
        hover a variant for copy / teleprompter / use-as-VO. A hook's → full script grows it
        into a complete script. The VO box is on the Scenes tab (ElevenLabs).
      </p>

      {/* the teleprompter — record a new take reading the script on screen */}
      {prompt && (
        <Teleprompter text={prompt.text} title={prompt.title} onClose={() => setPrompt(null)} />
      )}
    </div>
  );
}
