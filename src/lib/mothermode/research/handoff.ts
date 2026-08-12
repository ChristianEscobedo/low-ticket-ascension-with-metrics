/**
 * Research Lab handoffs: turn an artifact's structured payload into a REAL
 * thing elsewhere in the suite — planner cards, a Lead Gen Kit, an Email Kit,
 * a Sales Funnel draft — then stamp the artifact's handed_off_to.
 *
 * Two depths:
 *   DRAFT  (generate: false) — create with intake pre-filled; the owner
 *          presses Generate in the target editor.
 *   BUILD  (generate: true)  — create AND run the target's own pipeline
 *          (leadgen aiGenerateDoc, email aiGenerateSequence), so the owner
 *          lands on a drafted editor.
 *
 * And one composition: `system` — the Full System builder. One offer brief
 * fans out into the whole machine (lead magnet + opt-in funnel + nurture
 * email kit + sales funnel draft + planner cards), cross-linked and
 * research-context-stamped, with a manifest persisted on the artifact.
 *
 * Every handoff goes through the target's OWN store (never raw inserts), so
 * the planner's upsert-on-conflict semantics, the email kit's HTML render
 * invariant, and the funnel normalizers all apply exactly as if the admin had
 * created the row in that editor.
 *
 * Server-only (service-role stores).
 */
import {
  normalizeContentPlanItems,
  normalizeLeadMagnetConcept,
  normalizeEmailOutline,
  normalizeOfferBrief,
  normalizeReelBrief,
  normalizeReelCuePlan,
  type HandedOffRef,
  type ResearchArtifact,
  type ResearchSession,
} from './types';
import { getArtifact, upsertArtifact } from './store';
import { intakeBriefBlock } from './intake';
import { upsertContentPlan } from '@/lib/mothermode/planner/store';
import {
  upsertKit as upsertLeadGenKit,
  getKitBySlug as getLeadGenKitBySlug,
} from '@/lib/mothermode/leadgen/store';
import {
  blankIntake as blankLeadGenIntake,
  blankDoc,
  LEAD_MAGNET_FORMATS,
  type LeadMagnetFormat,
} from '@/lib/mothermode/leadgen/types';
import { aiGenerateDoc } from '@/utils/integrations/openai-leadgen';
import {
  upsertKit as upsertEmailKit,
  getKitBySlug as getEmailKitBySlug,
} from '@/lib/mothermode/email/store';
import {
  blankIntake as blankEmailIntake,
  blankSequence,
  EMAIL_CAMPAIGN_TYPES,
  type EmailCampaignType,
} from '@/lib/mothermode/email/types';
import { aiGenerateSequence } from '@/utils/integrations/openai-email';
import {
  upsertFunnel,
  getFunnelBySlug as getSalesFunnelBySlug,
} from '@/lib/mothermode/sales/store';
import {
  blankSalesOptin,
  blankSalesPage,
  blankVslPage,
  blankCheckout,
  blankUpsell,
  blankSuccess,
  blankAccess,
  blankSalesFooter,
  slugifySalesName,
} from '@/lib/mothermode/sales/types';
import {
  upsertFunnel as upsertOptinFunnel,
  getFunnelBySlug as getOptinFunnelBySlug,
} from '@/lib/mothermode/optin/store';
import {
  blankOptinPage,
  blankOptinOto,
  blankOptinThankYou,
  blankOptinFooter,
} from '@/lib/mothermode/optin/types';
import { resolveContextRefs } from '@/lib/mothermode/context/resolve';
import type { ContextRef } from '@/lib/mothermode/context';
import {
  blankSalesAiIntake,
  type SalesAiIntake,
} from '@/lib/mothermode/sales/aiIntake';
import { aiGenerateSalesFunnel } from '@/utils/integrations/openai-sales';
import type { OfferBrief } from './types';
import {
  getReelProject,
  upsertReelProject,
} from '@/lib/mothermode/reel/store';
import {
  makeClipId,
  normalizeMediaCueStyle,
  type ReelMediaCue,
} from '@/lib/mothermode/reel/types';
import { suggestCuesForWords } from '@/lib/mothermode/reel/cueSuggest';
import {
  ingestMediaAsset,
  listMediaAssets,
} from '@/lib/mothermode/reel/mediaLibrary';
import {
  generateContentImage,
  imageSizeForFormat,
} from '@/utils/integrations/openai-content';
import { hostGeneratedImage } from '@/utils/mothermode/storage';

export type HandoffTarget = HandedOffRef['kind'];

export type HandoffResult =
  | { ok: true; handedOffTo: HandedOffRef; artifact: ResearchArtifact }
  | { ok: false; error: string; status: number };

function slugify(text: string, fallback: string): string {
  const s = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

/** Unique-per-artifact slug suffix so re-handing-off never collides. */
function suffixOf(artifactId: string): string {
  return artifactId.replace(/-/g, '').slice(0, 8) || 'x';
}

/**
 * Replay-safety (idempotency keys, extended to the handoff's single-row
 * targets): every slug below is DETERMINISTIC — it carries the artifact's
 * suffix, so a retried step names the same row. Resolving the slug to the
 * row's id before the upsert turns the store's `onConflict: 'id'` write
 * into an UPDATE: a lane resume, an owner retry, or a double-fired gate
 * approval rewrites the same kit/funnel instead of dying on the UNIQUE
 * slug constraint. (Planner cards were already safe: deterministic piece
 * ids upsert on `piece_id,offer_slug`.)
 *
 * A failed lookup degrades to null — the write proceeds as an insert,
 * exactly as before; if that guess is wrong, the DB's UNIQUE(slug) fails
 * the handoff LOUDLY. The one outcome this rules out is the silent
 * duplicate.
 */
async function existingRowId(
  lookup: (slug: string) => Promise<{ id: string } | null>,
  slug: string,
): Promise<string | null> {
  try {
    return (await lookup(slug))?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The research-context preset stamped onto every generated output: the offer
 * ref (when scoped) plus the session's research brief as an inline text pack,
 * so downstream generators inherit the language and numbers the owner
 * researched, not just the target's intake.
 */
function researchContextRefs(session: ResearchSession): ContextRef[] {
  const refs: ContextRef[] = [];
  if (session.offerSlug) refs.push({ kind: 'offer', id: session.offerSlug });
  const brief = intakeBriefBlock(session.intake);
  if (brief) {
    refs.push({
      kind: 'text',
      id: 'research-brief',
      label: 'Research brief',
      value: brief,
    });
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

async function handoffToPlanner(
  artifact: ResearchArtifact,
  session: ResearchSession,
  updatedBy: string | null,
): Promise<HandoffResult> {
  const items = normalizeContentPlanItems(artifact.structured?.items);
  if (items.length === 0) {
    return {
      ok: false,
      error:
        'This artifact has no plan items to send. Ask the agent to shape it as a content-plan/ad-angles payload first.',
      status: 400,
    };
  }
  if (items.length > 60) {
    return { ok: false, error: 'Too many items (max 60 per handoff).', status: 400 };
  }

  const adAngles = artifact.type === 'ad-angles';
  let created = 0;
  for (const [i, item] of Array.from(items.entries())) {
    const pieceId = `research_${suffixOf(artifact.id)}_${i + 1}`;
    const scheduledAt = item.date
      ? new Date(`${item.date}T09:00:00`).toISOString()
      : null;
    await upsertContentPlan({
      pieceId,
      offerSlug: session.offerSlug || undefined,
      platform: item.platform,
      format: item.format,
      kind: adAngles ? 'paid' : item.kind,
      title: item.title,
      scheduledAt,
      notes: [item.hook, item.notes].filter(Boolean).join('\n\n'),
      publishState: '',
      updatedBy,
    });
    created += 1;
  }

  const handedOffTo: HandedOffRef = {
    kind: 'planner-cards',
    id: '',
    label: `${created} planner card${created === 1 ? '' : 's'}`,
    count: created,
    at: new Date().toISOString(),
  };
  return finish(artifact, handedOffTo);
}

async function handoffToLeadGenKit(
  artifact: ResearchArtifact,
  session: ResearchSession,
  updatedBy: string | null,
  generate: boolean,
): Promise<HandoffResult> {
  const concept = normalizeLeadMagnetConcept(artifact.structured);
  if (!concept.title) {
    return {
      ok: false,
      error: 'This artifact has no lead-magnet title in its structured payload.',
      status: 400,
    };
  }
  const format = (LEAD_MAGNET_FORMATS as readonly string[]).includes(
    concept.format,
  )
    ? (concept.format as LeadMagnetFormat)
    : 'guide';
  const name = concept.title;
  const slug = `${slugify(name, 'lead-magnet')}-${suffixOf(artifact.id)}`;
  const intake = {
    ...blankLeadGenIntake(),
    topic: concept.title,
    audience: concept.audience,
    goal: 'opt-in',
    transformation: concept.promise,
    cta: concept.cta,
    offerSlug: session.offerSlug,
    notes: [
      concept.outline.length
        ? `OUTLINE:\n${concept.outline.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        : '',
      concept.notes,
      artifact.markdown ? `\nRESEARCH NOTES:\n${artifact.markdown.slice(0, 3000)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
  const kit = await upsertLeadGenKit({
    // Replay: the deterministic slug resolves to the existing row's id, so
    // a retried handoff UPDATES instead of dying on UNIQUE(slug).
    id: await existingRowId(getLeadGenKitBySlug, slug),
    slug,
    name,
    format,
    status: 'draft',
    intake,
    doc: blankDoc(),
    updatedBy,
  });

  let label = kit.name || name;
  if (generate) {
    const doc = await aiGenerateDoc(kit.intake, kit.format);
    if (!doc.ok) {
      return {
        ok: false,
        error: `Kit created (${kit.id}) but generation failed: ${doc.error}. Open it in the Lead Gen Kit editor and press Generate.`,
        status: 502,
      };
    }
    await upsertLeadGenKit({
      id: kit.id,
      slug: kit.slug,
      name: kit.name,
      format: kit.format,
      status: kit.status,
      intake: kit.intake,
      doc: doc.data,
      updatedBy,
    });
    label = `${label} (drafted)`;
  }

  const handedOffTo: HandedOffRef = {
    kind: 'leadgen-kit',
    id: kit.id,
    label,
    at: new Date().toISOString(),
  };
  return finish(artifact, handedOffTo);
}

async function handoffToEmailKit(
  artifact: ResearchArtifact,
  session: ResearchSession,
  updatedBy: string | null,
  generate: boolean,
): Promise<HandoffResult> {
  const outline = normalizeEmailOutline(artifact.structured);
  if (!outline.goal && outline.emails.length === 0) {
    return {
      ok: false,
      error: 'This artifact has no email goal or email list in its structured payload.',
      status: 400,
    };
  }
  const campaignType = (EMAIL_CAMPAIGN_TYPES as readonly string[]).includes(
    outline.campaignType,
  )
    ? (outline.campaignType as EmailCampaignType)
    : 'nurture-to-offer';
  const name = artifact.title || outline.goal || 'Research email kit';
  const slug = `${slugify(name, 'email-kit')}-${suffixOf(artifact.id)}`;
  const intake = {
    ...blankEmailIntake(),
    audience: outline.audience,
    goal: outline.goal,
    offerSlug: session.offerSlug,
    notes: [
      outline.emails.length
        ? `EMAIL PLAN:\n${outline.emails
            .map((e, i) => `${i + 1}. ${e.title}: ${e.idea}`)
            .join('\n')}`
        : '',
      outline.notes,
      artifact.markdown ? `\nRESEARCH NOTES:\n${artifact.markdown.slice(0, 3000)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
  const contextRefs = researchContextRefs(session);
  const kit = await upsertEmailKit({
    // Replay: see existingRowId — deterministic slug -> update, not 23505.
    id: await existingRowId(getEmailKitBySlug, slug),
    slug,
    name,
    campaignType,
    framework: 'story-lesson',
    status: 'draft',
    intake,
    contextRefs,
    sequence: blankSequence(),
    updatedBy,
  });

  let label = kit.name || name;
  if (generate) {
    const packs = await resolveContextRefs(contextRefs);
    const seq = await aiGenerateSequence(
      kit.intake,
      kit.campaignType,
      kit.framework,
      packs,
    );
    if (!seq.ok) {
      return {
        ok: false,
        error: `Kit created (${kit.id}) but generation failed: ${seq.error}. Open it in the Email Kit editor and press Generate.`,
        status: 502,
      };
    }
    await upsertEmailKit({
      id: kit.id,
      slug: kit.slug,
      name: kit.name,
      campaignType: kit.campaignType,
      framework: kit.framework,
      status: kit.status,
      intake: kit.intake,
      contextRefs: kit.contextRefs,
      sequence: seq.data,
      updatedBy,
    });
    label = `${label} (drafted)`;
  }

  const handedOffTo: HandedOffRef = {
    kind: 'email-kit',
    id: kit.id,
    label,
    at: new Date().toISOString(),
  };
  return finish(artifact, handedOffTo);
}

/**
 * '$27' from 2700 ('' when free/unknown) — the format the funnel blocks and
 * the AI intake both read.
 */
function priceLabelOf(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return '';
  return cents % 100 === 0
    ? `$${Math.round(cents / 100)}`
    : `$${(cents / 100).toFixed(2)}`;
}

/**
 * The deterministic prefill: the offer brief's real content mapped onto the
 * funnel's opt-in, sales, and checkout blocks so the editor never opens
 * empty. No AI — this is the DRAFT floor; the build path regenerates
 * everything on top of it.
 */
function salesPagesFromBrief(brief: OfferBrief, name: string) {
  const promise =
    brief.promise || brief.mechanism || `A calmer week with ${name}.`;
  const price = priceLabelOf(brief.priceCents);
  const optin = {
    ...blankSalesOptin(),
    eyebrow: 'Free guide',
    headline: promise,
    subheadline: brief.mechanism || brief.promise,
    audience: brief.audience,
    benefits: brief.angles.slice(0, 4),
    ctaText: 'Send it to me',
    badgeText: 'Instant access',
    magnetTitle: name,
    magnetDescription: promise,
  };
  const sales = {
    ...blankSalesPage(),
    name,
    tagline: promise,
    priceCents: brief.priceCents,
    priceLabel: price,
    headline: promise,
    subheadline: brief.mechanism,
    promise,
    audience: brief.audience,
    ctaText: `Get ${name}`,
  };
  const checkout = {
    ...blankCheckout(),
    headline: name,
    subheadline: promise,
    priceLabel: price,
    priceCents: brief.priceCents,
    productName: name,
    bullets: brief.angles.slice(0, 4),
  };
  return { optin, sales, checkout };
}

/** The AI self-build intake, assembled from the offer brief + the research
 *  language (tone notes), so every generated page speaks from the evidence. */
function salesIntakeFromBrief(
  brief: OfferBrief,
  artifact: ResearchArtifact,
  session: ResearchSession,
): SalesAiIntake {
  const name = brief.name || artifact.title;
  const intake = blankSalesAiIntake();
  intake.offerName = name;
  intake.offerPrice = priceLabelOf(brief.priceCents);
  intake.audience = brief.audience || session.intake.audience;
  intake.pain = brief.notes || brief.audience;
  intake.magnetName = `${name} Starter Guide`;
  intake.magnetPromise = brief.promise || brief.mechanism;
  intake.toneNotes = artifact.markdown.slice(0, 3000);
  intake.offerStack = {
    ...intake.offerStack,
    frontEnd: {
      name,
      price: intake.offerPrice,
      originalPrice: '',
      promise: brief.promise || brief.mechanism,
      deliverables: brief.angles,
    },
  };
  return intake;
}

async function handoffToSalesFunnel(
  artifact: ResearchArtifact,
  session: ResearchSession,
  updatedBy: string | null,
  generate: boolean,
): Promise<HandoffResult> {
  const brief = normalizeOfferBrief(artifact.structured);
  const name = brief.name || artifact.title;
  if (!name) {
    return {
      ok: false,
      error: 'This artifact has no offer name in its structured payload.',
      status: 400,
    };
  }
  const pages = salesPagesFromBrief(brief, name);
  const slug = `${slugifySalesName(name) || 'offer'}-${suffixOf(artifact.id)}`;
  const funnel = await upsertFunnel({
    // Replay: see existingRowId — deterministic slug -> update, not 23505.
    id: await existingRowId(getSalesFunnelBySlug, slug),
    slug,
    name,
    status: 'draft',
    offerSlug: session.offerSlug || null,
    leadGenSlug: null,
    optin: pages.optin,
    sales: pages.sales,
    vsl: blankVslPage(),
    checkout: pages.checkout,
    upsell1: blankUpsell(),
    upsell2: blankUpsell(),
    upsell3: blankUpsell(),
    upsell4: blankUpsell(),
    success: blankSuccess(),
    access: blankAccess(),
    footer: blankSalesFooter(),
    updatedBy,
  });

  let label = funnel.name || name;
  if (generate) {
    // The build path: the editor's own self-build pipeline fills EVERY page
    // from the brief-built intake. A generation failure keeps the drafted
    // funnel (with the deterministic prefill) and says so honestly.
    const intake = salesIntakeFromBrief(brief, artifact, session);
    const bundle = await aiGenerateSalesFunnel(intake);
    if (!bundle.ok) {
      return {
        ok: false,
        error: `Funnel created (${funnel.id}) but page generation failed: ${bundle.error}. Open it in the Sales Funnel editor and press Generate.`,
        status: 502,
      };
    }
    await upsertFunnel({
      id: funnel.id,
      slug: funnel.slug,
      name: bundle.data.name || name,
      status: funnel.status,
      leadGenSlug: funnel.leadGenSlug,
      optin: bundle.data.optin,
      sales: bundle.data.sales,
      vsl: bundle.data.vsl,
      checkout: bundle.data.checkout,
      upsell1: bundle.data.upsell1,
      upsell2: bundle.data.upsell2,
      upsell3: bundle.data.upsell3,
      upsell4: bundle.data.upsell4,
      success: bundle.data.success,
      access: bundle.data.access,
      footer: bundle.data.footer,
      updatedBy,
    });
    label = `${label} (built)`;
  }

  const handedOffTo: HandedOffRef = {
    kind: 'sales-funnel',
    id: funnel.id,
    label,
    at: new Date().toISOString(),
  };
  return finish(artifact, handedOffTo);
}

// ---------------------------------------------------------------------------
// The Full System builder
// ---------------------------------------------------------------------------

export interface SystemBuildPart {
  kind: 'leadgen-kit' | 'optin-funnel' | 'email-kit' | 'sales-funnel' | 'planner-cards';
  id: string;
  label: string;
  href: string;
}

/**
 * One offer brief -> the whole machine: lead magnet (built), opt-in funnel,
 * nurture email kit (built), sales funnel draft, and planner cards. Each part
 * is created through its own store with the research-context preset stamped
 * in, and the manifest is persisted on the artifact's structured payload.
 */
async function runSystemBuild(
  artifact: ResearchArtifact,
  session: ResearchSession,
  updatedBy: string | null,
): Promise<HandoffResult> {
  const brief = normalizeOfferBrief(artifact.structured);
  const name = brief.name || artifact.title;
  if (!name) {
    return {
      ok: false,
      error: 'This artifact has no offer name in its structured payload.',
      status: 400,
    };
  }
  const parts: SystemBuildPart[] = [];
  const suffix = suffixOf(artifact.id);
  const magnetTitle = `${name} Starter Guide`;
  const magnetPromise =
    brief.promise || brief.mechanism || `A calmer week with ${name}.`;

  // 1. Lead Gen Kit (built) ------------------------------------------------
  const leadIntake = {
    ...blankLeadGenIntake(),
    topic: magnetTitle,
    audience: brief.audience || session.intake.audience,
    goal: 'opt-in',
    transformation: magnetPromise,
    cta: brief.notes || `Get ${name}.`,
    offerSlug: session.offerSlug,
    notes: [
      brief.mechanism ? `MECHANISM: ${brief.mechanism}` : '',
      brief.angles.length ? `ANGLES:\n${brief.angles.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : '',
      artifact.markdown ? `\nRESEARCH NOTES:\n${artifact.markdown.slice(0, 3000)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
  const leadKitSlug = `${slugify(magnetTitle, 'lead-magnet')}-${suffix}`;
  const leadKit = await upsertLeadGenKit({
    // Replay-safe: deterministic slug resolves to the existing row (see
    // existingRowId) — a fan-out retry rewrites parts, never duplicates.
    id: await existingRowId(getLeadGenKitBySlug, leadKitSlug),
    slug: leadKitSlug,
    name: magnetTitle,
    format: 'guide',
    status: 'draft',
    intake: leadIntake,
    doc: blankDoc(),
    updatedBy,
  });
  const leadDoc = await aiGenerateDoc(leadKit.intake, leadKit.format);
  if (leadDoc.ok) {
    await upsertLeadGenKit({
      id: leadKit.id,
      slug: leadKit.slug,
      name: leadKit.name,
      format: leadKit.format,
      status: leadKit.status,
      intake: leadKit.intake,
      doc: leadDoc.data,
      updatedBy,
    });
  }
  parts.push({
    kind: 'leadgen-kit',
    id: leadKit.id,
    label: leadDoc.ok ? `${leadKit.name} (drafted)` : `${leadKit.name} (draft, generation failed)`,
    href: `/admin/lead-gen?kit=${leadKit.id}`,
  });

  // 2. Opt-in funnel (draft, linked to the magnet + offer) ------------------
  const optinSlug = `${slugify(name, 'offer')}-optin-${suffix}`;
  const optin = await upsertOptinFunnel({
    id: await existingRowId(getOptinFunnelBySlug, optinSlug),
    slug: optinSlug,
    name: `${name} opt-in`,
    status: 'draft',
    offerSlug: session.offerSlug || null,
    leadGenSlug: leadKit.slug,
    optin: blankOptinPage(),
    oto: blankOptinOto(),
    thankyou: blankOptinThankYou(),
    footer: blankOptinFooter(),
    updatedBy,
  });
  parts.push({
    kind: 'optin-funnel',
    id: optin.id,
    label: optin.name || `${name} opt-in`,
    href: '/admin/funnels',
  });

  // 3. Nurture Email Kit (built) --------------------------------------------
  const emailContextRefs = researchContextRefs(session);
  const emailIntake = {
    ...blankEmailIntake(),
    audience: brief.audience || session.intake.audience,
    goal: brief.promise ? `Sell ${name}: ${brief.promise}` : `Sell ${name}.`,
    offerSlug: session.offerSlug,
    notes: [
      brief.mechanism ? `MECHANISM: ${brief.mechanism}` : '',
      artifact.markdown ? `RESEARCH NOTES:\n${artifact.markdown.slice(0, 3000)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
  const emailKitSlug = `${slugify(name, 'offer')}-nurture-${suffix}`;
  const emailKit = await upsertEmailKit({
    id: await existingRowId(getEmailKitBySlug, emailKitSlug),
    slug: emailKitSlug,
    name: `${name} nurture`,
    campaignType: 'nurture-to-offer',
    framework: 'story-lesson',
    status: 'draft',
    intake: emailIntake,
    contextRefs: emailContextRefs,
    sequence: blankSequence(),
    updatedBy,
  });
  const packs = await resolveContextRefs(emailContextRefs);
  const seq = await aiGenerateSequence(
    emailKit.intake,
    emailKit.campaignType,
    emailKit.framework,
    packs,
  );
  if (seq.ok) {
    await upsertEmailKit({
      id: emailKit.id,
      slug: emailKit.slug,
      name: emailKit.name,
      campaignType: emailKit.campaignType,
      framework: emailKit.framework,
      status: emailKit.status,
      intake: emailKit.intake,
      contextRefs: emailKit.contextRefs,
      sequence: seq.data,
      updatedBy,
    });
  }
  parts.push({
    kind: 'email-kit',
    id: emailKit.id,
    label: seq.ok ? `${emailKit.name} (drafted)` : `${emailKit.name} (draft, generation failed)`,
    href: `/admin/email-marketing?kit=${emailKit.id}`,
  });

  // 4. Sales funnel draft (with the offer brief's copy pre-filled) ----------
  const salesPages = salesPagesFromBrief(brief, name);
  const funnelSlug = `${slugifySalesName(name) || 'offer'}-${suffix}`;
  const funnel = await upsertFunnel({
    id: await existingRowId(getSalesFunnelBySlug, funnelSlug),
    slug: funnelSlug,
    name,
    status: 'draft',
    offerSlug: session.offerSlug || null,
    leadGenSlug: leadKit.slug,
    optin: salesPages.optin,
    sales: salesPages.sales,
    vsl: blankVslPage(),
    checkout: salesPages.checkout,
    upsell1: blankUpsell(),
    upsell2: blankUpsell(),
    upsell3: blankUpsell(),
    upsell4: blankUpsell(),
    success: blankSuccess(),
    access: blankAccess(),
    footer: blankSalesFooter(),
    updatedBy,
  });
  parts.push({
    kind: 'sales-funnel',
    id: funnel.id,
    label: funnel.name || name,
    href: '/admin/sales-funnels',
  });

  // 5. Planner cards (one per angle) -----------------------------------------
  let cards = 0;
  const angles = brief.angles.slice(0, 6);
  for (const [i, angle] of Array.from(angles.entries())) {
    await upsertContentPlan({
      pieceId: `research_system_${suffix}_${i + 1}`,
      offerSlug: session.offerSlug || undefined,
      platform: 'instagram',
      format: 'feed',
      kind: 'organic',
      title: `${name}: ${angle.slice(0, 60)}`,
      notes: angle,
      publishState: '',
      updatedBy,
    });
    cards += 1;
  }
  parts.push({
    kind: 'planner-cards',
    id: '',
    label: `${cards} planner card${cards === 1 ? '' : 's'}`,
    href: '/admin/planner',
  });

  const handedOffTo: HandedOffRef = {
    kind: 'system',
    id: '',
    label: `Full system: ${parts.length} parts`,
    count: parts.length,
    at: new Date().toISOString(),
  };
  const updated = await upsertArtifact({
    id: artifact.id,
    sessionId: artifact.sessionId,
    status: 'handed-off',
    handedOffTo,
    structured: { ...artifact.structured, systemManifest: parts },
  });
  return { ok: true, handedOffTo, artifact: updated };
}

// ---------------------------------------------------------------------------
// Reel Cue Autopilot (media-cue handoff)
// ---------------------------------------------------------------------------

/**
 * 'reel-cues': attach an approved reel-cue-plan's beats to the reel as media
 * cues. FREE BEFORE PAID is the rule: each beat first tries the Media Library
 * (the same deterministic matcher the studio's "auto" button runs), and only
 * an unmatched beat spends an image generation — and only when the step was
 * told to Build (generate: true). Generated images are hosted and ingested
 * into the library, so the next run's beats match against them for free.
 *
 * One cue per (clip, word) — a re-run REPLACES the same address instead of
 * doubling (the studio's attachCue semantics). Beats whose word fell out of
 * the transcript (a re-transcribe between propose and approve) are skipped
 * and named in the label, never silently attached to the wrong word.
 */
async function handoffToReelCues(
  artifact: ResearchArtifact,
  _session: ResearchSession,
  updatedBy: string | null,
  generate: boolean,
): Promise<HandoffResult> {
  const plan = normalizeReelCuePlan(artifact.structured);
  if (!plan.projectId || plan.beats.length === 0) {
    return {
      ok: false,
      error: 'The cue plan needs a reel project id and at least one beat.',
      status: 400,
    };
  }
  const project = await getReelProject(plan.projectId);
  if (!project) {
    return {
      ok: false,
      error: 'Reel project not found — the plan points at a reel that no longer exists.',
      status: 404,
    };
  }

  const library = await listMediaAssets({ kind: 'image' });
  const usedUrls = new Set<string>();
  const cues: ReelMediaCue[] = [];
  const skipped: string[] = [];
  let matched = 0;
  let generated = 0;

  for (const beat of plan.beats) {
    const words = project.captions[beat.clipId] ?? [];
    if (!words[beat.wordIndex]) {
      skipped.push(beat.word || `${beat.clipId}#${beat.wordIndex}`);
      continue;
    }
    // 1 — the library first (free). One beat, one image; a used image can't
    // serve a second beat (the studio's one-cue-per-pair rule).
    const proposal = suggestCuesForWords(
      [{ word: beat.word, start: 0, end: 1 }],
      library.filter((a) => !usedUrls.has(a.url)),
      1,
    )[0];
    let url = proposal?.url ?? '';
    if (url) {
      matched += 1;
      usedUrls.add(url);
    } else if (generate) {
      // 2 — generate (paid), host it, keep it in the library for next time.
      try {
        const result = await generateContentImage(
          beat.imagePrompt,
          imageSizeForFormat('reel'),
        );
        if (result.ok) {
          const hosted = await hostGeneratedImage(result.data);
          if (/^https?:\/\//i.test(hosted)) {
            url = hosted;
            generated += 1;
            usedUrls.add(url);
            await ingestMediaAsset({
              name: `${beat.imagePrompt.slice(0, 60)} (cue autopilot)`,
              url,
              kind: 'image',
              source: 'generated',
              tags: ['ai-image', 'cue-autopilot'],
              refId: artifact.id,
              refKind: 'recipe-run',
            });
          }
        }
      } catch {
        /* a failed generation skips the beat — it never blocks the rest */
      }
    }
    if (!url) {
      skipped.push(beat.word || beat.imagePrompt.slice(0, 30));
      continue;
    }
    const style = beat.style ? normalizeMediaCueStyle(beat.style) : undefined;
    cues.push({
      id: makeClipId(),
      clipId: beat.clipId,
      wordIndex: beat.wordIndex,
      url,
      ...(style ? { style } : {}),
    });
  }

  if (!cues.length) {
    return {
      ok: false,
      error:
        'No beats landed — every proposed cue either missed its word or found no image.',
      status: 400,
    };
  }

  const replaceKeys = new Set(cues.map((c) => `${c.clipId}:${c.wordIndex}`));
  const mediaCues = [
    ...(project.mediaCues ?? []).filter((c) => !replaceKeys.has(`${c.clipId}:${c.wordIndex}`)),
    ...cues,
  ];
  const saved = await upsertReelProject({
    id: project.id,
    name: project.name,
    clips: project.clips,
    audio: project.audio,
    composedUrl: project.composedUrl,
    composedAt: project.composedAt,
    captions: project.captions,
    captionStyle: project.captionStyle,
    captionOverrides: project.captionOverrides,
    overlays: project.overlays,
    mediaCues,
    updatedBy,
  });
  if (!saved) {
    return { ok: false, error: 'The reel save failed.', status: 500 };
  }

  const parts = [`${cues.length} cue(s)`];
  if (matched) parts.push(`${matched} matched free`);
  if (generated) parts.push(`${generated} generated`);
  if (skipped.length) parts.push(`skipped: ${skipped.slice(0, 3).join(', ')}`);
  return finish(artifact, {
    kind: 'reel-cues',
    id: project.id,
    label: `${project.name || 'Reel'} — ${parts.join(' · ')}`,
    count: cues.length,
    at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Lead Magnet Reel Day targets (the reel-brief + gated-delivery handoffs)
// ---------------------------------------------------------------------------

/**
 * 'reel-brief': turn an approved reel brief into the day's reel canvas + the
 * planner card the owner films from. Creates a NAMED reel project (empty
 * clips — the studio opens it as the canvas) and a planner card carrying the
 * full script, the hook variants, and the filming recommendations.
 */
async function handoffToReelBrief(
  artifact: ResearchArtifact,
  session: ResearchSession,
  updatedBy: string | null,
): Promise<HandoffResult> {
  const brief = normalizeReelBrief(artifact.structured);
  const title = brief.title || brief.magnetTitle || artifact.title;
  if (!title) {
    return { ok: false, error: 'The reel brief needs a title.', status: 400 };
  }
  const suffix = suffixOf(artifact.id);
  // The studio canvas: a named, empty project the owner opens and builds into.
  const reel = await upsertReelProject({
    name: `Reel: ${title}`.slice(0, 150),
    clips: [],
    audio: null,
    updatedBy,
  });
  if (!reel) return { ok: false, error: 'The reel project save failed.', status: 500 };

  // The day card: the script + hooks + filming recs the owner films from.
  const notes = [
    brief.hook ? `HOOK: ${brief.hook}` : '',
    brief.beats.length ? `SCRIPT:\n${brief.beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}` : '',
    brief.cta ? `CTA: ${brief.cta}${brief.linkUrl ? ` (${brief.linkUrl})` : ''}` : '',
    brief.hooks.length ? `HOOK VARIANTS:\n${brief.hooks.map((h) => `- ${h}`).join('\n')}` : '',
    brief.filming.length ? `FILMING:\n${brief.filming.map((f) => `- ${f}`).join('\n')}` : '',
    artifact.markdown ? `\nBRIEF:\n${artifact.markdown.slice(0, 1500)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  await upsertContentPlan({
    pieceId: `research_reel_${suffix}`,
    offerSlug: session.offerSlug || undefined,
    platform: 'instagram',
    format: 'reel',
    kind: 'organic',
    title: `Reel: ${title.slice(0, 60)}`,
    notes,
    publishState: '',
    updatedBy,
  });

  return finish(artifact, {
    kind: 'reel-brief',
    id: reel.id,
    label: `${reel.name || title} + planner card`,
    count: 2,
    at: new Date().toISOString(),
  });
}

/**
 * 'gated-delivery' (the gated path): gate the magnet behind an opt-in page and
 * deliver it by email. Builds the opt-in funnel page (linked to the offer)
 * plus the delivery email kit (generated, carrying the magnet link). Fires on
 * APPROVAL of the gate step; canceling it is the free path — the magnet's
 * public link is the CTA and nothing gated is built.
 */
async function handoffToGatedDelivery(
  artifact: ResearchArtifact,
  session: ResearchSession,
  updatedBy: string | null,
): Promise<HandoffResult> {
  const brief = normalizeReelBrief(artifact.structured);
  const magnetTitle = brief.magnetTitle || brief.title || artifact.title;
  if (!magnetTitle) {
    return { ok: false, error: 'The brief needs a magnet title to gate.', status: 400 };
  }
  const linkUrl = brief.linkUrl;
  const suffix = suffixOf(artifact.id);

  // 1. The opt-in page (lead capture), linked to the offer.
  const optinSlug = `${slugify(magnetTitle, 'magnet')}-optin-${suffix}`;
  const optin = await upsertOptinFunnel({
    id: await existingRowId(getOptinFunnelBySlug, optinSlug),
    slug: optinSlug,
    name: `${magnetTitle} opt-in`,
    status: 'draft',
    offerSlug: session.offerSlug || null,
    leadGenSlug: null,
    optin: blankOptinPage(),
    oto: blankOptinOto(),
    thankyou: blankOptinThankYou(),
    footer: blankOptinFooter(),
    updatedBy,
  });

  // 2. The delivery email (built), carrying the magnet link.
  const emailSlug = `${slugify(magnetTitle, 'magnet')}-delivery-${suffix}`;
  const emailIntake = {
    ...blankEmailIntake(),
    audience: session.intake.audience,
    goal: `Deliver ${magnetTitle}${linkUrl ? ` at ${linkUrl}` : ''} and point to the next step.`,
    offerSlug: session.offerSlug,
    notes: artifact.markdown ? `BRIEF:\n${artifact.markdown.slice(0, 2000)}` : '',
  };
  const emailKit = await upsertEmailKit({
    id: await existingRowId(getEmailKitBySlug, emailSlug),
    slug: emailSlug,
    name: `${magnetTitle} delivery`,
    campaignType: 'leadmag-to-lowticket',
    framework: 'quick-win',
    status: 'draft',
    intake: emailIntake,
    contextRefs: researchContextRefs(session),
    sequence: blankSequence(),
    updatedBy,
  });
  const packs = await resolveContextRefs(researchContextRefs(session));
  const seq = await aiGenerateSequence(
    emailKit.intake,
    emailKit.campaignType,
    emailKit.framework,
    packs,
  );
  if (seq.ok) {
    await upsertEmailKit({
      id: emailKit.id,
      slug: emailKit.slug,
      name: emailKit.name,
      campaignType: emailKit.campaignType,
      framework: emailKit.framework,
      status: emailKit.status,
      intake: emailKit.intake,
      contextRefs: emailKit.contextRefs,
      sequence: seq.data,
      updatedBy,
    });
  }

  return finish(artifact, {
    kind: 'gated-delivery',
    id: optin.id,
    label: `${optin.name || magnetTitle} opt-in + delivery email${seq.ok ? '' : ' (draft)'}`,
    count: 2,
    at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function finish(
  artifact: ResearchArtifact,
  handedOffTo: HandedOffRef,
): Promise<HandoffResult> {
  const updated = await upsertArtifact({
    id: artifact.id,
    sessionId: artifact.sessionId,
    status: 'handed-off',
    handedOffTo,
  });
  return { ok: true, handedOffTo, artifact: updated };
}

/**
 * Run a handoff. Loads the artifact (server-side source of truth; the client
 * sends only ids), dispatches to the target, stamps the artifact.
 */
export async function runHandoff(opts: {
  artifactId: string;
  target: HandoffTarget;
  session: ResearchSession;
  generate?: boolean;
  updatedBy?: string | null;
}): Promise<HandoffResult> {
  const artifact = await getArtifact(opts.artifactId);
  if (!artifact || artifact.sessionId !== opts.session.id) {
    return { ok: false, error: 'artifact not found', status: 404 };
  }
  const updatedBy = opts.updatedBy ?? null;
  const generate = opts.generate === true;
  switch (opts.target) {
    case 'planner-cards':
      return handoffToPlanner(artifact, opts.session, updatedBy);
    case 'leadgen-kit':
      return handoffToLeadGenKit(artifact, opts.session, updatedBy, generate);
    case 'email-kit':
      return handoffToEmailKit(artifact, opts.session, updatedBy, generate);
    case 'sales-funnel':
      return handoffToSalesFunnel(artifact, opts.session, updatedBy, generate);
    case 'system':
      return runSystemBuild(artifact, opts.session, updatedBy);
    case 'reel-cues':
      return handoffToReelCues(artifact, opts.session, updatedBy, generate);
    case 'reel-brief':
      return handoffToReelBrief(artifact, opts.session, updatedBy);
    case 'gated-delivery':
      return handoffToGatedDelivery(artifact, opts.session, updatedBy);
    default:
      return { ok: false, error: 'unknown handoff target', status: 400 };
  }
}
