'use client';

/**
 * The live merged prompt bank for generator-surface pickers
 * (docs/PROMPT_BANK_GENERATOR_PICKERS_TASK.md). Fetches the admin prompts
 * route once per session (module-level cache + in-flight dedupe), so DB
 * customs, seed edits, and on/off toggles reach every picker without a
 * deploy. Falls back to the code registry when the route is unreachable, so
 * a surface never renders empty.
 */
import { useEffect, useState } from 'react';
import {
  PROMPT_RECIPES,
  type PromptRecipe,
} from '@/lib/mothermode/content/promptBank';
import { IMAGE_PROMPT_RECIPES } from '@/lib/mothermode/content/imagePromptBank';

/** The version-controlled seeds, used before hydration and as the fallback. */
const CODE_SEEDS: PromptRecipe[] = [...PROMPT_RECIPES, ...IMAGE_PROMPT_RECIPES];

let cache: PromptRecipe[] | null = null;
let inflight: Promise<PromptRecipe[]> | null = null;

/** GET the merged bank; degrade to the code seeds on any failure. */
async function fetchMergedBank(): Promise<PromptRecipe[]> {
  try {
    const res = await fetch('/api/admin/mothermode-prompts');
    const json = (await res.json().catch(() => ({}))) as {
      recipes?: unknown;
    };
    if (!res.ok || !Array.isArray(json.recipes)) return CODE_SEEDS;
    const merged = (json.recipes as PromptRecipe[]).filter(
      (r) => r && typeof r.id === 'string' && r.enabled !== false,
    );
    return merged.length > 0 ? merged : CODE_SEEDS;
  } catch {
    return CODE_SEEDS;
  }
}

/** One shared fetch for every mounted picker. */
function loadBank(): Promise<PromptRecipe[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchMergedBank().then((list) => {
      cache = list;
      inflight = null;
      return list;
    });
  }
  return inflight;
}

/**
 * The enabled merged bank, hydrated from the live store. Renders immediately
 * with the code seeds (or the cached merge), then swaps in live data.
 */
export function usePromptBankRecipes(): {
  recipes: PromptRecipe[];
  loading: boolean;
} {
  const [recipes, setRecipes] = useState<PromptRecipe[]>(cache ?? CODE_SEEDS);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;
    void loadBank().then((list) => {
      if (cancelled) return;
      setRecipes(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { recipes, loading };
}
