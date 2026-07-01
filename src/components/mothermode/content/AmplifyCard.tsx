'use client';

/**
 * The compact Amplify entry on the Amplify tab. It explains what amplify does in
 * a line and opens the full-screen amplify studio, where the matrix runs and the
 * versions get assembled. This keeps the slide-over calm and moves the wide,
 * visual work to a surface with room, mirroring the image studio pattern.
 */
import React, { useState } from 'react';
import { Maximize2, Sparkles } from 'lucide-react';
import { type ContentPiece } from '@/lib/mothermode/content';
import { aiBtnSolid } from './AiControls';
import { AmplifyStudioModal } from './AmplifyStudioModal';

export const AmplifyCard: React.FC<{
  piece: ContentPiece;
  offerUrl?: string;
  offerSlug: string;
  onAppendHooks: (hooks: string[]) => void;
  onUseBody: (body: string) => void;
  onGenerated: (pieces: ContentPiece[]) => void;
}> = ({ piece, offerUrl, offerSlug, onAppendHooks, onUseBody, onGenerated }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-ink/15 bg-white/50 p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-mode/10 p-2 text-mode">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg text-ink">Amplify</div>
          <p className="mt-1 text-sm text-ink/55">
            Multiply this piece into hooks, angles, bodies, and CTAs, then
            assemble them into versions. Or spin up fresh posts across voices,
            awareness levels, and channels.
          </p>
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
        className={`${aiBtnSolid} mt-4 w-full justify-center py-2.5 text-sm`}
      >
        <Maximize2 className="h-4 w-4" /> Open amplify studio
      </button>

      <AmplifyStudioModal
        open={open}
        onClose={() => setOpen(false)}
        piece={piece}
        offerUrl={offerUrl}
        offerSlug={offerSlug}
        onAppendHooks={onAppendHooks}
        onUseBody={onUseBody}
        onGenerated={onGenerated}
      />
    </div>
  );
};
