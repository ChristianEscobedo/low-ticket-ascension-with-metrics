'use client';

/**
 * The Generate drawer for the content hub. Produces an offer-grounded batch of
 * formatted posts/ads, or several variations of one post, then hands the new
 * pieces back to the hub. Copy stays A-level: the offer facts and prompt guides
 * steer it, but the brand voice rules are enforced server-side.
 */
import React, { useMemo, useState } from 'react';
import { X as XIcon, Sparkles } from 'lucide-react';
import { useAiAction, aiBtnSolid, Spinner, AiError } from './AiControls';
import { generateBatch } from './generatedClient';
import { OFFERS } from '@/lib/mothermode/offers';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  KIND_LABEL,
  TONE_LABEL,
  TEXT_MODELS,
  AUTO_MODEL,
  PLATFORM_FORMATS,
  type ContentFormat,
  type ContentKind,
  type ContentPiece,
  type ContentPlatform,
  type ToneRegister,
} from '@/lib/mothermode/content';

const PLATFORMS = Object.keys(PLATFORM_LABEL) as ContentPlatform[];
const KINDS: ContentKind[] = ['organic', 'ad'];
const TONES = Object.keys(TONE_LABEL) as ToneRegister[];

const fieldCls =
  'w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-sm text-ink focus:border-mode focus:outline-none';
const labelCls = 'mb-1 block text-xs uppercase tracking-wide text-ink/45';

/** A labelled <select> kept compact for the two-column grid. */
const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
      {children}
    </select>
  </div>
);

export const BatchPanel: React.FC<{
  pieces: ContentPiece[];
  onClose: () => void;
  onGenerated: (pieces: ContentPiece[]) => void;
}> = ({ pieces, onClose, onGenerated }) => {
  const [offerSlug, setOfferSlug] = useState(OFFERS[0]?.slug ?? '');
  const [mode, setMode] = useState<'batch' | 'variations'>('batch');
  const [platform, setPlatform] = useState<ContentPlatform>('instagram');
  const [format, setFormat] = useState<ContentFormat>('feed');
  const [kind, setKind] = useState<ContentKind>('organic');
  const [tone, setTone] = useState<ToneRegister>('confidante');
  const [count, setCount] = useState(5);
  const [theme, setTheme] = useState('');
  const [guides, setGuides] = useState('');
  const [model, setModel] = useState(AUTO_MODEL);
  const [sourceId, setSourceId] = useState('');
  const { busy, error, run } = useAiAction();

  const formats = PLATFORM_FORMATS[platform];

  const changePlatform = (p: string) => {
    const next = p as ContentPlatform;
    setPlatform(next);
    if (!PLATFORM_FORMATS[next].includes(format)) setFormat(PLATFORM_FORMATS[next][0]);
  };

  const sources = useMemo(
    () => pieces.filter((p) => p.platform === platform),
    [pieces, platform],
  );

  const generate = () =>
    run(async () => {
      const source =
        mode === 'variations' && sourceId
          ? pieces.find((p) => p.id === sourceId)
          : undefined;
      const created = await generateBatch({
        offerSlug,
        mode,
        count,
        platform,
        format,
        kind,
        tone,
        theme: theme.trim() || undefined,
        guides: guides.trim() || undefined,
        model: model || undefined,
        source,
      });
      onGenerated(created);
      onClose();
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-sm">
      <div className="h-full w-full max-w-md overflow-y-auto bg-bone p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
            <Sparkles className="h-5 w-5 text-brass" />
            Generate content
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-ink/40 hover:text-ink">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-ink/60">
          A batch of formatted, on-voice pieces for one offer. Saved to the hub as
          drafts you can edit, preview, and copy.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Select label="Offer" value={offerSlug} onChange={setOfferSlug}>
              {OFFERS.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Mode</label>
            <div className="flex gap-2">
              {(['batch', 'variations'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    mode === m ? 'bg-mode text-bone' : 'border border-ink/15 text-ink/70'
                  }`}
                >
                  {m === 'batch' ? 'Distinct posts' : 'Variations'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'variations' && (
            <div className="col-span-2">
              <Select label="Base on (optional)" value={sourceId} onChange={setSourceId}>
                <option value="">Write fresh variations</option>
                {sources.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Select label="Channel" value={platform} onChange={changePlatform}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </Select>
          <Select label="Format" value={format} onChange={(v) => setFormat(v as ContentFormat)}>
            {formats.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </Select>
          <Select label="Type" value={kind} onChange={(v) => setKind(v as ContentKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
          <Select label="Tone" value={tone} onChange={(v) => setTone(v as ToneRegister)}>
            {TONES.map((t) => (
              <option key={t} value={t}>
                {TONE_LABEL[t]}
              </option>
            ))}
          </Select>
          <div className="col-span-2">
            <Select label="Writer" value={model} onChange={setModel}>
              <option value={AUTO_MODEL}>Auto (recommended)</option>
              {TEXT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.note ? ` (${m.note})` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>How many: {count}</label>
            <input
              type="range"
              min={3}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-mode"
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Theme / angle (optional)</label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. the 5 pm witching hour"
              className={fieldCls}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Prompt guides (optional)</label>
            <textarea
              value={guides}
              onChange={(e) => setGuides(e.target.value)}
              rows={3}
              placeholder="Steer the batch. The brand voice rules are always enforced."
              className={`${fieldCls} resize-none`}
            />
          </div>
        </div>

        <button onClick={generate} disabled={busy} className={`${aiBtnSolid} mt-5 w-full justify-center py-2.5 text-sm`}>
          {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
          {busy ? `Writing ${count} pieces...` : `Generate ${count} pieces`}
        </button>
        <AiError message={error} />
      </div>
    </div>
  );
};
