/**
 * The AI models an admin can choose from in the content hub, for text (copy) and
 * for image generation. Client-safe: no env reads and no server imports, so the
 * selectors and the server resolvers share one source of truth. An empty/unknown
 * selection means "Auto": the server falls back to its env-configured default,
 * preserving the original behavior.
 */

export type TextProvider = 'openai' | 'anthropic';

/** The image API a generator is served by. */
export type ImageProvider = 'openai' | 'google';

/** A selectable copywriter, mapped to the provider that serves it. */
export interface TextModelOption {
  id: string;
  label: string;
  provider: TextProvider;
  /** Short note shown beside the label in the selector. */
  note?: string;
}

/** A selectable image generator, mapped to the API that serves it. The id is
 *  the provider's own model name, so it doubles as the API request model. */
export interface ImageModelOption {
  id: string;
  label: string;
  provider: ImageProvider;
  note?: string;
  /** When true, the model can take a seed image (and optional refs) for edits. */
  supportsEdit?: boolean;
}


/** Frontier copywriters offered for text generation and rewrites. */
export const TEXT_MODELS: TextModelOption[] = [
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    provider: 'anthropic',
    note: 'Anthropic',
  },
  { id: 'gpt-5.5', label: 'GPT-5.5', provider: 'openai', note: 'OpenAI' },
];

/** Image models offered for post visuals. */
export const IMAGE_MODELS: ImageModelOption[] = [
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    provider: 'openai',
    note: 'Best quality',
    supportsEdit: true,
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    provider: 'google',
    note: 'Google, fast',
    supportsEdit: true,
  },
  { id: 'dall-e-3', label: 'DALL-E 3', provider: 'openai', note: 'Faster' },
];

/** Image models that accept a seed (and optional reference images) for edits. */
export const EDIT_IMAGE_MODELS: ImageModelOption[] = IMAGE_MODELS.filter(
  (m) => m.supportsEdit,
);


/** The value used in the selectors for "let the server decide". */
export const AUTO_MODEL = '';

/** Look up a text model by id, or undefined for Auto/unknown. */
export function getTextModel(id?: string | null): TextModelOption | undefined {
  return id ? TEXT_MODELS.find((m) => m.id === id) : undefined;
}

/** Look up an image model by id, or undefined for Auto/unknown. */
export function getImageModel(id?: string | null): ImageModelOption | undefined {
  return id ? IMAGE_MODELS.find((m) => m.id === id) : undefined;
}

/** Whether an id is a known, selectable image model. */
export function isImageModel(id?: string | null): id is string {
  return !!id && IMAGE_MODELS.some((m) => m.id === id);
}
