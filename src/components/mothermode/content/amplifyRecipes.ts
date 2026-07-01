/**
 * Local persistence for the Amplify command box: the last-used configuration
 * (restored every time the panel opens) and named recipes an admin can save and
 * re-run. Stored in localStorage so a reviewer's setup is sticky across visits
 * without a round trip. SSR-guarded: every reader returns a safe default on the
 * server. Keep this storage-only; the UI shapes live with the panel.
 */
import type {
  ContentFormat,
  ContentPlatform,
  PartCounts,
  Perspective,
  Sophistication,
} from '@/lib/mothermode/content';

/** Which whole-post channel a New-posts run targets. */
export type PostTarget = 'same' | 'cross';

/** The full Amplify panel state worth remembering and naming. */
export interface AmplifyConfig {
  mode: 'refine' | 'posts';
  /** Refine: per-part counts (0 = locked/kept). */
  partCounts: PartCounts;
  /** Refine voice controls. */
  perspective: Perspective;
  sophistication: Sophistication;
  /** Posts matrix: the voices and awareness levels to multiply across. */
  perspectives: Perspective[];
  sophistications: Sophistication[];
  /** Posts: how many per matrix combination. */
  postCount: number;
  target: PostTarget;
  targetPlatform: ContentPlatform;
  targetFormat: ContentFormat;
  model: string;
  guides: string;
}

/** A saved, re-runnable recipe. */
export interface SavedRecipe {
  id: string;
  name: string;
  config: AmplifyConfig;
}

const LAST_KEY = 'mm:amplify:last';
const RECIPES_KEY = 'mm:amplify:recipes';

function canUse(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function read<T>(key: string): T | null {
  if (!canUse()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (!canUse()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or serialization: a sticky setup is best-effort */
  }
}

/** The last-used config, or null when nothing has been saved yet. */
export function loadLastConfig(): AmplifyConfig | null {
  return read<AmplifyConfig>(LAST_KEY);
}

/** Remember the current config as the default for next time. */
export function saveLastConfig(config: AmplifyConfig): void {
  write(LAST_KEY, config);
}

/** Every saved recipe, newest first. */
export function listRecipes(): SavedRecipe[] {
  const list = read<SavedRecipe[]>(RECIPES_KEY);
  return Array.isArray(list) ? list : [];
}

function newId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Save a named recipe, replacing one of the same name, and return the updated
 * list (newest first). A blank name is ignored and returns the current list.
 */
export function saveRecipe(name: string, config: AmplifyConfig): SavedRecipe[] {
  const clean = name.trim();
  if (!clean) return listRecipes();
  const rest = listRecipes().filter(
    (r) => r.name.toLowerCase() !== clean.toLowerCase(),
  );
  const next = [{ id: newId(), name: clean, config }, ...rest];
  write(RECIPES_KEY, next);
  return next;
}

/** Delete a recipe by id and return the updated list. */
export function deleteRecipe(id: string): SavedRecipe[] {
  const next = listRecipes().filter((r) => r.id !== id);
  write(RECIPES_KEY, next);
  return next;
}
