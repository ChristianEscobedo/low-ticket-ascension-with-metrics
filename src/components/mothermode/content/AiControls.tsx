'use client';

/**
 * Shared primitives for the Edit-tab AI controls (image studio, hook variants,
 * single-field rewrite). They keep the busy/error handling and the button and
 * input styling in one place so each control stays small and consistent.
 */
import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * Wrap an async AI call with shared busy and error state. `run` ignores a second
 * call while one is in flight and surfaces a readable message on failure.
 */
export function useAiAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setBusy(false);
      }
    })();
  };
  return { busy, error, setError, run };
}

const aiBtn =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50';
/** Solid aubergine button for the primary action in a control. */
export const aiBtnSolid = `${aiBtn} bg-mode text-bone hover:bg-mode-deep`;
/** Outlined button for the secondary action in a control. */
export const aiBtnGhost = `${aiBtn} border border-ink/15 text-ink/70 hover:border-ink/30`;

/** A small spinning indicator shown inside a busy button. */
export const Spinner: React.FC = () => (
  <Loader2 className="h-3.5 w-3.5 animate-spin" />
);

/** Inline error line, brass-iconed to match the rest of the panel. */
export const AiError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-ink/70">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" />
      <span>{message}</span>
    </p>
  ) : null;

/** A one-line "what to change" input shared by the rewrite controls. */
export const InstructionsInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder ?? 'Anything to change? (optional)'}
    className="w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
  />
);
