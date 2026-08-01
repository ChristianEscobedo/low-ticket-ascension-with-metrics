/**
 * The evidence base (roadmap task 2.1): pinned quotes, phrases, metrics,
 * and notes, persisted with provenance. Pure: no server imports — the
 * store (research/store.ts) does the DB work, the workspace pins from
 * selections, and the tests pin the boundary.
 */

export const EVIDENCE_KINDS = ['quote', 'phrase', 'metric', 'note'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface ResearchEvidence {
  id: string;
  sessionId: string;
  artifactId: string;
  offerSlug: string;
  kind: EvidenceKind;
  /** The pinned text, verbatim. */
  body: string;
  sourceUrl: string;
  /** The tool the text came from ('' for manual pins). */
  sourceTool: string;
  /** The expert slug whose output carried it ('' for manual pins). */
  expert: string;
  createdBy: string;
  createdAt: string | null;
}

export interface ResearchEvidenceRow {
  id: string;
  session_id: string;
  artifact_id: string | null;
  offer_slug: string | null;
  kind: string | null;
  body: string | null;
  source_url: string | null;
  source_tool: string | null;
  expert: string | null;
  created_by: string | null;
  created_at: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function toEvidenceKind(v: unknown): EvidenceKind {
  return v === 'phrase' || v === 'metric' || v === 'note' ? v : 'quote';
}

/** Defensive row -> evidence. */
export function rowToResearchEvidence(
  row: ResearchEvidenceRow,
): ResearchEvidence {
  return {
    id: row.id,
    sessionId: row.session_id,
    artifactId: str(row.artifact_id),
    offerSlug: str(row.offer_slug),
    kind: toEvidenceKind(row.kind),
    body: str(row.body),
    sourceUrl: str(row.source_url),
    sourceTool: str(row.source_tool),
    expert: str(row.expert),
    createdBy: str(row.created_by) || 'agent',
    createdAt: row.created_at,
  };
}

/**
 * Guess the kind from the pinned text: a 1-4 word snippet is a phrase (a
 * "5pm" inside three words is a time reference, not a number), a longer
 * line carrying digits reads as a metric, anything else as a quote. The UI
 * lets the owner override; this is the sane default.
 */
export function inferEvidenceKind(text: string): EvidenceKind {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'note';
  if (clean.split(' ').length <= 4 && clean.length <= 40) return 'phrase';
  if (/\d/.test(clean) && clean.length <= 140) return 'metric';
  return 'quote';
}
