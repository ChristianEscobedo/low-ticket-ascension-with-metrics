/**
 * Browser-side wrappers for the content hub AI endpoint (/api/mothermode/ai).
 * Each throws a readable Error on failure so the calling control can surface the
 * message inline. The route is admin-gated, so these only succeed for admins.
 */
import type { ContentPiece } from '@/lib/mothermode/content/types';
import type {
  AmplifyTextDimension,
  Perspective,
  Sophistication,
} from '@/lib/mothermode/content/amplify';

/** One part of a multi-part Refine run sent to the server. */
export interface AmplifyPartRequest {
  dimension: AmplifyTextDimension;
  count: number;
  /** Existing items this part should avoid repeating. */
  avoid?: string[];
}

/** The piece context passed to a rewrite so the copy stays on-brief. */
export interface AiContext {
  theme?: string;
  tone?: string;
  platform?: string;
  format?: string;
}

async function postAi(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch('/api/mothermode/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok !== true) {
    const msg =
      typeof json.error === 'string' ? json.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/** Generate a post image, returning a hosted public URL (the server uploads the
 *  render to Storage so it is renderable and GoHighLevel-postable; it falls back
 *  to a data URL only if hosting is unavailable). An optional model id overrides
 *  the server default; omit it (or pass empty) for Auto. */
export async function aiGenerateImage(
  prompt: string,
  format?: string,
  model?: string,
): Promise<string> {
  const json = await postAi({ action: 'image', prompt, format, model });
  if (typeof json.image !== 'string') throw new Error('No image was returned');
  return json.image;
}

/**
 * Edit a seed image (optionally with reference images for character/logo/etc.)
 * and return a hosted public URL. Seed and references may be data URLs or
 * public http(s) URLs; the server resolves them.
 */
export async function aiEditImage(args: {
  prompt: string;
  seed: string;
  references?: string[];
  format?: string;
  model?: string;
}): Promise<string> {
  const json = await postAi({ action: 'imageEdit', ...args });
  if (typeof json.image !== 'string') throw new Error('No image was returned');
  return json.image;
}


/**
 * Stage one of the image pipeline: turn a version's hook (with optional
 * theme/format context and guides) into N distinct photographic scene prompts.
 * Each returned scene is fed to aiGenerateImage to render and host an image.
 */
export async function aiImagePrompts(args: {
  count: number;
  hook: string;
  guides?: string;
  avoid?: string[];
  context?: AiContext;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<string[]> {
  const json = await postAi({ action: 'imagePrompts', ...args });
  if (!Array.isArray(json.prompts)) throw new Error('No image prompts were returned');
  return json.prompts as string[];
}

/** Rewrite or A/B-variant a single copy field, returning the new text. */
export async function aiRewriteText(args: {
  field: 'hook' | 'caption' | 'body';
  text: string;
  instructions?: string;
  variant?: boolean;
  context?: AiContext;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<string> {
  const json = await postAi({ action: 'rewrite', ...args });
  if (typeof json.text !== 'string') throw new Error('No text was returned');
  return json.text;
}

/** Multiply one piece into a list of hooks, angles, CTAs, or body versions. */
export async function aiAmplify(args: {
  dimension: AmplifyTextDimension;
  count: number;
  source: ContentPiece;
  perspective?: Perspective;
  sophistication?: Sophistication;
  guides?: string;
  context?: AiContext;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<string[]> {
  const json = await postAi({ action: 'amplify', ...args });
  if (!Array.isArray(json.items)) throw new Error('No variants were returned');
  return json.items as string[];
}

/**
 * Multiply one piece across several parts in one run (hooks and CTAs and so on),
 * each with its own count, returning a per-part map of variants. Parts not
 * requested are simply absent, so the caller keeps (locks) the rest of the piece.
 */
export async function aiAmplifyParts(args: {
  parts: AmplifyPartRequest[];
  source: ContentPiece;
  perspective?: Perspective;
  sophistication?: Sophistication;
  guides?: string;
  context?: AiContext;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
}): Promise<Partial<Record<AmplifyTextDimension, string[]>>> {
  const json = await postAi({ action: 'amplifyParts', ...args });
  if (!json.parts || typeof json.parts !== 'object')
    throw new Error('No variants were returned');
  return json.parts as Partial<Record<AmplifyTextDimension, string[]>>;
}
