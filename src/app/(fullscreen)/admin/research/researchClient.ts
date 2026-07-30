/**
 * Research Lab browser client: CRUD wrappers plus the SSE chat-turn reader.
 * Client-safe (fetch only) — every route enforces admin auth server-side.
 */
import type {
  ResearchArtifact,
  ResearchMessage,
  ResearchSession,
  ToolCallRecord,
  HandedOffRef,
} from '@/lib/mothermode/research/types';
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
  | { type: 'error'; error: string };

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
