
/**
 * Semantic evidence search (roadmap 4.7): OpenAI embeddings over the
 * evidence base. The write path is best-effort (a dead lane never blocks
 * a pin); the search is embed-the-query + JS cosine scoring over the
 * session's stored embeddings (dozens of rows — pgvector takes over when
 * the corpus outgrows that).
 *
 * Server-only: reads the OpenAI key through runtime-config.
 */
import { createClient } from '@supabase/supabase-js';
import { listEvidence } from './store';
import type { ResearchEvidence } from './evidence';

const TABLE = 'mothermode_research_evidence_embeddings';
const MODEL = 'text-embedding-3-small';

/** Cosine similarity between two vectors (pure; 0 when degenerate). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Rank items by similarity to the query vector, best first (pure). */
export function rankBySimilarity<T>(
  items: T[],
  vectorOf: (item: T) => number[],
  query: number[],
): Array<{ item: T; score: number }> {
  return items
    .map((item) => ({ item, score: cosineSimilarity(query, vectorOf(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Embed one text. null when no OpenAI key is configured or the call fails. */
export async function embedText(text: string): Promise<number[] | null> {
  const clean = (text || '').trim().slice(0, 2000);
  if (!clean) return null;
  // Lazy: the integrations layer boots a service client at import time, so
  // it only loads on a real embed call (keeps unit tests off it).
  const { getOpenAiKey } = await import('@/utils/integrations/runtime-config');
  const key = await getOpenAiKey();
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, input: clean }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    const vector = json?.data?.[0]?.embedding;
    return Array.isArray(vector) && vector.every((n) => typeof n === 'number')
      ? vector
      : null;
  } catch {
    return null;
  }
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

/** Store one evidence row's embedding. Best-effort: failures swallow. */
export async function embedEvidenceRow(input: {
  evidenceId: string;
  body: string;
}): Promise<void> {
  const vector = await embedText(input.body);
  if (!vector) return;
  try {
    await (serviceClient() as any).from(TABLE).upsert({
      evidence_id: input.evidenceId,
      embedding: JSON.stringify(vector),
      model: MODEL,
    });
  } catch {
    /* the lane never blocks a pin */
  }
}

/** Backfill a session's evidence rows that have no embedding yet. */
export async function backfillEvidenceEmbeddings(
  sessionId: string,
): Promise<number> {
  const evidence = await listEvidence(sessionId);
  if (evidence.length === 0) return 0;
  let done = 0;
  for (const e of evidence) {
    try {
      const { data } = await (serviceClient() as any)
        .from(TABLE)
        .select('evidence_id')
        .eq('evidence_id', e.id)
        .maybeSingle();
      if (data) continue;
      const vector = await embedText(e.body);
      if (!vector) continue;
      await (serviceClient() as any).from(TABLE).insert({
        evidence_id: e.id,
        embedding: JSON.stringify(vector),
        model: MODEL,
      });
      done += 1;
    } catch {
      /* one bad row never stops the backfill */
    }
  }
  return done;
}

/**
 * Semantic search over a session's evidence: embed the query, score the
 * stored embeddings JS-side, return the ranked rows (best first). [] when
 * the lane is unconfigured or nothing is embedded yet.
 */
export async function searchEvidenceSemantically(input: {
  sessionId: string;
  query: string;
  limit?: number;
}): Promise<Array<{ evidence: ResearchEvidence; score: number }>> {
  const queryVector = await embedText(input.query);
  if (!queryVector) return [];
  const evidence = await listEvidence(input.sessionId);
  if (evidence.length === 0) return [];
  const { data, error } = await (serviceClient() as any)
    .from(TABLE)
    .select('evidence_id, embedding')
    .in(
      'evidence_id',
      evidence.map((e) => e.id),
    );
  if (error || !data) return [];
  const vectors = new Map<string, number[]>();
  for (const row of data as Array<{ evidence_id: string; embedding: unknown }>) {
    const v =
      typeof row.embedding === 'string'
        ? (JSON.parse(row.embedding) as number[])
        : (row.embedding as number[]);
    if (Array.isArray(v)) vectors.set(row.evidence_id, v);
  }
  const ranked = rankBySimilarity(
    evidence.filter((e) => vectors.has(e.id)),
    (e) => vectors.get(e.id) ?? [],
    queryVector,
  ).slice(0, Math.max(1, Math.min(10, input.limit ?? 5)));
  return ranked.map((r) => ({ evidence: r.item, score: r.score }));
}
