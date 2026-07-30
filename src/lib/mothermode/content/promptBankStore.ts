/**
 * Server-only store for the prompt bank. The code registry (promptBank.ts) is
 * the version-controlled seed; rows in `mothermode_prompt_recipes` override
 * seed fields, toggle recipes on/off, and add fully custom recipes. Every
 * reader degrades to the code registry when the table is missing, empty, or
 * Supabase is unconfigured, so generation never hard-fails on a DB hiccup.
 *
 * Merge rules:
 *   - DB row whose slug matches a seed: overrides every stored field (incl.
 *     enabled). Deleting that row resets the seed back to the code default.
 *   - DB row with a new slug: a custom recipe, appended after the seeds.
 * Never import from a browser bundle.
 */
import { createClient } from '@supabase/supabase-js';
import {
  PROMPT_RECIPES,
  type PromptRecipe,
  type RecipeGoal,
  type RecipeGroup,
  type RecipeInputField,
} from './promptBank';
import { IMAGE_PROMPT_RECIPES } from './imagePromptBank';
import type { ContentFormat, ContentKind, ContentPlatform } from './types';

export const PROMPT_RECIPES_TABLE = 'mothermode_prompt_recipes';

/**
 * Every code-seeded recipe across all groups: text frameworks and the image
 * creative bank. DB rows override these by slug; custom rows append after.
 */
export const ALL_SEED_RECIPES: PromptRecipe[] = [
  ...PROMPT_RECIPES,
  ...IMAGE_PROMPT_RECIPES,
];

const COLUMNS =
  'slug, recipe_group, label, hint, goal, why_it_works, template, example_hooks, craft, platforms, formats, kind, size_presets, platform_notes, source_urls, inputs, enabled, builtin, sort_order, updated_at, updated_by';

export interface PromptRecipeRow {
  slug: string;
  recipe_group: RecipeGroup;
  label: string;
  hint: string;
  goal: RecipeGoal;
  why_it_works: string[];
  template: string;
  example_hooks: string[];
  craft: string;
  platforms: ContentPlatform[];
  formats: ContentFormat[];
  kind?: ContentKind | null;
  size_presets?: string[];
  platform_notes: Partial<Record<ContentPlatform, string>>;
  source_urls: string[];
  /** Custom input field defs ({ id, label, placeholder?, hint?, required? }). */
  inputs?: RecipeInputField[];
  enabled: boolean;
  builtin: boolean;
  sort_order: number;
  updated_at?: string;
  updated_by?: string | null;
}

// Service-role client for admin reads and all writes. Lazy so the module never
// throws on missing env at import time; every caller treats a failure as
// "fall back to the code registry".
let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

const asStringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Defensive normalizer for the jsonb inputs column: keep only well-formed
 *  field defs (id + label strings); everything else drops out. */
const asInputFields = (v: unknown): RecipeInputField[] => {
  if (!Array.isArray(v)) return [];
  const out: RecipeInputField[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !rec.id.trim()) continue;
    if (typeof rec.label !== 'string' || !rec.label.trim()) continue;
    const field: RecipeInputField = {
      id: rec.id.trim(),
      label: rec.label.trim(),
    };
    if (typeof rec.placeholder === 'string' && rec.placeholder.trim()) {
      field.placeholder = rec.placeholder.trim();
    }
    if (typeof rec.hint === 'string' && rec.hint.trim()) {
      field.hint = rec.hint.trim();
    }
    if (rec.required === true) field.required = true;
    out.push(field);
  }
  return out;
};

/** Map a DB row onto the shared PromptRecipe shape. */
export function rowToRecipe(row: PromptRecipeRow): PromptRecipe {
  return {
    id: row.slug,
    label: row.label,
    hint: row.hint ?? '',
    group:
      row.recipe_group === 'style'
        ? 'style'
        : row.recipe_group === 'image'
          ? 'image'
          : 'framework',
    goal: row.goal ?? 'shares',
    whyItWorks: asStringList(row.why_it_works),
    template: row.template ?? '',
    exampleHooks: asStringList(row.example_hooks),
    craft: row.craft ?? '',
    platforms: asStringList(row.platforms) as ContentPlatform[],
    formats: asStringList(row.formats) as ContentFormat[],
    kind: row.kind === 'ad' ? 'ad' : row.kind === 'organic' ? 'organic' : undefined,
    sizePresetIds: asStringList(row.size_presets),
    platformNotes:
      row.platform_notes && typeof row.platform_notes === 'object'
        ? row.platform_notes
        : undefined,
    sourceUrls: asStringList(row.source_urls),
    inputs: asInputFields(row.inputs),
    builtin: row.builtin === true,
    enabled: row.enabled !== false,
  };
}

/** Map a recipe onto a DB row for upserts. */
export function recipeToRow(
  recipe: PromptRecipe,
  sortOrder: number,
  updatedBy?: string | null,
): PromptRecipeRow {
  return {
    slug: recipe.id,
    recipe_group: recipe.group,
    label: recipe.label,
    hint: recipe.hint,
    goal: recipe.goal,
    why_it_works: recipe.whyItWorks,
    template: recipe.template,
    example_hooks: recipe.exampleHooks,
    craft: recipe.craft,
    platforms: recipe.platforms,
    formats: recipe.formats,
    kind: recipe.kind ?? null,
    size_presets: recipe.sizePresetIds ?? [],
    platform_notes: recipe.platformNotes ?? {},
    source_urls: recipe.sourceUrls ?? [],
    inputs: recipe.inputs ?? [],
    enabled: recipe.enabled !== false,
    builtin: recipe.builtin,
    sort_order: sortOrder,
    updated_by: updatedBy ?? null,
  };
}

/** Every DB row, or [] when the table is absent/unreachable. */
export async function listDbRecipes(): Promise<PromptRecipeRow[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(PROMPT_RECIPES_TABLE)
      .select(COLUMNS)
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return data as PromptRecipeRow[];
  } catch {
    return [];
  }
}

/**
 * The full merged bank: seeds with any DB overrides applied, plus custom DB
 * recipes, enabled and disabled alike (the admin editor needs the full view).
 * `hasDbOverride` marks seeds whose row exists in the table (edited or
 * toggled), so the editor can offer a reset.
 */
export async function resolveAllRecipes(): Promise<{
  recipes: PromptRecipe[];
  overriddenIds: string[];
}> {
  const rows = await listDbRecipes();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const recipes: PromptRecipe[] = ALL_SEED_RECIPES.map((seed) => {
    const row = bySlug.get(seed.id);
    if (!row) return seed;
    const merged = rowToRecipe(row);
    // A builtin row always keeps its seed identity even if stored fields drift.
    return { ...merged, id: seed.id, builtin: true };
  });

  const seedIds = new Set(ALL_SEED_RECIPES.map((r) => r.id));
  for (const row of rows) {
    if (seedIds.has(row.slug)) continue;
    recipes.push(rowToRecipe(row));
  }

  return {
    recipes,
    overriddenIds: rows.filter((r) => seedIds.has(r.slug)).map((r) => r.slug),
  };
}

/** The generator-facing pool: merged bank, enabled recipes only. */
export async function resolveEnabledRecipes(): Promise<PromptRecipe[]> {
  const { recipes } = await resolveAllRecipes();
  return recipes.filter((r) => r.enabled !== false);
}

/** Look up one recipe in the merged pool by id (enabled only). */
export async function resolveRecipeById(
  id?: string | null,
): Promise<PromptRecipe | undefined> {
  if (!id) return undefined;
  const pool = await resolveEnabledRecipes();
  return pool.find((r) => r.id === id);
}

/** Look up one enabled image-group recipe by id, for image generation stages. */
export async function resolveImageRecipeById(
  id?: string | null,
): Promise<PromptRecipe | undefined> {
  if (!id) return undefined;
  const pool = await resolveEnabledRecipes();
  return pool.find((r) => r.id === id && r.group === 'image');
}

export interface UpsertRecipeInput {
  recipe: PromptRecipe;
  sortOrder?: number;
  updatedBy?: string | null;
}

/** Admin-only upsert. Custom recipes insert; seed slugs update in place. */
export async function upsertRecipe(input: UpsertRecipeInput): Promise<void> {
  const seedIndex = ALL_SEED_RECIPES.findIndex((r) => r.id === input.recipe.id);
  const sortOrder =
    input.sortOrder ??
    (seedIndex >= 0 ? seedIndex : ALL_SEED_RECIPES.length + 100);
  const row = recipeToRow(input.recipe, sortOrder, input.updatedBy);
  const { error } = await (serviceClient() as any)
    .from(PROMPT_RECIPES_TABLE)
    .upsert(row, { onConflict: 'slug' });
  if (error) throw new Error(error.message);
}

/**
 * Delete the DB row for a slug. For a builtin seed this resets it to the code
 * default (the seed re-emerges); for a custom recipe it removes it entirely.
 */
export async function deleteRecipeRow(slug: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(PROMPT_RECIPES_TABLE)
    .delete()
    .eq('slug', slug);
  if (error) throw new Error(error.message);
}

/**
 * Toggle a recipe on/off. For a seed with no DB row yet, materialize the row
 * from the seed with the flag flipped so the rest of the fields stay defaults.
 */
export async function setRecipeEnabled(
  slug: string,
  enabled: boolean,
  updatedBy?: string | null,
): Promise<void> {
  const rows = await listDbRecipes();
  const existing = rows.find((r) => r.slug === slug);
  if (existing) {
    const { error } = await (serviceClient() as any)
      .from(PROMPT_RECIPES_TABLE)
      .update({ enabled, updated_by: updatedBy ?? null })
      .eq('slug', slug);
    if (error) throw new Error(error.message);
    return;
  }
  const seed = ALL_SEED_RECIPES.find((r) => r.id === slug);
  if (!seed) throw new Error(`Unknown recipe: ${slug}`);
  await upsertRecipe({
    recipe: { ...seed, enabled },
    updatedBy,
  });
}
