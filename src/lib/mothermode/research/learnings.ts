/**
 * Cross-session memory (roadmap 4.4): distilled learnings + the prompt
 * block they ride. The store is admin-only service-role (reads DEGRADE to
 * []); the parser and the block builder are PURE.
 */
import { createClient } from '@supabase/supabase-js';

const TABLE = 'mothermode_research_learnings';
const COLUMNS = 'id, offer_slug, body, source_session_id, created_at';

export interface ResearchLearning {
  id: string;
  offerSlug: string;
  body: string;
  sourceSessionId: string;
  createdAt: string | null;
}

export interface LearningRow {
  id: string;
  offer_slug: string | null;
  body: string | null;
  source_session_id: string | null;
  created_at: string | null;
}

/** Defensive row -> learning. */
export function rowToLearning(row: LearningRow): ResearchLearning {
  return {
    id: row.id,
    offerSlug: (row.offer_slug || '').trim(),
    body: (row.body || '').trim(),
    sourceSessionId: row.source_session_id ?? '',
    createdAt: row.created_at,
  };
}

/**
 * Parse the distiller's output into 3-5 clean one-liners: numbered or
 * bulleted lines, stripped of their markers, capped at 5 and 160 chars
 * each. Junk lines (headers, blanks, chatter) drop out.
 */
export function parseLearnings(text: string): string[] {
  const out: string[] = [];
  for (const raw of (text || '').split('\n')) {
    const line = raw
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (line.length < 12 || line.length > 300) continue;
    if (/^(learnings?|summary|here|these|the following)/i.test(line)) continue;
    out.push(line.length <= 160 ? line : `${line.slice(0, 159)}…`);
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * The prompt block: what past research already proved, one line each.
 * '' when there is nothing to say (a fresh offer stays silent).
 */
export function learningsBlock(bodies: string[]): string {
  const clean = bodies.filter((b) => b.trim()).slice(0, 5);
  if (clean.length === 0) return '';
  return [
    'CROSS-SESSION MEMORY (what past research already proved — build on it, do not re-learn it):',
    ...clean.map((b) => `- ${b}`),
  ].join('\n');
}

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Replace an offer's learnings from one distillation (delete + insert). */
export async function upsertLearnings(input: {
  offerSlug: string;
  sourceSessionId: string;
  bodies: string[];
}): Promise<ResearchLearning[]> {
  const offerSlug = (input.offerSlug || '').trim();
  const bodies = input.bodies.filter((b) => b.trim()).slice(0, 5);
  if (bodies.length === 0) return [];
  // One distillation replaces the offer's previous set from the SAME
  // session lineage: simplest honest rule is replace-all for the offer.
  await (serviceClient() as any)
    .from(TABLE)
    .delete()
    .eq('offer_slug', offerSlug);
  const rows = bodies.map((body) => ({
    offer_slug: offerSlug,
    body,
    source_session_id: input.sourceSessionId,
  }));
  const { data, error } = await (serviceClient() as any)
    .from(TABLE)
    .insert(rows)
    .select(COLUMNS);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LearningRow[]).map(rowToLearning);
}

/** Admin read: an offer's learnings (or house-wide when ''), newest first. */
export async function listLearnings(
  offerSlug: string,
): Promise<ResearchLearning[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('offer_slug', (offerSlug || '').trim())
      .order('created_at', { ascending: false })
      .limit(5);
    if (error || !data) return [];
    return (data as LearningRow[]).map(rowToLearning);
  } catch {
    return [];
  }
}
