'use client';

/**
 * The compact image entry on the Edit tab. It shows the primary frame at the
 * post's true crop with a count and a quick upload, and one button opens the
 * full-screen image studio where the generating, comparing, and picking happen.
 * This keeps the sheet calm and moves the visual work to a surface with room.
 */
import React, { useRef, useState } from 'react';
import { ImagePlus, Images as ImagesIcon, Maximize2 } from 'lucide-react';
import { type ContentPiece } from '@/lib/mothermode/content';
import {
  clampIndex,
  reviewImages,
  type PieceReview,
} from '@/lib/mothermode/content/review';
import { PreviewMedia } from './previews/shared';
import { aiBtnGhost, aiBtnSolid } from './AiControls';
import { ImageStudioModal, formatAspect } from './ImageStudioModal';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const MULTI_FRAME = ['story', 'carousel', 'idea'];

export const ImagesCard: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  onUpload: (file: File) => void;
  onAddImages: (urls: string[]) => void;
  onRemove: (index: number) => void;
  onSetIndex: (index: number) => void;
}> = ({ piece, review, onUpload, onAddImages, onRemove, onSetIndex }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const images = reviewImages(review);
  const active = clampIndex(review.imageIndex, images.length);
  const noun = MULTI_FRAME.includes(piece.format) ? 'Frame' : 'Image';
  const aspect = formatAspect(piece.format);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={labelCls}>
          {noun}s{images.length > 0 ? ` \u00b7 ${images.length}` : ''}
        </span>
        <button onClick={() => setOpen(true)} className={aiBtnSolid}>
          <Maximize2 className="h-3.5 w-3.5" /> Open image studio
        </button>
      </div>

      <div className="mt-2 overflow-hidden rounded-xl border border-ink/15">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full"
          aria-label="Open image studio"
        >
          <PreviewMedia
            src={images[active]}
            alt={`${noun} ${active + 1}`}
            aspect={aspect}
          />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
        <button onClick={() => fileRef.current?.click()} className={aiBtnGhost}>
          <ImagePlus className="h-3.5 w-3.5" /> Upload {noun.toLowerCase()}
        </button>
        {images.length > 1 && (
          <span className="text-[11px] text-ink/40">
            <ImagesIcon className="mr-1 inline h-3 w-3" />
            {active + 1} of {images.length} primary
          </span>
        )}
      </div>

      <ImageStudioModal
        open={open}
        onClose={() => setOpen(false)}
        piece={piece}
        review={review}
        onUpload={onUpload}
        onAddImages={onAddImages}
        onRemove={onRemove}
        onSetIndex={onSetIndex}
      />
    </div>
  );
};
