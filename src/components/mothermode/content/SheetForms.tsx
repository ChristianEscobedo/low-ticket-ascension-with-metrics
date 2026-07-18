'use client';

/**
 * The Edit and Metrics forms used inside the content sheet. Edit overrides the
 * catalog copy locally (blank means "use the catalog text"); Metrics captures
 * the numbers that drive the preview's engagement counts. Both write straight
 * to the review store via the callbacks the sheet provides.
 */
import React, { useState } from 'react';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  TONE_LABEL,
  TEXT_MODELS,
  AUTO_MODEL,
  type ContentPiece,
} from '@/lib/mothermode/content';
import type {
  PieceEdits,
  PieceReview,
} from '@/lib/mothermode/content/review';
import type { AiContext } from './aiClient';
import { ImagesCard } from './ImagesCard';
import { HookVariants } from './HookVariants';
import { RewriteField } from './RewriteField';
import { VideoScriptPanel } from './VideoScriptPanel';
import { StoryboardPanel } from './StoryboardPanel';



type MetricField = keyof NonNullable<PieceReview['metrics']>;

/** Metric inputs shown per kind, label first so the grid reads cleanly. */
const ORGANIC_METRICS: { key: MetricField; label: string }[] = [
  { key: 'reach', label: 'Reach' },
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
];

const PAID_METRICS: { key: MetricField; label: string }[] = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'reach', label: 'Reach' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'spend', label: 'Spend ($)' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'likes', label: 'Reactions' },
];

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const fieldCls =
  'mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none';

export const EditForm: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  onUploadImage: (file: File) => void;
  onAddImages: (urls: string[]) => void;
  onRemoveImage: (index: number) => void;
  onSetImageIndex: (index: number) => void;
  onEditPatch: (patch: Partial<PieceEdits>) => void;
  onReviewChange: (next: PieceReview) => void;
}> = ({
  piece,
  review,
  offerSlug,
  onUploadImage,
  onAddImages,
  onRemoveImage,
  onSetImageIndex,
  onEditPatch,
  onReviewChange,
}) => {
  const edits = review.edits ?? {};
  const [model, setModel] = useState(AUTO_MODEL);
  const isVideo =
    piece.format === 'reel' || piece.format === 'video';
  // The brief the AI rewrites stay anchored to, in human labels.
  const context: AiContext = {
    theme: piece.theme,
    tone: TONE_LABEL[piece.tone],
    platform: PLATFORM_LABEL[piece.platform],
    format: FORMAT_LABEL[piece.format],
  };
  return (
    <div className="space-y-6">
      <label className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
          Writer
        </span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-md border border-ink/15 bg-white/70 px-2 py-1 text-xs text-ink focus:border-mode focus:outline-none"
        >
          <option value={AUTO_MODEL}>Auto</option>
          {TEXT_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      {isVideo && (
        <VideoScriptPanel
          piece={piece}
          review={review}
          offerSlug={offerSlug}
          model={model}
          onReviewChange={onReviewChange}
        />
      )}

      <StoryboardPanel
        piece={piece}
        review={review}
        offerSlug={offerSlug}
        model={model}
        onReviewChange={onReviewChange}
      />

      <ImagesCard
        piece={piece}
        review={review}
        onUpload={onUploadImage}
        onAddImages={onAddImages}
        onRemove={onRemoveImage}
        onSetIndex={onSetImageIndex}
        offerSlug={offerSlug}
        onReviewChange={onReviewChange}
      />


      <HookVariants
        piece={piece}
        review={review}
        context={context}
        model={model}
        onPatch={onEditPatch}
      />

      <RewriteField
        label="Caption"
        field="caption"
        value={edits.caption ?? ''}
        fallback={piece.caption ?? piece.hook}
        placeholder={piece.caption ?? piece.hook}
        minHeight="4rem"
        context={context}
        model={model}
        onChange={(value) => onEditPatch({ caption: value })}
      />

      <RewriteField
        label="Body (blank line between paragraphs)"
        field="body"
        value={edits.body ?? ''}
        fallback={piece.body?.join('\n\n') ?? ''}
        placeholder={piece.body?.join('\n\n') ?? 'No body copy for this format.'}
        minHeight="8rem"
        context={context}
        model={model}
        onChange={(value) => onEditPatch({ body: value })}
      />
    </div>
  );
};


export const MetricsForm: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  onMetric: (field: MetricField, value: number | undefined) => void;
}> = ({ piece, review, onMetric }) => {
  const fields = piece.kind === 'ad' ? PAID_METRICS : ORGANIC_METRICS;
  const metrics = review.metrics ?? {};
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(({ key, label }) => (
        <label key={key} className="block">
          <span className={labelCls}>{label}</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={metrics[key] ?? ''}
            placeholder="0"
            onChange={(e) =>
              onMetric(key, e.target.value === '' ? undefined : Number(e.target.value))
            }
            className={fieldCls}
          />
        </label>
      ))}
    </div>
  );
};
