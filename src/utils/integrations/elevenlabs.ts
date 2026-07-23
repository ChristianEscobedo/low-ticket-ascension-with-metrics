/**
 * ElevenLabs text-to-speech client (server-only).
 * https://elevenlabs.io/docs/api-reference/text-to-speech
 *
 * We always call the `/with-timestamps` endpoint so every generation returns a
 * character-level alignment alongside the audio. That alignment is what keeps
 * beat timing intact: for a combined track we map each beat's character offset
 * to seconds; for per-beat clips the alignment's last end time is the clip's
 * exact duration. Reads keys from the environment and throws clear errors when
 * unconfigured, so this must never be imported into a browser bundle.
 */

const API_BASE = 'https://api.elevenlabs.io/v1';

/** Default model: most natural. `eleven_turbo_v2_5` is the fast alternative. */
export const DEFAULT_ELEVENLABS_MODEL = 'eleven_multilingual_v2';

/** Character-level alignment returned by the `/with-timestamps` endpoint. */
export interface ElevenLabsAlignment {
  /** One entry per character of the synthesized text. */
  characters: string[];
  /** Start time (seconds) of each character. Same length as `characters`. */
  character_start_times_seconds: number[];
  /** End time (seconds) of each character. Same length as `characters`. */
  character_end_times_seconds: number[];
}

/** Result of a single speech generation. */
export interface ElevenLabsSpeech {
  /** Base64-encoded MP3 payload. */
  audioBase64: string;
  /** MIME type of the audio (always audio/mpeg for MP3). */
  mimeType: string;
  /** Character-level timing alignment for the synthesized text. */
  alignment: ElevenLabsAlignment;
}

/** A voice option for the picker. */
export interface ElevenLabsVoice {
  id: string;
  name: string;
}

/** Optional per-generation voice settings. */
export interface ElevenLabsVoiceOptions {
  voiceId?: string;
  modelId?: string;
  /** 0..1 — higher is steadier, lower is more expressive. */
  stability?: number;
  /** 0..1 — how closely the clone tracks the original voice. */
  similarityBoost?: number;
  /** 0..1 — style exaggeration (0 = none). */
  style?: number;
}

/** Read the API key, or throw a clear, actionable error when it is missing. */
function requireApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the environment to enable voiceover generation.',
    );
  }
  return key;
}

/** Resolve the voice id: explicit arg wins, then the env default. */
function resolveVoiceId(voiceId?: string): string {
  const id = voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!id) {
    throw new Error(
      'No ElevenLabs voice selected. Pick a voice or set ELEVENLABS_VOICE_ID in the environment.',
    );
  }
  return id;
}

/** Resolve the model id: explicit arg wins, then env, then the natural default. */
function resolveModelId(modelId?: string): string {
  return (
    modelId?.trim() ||
    process.env.ELEVENLABS_MODEL_ID?.trim() ||
    DEFAULT_ELEVENLABS_MODEL
  );
}

/** Clamp an optional 0..1 setting, dropping it when unset/invalid. */
function clamp01(v: number | undefined): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.max(0, Math.min(1, v));
}

/**
 * Synthesize `text` to speech and return the audio plus its character-level
 * alignment. Uses the `/with-timestamps` endpoint so timing is always known.
 * Throws a readable Error on a missing key or an API failure.
 */
export async function generateSpeechWithTimestamps(
  text: string,
  opts: ElevenLabsVoiceOptions = {},
): Promise<ElevenLabsSpeech> {
  const clean = (text ?? '').trim();
  if (!clean) throw new Error('No voiceover text to synthesize');

  const apiKey = requireApiKey();
  const voiceId = resolveVoiceId(opts.voiceId);
  const modelId = resolveModelId(opts.modelId);

  const voiceSettings: Record<string, number> = {};
  const stability = clamp01(opts.stability);
  const similarity = clamp01(opts.similarityBoost);
  const style = clamp01(opts.style);
  if (stability !== undefined) voiceSettings.stability = stability;
  if (similarity !== undefined) voiceSettings.similarity_boost = similarity;
  if (style !== undefined) voiceSettings.style = style;

  const body: Record<string, unknown> = { text: clean, model_id: modelId };
  if (Object.keys(voiceSettings).length > 0) {
    body.voice_settings = voiceSettings;
  }

  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
  } catch (e) {
    throw new Error(
      e instanceof Error ? `ElevenLabs request failed: ${e.message}` : 'ElevenLabs request failed',
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      const err = (await res.json()) as Record<string, unknown>;
      const d = err?.detail;
      if (typeof d === 'string') detail = d;
      else if (d && typeof d === 'object' && typeof (d as Record<string, unknown>).message === 'string') {
        detail = (d as Record<string, unknown>).message as string;
      } else if (typeof err?.message === 'string') detail = err.message as string;
    } catch {
      /* body was not JSON */
    }
    throw new Error(
      `ElevenLabs generation failed (${res.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const audioBase64 =
    typeof json.audio_base64 === 'string' ? json.audio_base64 : '';
  if (!audioBase64) throw new Error('ElevenLabs returned no audio');

  const rawAlign = (json.alignment ?? json.normalized_alignment) as
    | Record<string, unknown>
    | undefined;
  const alignment: ElevenLabsAlignment = {
    characters: Array.isArray(rawAlign?.characters)
      ? (rawAlign!.characters as unknown[]).map((c) => String(c))
      : [],
    character_start_times_seconds: Array.isArray(
      rawAlign?.character_start_times_seconds,
    )
      ? (rawAlign!.character_start_times_seconds as unknown[]).map((n) => Number(n))
      : [],
    character_end_times_seconds: Array.isArray(
      rawAlign?.character_end_times_seconds,
    )
      ? (rawAlign!.character_end_times_seconds as unknown[]).map((n) => Number(n))
      : [],
  };

  return { audioBase64, mimeType: 'audio/mpeg', alignment };
}

/**
 * List the account's voices for the picker. Returns `{ id, name }[]`. Throws a
 * readable Error on a missing key or an API failure.
 */
export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = requireApiKey();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/voices`, {
      headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
    });
  } catch (e) {
    throw new Error(
      e instanceof Error ? `ElevenLabs request failed: ${e.message}` : 'ElevenLabs request failed',
    );
  }

  if (!res.ok) {
    throw new Error(`ElevenLabs voices request failed (${res.status})`);
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const voices = Array.isArray(json.voices) ? (json.voices as unknown[]) : [];
  return voices
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      const id = typeof o.voice_id === 'string' ? o.voice_id : '';
      const name = typeof o.name === 'string' ? o.name : id;
      return { id, name };
    })
    .filter((v) => v.id !== '');
}

/** True when the ElevenLabs API key is present in the environment. */
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY?.trim();
}
