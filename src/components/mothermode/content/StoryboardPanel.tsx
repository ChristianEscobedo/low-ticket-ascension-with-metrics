'use client';

/**
 * Edit-tab storyboard planner: turn a post into 1–4 connected cinematic
 * contact-sheet boards with lookback continuity, character/product refs, and
 * optional b-roll mode. Renders happen in Image Studio → Storyboard tab.
 */
import React, { useRef, useState } from 'react';
import {
  Clapperboard,
  Copy,
  Check,
  ImagePlus,
  LayoutGrid,
  Sparkles,
  Trash2,
  User,
  Package,
} from 'lucide-react';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  TONE_LABEL,
  AUTO_MODEL,
  MAX_STORYBOARD_REFERENCES,
  type ContentPiece,
} from '@/lib/mothermode/content';
import type {
  PieceReview,
  StoryboardBoard,
  StoryboardCount,
  StoryboardMode,
  StoryboardPack,
} from '@/lib/mothermode/content/review';
import {
  setReviewStoryboard,
  clearReviewStoryboard,
} from './reviewClient';
import { aiGenerateStoryboardPlan } from './aiClient';
import {
  useAiAction,
  aiBtnSolid,
  aiBtnGhost,
  Spinner,
  AiError,
  InstructionsInput,
} from './AiControls';

const COUNTS: StoryboardCount[] = [1, 2, 3, 4];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

function packToText(pack: StoryboardPack): string {
  const lines: string[] = [
    `STORYBOARD PACK · ${pack.mode.toUpperCase()} · ${pack.boardCount} board${pack.boardCount > 1 ? 's' : ''}`,
    '',
  ];
  for (const b of pack.boards) {
    lines.push(`═══ BOARD ${b.index}: ${b.title} ═══`);
    if (b.scenes?.length) {
      lines.push('Scenes:');
      b.scenes.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
    }
    lines.push('');
    lines.push('IMAGE PROMPT:');
    lines.push(b.imagePrompt);
    if (b.videoPrompt) {
      lines.push('');
      lines.push('VIDEO PROMPT:');
      lines.push(b.videoPrompt);
    }
    lines.push('');
    lines.push(`LOOKBACK: ${b.lookbackSummary}`);
    if (b.brollNotes) lines.push(`B-ROLL NOTES: ${b.brollNotes}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export const StoryboardPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  model?: string;
  onReviewChange: (next: PieceReview) => void;
  /** Open Image Studio focused on storyboard render (optional). */
  onOpenStudio?: () => void;
}> = ({
  piece,
  review,
  offerSlug,
  model = AUTO_MODEL,
  onReviewChange,
  onOpenStudio,
}) => {
  const pack = review.storyboard;
  const [boardCount, setBoardCount] = useState<StoryboardCount>(
    pack?.boardCount ?? 1,
  );
  const [mode, setMode] = useState<StoryboardMode>(pack?.mode ?? 'narrative');
  const [guides, setGuides] = useState(pack?.guides ?? '');
  const [characterRef, setCharacterRef] = useState(pack?.characterRef ?? '');
  const [refs, setRefs] = useState<string[]>(pack?.referenceImages ?? []);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(
    pack?.boards?.[0]?.index ?? null,
  );
  const charRef = useRef<HTMLInputElement>(null);
  const prodRef = useRef<HTMLInputElement>(null);
  const gen = useAiAction();

  const persistPack = (next: StoryboardPack) => {
    onReviewChange(setReviewStoryboard(offerSlug, piece.id, next));
  };

  const generate = () =>
    gen.run(async () => {
      const brollSeeds =
        mode === 'broll'
          ? (review.videoScript?.beats ?? [])
              .map((b) => b.brollPrompt || b.broll || '')
              .filter(Boolean)
          : undefined;
      const result = await aiGenerateStoryboardPlan({
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
          brollSeeds,
        },
        boardCount,
        mode,
        guides: guides.trim() || undefined,
        hasCharacterRef: !!characterRef,
        hasReferenceImages: refs.length > 0,
        model: model || undefined,
      });
      const next: StoryboardPack = {
        boardCount: result.boardCount as StoryboardCount,
        mode: result.mode,
        guides: guides.trim() || undefined,
        characterRef: characterRef || undefined,
        referenceImages: refs.length ? refs : undefined,
        boards: result.boards.map((b) => ({
          index: b.index,
          title: b.title,
          scenes: b.scenes,
          imagePrompt: b.imagePrompt,
          videoPrompt: b.videoPrompt,
          lookbackSummary: b.lookbackSummary,
          brollNotes: b.brollNotes,
        })),
        model: result.model,
        generatedAt: new Date().toISOString(),
      };
      persistPack(next);
      setExpanded(next.boards[0]?.index ?? null);
    });

  const clear = () => {
    onReviewChange(clearReviewStoryboard(offerSlug, piece.id));
    setExpanded(null);
  };

  const updateBoard = (index: number, patch: Partial<StoryboardBoard>) => {
    if (!pack) return;
    const boards = pack.boards.map((b) =>
      b.index === index ? { ...b, ...patch } : b,
    );
    persistPack({
      ...pack,
      characterRef: characterRef || pack.characterRef,
      referenceImages: refs.length ? refs : pack.referenceImages,
      boards,
    });
  };

  const saveRefsToPack = () => {
    if (!pack) return;
    persistPack({
      ...pack,
      characterRef: characterRef || undefined,
      referenceImages: refs.length ? refs : undefined,
      guides: guides.trim() || undefined,
    });
  };

  const onCharFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const url = await readFileAsDataUrl(f);
      setCharacterRef(url);
    } catch {
      /* ignore */
    }
  };

  const onRefFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_STORYBOARD_REFERENCES - refs.length;
    if (room <= 0) return;
    const urls: string[] = [];
    for (const f of files.slice(0, room)) {
      try {
        urls.push(await readFileAsDataUrl(f));
      } catch {
        /* skip */
      }
    }
    if (urls.length)
      setRefs((prev) => [...prev, ...urls].slice(0, MAX_STORYBOARD_REFERENCES));
  };

  const copyPack = async () => {
    if (!pack) return;
    try {
      await navigator.clipboard.writeText(packToText(pack));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5 rounded-xl border border-ink/10 bg-mushroom/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brass">
            <LayoutGrid className="h-3.5 w-3.5" />
            Storyboard
          </p>
          <p className="mt-1 text-xs text-ink/55">
            Turn this post into 1–4 connected cinematic contact sheets. Board N
            continues where board N−1 left off. Plan here; render in Image
            Studio.
          </p>
        </div>
      </div>

      {/* Count + mode */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Boards
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBoardCount(n)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  boardCount === n
                    ? 'bg-mode/15 text-mode ring-1 ring-mode/30'
                    : 'border border-ink/15 text-ink/60 hover:border-ink/30'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Mode
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(
              [
                { v: 'narrative' as const, label: 'Narrative arc' },
                { v: 'broll' as const, label: 'B-roll boards' },
              ] as const
            ).map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  mode === v
                    ? 'bg-mode/15 text-mode ring-1 ring-mode/30'
                    : 'border border-ink/15 text-ink/60 hover:border-ink/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* References */}
      <div className="space-y-3 rounded-lg border border-ink/10 bg-white/50 p-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
          References (shared across boards)
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <button
              type="button"
              onClick={() => charRef.current?.click()}
              className={aiBtnGhost}
            >
              <User className="h-3.5 w-3.5" />
              Character
            </button>
            <input
              ref={charRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onCharFile}
            />
            {characterRef ? (
              <div className="relative mt-2 h-16 w-16 overflow-hidden rounded-lg border border-ink/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={characterRef}
                  alt="Character ref"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setCharacterRef('')}
                  className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-ink/70"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>
          <div>
            <button
              type="button"
              onClick={() => prodRef.current?.click()}
              className={aiBtnGhost}
              disabled={refs.length >= MAX_STORYBOARD_REFERENCES}
            >
              <Package className="h-3.5 w-3.5" />
              Product / env
            </button>
            <input
              ref={prodRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onRefFiles}
            />
            {refs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {refs.map((src, i) => (
                  <div
                    key={i}
                    className="relative h-14 w-14 overflow-hidden rounded-lg border border-ink/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Ref ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRefs((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-ink/70"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {pack ? (
          <button type="button" onClick={saveRefsToPack} className={aiBtnGhost}>
            Save refs to pack
          </button>
        ) : null}
      </div>

      <InstructionsInput
        value={guides}
        onChange={setGuides}
        placeholder="Optional guides: setting, wardrobe, must-include props, tone…"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={gen.busy}
          className={aiBtnSolid}
        >
          {gen.busy ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
          {gen.busy
            ? 'Planning…'
            : pack
              ? `Regenerate ${boardCount} board${boardCount > 1 ? 's' : ''}`
              : `Generate ${boardCount} board${boardCount > 1 ? 's' : ''}`}
        </button>
        {pack ? (
          <>
            <button type="button" onClick={copyPack} className={aiBtnGhost}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy pack'}
            </button>
            {onOpenStudio ? (
              <button type="button" onClick={onOpenStudio} className={aiBtnGhost}>
                <ImagePlus className="h-3.5 w-3.5" />
                Render in studio
              </button>
            ) : null}
            <button type="button" onClick={clear} className={aiBtnGhost}>
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </>
        ) : null}
      </div>
      <AiError message={gen.error} />


      {pack?.boards?.length ? (
        <div className="space-y-3">
          {pack.boards.map((b) => {
            const open = expanded === b.index;
            return (
              <div
                key={b.index}
                className="rounded-lg border border-ink/10 bg-white/60"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : b.index)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Clapperboard className="h-3.5 w-3.5 text-brass" />
                    Board {b.index}
                    <span className="font-normal text-ink/55">· {b.title}</span>
                  </span>
                  {b.imageUrl ? (
                    <span className="text-[10px] uppercase tracking-wide text-mode">
                      Rendered
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide text-ink/40">
                      Prompt ready
                    </span>
                  )}
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-ink/10 px-3 py-3">
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.imageUrl}
                        alt={b.title}
                        className="max-h-48 w-full rounded-lg object-contain bg-ink/5"
                      />
                    ) : null}
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
                        Scenes
                      </span>
                      <textarea
                        rows={3}
                        value={(b.scenes ?? []).join('\n')}
                        onChange={(e) =>
                          updateBoard(b.index, {
                            scenes: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-ink/15 bg-white/70 p-2 text-xs text-ink focus:border-mode focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
                        Image prompt
                      </span>
                      <textarea
                        rows={6}
                        value={b.imagePrompt}
                        onChange={(e) =>
                          updateBoard(b.index, {
                            imagePrompt: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-ink/15 bg-white/70 p-2 font-mono text-[11px] text-ink focus:border-mode focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
                        Video prompt
                      </span>
                      <textarea
                        rows={3}
                        value={b.videoPrompt ?? ''}
                        onChange={(e) =>
                          updateBoard(b.index, {
                            videoPrompt: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-ink/15 bg-white/70 p-2 text-xs text-ink focus:border-mode focus:outline-none"
                      />
                    </label>
                    <p className="text-[11px] text-ink/50">
                      <span className="font-semibold text-ink/70">Lookback:</span>{' '}
                      {b.lookbackSummary}
                    </p>
                    {b.brollNotes ? (
                      <p className="text-[11px] text-ink/50">
                        <span className="font-semibold text-ink/70">
                          B-roll:
                        </span>{' '}
                        {b.brollNotes}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
