/**
 * AssemblyAI transcription client (server-only) — the DEFAULT karaoke pipeline.
 *
 * Better than Whisper for the caption layer: sharper word-level timings, proper
 * punctuation/casing, and speaker labels. The flow is upload (or pass a hosted
 * URL directly — AssemblyAI fetches public URLs itself) → transcript → poll
 * until complete, then flatten `words[]` into our `ReelWord[]` (ms → seconds).
 *
 * Env: `ASSEMBLYAI_API_KEY`. Pure-mapped (no SDK) so it's unit-testable and
 * has zero new dependencies. `transcribeUrl` does the network dance;
 * `wordsFromTranscript` is the pure mapper the tests hit.
 */
import type { ReelWord } from '@/lib/mothermode/reel/types';

const API = 'https://api.assemblyai.com/v2';

export function isAssemblyAiConfigured(): boolean {
  return !!(process.env.ASSEMBLYAI_API_KEY || '').trim();
}

function key(): string {
  return (process.env.ASSEMBLYAI_API_KEY || '').trim();
}

/** The raw word shape AssemblyAI returns (timings in MILLISECONDS). */
interface AaiWord {
  text?: string;
  start?: number;
  end?: number;
  confidence?: number;
  speaker?: string | null;
}

/**
 * Pure mapper: AssemblyAI `words[]` (ms) → our `ReelWord[]` (seconds, 3dp).
 * Drops empty words and any word whose end precedes its start; clamps to the
 * 60-char word cap the reel model uses everywhere else.
 */
export function wordsFromTranscript(raw: unknown): ReelWord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      const o = w && typeof w === 'object' ? (w as AaiWord) : {};
      const word = typeof o.text === 'string' ? o.text.trim() : '';
      const startMs = typeof o.start === 'number' ? o.start : 0;
      const endMs = typeof o.end === 'number' ? o.end : startMs;
      if (!word || endMs < startMs) return null;
      // ms → s, 3 decimal places (the centisecond precision the burn-in relies on).
      const start = Math.round(startMs) / 1000;
      const end = Math.round(endMs) / 1000;
      return { word: word.slice(0, 60), start, end };
    })
    .filter((w): w is ReelWord => !!w);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Transcribe a PUBLIC audio/video URL with AssemblyAI and return the flat
 * word list (seconds). AssemblyAI fetches the URL itself — no 25MB cap, no
 * big server-side download. `speech_models` uses the latest universal model;
 * `punctuate`+`format_text` give the caption layer clean words.
 */
export async function transcribeUrl(
  url: string,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<ReelWord[]> {
  const apiKey = key();
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY is not configured.');
  const timeoutMs = opts?.timeoutMs ?? 280_000;
  const pollMs = opts?.pollMs ?? 1500;

  const headers = { authorization: apiKey, 'content-type': 'application/json' };

  // 1 — submit the transcript job (AssemblyAI pulls the public URL).
  // speech_models: 'universal-3-5-pro' is the current best (sharpest word
  // timings). AssemblyAI validates the list strictly — it must be one or more
  // of 'universal-3-pro' | 'universal-2' | 'universal-3-5-pro'. Env-tunable.
  const models = (process.env.ASSEMBLYAI_SPEECH_MODELS || 'universal-3-5-pro')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const submit = await fetch(`${API}/transcript`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      audio_url: url,
      speech_models: models.length ? models : ['universal-3-5-pro'],
      punctuate: true,
      format_text: true,
    }),
  });
  const submitJson = (await submit.json().catch(() => ({}))) as Record<string, unknown>;
  if (!submit.ok) {
    throw new Error(
      typeof submitJson.error === 'string'
        ? submitJson.error
        : `AssemblyAI submit failed (${submit.status})`,
    );
  }
  const id = typeof submitJson.id === 'string' ? submitJson.id : '';
  if (!id) throw new Error('AssemblyAI returned no transcript id.');

  // 2 — poll until the words are ready.
  const started = Date.now();
  for (;;) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('AssemblyAI transcription timed out.');
    }
    await sleep(pollMs);
    const st = await fetch(`${API}/transcript/${id}`, { headers });
    const json = (await st.json().catch(() => ({}))) as Record<string, unknown>;
    if (!st.ok) {
      throw new Error(
        typeof json.error === 'string' ? json.error : `AssemblyAI poll failed (${st.status})`,
      );
    }
    const status = typeof json.status === 'string' ? json.status : '';
    if (status === 'completed') {
      const words = wordsFromTranscript(json.words);
      if (!words.length) throw new Error('AssemblyAI returned no words (silent clip?).');
      return words;
    }
    if (status === 'error') {
      throw new Error(
        typeof json.error === 'string' ? json.error : 'AssemblyAI transcription failed.',
      );
    }
    // 'queued' | 'processing' → keep polling
  }
}
