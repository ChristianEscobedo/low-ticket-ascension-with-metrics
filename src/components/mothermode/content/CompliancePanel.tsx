'use client';

/**
 * Compliance tab: local brand + platform score, AI agent score, deterministic
 * fixes, and AI rewrite of non-compliant ads/organic copy into editable fields.
 */
import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Wand2,
  Sparkles,
  Shield,
} from 'lucide-react';
import {
  effectivePiece,
  complianceFixPatch,
  isEditableField,
  aiCompliancePatchToEdits,
  scoreLocalCompliance,
  platformPackFor,
  type ComplianceIssue,
  type ComplianceScorecard,
  type ContentPiece,
  TEXT_MODELS,
  AUTO_MODEL,
} from '@/lib/mothermode/content';
import type {
  PieceEdits,
  PieceReview,
  StoredComplianceReport,
} from '@/lib/mothermode/content/review';
import {
  AiError,
  Spinner,
  aiBtnGhost,
  aiBtnSolid,
  useAiAction,
} from './AiControls';
import {
  aiComplianceFix,
  aiComplianceScore,
  type AiCompliancePiece,
} from './aiClient';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';

function fieldLabel(field: string): string {
  return field
    .replace(/\[(\d+)\]/g, (_, i) => ` ${Number(i) + 1}`)
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function gradeColor(grade: string): string {
  if (grade === 'pass') return 'text-brass border-brass/40 bg-brass/5';
  if (grade === 'fail') return 'text-mode border-mode/30 bg-mode/5';
  return 'text-ink/70 border-ink/20 bg-ink/5';
}

function severityDot(sev: string): string {
  if (sev === 'block') return 'bg-mode';
  if (sev === 'warn') return 'bg-brass';
  return 'bg-ink/30';
}

function toAgentPiece(p: ContentPiece): AiCompliancePiece {
  return {
    hook: p.hook,
    hooks: p.hooks,
    caption: p.caption,
    body: p.body,
    cta: p.cta,
    title: p.title,
    theme: p.theme,
    tone: p.tone,
    platform: p.platform,
    format: p.format,
    kind: p.kind,
    adPrimaryText: p.ad?.primaryText,
    adHeadline: p.ad?.headline,
    adDescription: p.ad?.description,
    emailSubject: p.email?.subject,
    emailPreheader: p.email?.preheader,
  };
}

function cardToStored(c: ComplianceScorecard): StoredComplianceReport {
  return {
    score: c.score,
    grade: c.grade,
    brandScore: c.brandScore,
    platformScore: c.platformScore,
    claimScore: c.claimScore,
    blockCount: c.blockCount,
    warnCount: c.warnCount,
    noteCount: c.noteCount,
    summary: c.summary,
    platformPack: c.platformPack,
    isAd: c.isAd,
    scoredAt: c.scoredAt,
    model: c.model,
    issues: c.issues.map((i) => ({
      id: i.id,
      severity: i.severity,
      source: i.source,
      field: i.field,
      message: i.message,
      match: i.match,
      suggestion: i.suggestion,
      fixable: i.fixable,
    })),
  };
}

function storedToCard(
  s: StoredComplianceReport,
  fallback: ComplianceScorecard,
): ComplianceScorecard {
  return {
    ...fallback,
    score: s.score,
    grade: s.grade,
    brandScore: s.brandScore ?? fallback.brandScore,
    platformScore: s.platformScore ?? fallback.platformScore,
    claimScore: s.claimScore ?? fallback.claimScore,
    blockCount: s.blockCount ?? fallback.blockCount,
    warnCount: s.warnCount ?? fallback.warnCount,
    noteCount: s.noteCount ?? fallback.noteCount,
    summary: s.summary ?? fallback.summary,
    platformPack: (s.platformPack as ComplianceScorecard['platformPack']) ||
      fallback.platformPack,
    isAd: s.isAd ?? fallback.isAd,
    scoredAt: s.scoredAt,
    model: s.model,
    issues: (s.issues as ComplianceIssue[])?.length
      ? (s.issues as ComplianceIssue[])
      : fallback.issues,
  };
}

const ScoreRing: React.FC<{ score: number; grade: string }> = ({
  score,
  grade,
}) => (
  <div
    className={`flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 ${gradeColor(grade)}`}
  >
    <span className="font-display text-xl font-semibold leading-none">
      {score}
    </span>
    <span className="text-[9px] uppercase tracking-wider opacity-70">
      {grade}
    </span>
  </div>
);

const IssueRow: React.FC<{ v: ComplianceIssue }> = ({ v }) => (
  <li className="flex flex-col gap-0.5 py-1.5">
    <div className="flex flex-wrap items-baseline gap-2 text-[13px] text-ink">
      <span
        className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${severityDot(v.severity)}`}
      />
      <span className="rounded-full border border-ink/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/45">
        {v.source}
      </span>
      <span className="text-[10px] uppercase text-ink/40">{v.severity}</span>
      <span>{v.message}</span>
    </div>
    {v.match ? (
      <span className="pl-3.5 font-mono text-[11px] text-ink/45">
        “{v.match}”
      </span>
    ) : null}
    {v.suggestion ? (
      <span className="pl-3.5 text-[12px] text-ink/55">Try: {v.suggestion}</span>
    ) : null}
  </li>
);

const FieldGroup: React.FC<{ field: string; items: ComplianceIssue[] }> = ({
  field,
  items,
}) => (
  <div className="rounded-lg border border-ink/10 bg-white/50 p-3">
    <div className={labelCls}>{fieldLabel(field)}</div>
    <ul className="mt-1 divide-y divide-ink/5">
      {items.map((v, i) => (
        <IssueRow key={`${v.id}-${i}`} v={v} />
      ))}
    </ul>
  </div>
);

export const CompliancePanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  onEditPatch: (patch: Partial<PieceEdits>) => void;
  onReviewChange?: (next: PieceReview) => void;
  offerSlug?: string;
}> = ({ piece, review, onEditPatch, onReviewChange }) => {
  const edits = review.edits;
  const live = useMemo(() => effectivePiece(piece, edits), [piece, edits]);
  const local = useMemo(() => scoreLocalCompliance(live), [live]);

  const [agentCard, setAgentCard] = useState<ComplianceScorecard | null>(() =>
    review.compliance
      ? storedToCard(review.compliance, local)
      : null,
  );
  const [changelog, setChangelog] = useState<string[]>([]);
  const [model, setModel] = useState(AUTO_MODEL);
  const { busy, error, run } = useAiAction();

  // Prefer last agent run when present; always recompute local for Fix safe.
  const display = agentCard ?? local;
  const pack = platformPackFor(piece.platform);

  const here: Record<string, ComplianceIssue[]> = {};
  const source: Record<string, ComplianceIssue[]> = {};
  for (const v of display.issues) {
    const bucket = isEditableField(v.field) ? here : source;
    (bucket[v.field] ??= []).push(v);
  }

  const fixPatch = useMemo(
    () => complianceFixPatch(piece, edits),
    [piece, edits],
  );
  const canFixSafe = Object.keys(fixPatch).length > 0;
  const needsAgent =
    display.blockCount > 0 ||
    display.issues.some((i) => i.fixable === 'ai');

  const persistCard = (card: ComplianceScorecard) => {
    setAgentCard(card);
    if (onReviewChange) {
      onReviewChange({ ...review, compliance: cardToStored(card) });
    }
  };

  const runAgent = () =>
    run(async () => {
      const card = await aiComplianceScore({
        piece: toAgentPiece(live),
        model: model || undefined,
      });
      persistCard(card as ComplianceScorecard);
      setChangelog([]);
    });

  const fixWithAgent = () =>
    run(async () => {
      const result = await aiComplianceFix({
        piece: toAgentPiece(live),
        issues: display.issues.filter(
          (i) => i.severity === 'block' || i.severity === 'warn',
        ),
        model: model || undefined,
      });
      const patch = aiCompliancePatchToEdits(result.patch);
      if (Object.keys(patch).length === 0) {
        throw new Error('Agent returned no editable changes');
      }
      onEditPatch(patch);
      setChangelog(result.changelog);
      // Re-score locally after apply (edits prop updates on next render; score now with patch).
      const nextLive = effectivePiece(piece, { ...edits, ...patch });
      const nextLocal = scoreLocalCompliance(nextLive);
      persistCard({
        ...nextLocal,
        scoredAt: new Date().toISOString(),
        model: result.model,
        summary: `Agent fixed ${Object.keys(patch).length} field(s). Local re-score: ${nextLocal.score}.`,
      });
    });

  const cleanPass =
    display.grade === 'pass' &&
    display.blockCount === 0 &&
    display.warnCount === 0;

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-ink/10 bg-white/60 p-4">
        <ScoreRing score={display.score} grade={display.grade} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base text-ink">Compliance</span>
            <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink/50">
              {pack}
              {display.isAd ? ' · ad' : ' · organic'}
            </span>
            {agentCard?.model ? (
              <span className="text-[10px] text-ink/40">
                Agent · {agentCard.model}
              </span>
            ) : (
              <span className="text-[10px] text-ink/40">Local heuristics</span>
            )}
          </div>
          <p className="text-sm text-ink/70">{display.summary}</p>
          <div className="flex flex-wrap gap-3 text-[11px] text-ink/50">
            <span>Brand {display.brandScore}</span>
            <span>Platform {display.platformScore}</span>
            <span>Claims {display.claimScore}</span>
            {display.blockCount > 0 && (
              <span className="text-mode">{display.blockCount} block</span>
            )}
            {display.warnCount > 0 && (
              <span className="text-brass">{display.warnCount} warn</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-ink/50">
          Model
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
        <button
          type="button"
          onClick={runAgent}
          disabled={busy}
          className={aiBtnSolid}
        >
          {busy ? <Spinner /> : <Shield className="h-3.5 w-3.5" />}
          Run compliance agent
        </button>
        <button
          type="button"
          onClick={() => canFixSafe && onEditPatch(fixPatch)}
          disabled={!canFixSafe || busy}
          className={aiBtnGhost}
          title="Remove dashes and exclamation points"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Fix what is safe
        </button>
        <button
          type="button"
          onClick={fixWithAgent}
          disabled={busy || (!needsAgent && cleanPass)}
          className={aiBtnGhost}
          title="AI rewrite of blocked and warned fields"
        >
          {busy ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
          Fix with agent
        </button>
      </div>
      <AiError message={error} />

      {changelog.length > 0 && (
        <div className="rounded-lg border border-brass/30 bg-brass/5 px-3 py-2 text-xs text-ink/70">
          <div className={labelCls}>Agent changes</div>
          <ul className="mt-1 list-inside list-disc">
            {changelog.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {cleanPass ? (
        <div className="flex items-center gap-2 rounded-lg border border-brass/40 bg-brass/5 px-3 py-2.5 text-sm font-medium text-brass">
          <ShieldCheck className="h-4 w-4" />
          Pass. Brand voice and platform heuristics look clear.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mode/30 bg-mode/5 px-2.5 py-1 text-[12px] font-medium text-mode">
              <AlertTriangle className="h-3.5 w-3.5" />
              {display.blockCount} to fix
              {display.warnCount
                ? `, ${display.warnCount} note${display.warnCount > 1 ? 's' : ''}`
                : ''}
            </span>
          </div>

          {Object.keys(here).length > 0 && (
            <div className="space-y-2">
              <div className={labelCls}>Editable here</div>
              {Object.entries(here).map(([field, items]) => (
                <FieldGroup key={field} field={field} items={items} />
              ))}
            </div>
          )}

          {Object.keys(source).length > 0 && (
            <div className="space-y-2">
              <div className={labelCls}>Source / catalog fields</div>
              {Object.entries(source).map(([field, items]) => (
                <FieldGroup key={field} field={field} items={items} />
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-ink/40">
        Local checks run instantly (brand NO-list, dashes, platform claim
        patterns). The agent adds deeper ad-policy judgment for {pack}
        {display.isAd ? ' paid placements' : ''}. Fixes write into your edit
        store (hooks, caption, body, ad fields, email).
      </p>
    </div>
  );
};
