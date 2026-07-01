'use client';

/**
 * A single editable copy field (caption or body) with an AI rewrite. The
 * reviewer edits the text directly, optionally notes what to change, and the
 * rewrite returns on-voice copy (no em dashes, no NO-list words) in place.
 */
import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { RichTextField } from './RichTextField';
import { aiRewriteText, type AiContext } from './aiClient';
import {
  AiError,
  InstructionsInput,
  Spinner,
  aiBtnGhost,
  useAiAction,
} from './AiControls';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';

export const RewriteField: React.FC<{
  label: string;
  field: 'caption' | 'body';
  /** The current edited value (empty means the catalog text is in use). */
  value: string;
  /** Catalog text rewritten when the field has not been edited yet. */
  fallback: string;
  placeholder: string;
  minHeight: string;
  context: AiContext;
  /** Text model id from the Edit-tab selector. Empty for Auto. */
  model?: string;
  onChange: (value: string) => void;
}> = ({
  label,
  field,
  value,
  fallback,
  placeholder,
  minHeight,
  context,
  model,
  onChange,
}) => {
  const [instructions, setInstructions] = useState('');
  const { busy, error, run } = useAiAction();

  const rewrite = () =>
    run(async () => {
      const text = await aiRewriteText({
        field,
        text: value.trim() ? value : fallback,
        instructions: instructions.trim() || undefined,
        context,
        model: model || undefined,
      });
      onChange(text);
      setInstructions('');
    });

  return (
    <div>
      <span className={labelCls}>{label}</span>
      <RichTextField
        value={value}
        placeholder={placeholder}
        minHeight={minHeight}
        onChange={onChange}
      />
      <div className="mt-2 flex items-center gap-2">
        <InstructionsInput value={instructions} onChange={setInstructions} />
        <button
          onClick={rewrite}
          disabled={busy}
          className={`${aiBtnGhost} shrink-0`}
        >
          {busy ? <Spinner /> : <Wand2 className="h-3.5 w-3.5" />}
          {busy ? 'Rewriting' : 'Rewrite'}
        </button>
      </div>
      <AiError message={error} />
    </div>
  );
};
