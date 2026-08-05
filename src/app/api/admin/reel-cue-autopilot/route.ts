import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { getReelProject } from '@/lib/mothermode/reel/store';
import { upsertSession } from '@/lib/mothermode/research/store';
import { blankIntake } from '@/lib/mothermode/research/intake';
import { getRecipe, createRecipeRun } from '@/lib/mothermode/research/recipes/store';
import { createAgentJob } from '@/lib/mothermode/research/recipes/jobs';

export const runtime = 'nodejs';

const RECIPE_SLUG = 'reel-cue-autopilot';
/** Keep the agent's brief focused: a transcript line per word, capped. */
const MAX_WORDS_PER_CLIP = 120;
const MAX_BRIEF_CHARS = 12000;

/**
 * The Reel Cue Autopilot bridge. POST { projectId } → packages the reel's
 * indexed transcripts into a research-session brief (the exact export the
 * recipe's instruction reads), creates the session, and starts the
 * 'reel-cue-autopilot' run on the BACKGROUND lane (the agent job worker picks
 * it up; the owner approves the proposed beats at the gate, and the
 * 'reel-cues' handoff attaches them — see handoff.ts).
 *
 * This is deliberately a bridge, not a bespoke pipeline: the chain
 * (propose → gate → match/generate → attach) lives in the seeded recipe, so
 * it shows in the Plays rail with the run's cost tracking like every other
 * play.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  if (!projectId) {
    return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
  }

  try {
    const project = await getReelProject(projectId);
    if (!project) {
      return NextResponse.json({ ok: false, error: 'Reel not found.' }, { status: 404 });
    }

    // Package the indexed transcript export — the shape the recipe's
    // instruction reads (REEL_PROJECT_ID + per-scene clip ids + word indexes).
    const sections: string[] = [];
    let scene = 0;
    for (const clip of project.clips) {
      scene += 1;
      const words = (project.captions[clip.id] ?? []).slice(0, MAX_WORDS_PER_CLIP);
      if (!words.length) continue;
      const lines = words.map(
        (w, i) => `${i}: ${w.word} (${w.start.toFixed(2)}–${w.end.toFixed(2)}s)`,
      );
      sections.push(`Scene ${scene} — ${clip.name} (clipId: ${clip.id}):\n${lines.join('\n')}`);
    }
    if (!sections.length) {
      return NextResponse.json(
        {
          ok: false,
          error: 'This reel has no transcripts yet — transcribe a scene first (the CC button).',
        },
        { status: 400 },
      );
    }

    const brief = [
      `REEL_PROJECT_ID: ${project.id}`,
      `Reel: ${project.name || 'Untitled reel'}`,
      '',
      ...sections,
    ]
      .join('\n')
      .slice(0, MAX_BRIEF_CHARS);

    const session = await upsertSession({
      title: `Cue autopilot: ${(project.name || 'Untitled reel').slice(0, 60)}`,
      intake: { ...blankIntake(), goal: brief },
      updatedBy: guard.email ?? null,
    });
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Could not create the research session.' },
        { status: 500 },
      );
    }

    const recipe = await getRecipe(RECIPE_SLUG);
    if (!recipe || recipe.steps.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'The reel-cue-autopilot recipe is not seeded yet — run the recipe seed.' },
        { status: 404 },
      );
    }

    const run = await createRecipeRun({
      recipeId: recipe.id,
      sessionId: session.id,
      stepCount: recipe.steps.length,
    });
    // The background lane: the agent job worker runs the step; the owner
    // approves the beat list at the gate. Never block the studio on an LLM.
    const job = await createAgentJob({
      kind: 'recipe-run',
      refId: run.id,
      total: recipe.steps.length,
    });

    return NextResponse.json({
      ok: true,
      runId: run.id,
      sessionId: session.id,
      jobId: job?.id ?? null,
      runUrl: `/admin/recipes/${run.id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Autopilot failed to start';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
