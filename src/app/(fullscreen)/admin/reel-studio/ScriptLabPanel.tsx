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
 * A variant has two exits: copy it (for re-recording), or load it into the
 * Scenes panel's voiceover box (the ElevenLabs flow already lives there).
 */
import { useMemo, useState } from 'react';
import { Copy, Loader2, Mic, Sparkles, Wand2 } from 'lucide-react';
import type { ContentPiece } from '@/lib/mothermode/content/types';
import { aiAmplify, aiAmplifyParts } from '@/components/mothermode/content/aiClient';
import {
  scriptLabGuides,
  transcriptCta,
  transcriptHook,
} from '@/lib/mothermode/reel/scriptLab';

type Section = 'full' | 'hooks' | 'body' | 'ctas';

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
  const guides = useMemo(() => scriptLabGuides(transcript), [transcript]);

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

  const VariantCard = ({ text, vo }: { text: string; vo?: boolean }) => (
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

      <button
        onClick={() => void generateAll()}
        disabled={busy !== null}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brass px-3 py-2 text-[11px] font-bold text-ink hover:bg-brass/90 disabled:opacity-40"
      >
        {busy === 'all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {busy === 'all' ? 'Writing variations…' : 'Generate all variations'}
      </button>
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
          <VariantCard key={`hook-${i}`} text={t} />
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
        hover a variant for copy / use-as-VO. The VO box is on the Scenes tab (ElevenLabs).
      </p>
    </div>
  );
}
