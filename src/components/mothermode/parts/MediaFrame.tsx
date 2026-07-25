'use client';

import React from 'react';
import { ImageIcon, Play, Pencil } from 'lucide-react';
import { PALETTE } from '@/lib/mothermode/brand';
import {
  useSalesPageEdit,
  type SalesMediaOpenRequest,
} from '@/components/mothermode/sales/SalesPageEditContext';
import type { FunnelMediaKind } from '@/components/mothermode/sales/FunnelMediaStudio';

interface MediaFrameProps {
  /** When set, the real image renders. When absent, an on-brand placeholder
   *  renders instead, labelled with what belongs here and at what size. */
  src?: string;
  alt: string;
  /** Placeholder label, e.g. "Product mockup". */
  label?: string;
  /** Placeholder size hint, e.g. "1200 × 750". */
  hint?: string;
  /** Tailwind aspect-ratio class. Defaults to a wide editorial frame. */
  aspect?: string;
  rounded?: string;
  /** Show a play affordance (for VSL / video posters). */
  video?: boolean;
  className?: string;
  /**
   * Funnel sales JSON media field (e.g. heroImageUrl, heroVideoUrl, founderPhotoUrl).
   * When set and admin is in edit mode, click opens Funnel Media Studio.
   */
  mediaField?: string;
  mediaKind?: FunnelMediaKind;
  mediaLabel?: string;
}

/**
 * One image slot for the MotherMode sales page. Renders the supplied image, or a
 * tasteful Editorial Warm placeholder. On funnel pages in edit mode, click opens
 * the media studio when mediaField is provided.
 */
export const MediaFrame: React.FC<MediaFrameProps> = ({
  src,
  alt,
  label = 'Image',
  hint,
  aspect = 'aspect-[16/10]',
  rounded = 'rounded-2xl',
  video = false,
  className = '',
  mediaField,
  mediaKind,
  mediaLabel,
}) => {
  const edit = useSalesPageEdit();
  const canEdit =
    Boolean(edit?.isEditMode && mediaField && edit.openMediaStudio);
  const frame = `relative overflow-hidden ${rounded} border border-ink/10 ${className} ${
    canEdit
      ? 'cursor-pointer outline-dashed outline-1 outline-transparent hover:outline-mode/50 ring-offset-2'
      : ''
  }`;

  const onEditClick = (e: React.MouseEvent) => {
    if (!canEdit || !edit?.openMediaStudio || !mediaField) return;
    e.preventDefault();
    e.stopPropagation();
    const req: SalesMediaOpenRequest = {
      kind: mediaKind || (video ? 'video' : 'image'),
      field: mediaField,
      label: mediaLabel || label,
    };
    edit.openMediaStudio(req);
  };

  const editBadge = canEdit ? (
    <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-bone shadow">
      <Pencil className="h-3 w-3" />
      Edit media
    </span>
  ) : null;

  if (src) {
    return (
      <div
        className={frame}
        onClick={canEdit ? onEditClick : undefined}
        title={canEdit ? 'Click to edit media' : undefined}
        role={canEdit ? 'button' : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={`${aspect} w-full object-cover`} />
        {video && <PlayBadge />}
        {editBadge}
      </div>
    );
  }

  return (
    <div
      className={`${frame} ${aspect} w-full bg-bone`}
      onClick={canEdit ? onEditClick : undefined}
      title={canEdit ? 'Click to add media' : undefined}
      role={canEdit ? 'button' : undefined}
    >
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${PALETTE.mode}22 1px, transparent 0)`,
          backgroundSize: '22px 22px',
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        {video ? (
          <PlayBadge inline />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-mode/25 bg-white/60">
            <ImageIcon className="h-5 w-5 text-mode" />
          </span>
        )}
        <span className="text-sm font-medium text-ink/70">{label}</span>
        {hint && (
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
            {hint}
          </span>
        )}
        {canEdit && (
          <span className="mt-1 text-xs font-semibold text-mode">
            Click to add / edit
          </span>
        )}
      </div>
      {editBadge}
    </div>
  );
};

const PlayBadge: React.FC<{ inline?: boolean }> = ({ inline = false }) => (
  <span
    className={
      inline
        ? 'flex h-14 w-14 items-center justify-center rounded-full border border-mode/30 bg-white/70'
        : 'absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full border border-bone/40 bg-ink/30 backdrop-blur-sm'
    }
  >
    <Play
      className={inline ? 'h-6 w-6 text-mode' : 'h-7 w-7 text-bone'}
      fill="currentColor"
    />
  </span>
);
