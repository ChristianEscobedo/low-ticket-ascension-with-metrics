/**
 * The blueprint skills — the agent's hands, one per source table. These are
 * the ONLY path that turns a proposed blueprint into real records, and they
 * run EXCLUSIVELY on the approve route. The gated invariant is structural:
 * the drafters (blueprint.ts) never import this module, and the propose route
 * never calls it — so nothing writes to a source table before a human approves.
 *
 * `materializeBlueprint` walks the blueprint's nodes in dependency order
 * (content → funnel → email → link), resolving each node's local `funnelKey` /
 * `pieceKey` reference to the record id (and slug) the dependency produced,
 * and calls the source table's OWN store — never a raw insert — so the funnel
 * normalizers, the email kit's invariants, and the link's UTM rules all apply
 * exactly as if the admin had built it by hand.
 *
 * Server-only (the service-role stores). Deps are INJECTED (the real ones
 * resolve lazily via dynamic import) so the materializer is unit-testable
 * without booting the integrations layer — the recipe interpreter's pattern.
 */
import {
  salesStepPath,
  type BlueprintNode,
  type BindEmailSequenceSkillInput,
  type CloneFunnelSkillInput,
  type CreateContentCardSkillInput,
  type CreateFunnelSkillInput,
  type CreateTrackedLinkSkillInput,
  type SystemBlueprint,
} from '../../blueprint';

// ---------------------------------------------------------------------------
// The deps — the source tables' own stores, injected for the tests.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BlueprintMaterializeDeps {
  /** Sales + optin funnel writes (create + clone both land here). */
  upsertSalesFunnel: (input: any) => Promise<{ id: string; slug: string }>;
  upsertOptinFunnel: (input: any) => Promise<{ id: string; slug: string }>;
  getSalesFunnelById: (id: string) => Promise<any | null>;
  getOptinFunnelById: (id: string) => Promise<any | null>;
  /** Email kit write. */
  upsertEmailKit: (input: any) => Promise<{ id: string }>;
  /** Tracked link mint. */
  createUtmLink: (input: any) => Promise<{ id: string }>;
  /** Planner card write. */
  upsertContentPlan: (input: any) => Promise<unknown>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The production deps, resolved lazily (keeps vitest off the integrations). */
async function defaultDeps(): Promise<BlueprintMaterializeDeps> {
  const sales = await import('@/lib/mothermode/sales/store');
  const optin = await import('@/lib/mothermode/optin/store');
  const email = await import('@/lib/mothermode/email/store');
  const links = await import('@/lib/mothermode/planner/links');
  const planner = await import('@/lib/mothermode/planner/store');
  return {
    upsertSalesFunnel: (input) => sales.upsertFunnel(input),
    upsertOptinFunnel: (input) => optin.upsertFunnel(input),
    getSalesFunnelById: (id) => sales.getFunnelById(id),
    getOptinFunnelById: (id) => optin.getFunnelById(id),
    upsertEmailKit: (input) => email.upsertKit(input),
    createUtmLink: (input) => links.createUtmLink(input),
    upsertContentPlan: (input) => planner.upsertContentPlan(input),
  };
}

// ---------------------------------------------------------------------------
// The blank-page factories, resolved with the deps (they ride the sales/optin
// types modules). Resolved once per materialization.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
async function blankSalesPages(): Promise<Record<string, any>> {
  const t = await import('@/lib/mothermode/sales/types');
  return {
    optin: t.blankSalesOptin(),
    sales: t.blankSalesPage(),
    vsl: t.blankVslPage(),
    checkout: t.blankCheckout(),
    upsell1: t.blankUpsell(),
    upsell2: t.blankUpsell(),
    upsell3: t.blankUpsell(),
    upsell4: t.blankUpsell(),
    success: t.blankSuccess(),
    access: t.blankAccess(),
    footer: t.blankSalesFooter(),
  };
}

async function blankOptinPages(): Promise<Record<string, any>> {
  const t = await import('@/lib/mothermode/optin/types');
  return {
    optin: t.blankOptinPage(),
    oto: t.blankOptinOto(),
    thankyou: t.blankOptinThankYou(),
    footer: t.blankOptinFooter(),
  };
}

async function blankEmailIntakeAndSequence(): Promise<{
  intake: any;
  sequence: any;
}> {
  const t = await import('@/lib/mothermode/email/types');
  return { intake: t.blankIntake(), sequence: t.blankSequence() };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** '$27' from 2700 ('' when free/unknown) — the funnel blocks read it. */
function priceLabelOf(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return '';
  return cents % 100 === 0
    ? `$${Math.round(cents / 100)}`
    : `$${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// The individual skills
// ---------------------------------------------------------------------------

/** create_funnel: a fresh draft funnel, its pages prefilled from the brief. */
async function runCreateFunnel(
  input: CreateFunnelSkillInput,
  deps: BlueprintMaterializeDeps,
  updatedBy: string | null,
): Promise<{ id: string; slug: string }> {
  if (input.kind === 'optin') {
    const pages = await blankOptinPages();
    const funnel = await deps.upsertOptinFunnel({
      slug: input.slug,
      name: input.name,
      status: 'draft',
      offerSlug: input.offerSlug ?? null,
      ...pages,
      updatedBy,
    });
    return { id: funnel.id, slug: funnel.slug };
  }
  const brief = input.brief;
  const blanks = await blankSalesPages();
  const promise =
    brief && (brief.promise || brief.mechanism)
      ? brief.promise || brief.mechanism
      : `A calmer week with ${input.name}.`;
  const price = priceLabelOf(brief?.priceCents ?? 0);
  const funnel = await deps.upsertSalesFunnel({
    slug: input.slug,
    name: input.name,
    status: 'draft',
    offerSlug: input.offerSlug ?? null,
    optin: {
      ...blanks.optin,
      headline: promise,
      subheadline: brief?.mechanism || brief?.promise || '',
      audience: brief?.audience ?? '',
      benefits: (brief?.angles ?? []).slice(0, 4),
    },
    sales: {
      ...blanks.sales,
      name: input.name,
      tagline: promise,
      priceCents: brief?.priceCents ?? 0,
      priceLabel: price,
      headline: promise,
      subheadline: brief?.mechanism ?? '',
    },
    checkout: {
      ...blanks.checkout,
      headline: input.name,
      subheadline: promise,
      priceLabel: price,
      priceCents: brief?.priceCents ?? 0,
      productName: input.name,
      bullets: (brief?.angles ?? []).slice(0, 4),
    },
    vsl: blanks.vsl,
    upsell1: blanks.upsell1,
    upsell2: blanks.upsell2,
    upsell3: blanks.upsell3,
    upsell4: blanks.upsell4,
    success: blanks.success,
    access: blanks.access,
    footer: blanks.footer,
    updatedBy,
  });
  return { id: funnel.id, slug: funnel.slug };
}

/** clone_funnel: a faithful copy of the parent under a new slug — the variant
 *  canvas. (The optimization mode's "rework" is the owner's edit on the
 *  variant; the blueprint materializes the canvas + the recovery wiring.) */
async function runCloneFunnel(
  input: CloneFunnelSkillInput,
  deps: BlueprintMaterializeDeps,
  updatedBy: string | null,
): Promise<{ id: string; slug: string }> {
  if (input.kind === 'optin') {
    const parent = await deps.getOptinFunnelById(input.parentFunnelId);
    if (!parent) throw new Error('clone_funnel: the parent opt-in funnel is gone');
    const funnel = await deps.upsertOptinFunnel({
      slug: input.slug,
      name: input.name,
      status: 'draft',
      offerSlug: parent.offerSlug ?? null,
      leadGenSlug: parent.leadGenSlug ?? null,
      optin: parent.optin,
      oto: parent.oto,
      thankyou: parent.thankyou,
      footer: parent.footer,
      updatedBy,
    });
    return { id: funnel.id, slug: funnel.slug };
  }
  const parent = await deps.getSalesFunnelById(input.parentFunnelId);
  if (!parent) throw new Error('clone_funnel: the parent sales funnel is gone');
  const funnel = await deps.upsertSalesFunnel({
    slug: input.slug,
    name: input.name,
    status: 'draft',
    offerSlug: parent.offerSlug ?? null,
    leadGenSlug: parent.leadGenSlug ?? null,
    optin: parent.optin,
    sales: parent.sales,
    vsl: parent.vsl,
    checkout: parent.checkout,
    upsell1: parent.upsell1,
    upsell2: parent.upsell2,
    upsell3: parent.upsell3,
    upsell4: parent.upsell4,
    success: parent.success,
    access: parent.access,
    footer: parent.footer,
    updatedBy,
  });
  return { id: funnel.id, slug: funnel.slug };
}

/** bind_email_sequence: create the kit (draft), then bind it to the funnel's
 *  event — the sales funnel's multi-event `emailKits` map, or the opt-in
 *  funnel's single `emailKitId`. */
async function runBindEmailSequence(
  input: BindEmailSequenceSkillInput,
  funnelId: string,
  deps: BlueprintMaterializeDeps,
  updatedBy: string | null,
): Promise<{ id: string }> {
  const { intake, sequence } = await blankEmailIntakeAndSequence();
  const kit = await deps.upsertEmailKit({
    slug: `${input.kitName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'sequence'}-${funnelId.replace(/-/g, '').slice(0, 8)}`,
    name: input.kitName,
    campaignType: input.campaignType || 'nurture-to-offer',
    framework: 'story-lesson',
    status: 'draft',
    intake: { ...intake, goal: input.goal },
    sequence,
    updatedBy,
  });

  if (input.funnelKind === 'optin') {
    const funnel = await deps.getOptinFunnelById(funnelId);
    if (!funnel) throw new Error('bind_email_sequence: the opt-in funnel is gone');
    await deps.upsertOptinFunnel({
      id: funnel.id,
      slug: funnel.slug,
      name: funnel.name,
      status: funnel.status,
      offerSlug: funnel.offerSlug ?? null,
      leadGenSlug: funnel.leadGenSlug ?? null,
      emailKitId: kit.id,
      optin: funnel.optin,
      oto: funnel.oto,
      thankyou: funnel.thankyou,
      footer: funnel.footer,
      updatedBy,
    });
  } else {
    const funnel = await deps.getSalesFunnelById(funnelId);
    if (!funnel) throw new Error('bind_email_sequence: the sales funnel is gone');
    const bindings = Array.isArray(funnel.emailKits) ? [...funnel.emailKits] : [];
    const existing = bindings.findIndex((b: any) => b?.event === input.event);
    const binding = { event: input.event, emailKitId: kit.id };
    if (existing >= 0) bindings[existing] = binding;
    else bindings.push(binding);
    await deps.upsertSalesFunnel({
      id: funnel.id,
      slug: funnel.slug,
      name: funnel.name,
      status: funnel.status,
      offerSlug: funnel.offerSlug ?? null,
      leadGenSlug: funnel.leadGenSlug ?? null,
      emailKitId: funnel.emailKitId ?? null,
      emailKits: bindings,
      optin: funnel.optin,
      sales: funnel.sales,
      vsl: funnel.vsl,
      checkout: funnel.checkout,
      upsell1: funnel.upsell1,
      upsell2: funnel.upsell2,
      upsell3: funnel.upsell3,
      upsell4: funnel.upsell4,
      success: funnel.success,
      access: funnel.access,
      footer: funnel.footer,
      updatedBy,
    });
  }
  return { id: kit.id };
}

/** create_tracked_link: mint the /go/<code> link pointing at the funnel page,
 *  carried by the content piece when one is linked. */
async function runCreateTrackedLink(
  input: CreateTrackedLinkSkillInput,
  funnel: { id: string; slug: string },
  pieceId: string | null,
  deps: BlueprintMaterializeDeps,
  updatedBy: string | null,
): Promise<{ id: string }> {
  const stepPath = input.funnelKind === 'optin' ? '' : salesStepPath(input.funnelPage);
  const base = input.funnelKind === 'optin' ? '/optin/' : '/funnel/';
  const baseUrl = `${base}${funnel.slug}${stepPath}`;
  const link = await deps.createUtmLink({
    ...(input.funnelKind === 'optin'
      ? { optinFunnelId: funnel.id }
      : { funnelId: funnel.id }),
    funnelPage: input.funnelPage,
    pieceId: pieceId ?? '',
    label: input.label,
    baseUrl,
    utmSource: input.utmSource,
    utmMedium: 'blueprint',
    utmContent: pieceId ?? undefined,
    withShortLink: true,
    createdBy: updatedBy,
  });
  return { id: link.id };
}

/** create_content_card: the planner card the link hangs on. */
async function runCreateContentCard(
  input: CreateContentCardSkillInput,
  deps: BlueprintMaterializeDeps,
  updatedBy: string | null,
): Promise<{ id: string }> {
  await deps.upsertContentPlan({
    pieceId: input.pieceId,
    offerSlug: input.offerSlug ?? undefined,
    platform: input.platform,
    format: input.format,
    kind: input.kind,
    title: input.title,
    notes: input.notes ?? '',
    publishState: '',
    updatedBy,
  });
  return { id: input.pieceId };
}

// ---------------------------------------------------------------------------
// The orchestrator
// ---------------------------------------------------------------------------

/** What one materialized node produced (the id the map will need). */
export interface MaterializedNode {
  key: string;
  kind: BlueprintNode['kind'];
  id: string;
}

/** The dependency rank: content and funnels have no in-blueprint deps, emails
 *  bind to a funnel, links point at a funnel (+ optionally a piece). */
function rankOf(node: BlueprintNode): number {
  if (node.kind === 'content') return 0;
  if (node.kind === 'funnel') return 1;
  if (node.kind === 'email') return 2;
  if (node.kind === 'link') return 3;
  return 4; // page — informational, never materialized directly
}

/**
 * Materialize an APPROVED blueprint: run each node's skill in dependency
 * order and return what was created. Throws on the first failure — a
 * half-materialized system must surface loudly, never silently (the approve
 * route marks the blueprint failed, not materialized).
 *
 * This is the ONLY write path. It is never called during propose.
 */
export async function materializeBlueprint(
  blueprint: Pick<SystemBlueprint, 'nodes'>,
  opts: { updatedBy?: string | null; deps?: Partial<BlueprintMaterializeDeps> } = {},
): Promise<{ created: MaterializedNode[] }> {
  const deps: BlueprintMaterializeDeps = {
    ...(await defaultDeps()),
    ...opts.deps,
  };
  const updatedBy = opts.updatedBy ?? null;

  // The created records, by node key — the reference pool funnelKey/pieceKey
  // resolve against.
  const createdByKey = new Map<string, { id: string; slug?: string; pieceId?: string }>();
  const created: MaterializedNode[] = [];

  const ordered = blueprint.nodes
    .filter((n) => n.skill !== null)
    .sort((a, b) => rankOf(a) - rankOf(b));

  for (const node of ordered) {
    const skill = node.skill!;
    const input = skill.input as Record<string, unknown>;

    if (skill.name === 'create_content_card') {
      const card = input as unknown as CreateContentCardSkillInput;
      const result = await runCreateContentCard(card, deps, updatedBy);
      createdByKey.set(node.key, { id: result.id, pieceId: card.pieceId });
      created.push({ key: node.key, kind: node.kind, id: result.id });
    } else if (skill.name === 'create_funnel') {
      const result = await runCreateFunnel(
        input as unknown as CreateFunnelSkillInput,
        deps,
        updatedBy,
      );
      createdByKey.set(node.key, { id: result.id, slug: result.slug });
      created.push({ key: node.key, kind: node.kind, id: result.id });
    } else if (skill.name === 'clone_funnel') {
      const result = await runCloneFunnel(
        input as unknown as CloneFunnelSkillInput,
        deps,
        updatedBy,
      );
      createdByKey.set(node.key, { id: result.id, slug: result.slug });
      created.push({ key: node.key, kind: node.kind, id: result.id });
    } else if (skill.name === 'bind_email_sequence') {
      const bind = input as unknown as BindEmailSequenceSkillInput;
      const funnelRef = createdByKey.get(bind.funnelKey);
      if (!funnelRef) {
        throw new Error(
          `bind_email_sequence: funnel "${bind.funnelKey}" hasn't been created yet`,
        );
      }
      const result = await runBindEmailSequence(bind, funnelRef.id, deps, updatedBy);
      createdByKey.set(node.key, { id: result.id });
      created.push({ key: node.key, kind: node.kind, id: result.id });
    } else if (skill.name === 'create_tracked_link') {
      const link = input as unknown as CreateTrackedLinkSkillInput;
      const funnelRef = createdByKey.get(link.funnelKey);
      if (!funnelRef?.slug) {
        throw new Error(
          `create_tracked_link: funnel "${link.funnelKey}" hasn't been created yet`,
        );
      }
      const pieceId = link.pieceKey
        ? createdByKey.get(link.pieceKey)?.pieceId ?? null
        : null;
      const result = await runCreateTrackedLink(
        link,
        { id: funnelRef.id, slug: funnelRef.slug },
        pieceId,
        deps,
        updatedBy,
      );
      createdByKey.set(node.key, { id: result.id });
      created.push({ key: node.key, kind: node.kind, id: result.id });
    }
  }

  return { created };
}
