import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  getBoards,
  saveBoardColumns,
  listContentPlan,
  listLeadBoard,
  upsertContentPlan,
  patchContentPlan,
  deleteContentPlan,
  upsertLeadPipeline
} from '@/lib/mothermode/planner/store';
import { normalizeColumns } from '@/lib/mothermode/planner/types';
import { defaultColumns } from '@/lib/mothermode/planner/defaults';
import { captureLead } from '@/lib/mothermode/sales/store';

/**
 * The planner's single admin endpoint.
 *
 * WHY ONE ROUTE
 * -------------
 * Every planner surface (calendar, content kanban, lead kanban, column editor)
 * reads the same three things — the two boards, the content plan, the lead
 * board — and writes through five verbs. Splitting that into five routes would
 * mean five admin guards, five error shapes, and a client that has to know
 * which URL owns which noun. So GET returns the whole planner in one payload,
 * and POST dispatches on an `action` discriminator.
 *
 * The store degrades gracefully (unconfigured Supabase or unapplied migration
 * returns seeded defaults and empty lists), so GET is always safe to call: a
 * fresh clone renders an empty board rather than a 500.
 */

/** Board columns are needed to coerce an incoming stage, so always load them. */
async function loadColumns() {
  const boards = await getBoards();
  return boards;
}

/**
 * GET ?offerSlug=&funnelId=
 *
 * offerSlug scopes the content plan (an evergreen piece may be planned once per
 * offer); funnelId scopes the lead board. Both optional — omitted means "all".
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  const offerSlug = url.searchParams.get('offerSlug');
  const funnelId = url.searchParams.get('funnelId');

  try {
    const boards = await loadColumns();
    const [plan, leads] = await Promise.all([
      listContentPlan({
        offerSlug: offerSlug || null,
        columns: boards.content.columns
      }),
      listLeadBoard({
        funnelId: funnelId || null,
        columns: boards.leads.columns
      })
    ]);

    return NextResponse.json({
      success: true,
      admin: true,
      boards,
      plan,
      leads
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Planner load failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST { action, ... }
 *
 *   saveColumns  { kind, name?, columns }      -- rename / reorder / add / remove
 *   upsertPlan   { ...UpsertContentPlanInput } -- create or replace a plan card
 *   patchPlan    { id, patch }                 -- drag: stage / scheduledAt / sortOrder
 *   deletePlan   { id }                        -- back to the unplanned library
 *   upsertLead   { ...UpsertLeadPipelineInput } -- drag or edit a lead card
 *   createLead   { funnelId, email, ... }      -- a lead that never used a form
 *
 * A drag is a patch, not an upsert, so a stale client cannot blank the fields it
 * never loaded.
 *
 * createLead is separate from upsertLead rather than a branch inside it because
 * it writes a different table first: see the comment on the case itself.
 */

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const updatedBy =
    ((guard as unknown as { email?: string | null }).email ?? null) || null;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const action = typeof body.action === 'string' ? body.action : '';

  try {
    switch (action) {
      case 'saveColumns': {
        const kind = body.kind === 'leads' ? 'leads' : 'content';
        // normalizeColumns drops malformed entries and re-slugs blank ids, so a
        // hand-edited payload can never persist a column with no id.
        const columns = normalizeColumns(body.columns, defaultColumns(kind));
        if (!columns.length) {
          return NextResponse.json(
            { success: false, error: 'At least one column is required' },
            { status: 400 }
          );
        }
        const board = await saveBoardColumns({
          kind,
          name: typeof body.name === 'string' ? body.name : undefined,
          columns,
          updatedBy
        });
        return NextResponse.json({ success: true, board });
      }

      case 'upsertPlan': {
        const pieceId =
          typeof body.pieceId === 'string' ? body.pieceId.trim() : '';
        if (!pieceId) {
          return NextResponse.json(
            { success: false, error: 'pieceId is required' },
            { status: 400 }
          );
        }
        const boards = await loadColumns();
        const record = await upsertContentPlan(
          {
            id: typeof body.id === 'string' ? body.id : null,
            pieceId,
            offerSlug:
              typeof body.offerSlug === 'string' ? body.offerSlug : null,
            boardId: boards.content.id,
            scheduledAt:
              typeof body.scheduledAt === 'string' ? body.scheduledAt : null,
            stage: typeof body.stage === 'string' ? body.stage : undefined,
            platform:
              typeof body.platform === 'string' ? body.platform : undefined,
            format: typeof body.format === 'string' ? body.format : undefined,
            kind: typeof body.kind === 'string' ? body.kind : undefined,
            title: typeof body.title === 'string' ? body.title : undefined,
            owner: typeof body.owner === 'string' ? body.owner : undefined,
            notes: typeof body.notes === 'string' ? body.notes : undefined,
            blocked:
              typeof body.blocked === 'boolean' ? body.blocked : undefined,
            sortOrder:
              typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
            // The Content Hub's Schedule tab sends these when it pushes a piece
            // out as a draft or a live schedule. Passed through as strings and
            // coerced in the store, so this route never has to know the vocabulary.
            publishState:
              typeof body.publishState === 'string' ? body.publishState : undefined,
            publishTarget:
              typeof body.publishTarget === 'string'
                ? body.publishTarget
                : undefined,
            publishRef:
              typeof body.publishRef === 'string' || body.publishRef === null
                ? (body.publishRef as string | null)
                : undefined,
            publishAccounts: Array.isArray(body.publishAccounts)
              ? body.publishAccounts
              : undefined,
            publishSyncedAt:
              typeof body.publishSyncedAt === 'string' ||
              body.publishSyncedAt === null
                ? (body.publishSyncedAt as string | null)
                : undefined,
            updatedBy
          },
          boards.content.columns
        );
        return NextResponse.json({ success: true, record });
      }

      case 'patchPlan': {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'id is required' },
            { status: 400 }
          );
        }
        const boards = await loadColumns();
        const patch = (body.patch ?? {}) as Record<string, unknown>;
        const record = await patchContentPlan(
          id,
          {
            stage: typeof patch.stage === 'string' ? patch.stage : undefined,
            scheduledAt:
              typeof patch.scheduledAt === 'string' ||
              patch.scheduledAt === null
                ? (patch.scheduledAt as string | null)
                : undefined,
            sortOrder:
              typeof patch.sortOrder === 'number' ? patch.sortOrder : undefined,
            owner: typeof patch.owner === 'string' ? patch.owner : undefined,
            notes: typeof patch.notes === 'string' ? patch.notes : undefined,
            blocked:
              typeof patch.blocked === 'boolean' ? patch.blocked : undefined,
            // Destination fields (20261005000000). Explicitly allow-listed like
            // every other patchable field: `patch` is client JSON, so anything
            // not named here is silently ignored rather than reaching the row.
            // `null` is meaningful for funnelId and destinationUrl — it is how
            // the drawer unlinks a card — so it has to pass the guard, which is
            // why these read differently from the plain `typeof` checks above.
            funnelId:
              typeof patch.funnelId === 'string' || patch.funnelId === null
                ? (patch.funnelId as string | null)
                : undefined,
            funnelPage:
              typeof patch.funnelPage === 'string'
                ? patch.funnelPage
                : undefined,
            destinationUrl:
              typeof patch.destinationUrl === 'string' ||
              patch.destinationUrl === null
                ? (patch.destinationUrl as string | null)
                : undefined,
            // Editable from the planner's card drawer: someone who scheduled a
            // draft in GHL and then published it by hand needs a way to say so
            // without the planner inventing a state it never observed.
            publishState:
              typeof patch.publishState === 'string'
                ? patch.publishState
                : undefined,
            publishTarget:
              typeof patch.publishTarget === 'string'
                ? patch.publishTarget
                : undefined,
            publishRef:
              typeof patch.publishRef === 'string' || patch.publishRef === null
                ? (patch.publishRef as string | null)
                : undefined,
            publishAccounts: Array.isArray(patch.publishAccounts)
              ? patch.publishAccounts
              : undefined,
            publishSyncedAt:
              typeof patch.publishSyncedAt === 'string' ||
              patch.publishSyncedAt === null
                ? (patch.publishSyncedAt as string | null)
                : undefined,
            updatedBy
          } as Parameters<typeof patchContentPlan>[1],
          boards.content.columns
        );
        return NextResponse.json({ success: true, record });
      }

      case 'deletePlan': {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'id is required' },
            { status: 400 }
          );
        }
        await deleteContentPlan(id);
        return NextResponse.json({ success: true });
      }

      case 'upsertLead': {
        const leadId = typeof body.leadId === 'string' ? body.leadId : '';
        if (!leadId) {
          return NextResponse.json(
            { success: false, error: 'leadId is required' },
            { status: 400 }
          );
        }
        const boards = await loadColumns();
        const record = await upsertLeadPipeline(
          {
            leadId,
            funnelId: typeof body.funnelId === 'string' ? body.funnelId : null,
            boardId: boards.leads.id,
            stage: typeof body.stage === 'string' ? body.stage : undefined,
            // Any lead write from this route is a human acting in the admin UI,
            // so the card freezes against further event automation unless the
            // caller explicitly says otherwise.
            stageManual:
              typeof body.stageManual === 'boolean' ? body.stageManual : true,
            owner: typeof body.owner === 'string' ? body.owner : undefined,
            nextAction:
              typeof body.nextAction === 'string' ? body.nextAction : undefined,
            nextActionAt:
              typeof body.nextActionAt === 'string' ||
              body.nextActionAt === null
                ? (body.nextActionAt as string | null)
                : undefined,
            valueCents:
              typeof body.valueCents === 'number' ? body.valueCents : undefined,
            notes: typeof body.notes === 'string' ? body.notes : undefined,
            tags: Array.isArray(body.tags)
              ? (body.tags as unknown[]).filter(
                  (t): t is string => typeof t === 'string'
                )
              : undefined,
            sortOrder:
              typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
            updatedBy
          } as Parameters<typeof upsertLeadPipeline>[0],
          boards.leads.columns
        );
        return NextResponse.json({ success: true, record });
      }

      /*
       * createLead { funnelId, email, firstName?, stage?, owner?, notes?,
       *              valueCents?, nextAction?, nextActionAt?, utmContent? }
       *
       * A lead typed in by hand — the call that came through DMs, the referral
       * from a friend — so the board reflects the whole pipeline instead of only
       * the part that arrived through a form.
       *
       * WHY THIS IS NOT `upsertLead`
       * ----------------------------
       * `upsertLead` writes mothermode_lead_pipeline, whose `lead_id` is a
       * PRIMARY KEY *and* a foreign key into mothermode_sales_funnel_leads. It
       * can only ever decorate a lead that already exists; handed a fresh uuid it
       * fails the FK, and even if it didn't, `listLeadBoard` reads from the leads
       * table, so the card would never render. Creating a lead therefore has to
       * write the lead row first, which is what `captureLead` is for.
       *
       * Two rows, in order, because the FK requires it: the lead, then the
       * pipeline sidecar that puts it in a column.
       */
      case 'createLead': {
        const funnelId = typeof body.funnelId === 'string' ? body.funnelId : '';
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        if (!funnelId) {
          return NextResponse.json(
            { success: false, error: 'funnelId is required' },
            { status: 400 }
          );
        }
        if (!email || !email.includes('@')) {
          return NextResponse.json(
            { success: false, error: 'A valid email is required' },
            { status: 400 }
          );
        }

        // Reuses the capture path rather than inserting directly so a
        // hand-added lead is the same shape as a captured one, and so
        // re-adding an existing email updates that lead instead of failing the
        // (funnel_id, email) unique constraint.
        //
        // Deliberately NOT calling incrementFunnelConversions: `isNew` is true
        // here, but the funnel didn't earn this lead — an admin typed it in.
        // Bumping conversion_count would make the funnel's conversion rate a
        // number that includes leads the funnel never saw.
        const { lead, isNew } = await captureLead({
          funnelId,
          email,
          firstName: typeof body.firstName === 'string' ? body.firstName : null,
          // Attribution for a manual lead is honest about itself: source
          // 'manual', and utm_content only if the admin knows which piece of
          // content produced the conversation. A guess here is worse than a
          // blank, because it is indistinguishable from a tracked click.
          utmSource: 'manual',
          utmMedium: 'admin_entry',
          utmCampaign:
            typeof body.utmCampaign === 'string' ? body.utmCampaign : null,
          utmContent:
            typeof body.utmContent === 'string' ? body.utmContent : null
        });

        const boards = await loadColumns();
        const record = await upsertLeadPipeline(
          {
            leadId: lead.id,
            funnelId,
            boardId: boards.leads.id,
            stage: typeof body.stage === 'string' ? body.stage : undefined,
            stageManual: true,
            owner: typeof body.owner === 'string' ? body.owner : undefined,
            nextAction:
              typeof body.nextAction === 'string' ? body.nextAction : undefined,
            nextActionAt:
              typeof body.nextActionAt === 'string' ||
              body.nextActionAt === null
                ? (body.nextActionAt as string | null)
                : undefined,
            valueCents:
              typeof body.valueCents === 'number' ? body.valueCents : undefined,
            notes: typeof body.notes === 'string' ? body.notes : undefined,
            sortOrder:
              typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
            updatedBy
          } as Parameters<typeof upsertLeadPipeline>[0],
          boards.leads.columns
        );

        // isNew=false means the email already existed on this funnel; the client
        // says "moved onto the board" rather than "created" so the admin isn't
        // told they made something they didn't.
        return NextResponse.json({
          success: true,
          record,
          leadId: lead.id,
          created: isNew
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action || '(none)'}` },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Planner write failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
