'use client';

/**
 * The compliance pass for the open piece. It checks the live copy (the
 * reviewer's edits over the catalog) against the brand voice, summarizes the
 * verdict, and lists every break grouped by field. One click applies the
 * deterministic fixes (dashes, exclamation points) to the editable copy and
 * persists them through the edits store; banned words and ALL CAPS are listed
 * with a recommendation for a human or AI rewrite.
 */
import React, { useMemo } from 'react';
import { ShieldCheck, AlertTriangle, Wand2 } from 'lucide-react';
import {
  checkPiece,
  effectivePiece,
  complianceFixPatch,
  isEditableField,
  type FieldViolation,
  type ContentPiece,
} from '@/lib/mothermode/content';
import type { PieceEdits, PieceReview } from '@/lib/mothermode/content/review';
import { aiBtnSolid } from './AiControls';

/** A friendlier label for a violation's dotted/indexed field path. */
function fieldLabel(field: string): string {
  return field
    .replace(/\[(\d+)\]/g, (_, i) => ` ${Number(i) + 1}`)
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One violation row: the rule message, the offending text, any suggestion. */
const ViolationRow: React.FC<{ v: FieldViolation }> = ({ v }) => (
  <li className="flex flex-col gap-0.5 py-1.5">
    <div className="flex items-baseline gap-2 text-[13px] text-ink">
      <span
        className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
          v.severity === 'error' ? 'bg-mode' : 'bg-brass'
        }`}
      />
      <span>{v.message}</span>
    </div>
    {v.suggestion && (
      <span className="pl-3.5 text-[12px] text-ink/55">Try: {v.suggestion}</span>
    )}
  </li>
);

/** A section of violations under one field heading. */
const FieldGroup: React.FC<{ field: string; items: FieldViolation[] }> = ({
  field,
  items,
}) => (
  <div className="rounded-lg border border-ink/10 bg-white/50 p-3">
    <div className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
      {fieldLabel(field)}
    </div>
    <ul className="mt-1 divide-y divide-ink/5">
      {items.map((v, i) => (
        <ViolationRow key={i} v={v} />
      ))}
    </ul>
  </div>
);

export const CompliancePanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  onEditPatch: (patch: Partial<PieceEdits>) => void;
}> = ({ piece, review, onEditPatch }) => {
  const edits = review.edits;
  const report = useMemo(
    () => checkPiece(effectivePiece(piece, edits)),
    [piece, edits],
  );

  // Split the breaks into what the editor can fix here vs the catalog source.
  const here: Record<string, FieldViolation[]> = {};
  const source: Record<string, FieldViolation[]> = {};
  for (const v of report.violations) {
    const bucket = isEditableField(v.field) ? here : source;
    (bucket[v.field] ??= []).push(v);
  }

  const fixPatch = useMemo(
    () => complianceFixPatch(piece, edits),
    [piece, edits],
  );
  const canFix = Object.keys(fixPatch).length > 0;

  if (report.ok && report.warningCount === 0)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brass/40 bg-brass/5 px-3 py-2.5 text-sm font-medium text-brass">
        <ShieldCheck className="h-4 w-4" />
        Voice pass. The live copy breaks no rule.
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mode/30 bg-mode/5 px-2.5 py-1 text-[12px] font-medium text-mode">
          <AlertTriangle className="h-3.5 w-3.5" />
          {report.errorCount} to fix
          {report.warningCount ? `, ${report.warningCount} note${report.warningCount > 1 ? 's' : ''}` : ''}
        </span>
        <button
          onClick={() => canFix && onEditPatch(fixPatch)}
          disabled={!canFix}
          className={aiBtnSolid}
          title="Remove dashes and exclamation points from the editable copy"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Fix what is safe
        </button>
      </div>

      {Object.keys(here).length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Editable here
          </div>
          {Object.entries(here).map(([field, items]) => (
            <FieldGroup key={field} field={field} items={items} />
          ))}
        </div>
      )}

      {Object.keys(source).length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
            Source copy (edit at the catalog)
          </div>
          {Object.entries(source).map(([field, items]) => (
            <FieldGroup key={field} field={field} items={items} />
          ))}
        </div>
      )}
    </div>
  );
};
