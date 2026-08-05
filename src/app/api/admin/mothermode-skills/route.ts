import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  deleteSkill,
  getSkill,
  listSkills,
  updateSkillStatus,
  upsertSkill,
} from '@/lib/mothermode/research/skills/store';
import {
  normalizeSkillExecutor,
  skillDraftErrors,
} from '@/lib/mothermode/research/skills/types';
import { runHttpSkill } from '@/lib/mothermode/research/skills/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A test call is one outbound HTTP request; 30s is generous.
export const maxDuration = 30;

/**
 * Declarative skills (Phase 3). Admin-only.
 *
 *   GET                                -> { ok, skills }
 *   POST {action:'save', ...skill}     -> { ok, skill, errors } — a draft
 *                                         saves WITH its needs-list;
 *                                         asking for status 'active'
 *                                         with a non-empty list is a 400
 *                                         (activation is gated, saving
 *                                         isn't).
 *   POST {action:'pause'|'unpause', id} -> { ok } (unpause re-validates —
 *                                         a broken skill doesn't come back
 *                                         quietly)
 *   POST {action:'delete', id}         -> { ok }
 *   POST {action:'test', id, input}    -> { ok, result } — the bench:
 *                                         drafts run, the limit is
 *                                         skipped, nothing is recorded.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  const skills = await listSkills();
  return NextResponse.json({ ok: true, skills });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  try {
    if (action === 'save') {
      const wantsActive = body.status === 'active';
      const draft = {
        slug: typeof body.slug === 'string' ? body.slug.trim() : '',
        name: typeof body.name === 'string' ? body.name.trim() : '',
        inputKeys: Array.isArray(body.inputKeys) ? body.inputKeys : [],
        allowedHosts: Array.isArray(body.allowedHosts) ? body.allowedHosts : [],
        executor: body.executor,
        costEstCents:
          typeof body.costEstCents === 'number' ? body.costEstCents : 1,
        maxCallsPerDay:
          typeof body.maxCallsPerDay === 'number' ? body.maxCallsPerDay : 100,
      };
      const errors = skillDraftErrors(draft);
      if (wantsActive && errors.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `an active skill needs zero issues — ${errors.join(', ')}`,
            errors,
          },
          { status: 400 },
        );
      }
      const skill = await upsertSkill({
        slug: draft.slug,
        name: draft.name,
        description:
          typeof body.description === 'string' ? body.description : '',
        inputKeys: draft.inputKeys
          .map((k) => (typeof k === 'string' ? k.trim() : ''))
          .filter(Boolean),
        allowedHosts: draft.allowedHosts
          .map((h) => (typeof h === 'string' ? h.trim() : ''))
          .filter(Boolean),
        executor: normalizeSkillExecutor(body.executor),
        costEstCents: draft.costEstCents,
        maxCallsPerDay: draft.maxCallsPerDay,
        status: wantsActive ? 'active' : 'draft',
      });
      return NextResponse.json({ ok: true, skill, errors });
    }

    if (action === 'pause' || action === 'unpause') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return NextResponse.json(
          { ok: false, error: 'id is required' },
          { status: 400 },
        );
      }
      if (action === 'unpause') {
        // Unpausing IS activating: re-validate first, loudly.
        const skill = await getSkill(id);
        if (!skill) {
          return NextResponse.json(
            { ok: false, error: 'no skill with that id' },
            { status: 404 },
          );
        }
        const errors = skillDraftErrors(skill);
        if (errors.length > 0) {
          return NextResponse.json(
            {
              ok: false,
              error: `this skill still needs ${errors.join(', ')}`,
              errors,
            },
            { status: 400 },
          );
        }
      }
      await updateSkillStatus(id, action === 'pause' ? 'paused' : 'active');
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return NextResponse.json(
          { ok: false, error: 'id is required' },
          { status: 400 },
        );
      }
      await deleteSkill(id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'test') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      const skill = id ? await getSkill(id) : null;
      if (!skill) {
        return NextResponse.json(
          { ok: false, error: 'no skill with that id' },
          { status: 404 },
        );
      }
      const input =
        body.input && typeof body.input === 'object' && !Array.isArray(body.input)
          ? (body.input as Record<string, unknown>)
          : {};
      const result = await runHttpSkill(skill, input, { purpose: 'test' });
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json(
      { ok: false, error: 'unknown action' },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'request failed',
      },
      { status: 500 },
    );
  }
}
