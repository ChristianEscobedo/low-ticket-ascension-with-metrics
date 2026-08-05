/**
 * Research Lab browser client: CRUD wrappers plus the SSE chat-turn reader.
 * Client-safe (fetch only) — every route enforces admin auth server-side.
 */
import type {
  ResearchArtifact,
  ResearchArtifactVersion,
  ResearchMessage,
  ResearchSession,
  ToolCallRecord,
  HandedOffRef,
} from '@/lib/mothermode/research/types';
import type { ResearchEvidence } from '@/lib/mothermode/research/evidence';
import type { PhraseBankRow } from '@/lib/mothermode/research/phraseBank';
import type { ResearchIntake } from '@/lib/mothermode/research/intake';

const CRUD = '/api/admin/mothermode-research';
const CHAT = '/api/mothermode/research/chat';
const HANDOFF = '/api/admin/mothermode-research/handoff';
const INTAKE = '/api/admin/mothermode-research/intake';

async function readJson<T>(res: Response): Promise<T> {
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Sessions + artifacts CRUD
// ---------------------------------------------------------------------------

export async function listSessions(): Promise<ResearchSession[]> {
  const res = await fetch(CRUD, { cache: 'no-store' });
  const json = await readJson<{ sessions: ResearchSession[] }>(res);
  return json.sessions;
}

export async function loadSession(id: string): Promise<{
  session: ResearchSession;
  messages: ResearchMessage[];
  artifacts: ResearchArtifact[];
  evidence: ResearchEvidence[];
  phraseBank: PhraseBankRow[];
  usage: { paidRunsToday: number; estCostCentsToday: number };
}> {
  const res = await fetch(`${CRUD}?id=${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  return readJson(res);
}

export async function upsertSession(input: {
  id?: string;
  title?: string;
  offerSlug?: string;
  intake?: ResearchIntake;
  status?: string;
}): Promise<ResearchSession> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'session', ...input }),
  });
  const json = await readJson<{ session: ResearchSession }>(res);
  return json.session;
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'delete-session', id }),
  });
  await readJson(res);
}

export async function upsertArtifact(input: {
  id: string;
  title?: string;
  markdown?: string;
  status?: string;
}): Promise<ResearchArtifact> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'artifact', ...input }),
  });
  const json = await readJson<{ artifact: ResearchArtifact }>(res);
  return json.artifact;
}

export async function deleteArtifact(id: string): Promise<void> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'delete-artifact', id }),
  });
  await readJson(res);
}

/** Pin selected text into the evidence base with its provenance. */
export async function pinEvidence(input: {
  sessionId: string;
  artifactId?: string;
  offerSlug?: string;
  kind?: string;
  body: string;
  sourceUrl?: string;
  sourceTool?: string;
  expert?: string;
}): Promise<ResearchEvidence> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'pin-evidence', ...input }),
  });
  const json = await readJson<{ evidence: ResearchEvidence }>(res);
  return json.evidence;
}

/** Semantic evidence search (4.7): ranked rows with scores. */
export async function searchEvidence(
  sessionId: string,
  query: string,
): Promise<Array<{ evidence: ResearchEvidence; score: number }>> {
  const res = await fetch(
    `${CRUD}?id=${encodeURIComponent(sessionId)}&evidenceSearch=${encodeURIComponent(query)}`,
    { cache: 'no-store' },
  );
  const json = await readJson<{
    results: Array<{ evidence: ResearchEvidence; score: number }>;
  }>(res);
  return json.results;
}

/** Backfill embeddings for a session's evidence (4.7). */
export async function embedEvidence(
  sessionId: string,
): Promise<{ embedded: number }> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'embed-evidence', sessionId }),
  });
  return readJson(res);
}

export async function deleteEvidence(id: string): Promise<void> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'delete-evidence', id }),
  });
  await readJson(res);
}

/** An artifact's version history (append-only snapshots), newest first. */
export async function listArtifactVersions(
  artifactId: string,
): Promise<ResearchArtifactVersion[]> {
  const res = await fetch(
    `${CRUD}?artifactVersions=${encodeURIComponent(artifactId)}`,
    { cache: 'no-store' },
  );
  const json = await readJson<{ versions: ResearchArtifactVersion[] }>(res);
  return json.versions;
}

// ---------------------------------------------------------------------------
// Intake engines (suggest from offer / find research context)
// ---------------------------------------------------------------------------

export async function runIntakeEngine(input: {
  mode: 'suggest' | 'find';
  sessionId?: string;
  offerSlug?: string;
  goal?: string;
  scope?: 'broad' | 'specific';
  apply?: boolean;
}): Promise<{
  intake: ResearchIntake;
  sources: string[];
  session?: ResearchSession;
}> {
  const res = await fetch(INTAKE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readJson(res);
}

/** Re-verify the session's research brief: one fresh turn, then the diff. */
export async function reverifySession(sessionId: string): Promise<{
  summary: string;
  diff: { added: string[]; removed: string[]; held: number };
  artifactId: string;
}> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'reverify', sessionId }),
  });
  return readJson(res);
}

/** Post-publish learning (4.6): the analyst's outcome digest, lineage-linked
 *  to the research that produced the work. */
export async function runOutcomeDigest(sessionId: string): Promise<{
  artifactId: string;
  parentArtifactId: string;
}> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'outcome', sessionId }),
  });
  return readJson(res);
}

/** Distill the session's learnings into cross-session memory. */
export async function distillSession(sessionId: string): Promise<{
  learnings: string[];
}> {
  const res = await fetch(CRUD, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity: 'distill', sessionId }),
  });
  return readJson(res);
}

/** Related books/products with working Amazon links, from the brief's seeds. */
export async function suggestProducts(input: {
  sessionId?: string;
  offerSlug?: string;
  goal?: string;
  categoryKeywords?: string[];
  audience?: string;
}): Promise<{ products: Array<{ title: string; link: string }> }> {
  const res = await fetch(INTAKE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'products', ...input }),
  });
  return readJson(res);
}

// ---------------------------------------------------------------------------
// Handoff
// ---------------------------------------------------------------------------

export async function runHandoff(input: {
  sessionId: string;
  artifactId: string;
  target: HandedOffRef['kind'];
  generate?: boolean;
}): Promise<{ handedOffTo: HandedOffRef; artifact: ResearchArtifact }> {
  const res = await fetch(HANDOFF, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readJson(res);
}

// ---------------------------------------------------------------------------
// Chat turn (SSE)
// ---------------------------------------------------------------------------

export type ResearchStreamEvent =
  | { type: 'session'; session: ResearchSession }
  | { type: 'status'; text: string }
  | { type: 'tool'; call: ToolCallRecord }
  | { type: 'artifact'; artifact: ResearchArtifact }
  | { type: 'message'; message: ResearchMessage }
  | { type: 'done' }
  | { type: 'error'; error: string }
  | { type: 'text-delta'; text: string };

/**
 * POST one user message and stream the turn. `onEvent` fires for every SSE
 * payload; rejects on transport/HTTP failure (an {type:'error'} event is the
 * in-stream failure path and does NOT reject).
 */
export async function streamChatTurn(opts: {
  sessionId?: string;
  message: string;
  model?: string;
  offerSlug?: string;
  onEvent: (event: ResearchStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(CHAT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: opts.sessionId || undefined,
      message: opts.message,
      model: opts.model || undefined,
      offerSlug: opts.offerSlug || undefined,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const json: any = await res.json().catch(() => ({}));
    throw new Error(json?.error || `Chat failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flush = (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = frame
        .split('\n')
        .find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        const event = JSON.parse(line.slice(6)) as ResearchStreamEvent;
        opts.onEvent(event);
      } catch {
        /* a malformed frame is skipped, not fatal */
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      flush(decoder.decode(value, { stream: true }));
    }
    flush(decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
