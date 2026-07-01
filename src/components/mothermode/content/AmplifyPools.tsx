'use client';

/**
 * Result pools for a multi-part Refine run. One section per part (hooks, angles,
 * CTAs, bodies), each listing its variants with Copy and, where it makes sense,
 * Apply (and "Add all" for hooks/angles). CTAs are copy-only because there is no
 * CTA field in the edit store. Every variant carries a voice-pass chip from the
 * compliance engine, with an inline Fix for the deterministic breaks (dashes,
 * exclamation points). Empty parts render a short "nothing usable" note.
 */
import React, { useState } from 'react';
import {
  Copy,
  Check,
  Plus,
  PlusSquare,
  ShieldCheck,
  AlertTriangle,
  Wand2,
} from 'lucide-react';
import { aiBtnGhost } from './AiControls';
import {
  ALL_TEXT_DIMENSIONS,
  AMPLIFY_PARTS,
  checkText,
  applyFixes,
  type AmplifyTextDimension,
} from '@/lib/mothermode/content';

/**
 * A compliance badge for one variant: a brass "Voice pass" when clean, or a
 * Mode-aubergine note with the rule breaks on hover. When a break is one of the
 * deterministic ones, an inline Fix repairs it in place via onFix.
 */
export const VoiceChip: React.FC<{ text: string; onFix?: () => void }> = ({
  text,
  onFix,
}) => {
  const issues = checkText(text);
  if (issues.length === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass/5 px-2 py-0.5 text-[11px] font-medium text-brass">
        <ShieldCheck className="h-3 w-3" />
        Voice pass
      </span>
    );
  const errors = issues.filter((i) => i.severity === 'error').length;
  const fixable = issues.some((i) => i.fixable);
  const title = issues.map((i) => i.message).join('\n');
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        title={title}
        className="inline-flex items-center gap-1 rounded-full border border-mode/30 bg-mode/5 px-2 py-0.5 text-[11px] font-medium text-mode"
      >
        <AlertTriangle className="h-3 w-3" />
        {errors
          ? `${errors} to fix`
          : `${issues.length} note${issues.length > 1 ? 's' : ''}`}
      </span>
      {fixable && onFix && (
        <button onClick={onFix} className={aiBtnGhost} title="Fix dashes and exclamation points">
          <Wand2 className="h-3.5 w-3.5" />
          Fix
        </button>
      )}
    </span>
  );
};

/** Apply-button label per part. CTAs are copy-only (undefined). */
const APPLY_LABEL: Record<AmplifyTextDimension, string | undefined> = {
  hooks: 'Add hook',
  angles: 'Add as hook',
  bodies: 'Use body',
  ctas: undefined,
};

const PART_LABEL: Record<AmplifyTextDimension, string> = {
  hooks: 'Hooks',
  angles: 'Angles',
  ctas: 'CTAs',
  bodies: 'Bodies',
};

export const AmplifyPools: React.FC<{
  pools: Partial<Record<AmplifyTextDimension, string[]>>;
  onApply: (dimension: AmplifyTextDimension, text: string) => void;
  onApplyAll: (dimension: AmplifyTextDimension, texts: string[]) => void;
  /** Replace one variant in place with its deterministically fixed version. */
  onFix?: (dimension: AmplifyTextDimension, index: number, fixed: string) => void;
}> = ({ pools, onApply, onApplyAll, onFix }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  };

  const active = ALL_TEXT_DIMENSIONS.filter((d) => pools[d] !== undefined);
  if (active.length === 0) return null;

  return (
    <div className="space-y-4">
      {active.map((dim) => {
        const items = pools[dim] ?? [];
        const applyLabel = APPLY_LABEL[dim];
        const canApply = applyLabel && (dim === 'hooks' || dim === 'angles');
        return (
          <div key={dim} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
                {PART_LABEL[dim]} · {items.length}
              </p>
              {canApply && items.length > 1 && (
                <button onClick={() => onApplyAll(dim, items)} className={aiBtnGhost}>
                  <PlusSquare className="h-3.5 w-3.5" />
                  Add all
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-ink/12 bg-white/40 px-3 py-2 text-xs text-ink/45">
                Nothing usable came back for this part. Try again.
              </p>
            ) : (
              items.map((text, i) => {
                const key = `${dim}:${i}`;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-ink/12 bg-white/60 p-3 text-sm text-ink"
                  >
                    <p className="whitespace-pre-line">{text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button onClick={() => copy(key, text)} className={aiBtnGhost}>
                        {copied === key ? (
                          <Check className="h-3.5 w-3.5 text-brass" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copied === key ? 'Copied' : 'Copy'}
                      </button>
                      {applyLabel && (
                        <button onClick={() => onApply(dim, text)} className={aiBtnGhost}>
                          <Plus className="h-3.5 w-3.5" />
                          {applyLabel}
                        </button>
                      )}
                      <span className="ml-auto">
                        <VoiceChip
                          text={text}
                          onFix={
                            onFix
                              ? () => onFix(dim, i, applyFixes(text))
                              : undefined
                          }
                        />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};

/** The display label for a part, exported for the panel's plan line. */
export function partLabel(dim: AmplifyTextDimension): string {
  return AMPLIFY_PARTS.find((p) => p.value === dim)?.label ?? dim;
}
