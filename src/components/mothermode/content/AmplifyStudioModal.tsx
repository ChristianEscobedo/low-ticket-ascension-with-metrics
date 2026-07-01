'use client';

/**
 * The full-screen amplify studio. Launched from the Amplify tab so the variant
 * matrix gets room: the command box sits in a left rail and the generated hooks,
 * angles, bodies, CTAs, and the version assembler fill a roomy right canvas.
 * It renders the same AmplifyPanel in its 'studio' layout, so this changes the
 * surface, not the logic.
 */
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { FORMAT_LABEL, type ContentPiece } from '@/lib/mothermode/content';
import { AmplifyPanel } from './AmplifyPanel';

export const AmplifyStudioModal: React.FC<{
  open: boolean;
  onClose: () => void;
  piece: ContentPiece;
  offerUrl?: string;
  offerSlug: string;
  onAppendHooks: (hooks: string[]) => void;
  onUseBody: (body: string) => void;
  onGenerated: (pieces: ContentPiece[]) => void;
}> = ({
  open,
  onClose,
  piece,
  offerUrl,
  offerSlug,
  onAppendHooks,
  onUseBody,
  onGenerated,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative m-auto flex h-[92vh] w-[min(1200px,96vw)] flex-col overflow-hidden rounded-2xl border border-ink/15 bg-bone shadow-2xl">
        <header className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
          <div>
            <div className="font-display text-lg text-ink">Amplify studio</div>
            <div className="text-xs text-ink/45">
              {FORMAT_LABEL[piece.format]} {'\u00b7'} {piece.theme}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink/60 hover:bg-ink/10"
            aria-label="Close amplify studio"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1">
          <AmplifyPanel
            piece={piece}
            offerUrl={offerUrl}
            offerSlug={offerSlug}
            layout="studio"
            onAppendHooks={onAppendHooks}
            onUseBody={onUseBody}
            onGenerated={onGenerated}
          />
        </div>
      </div>
    </div>
  );
};
