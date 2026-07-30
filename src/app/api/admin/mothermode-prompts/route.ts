import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  resolveAllRecipes,
  upsertRecipe,
  deleteRecipeRow,
} from '@/lib/mothermode/content/promptBankStore';
import type { PromptRecipe } from '@/lib/mothermode/content/promptBank';

/**
 * GET: admin-only. The full merged prompt bank (code seeds with DB overrides
 * applied, plus custom recipes) and the list of seed ids currently overridden,
 * for the /admin/prompt-bank editor.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const { recipes, overriddenIds } = await resolveAllRecipes();
  return NextResponse.json({ success: true, recipes, overriddenIds });
}

const GOALS = ['replies', 'saves', 'shares', 'follows', 'clicks'] as const;
const GROUPS = ['framework', 'style', 'image'] as const;
const KINDS = ['organic', 'ad'] as const;

const asStringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/**
 * POST: admin-only. Create or update one recipe.
 * Body: { recipe: PromptRecipe }. A recipe whose id matches a code seed is an
 * override of that seed; a new id is a custom recipe (builtin forced false).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { recipe } = (await request.json()) as { recipe?: PromptRecipe };
    if (!recipe || typeof recipe !== 'object') {
      return NextResponse.json(
        { success: false, error: 'recipe is required' },
        { status: 400 },
      );
    }
    const id = String(recipe.id ?? '').trim();
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id)) {
      return NextResponse.json(
        { success: false, error: 'id must be 2-61 chars of lowercase letters, numbers, and dashes' },
        { status: 400 },
      );
    }
    const label = String(recipe.label ?? '').trim();
    if (!label) {
      return NextResponse.json(
        { success: false, error: 'label is required' },
        { status: 400 },
      );
    }

    const clean: PromptRecipe = {
      id,
      label,
      hint: String(recipe.hint ?? ''),
      group: (GROUPS as readonly string[]).includes(recipe.group)
        ? recipe.group
        : 'framework',
      goal: (GOALS as readonly string[]).includes(recipe.goal)
        ? recipe.goal
        : 'shares',
      whyItWorks: asStringList(recipe.whyItWorks),
      template: String(recipe.template ?? ''),
      exampleHooks: asStringList(recipe.exampleHooks),
      craft: String(recipe.craft ?? ''),
      platforms: asStringList(recipe.platforms) as PromptRecipe['platforms'],
      formats: asStringList(recipe.formats) as PromptRecipe['formats'],
      kind: (KINDS as readonly string[]).includes(recipe.kind ?? '')
        ? recipe.kind
        : undefined,
      sizePresetIds: asStringList(recipe.sizePresetIds),
      platformNotes:
        recipe.platformNotes && typeof recipe.platformNotes === 'object'
          ? recipe.platformNotes
          : undefined,
      sourceUrls: asStringList(recipe.sourceUrls),
      builtin: recipe.builtin === true,
      enabled: recipe.enabled !== false,
    };

    await upsertRecipe({ recipe: clean, updatedBy: guard.email });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/**
 * DELETE: admin-only. Remove the DB row for a slug. For a builtin seed this
 * resets it to the code default; for a custom recipe it deletes it outright.
 * Query: ?slug=questions-proof
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json(
      { success: false, error: 'slug is required' },
      { status: 400 },
    );
  }
  try {
    await deleteRecipeRow(slug);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
