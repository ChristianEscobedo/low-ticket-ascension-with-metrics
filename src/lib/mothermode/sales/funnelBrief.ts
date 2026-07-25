/**
 * Funnel brief — the congruence substrate for Tasks B (copy), C (images) and D (scripts).
 *
 * Why this exists (see docs/SALES_FUNNEL_AI_AUTOFILL_TASK.md §2 bullet 3):
 * per-page AI calls drift. Each page invents its own promise, its own avatar
 * language, its own visual world. The brief is generated/authored ONCE per
 * funnel, persisted, and then every page-copy call, image-prompt derivation and
 * video script reads from it. It is deliberately small — it carries the things
 * that must be identical across pages, not the page copy itself.
 *
 * Field provenance (all verified against the real shapes, not guessed):
 *   - `audience`, `promise`  ← `SalesAiIntake` (niche, audience, pain,
 *                              magnetPromise, toneNotes)
 *   - `offer`                ← `OfferStack` (frontEnd/bonuses/bumps/upsells)
 *   - `identity`             ← the 6 identity-bearing fields the coverage audit
 *                              found rendering MotherMode literals in every
 *                              generated funnel: SalesPageContent.brandLine,
 *                              conversionLine, generationalLine, categoryLine,
 *                              founderName, founderRole — plus
 *                              SalesFooterContent.brandLine/disclaimer, which no
 *                              AI schema asks for at all.
 *   - `visual`               ← nothing today; Task C fills it. Declared now so
 *                              images and copy share one brief instead of two.
 *
 * Deliberate non-goal: this module never invents brand identity. If the intake
 * does not say who the founder is, `founderName` stays empty. An empty field is
 * a visible hole; `'Loni Brown'` in someone else's funnel is confident, wrong
 * copy — which is the exact failure the audit surfaced.
 */

import type { OfferStack, SalesAiIntake } from './aiIntake';
import { normalizeOfferStack } from './aiIntake';

export const FUNNEL_BRIEF_VERSION = 1;

/** How a brief came to exist. Drives whether a regenerate may overwrite it. */
export type FunnelBriefSource = 'derived' | 'ai' | 'manual';

/**
 * Brand-level identity. These are the fields that must never differ between
 * the sales page, the footer, an upsell and an email — they are the funnel's
 * signature, not per-page copy.
 */
export interface FunnelBriefIdentity {
  /** Business/product brand shown in chrome. → sales.brandLine, footer.brandLine */
  brandName: string;
  /** Short positioning line under the brand. → sales.brandLine when distinct */
  brandLine: string;
  /** Category framing. → sales.categoryLine */
  categoryLine: string;
  /** The transformation in ~3 words. → sales.conversionLine */
  conversionLine: string;
  /** The stakes / legacy line. → sales.generationalLine */
  generationalLine: string;
  /** → sales.founderName */
  founderName: string;
  /** → sales.founderRole */
  founderRole: string;
  /** → footer.disclaimer (no AI schema asks for this today) */
  disclaimer: string;
}

/** Who this is for, in the words they would use about themselves. */
export interface FunnelBriefAudience {
  niche: string;
  /** One-sentence avatar. */
  avatar: string;
  /** The pain in their language, not marketing language. */
  pain: string;
  /** What they want instead. */
  desire: string;
  /** What stops them buying. Feeds objection-handling copy + FAQ. */
  objections: string[];
}

/** The single argument every page is making a different slice of. */
export interface FunnelBriefPromise {
  /** The one sentence the whole funnel is arguing. */
  bigIdea: string;
  /** Primary outcome promised at the front end. */
  primaryPromise: string;
  /** Named mechanism / method. Congruence killer if it drifts per page. */
  mechanismName: string;
  mechanismSummary: string;
  /** What the old/broken way looks like — the foil the copy pushes against. */
  oldWay: string;
  /** Credibility angle: what makes this believable. */
  proofAngle: string;
}

/** Voice constraints applied to every generated string. */
export interface FunnelBriefVoice {
  /** Free-form tone direction from the intake. */
  toneNotes: string;
  /** e.g. "warm peer, never guru". */
  persona: string;
  /** Phrases that should recur across pages. */
  signaturePhrases: string[];
  /** Banned words/claims. Compliance + brand safety. */
  doNotSay: string[];
}

/**
 * Shared visual world for Task C. Copy and images must derive from the same
 * brief or the page reads as two different products.
 */
export interface FunnelBriefVisual {
  /** Recurring subject across image slots (who/what is in frame). */
  subject: string;
  /** Hex or named colours. */
  palette: string[];
  /** Style adjectives fed into image prompts. */
  styleKeywords: string[];
  lighting: string;
  composition: string;
  /** Negative prompt material. */
  avoid: string[];
}

/** Money-path snapshot. Denormalized from OfferStack so prompts need one object. */
export interface FunnelBriefOffer {
  name: string;
  price: string;
  originalPrice: string;
  promise: string;
  deliverables: string[];
  bonusTitles: string[];
  bumpTitles: string[];
  /** Enabled upsells only, in slot order. */
  upsellNames: string[];
}

export interface FunnelBrief {
  version: number;
  /** Funnel this brief belongs to. Empty until the funnel is saved. */
  funnelSlug: string;
  source: FunnelBriefSource;
  /** ISO timestamp; empty on a blank brief. */
  generatedAt: string;
  identity: FunnelBriefIdentity;
  audience: FunnelBriefAudience;
  promise: FunnelBriefPromise;
  voice: FunnelBriefVoice;
  visual: FunnelBriefVisual;
  offer: FunnelBriefOffer;
}

// ---------------------------------------------------------------------------
// Helpers (same conventions as aiIntake.ts / types.ts)
// ---------------------------------------------------------------------------

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function toSource(v: unknown): FunnelBriefSource {
  return v === 'ai' || v === 'manual' || v === 'derived' ? v : 'derived';
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export function blankFunnelBrief(): FunnelBrief {
  return {
    version: FUNNEL_BRIEF_VERSION,
    funnelSlug: '',
    source: 'derived',
    generatedAt: '',
    identity: {
      brandName: '',
      brandLine: '',
      categoryLine: '',
      conversionLine: '',
      generationalLine: '',
      founderName: '',
      founderRole: '',
      disclaimer: '',
    },
    audience: { niche: '', avatar: '', pain: '', desire: '', objections: [] },
    promise: {
      bigIdea: '',
      primaryPromise: '',
      mechanismName: '',
      mechanismSummary: '',
      oldWay: '',
      proofAngle: '',
    },
    voice: { toneNotes: '', persona: '', signaturePhrases: [], doNotSay: [] },
    visual: { subject: '', palette: [], styleKeywords: [], lighting: '', composition: '', avoid: [] },
    offer: {
      name: '',
      price: '',
      originalPrice: '',
      promise: '',
      deliverables: [],
      bonusTitles: [],
      bumpTitles: [],
      upsellNames: [],
    },
  };
}

export function normalizeFunnelBrief(raw: unknown): FunnelBrief {
  const o = obj(raw);
  const identity = obj(o.identity);
  const audience = obj(o.audience);
  const promise = obj(o.promise);
  const voice = obj(o.voice);
  const visual = obj(o.visual);
  const offer = obj(o.offer);

  return {
    version: typeof o.version === 'number' ? o.version : FUNNEL_BRIEF_VERSION,
    funnelSlug: asStr(o.funnelSlug),
    source: toSource(o.source),
    generatedAt: asStr(o.generatedAt),
    identity: {
      brandName: asStr(identity.brandName),
      brandLine: asStr(identity.brandLine),
      categoryLine: asStr(identity.categoryLine),
      conversionLine: asStr(identity.conversionLine),
      generationalLine: asStr(identity.generationalLine),
      founderName: asStr(identity.founderName),
      founderRole: asStr(identity.founderRole),
      disclaimer: asStr(identity.disclaimer),
    },
    audience: {
      niche: asStr(audience.niche),
      avatar: asStr(audience.avatar),
      pain: asStr(audience.pain),
      desire: asStr(audience.desire),
      objections: asStrArr(audience.objections),
    },
    promise: {
      bigIdea: asStr(promise.bigIdea),
      primaryPromise: asStr(promise.primaryPromise),
      mechanismName: asStr(promise.mechanismName),
      mechanismSummary: asStr(promise.mechanismSummary),
      oldWay: asStr(promise.oldWay),
      proofAngle: asStr(promise.proofAngle),
    },
    voice: {
      toneNotes: asStr(voice.toneNotes),
      persona: asStr(voice.persona),
      signaturePhrases: asStrArr(voice.signaturePhrases),
      doNotSay: asStrArr(voice.doNotSay),
    },
    visual: {
      subject: asStr(visual.subject),
      palette: asStrArr(visual.palette),
      styleKeywords: asStrArr(visual.styleKeywords),
      lighting: asStr(visual.lighting),
      composition: asStr(visual.composition),
      avoid: asStrArr(visual.avoid),
    },
    offer: {
      name: asStr(offer.name),
      price: asStr(offer.price),
      originalPrice: asStr(offer.originalPrice),
      promise: asStr(offer.promise),
      deliverables: asStrArr(offer.deliverables),
      bonusTitles: asStrArr(offer.bonusTitles),
      bumpTitles: asStrArr(offer.bumpTitles),
      upsellNames: asStrArr(offer.upsellNames),
    },
  };
}

/** Money-path slice, read straight off the stack. No invention. */
export function funnelBriefOfferFromStack(stack: OfferStack): FunnelBriefOffer {
  const s = normalizeOfferStack(stack);
  return {
    name: s.frontEnd.name,
    price: s.frontEnd.price,
    originalPrice: s.frontEnd.originalPrice,
    promise: s.frontEnd.promise,
    deliverables: s.frontEnd.deliverables.filter(Boolean),
    bonusTitles: s.bonuses.map((b) => b.title).filter(Boolean),
    bumpTitles: s.bumps.map((b) => b.title).filter(Boolean),
    upsellNames: s.upsells
      .filter((u) => u.enabled && u.name.trim())
      .sort((a, b) => a.slot - b.slot)
      .map((u) => u.name),
  };
}

/**
 * Derive as much of the brief as the intake actually supports.
 *
 * Everything the intake genuinely knows is copied across. Everything it does
 * not — identity, mechanism name, objections, the whole visual block — is left
 * empty for the AI pass or the admin to fill. That emptiness is the point: it
 * is what the coverage audit can see and count.
 */
export function funnelBriefFromIntake(
  intake: SalesAiIntake,
  opts: { funnelSlug?: string; brandName?: string } = {},
): FunnelBrief {
  const brief = blankFunnelBrief();
  const offer = funnelBriefOfferFromStack(intake.offerStack);

  return {
    ...brief,
    funnelSlug: opts.funnelSlug ?? '',
    source: 'derived',
    identity: {
      ...brief.identity,
      brandName: opts.brandName ?? '',
    },
    audience: {
      ...brief.audience,
      niche: intake.niche,
      avatar: intake.audience,
      pain: intake.pain,
      // The magnet promise is the only "desire" statement a thin intake carries.
      desire: intake.magnetPromise,
    },
    promise: {
      ...brief.promise,
      primaryPromise: offer.promise || intake.magnetPromise,
    },
    voice: { ...brief.voice, toneNotes: intake.toneNotes },
    offer: {
      ...offer,
      name: offer.name || intake.offerName,
      price: offer.price || intake.offerPrice,
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

function section(lines: string[], title: string, rows: [string, string][]): void {
  const filled = rows.filter(([, v]) => v.trim());
  if (!filled.length) return;
  lines.push(title);
  filled.forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
  lines.push('');
}

function listLine(label: string, items: string[]): string {
  return items.length ? `${label}: ${items.join(' | ')}` : '';
}

/**
 * Human-readable brief for AI user prompts. Mirrors
 * `formatOfferStackForPrompt` so both can be concatenated into one message.
 *
 * Empty fields are omitted rather than printed as "(not set)": a model shown
 * `founderName: (not set)` tends to invent one, which is the failure mode this
 * whole module exists to prevent.
 */
export function formatFunnelBriefForPrompt(brief: FunnelBrief): string {
  const b = normalizeFunnelBrief(brief);
  const lines: string[] = ['FUNNEL BRIEF (authoritative — every page must agree with this)', ''];

  section(lines, 'IDENTITY', [
    ['Brand', b.identity.brandName],
    ['Brand line', b.identity.brandLine],
    ['Category line', b.identity.categoryLine],
    ['Conversion line', b.identity.conversionLine],
    ['Generational line', b.identity.generationalLine],
    ['Founder', b.identity.founderName],
    ['Founder role', b.identity.founderRole],
    ['Disclaimer', b.identity.disclaimer],
  ]);

  section(lines, 'AUDIENCE', [
    ['Niche', b.audience.niche],
    ['Avatar', b.audience.avatar],
    ['Pain', b.audience.pain],
    ['Desire', b.audience.desire],
    ['Objections', b.audience.objections.join(' | ')],
  ]);

  section(lines, 'PROMISE', [
    ['Big idea', b.promise.bigIdea],
    ['Primary promise', b.promise.primaryPromise],
    ['Mechanism', b.promise.mechanismName],
    ['Mechanism summary', b.promise.mechanismSummary],
    ['Old way', b.promise.oldWay],
    ['Proof angle', b.promise.proofAngle],
  ]);

  section(lines, 'VOICE', [
    ['Tone', b.voice.toneNotes],
    ['Persona', b.voice.persona],
    ['Signature phrases', b.voice.signaturePhrases.join(' | ')],
    ['Never say', b.voice.doNotSay.join(' | ')],
  ]);

  section(lines, 'VISUAL WORLD (images must match this)', [
    ['Subject', b.visual.subject],
    ['Palette', b.visual.palette.join(' | ')],
    ['Style', b.visual.styleKeywords.join(' | ')],
    ['Lighting', b.visual.lighting],
    ['Composition', b.visual.composition],
    ['Avoid', b.visual.avoid.join(' | ')],
  ]);

  section(lines, 'OFFER', [
    ['Name', b.offer.name],
    ['Price', b.offer.price],
    ['Anchor price', b.offer.originalPrice],
    ['Promise', b.offer.promise],
    ['Deliverables', b.offer.deliverables.join(' | ')],
    ['Bonuses', b.offer.bonusTitles.join(' | ')],
    ['Order bumps', b.offer.bumpTitles.join(' | ')],
    ['Upsells', b.offer.upsellNames.join(' | ')],
  ]);

  return lines.join('\n').trimEnd();
}

/**
 * Fields that are still empty, as dotted paths. The AI brief pass targets this
 * list, and the coverage audit can assert on it, so "the brief is complete"
 * stays a measurable claim rather than a feeling.
 */
export function funnelBriefGaps(brief: FunnelBrief): string[] {
  const b = normalizeFunnelBrief(brief);
  const gaps: string[] = [];

  const scalar: [string, string][] = [
    ['identity.brandName', b.identity.brandName],
    ['identity.brandLine', b.identity.brandLine],
    ['identity.categoryLine', b.identity.categoryLine],
    ['identity.conversionLine', b.identity.conversionLine],
    ['identity.generationalLine', b.identity.generationalLine],
    ['identity.founderName', b.identity.founderName],
    ['identity.founderRole', b.identity.founderRole],
    ['identity.disclaimer', b.identity.disclaimer],
    ['audience.niche', b.audience.niche],
    ['audience.avatar', b.audience.avatar],
    ['audience.pain', b.audience.pain],
    ['audience.desire', b.audience.desire],
    ['promise.bigIdea', b.promise.bigIdea],
    ['promise.primaryPromise', b.promise.primaryPromise],
    ['promise.mechanismName', b.promise.mechanismName],
    ['promise.mechanismSummary', b.promise.mechanismSummary],
    ['promise.oldWay', b.promise.oldWay],
    ['promise.proofAngle', b.promise.proofAngle],
    ['voice.toneNotes', b.voice.toneNotes],
    ['voice.persona', b.voice.persona],
    ['visual.subject', b.visual.subject],
    ['visual.lighting', b.visual.lighting],
    ['visual.composition', b.visual.composition],
    ['offer.name', b.offer.name],
    ['offer.price', b.offer.price],
    ['offer.promise', b.offer.promise],
  ];
  scalar.forEach(([path, v]) => {
    if (!v.trim()) gaps.push(path);
  });

  const lists: [string, string[]][] = [
    ['audience.objections', b.audience.objections],
    ['voice.signaturePhrases', b.voice.signaturePhrases],
    ['visual.palette', b.visual.palette],
    ['visual.styleKeywords', b.visual.styleKeywords],
    ['offer.deliverables', b.offer.deliverables],
  ];
  lists.forEach(([path, v]) => {
    if (!v.length) gaps.push(path);
  });

  return gaps;
}

/** True when nothing the downstream generators depend on is still empty. */
export function isFunnelBriefComplete(brief: FunnelBrief): boolean {
  return funnelBriefGaps(brief).length === 0;
}

// Silences the unused-import lint if `listLine` is dropped later; it is used by
// callers building compact one-line summaries.
export { listLine as formatFunnelBriefListLine };
