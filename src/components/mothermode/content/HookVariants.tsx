'use client';

/**
 * Hook variant editor for the Edit tab. Lists the openers to A/B, lets the
 * reviewer edit any of them, mark one primary (it drives the preview), rewrite
 * the primary, or add a new distinctly different variant with the AI. Catalog
 * hooks seed the list the moment the reviewer touches one, so a bare selection
 * still persists.
 */
import React, { useState } from 'react';
import { Plus, Star, Trash2, Wand2 } from 'lucide-react';
import type { ContentPiece } from '@/lib/mothermode/content';
import {
  clampIndex,
  reviewHooks,
  type PieceEdits,
  type PieceReview,
} from '@/lib/mothermode/content/review';
import { RichTextField } from './RichTextField';
import { aiRewriteText, type AiContext } from './aiClient';
import {
  AiError,
  InstructionsInput,
  Spinner,
  aiBtnGhost,
  aiBtnSolid,
  useAiAction,
} from './AiControls';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';

/** The catalog hook variants: the explicit list, else the single hook. */
function catalogHooks(piece: ContentPiece): string[] {
  return piece.hooks && piece.hooks.length > 0 ? piece.hooks : [piece.hook];
}

export const HookVariants: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  context: AiContext;
  /** Text model id from the Edit-tab selector. Empty for Auto. */
  model?: string;
  onPatch: (patch: Partial<PieceEdits>) => void;
}> = ({ piece, review, context, model, onPatch }) => {
  const [instructions, setInstructions] = useState('');
  const { busy, error, run } = useAiAction();

  const edited = reviewHooks(review.edits);
  const hooks = edited.length > 0 ? edited : catalogHooks(piece);
  const active = clampIndex(review.edits?.hookIndex, hooks.length);

  const updateAt = (i: number, value: string) => {
    const next = hooks.map((h, idx) => (idx === i ? value : h));
    onPatch({ hooks: next, hookIndex: clampIndex(active, next.length) });
  };
  const removeAt = (i: number) => {
    const next = hooks.filter((_, idx) => idx !== i);
    onPatch({ hooks: next, hookIndex: Math.min(active, Math.max(0, next.length - 1)) });
  };
  const makePrimary = (i: number) => onPatch({ hooks, hookIndex: i });
  const addBlank = () => onPatch({ hooks: [...hooks, ''], hookIndex: hooks.length });

  const rewrite = () =>
    run(async () => {
      const text = await aiRewriteText({
        field: 'hook',
        text: hooks[active],
        instructions: instructions.trim() || undefined,
        context,
        model: model || undefined,
      });
      updateAt(active, text);
      setInstructions('');
    });
  const addVariant = () =>
    run(async () => {
      const text = await aiRewriteText({
        field: 'hook',
        text: hooks[active],
        instructions: instructions.trim() || undefined,
        variant: true,
        context,
        model: model || undefined,
      });
      onPatch({ hooks: [...hooks, text], hookIndex: hooks.length });
      setInstructions('');
    });

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={labelCls}>Hook variants · {hooks.length}</span>
        <button
          onClick={addBlank}
          className="text-[11px] font-semibold text-mode hover:underline"
        >
          + Add blank
        </button>
      </div>

      <div className="mt-2 space-y-2.5">
        {hooks.map((hook, i) => (
          <div
            key={i}
            className={`rounded-lg border p-2 ${
              i === active ? 'border-mode bg-mode/[0.04]' : 'border-ink/12'
            }`}
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => makePrimary(i)}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                  i === active ? 'text-mode' : 'text-ink/45 hover:text-ink'
                }`}
              >
                <Star className={`h-3 w-3 ${i === active ? 'fill-current' : ''}`} />
                {i === active ? 'Primary' : 'Make primary'}
              </button>
              {hooks.length > 1 && (
                <button
                  onClick={() => removeAt(i)}
                  aria-label={`Remove variant ${i + 1}`}
                  className="text-ink/40 hover:text-ink"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <RichTextField
              value={hook}
              placeholder={piece.hook}
              minHeight="2.75rem"
              onChange={(v) => updateAt(i, v)}
            />
          </div>
        ))}
      </div>

      <div className="mt-2.5 space-y-2">
        <InstructionsInput
          value={instructions}
          onChange={setInstructions}
          placeholder="Anything to change for the rewrite or new variant? (optional)"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={rewrite} disabled={busy} className={aiBtnGhost}>
            {busy ? <Spinner /> : <Wand2 className="h-3.5 w-3.5" />}
            {busy ? 'Working' : 'Rewrite primary'}
          </button>
          <button onClick={addVariant} disabled={busy} className={aiBtnSolid}>
            {busy ? <Spinner /> : <Plus className="h-3.5 w-3.5" />}
            Add variant
          </button>
        </div>
      </div>
      <AiError message={error} />
    </div>
  );
};
