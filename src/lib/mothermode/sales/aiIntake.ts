/**
 * Client-safe AI intake + offer stack types for the Sales Funnel self-build.
 *
 * Flow:
 *   1. Admin fills a thin brief (niche/audience/magnet/offer).
 *   2. AI fillIntake expands into a complete intake + OfferStack
 *      (front-end, bonuses, bumps, upsells).
 *   3. Admin edits the stack.
 *   4. AI generate maps stack → all 10 funnel page blocks.
 */

// ---------------------------------------------------------------------------
// Offer stack (money path source of truth)
// ---------------------------------------------------------------------------

export interface OfferStackBonus {
  title: string;
  description: string;
  value: string;
}

export interface OfferStackBump {
  id: string;
  title: string;
  price: string;
  description: string;
  /** Optional image URL; bulk image gen may fill later. */
  imageUrl: string;
}

export interface OfferStackUpsell {
  /** 1–4 */
  slot: number;
  enabled: boolean;
  name: string;
  price: string;
  promise: string;
  /** one_time | subscription */
  billingType: string;
}

export interface OfferStackFrontEnd {
  name: string;
  price: string;
  originalPrice: string;
  promise: string;
  /** Core deliverables / what's inside bullets. */
  deliverables: string[];
}

/**
 * Explicit offer stack the admin authors (or AI fills) before page generation.
 * Nested on the intake so one object travels client ↔ API.
 */
export interface OfferStack {
  frontEnd: OfferStackFrontEnd;
  bonuses: OfferStackBonus[];
  bumps: OfferStackBump[];
  upsells: OfferStackUpsell[];
}

// ---------------------------------------------------------------------------
// Intake brief
// ---------------------------------------------------------------------------

export interface SalesAiIntake {
  niche: string;
  audience: string;
  pain: string;
  magnetName: string;
  magnetPromise: string;
  /** Linked Lead Gen kit slug (optional). */
  leadGenSlug: string;
  offerName: string;
  offerPrice: string;
  /** @deprecated Prefer offerStack.upsells — kept for back-compat with thin briefs. */
  upsell1Name: string;
  upsell1Price: string;
  upsell2Name: string;
  upsell2Price: string;
  upsell3Name: string;
  upsell3Price: string;
  upsell4Name: string;
  upsell4Price: string;
  toneNotes: string;
  /**
   * Art direction. Six flat fields rather than a nested block so the existing
   * setIntakeField / AI-fill allowlist / normalize plumbing carries them without
   * special cases. They are the input side of `FunnelBrief.visual`: until they
   * existed the brief could describe a visual world but nothing could state one,
   * so every generated image fell back to the neutral look.
   *
   * List-ish fields (palette, style, avoid) are comma separated because they are
   * typed into single-line inputs; `splitVisualList` is the one place that splits.
   */
  visualSubject: string;
  visualPalette: string;
  visualStyleKeywords: string;
  visualLighting: string;
  visualComposition: string;
  visualAvoid: string;
  /** Structured money path. */
  offerStack: OfferStack;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean);
}

function slugId(title: string, fallback: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback;
}

export function blankOfferStack(): OfferStack {
  return {
    frontEnd: {
      name: '',
      price: '',
      originalPrice: '',
      promise: '',
      deliverables: [],
    },
    bonuses: [],
    bumps: [],
    upsells: [1, 2, 3, 4].map((slot) => ({
      slot,
      enabled: slot <= 2,
      name: '',
      price: '',
      promise: '',
      billingType: slot === 1 ? 'subscription' : 'one_time',
    })),
  };
}

export function blankSalesAiIntake(): SalesAiIntake {
  return {
    niche: '',
    audience: '',
    pain: '',
    magnetName: '',
    magnetPromise: '',
    leadGenSlug: '',
    offerName: '',
    offerPrice: '',
    upsell1Name: '',
    upsell1Price: '',
    upsell2Name: '',
    upsell2Price: '',
    upsell3Name: '',
    upsell3Price: '',
    upsell4Name: '',
    upsell4Price: '',
    toneNotes: '',
    visualSubject: '',
    visualPalette: '',
    visualStyleKeywords: '',
    visualLighting: '',
    visualComposition: '',
    visualAvoid: '',
    offerStack: blankOfferStack(),
  };
}

export function normalizeOfferStackBonus(raw: unknown): OfferStackBonus {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    title: asStr(o.title),
    description: asStr(o.description),
    value: asStr(o.value),
  };
}

export function normalizeOfferStackBump(raw: unknown, idx = 0): OfferStackBump {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const title = asStr(o.title);
  return {
    id: asStr(o.id) || slugId(title, `bump_${idx + 1}`),
    title,
    price: asStr(o.price),
    description: asStr(o.description),
    imageUrl: asStr(o.imageUrl),
  };
}

export function normalizeOfferStackUpsell(raw: unknown, slotFallback: number): OfferStackUpsell {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const slotNum = typeof o.slot === 'number' ? o.slot : parseInt(String(o.slot || ''), 10);
  const slot = Number.isFinite(slotNum) && slotNum >= 1 && slotNum <= 4 ? slotNum : slotFallback;
  const billing = asStr(o.billingType, 'one_time');
  return {
    slot,
    enabled: asBool(o.enabled, Boolean(asStr(o.name).trim())),
    name: asStr(o.name),
    price: asStr(o.price),
    promise: asStr(o.promise),
    billingType: billing === 'subscription' ? 'subscription' : 'one_time',
  };
}

export function normalizeOfferStack(raw: unknown): OfferStack {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fe = o.frontEnd && typeof o.frontEnd === 'object' ? (o.frontEnd as Record<string, unknown>) : {};
  const bonusesRaw = Array.isArray(o.bonuses) ? o.bonuses : [];
  const bumpsRaw = Array.isArray(o.bumps) ? o.bumps : [];
  const upsellsRaw = Array.isArray(o.upsells) ? o.upsells : [];

  const upsellsBySlot = new Map<number, OfferStackUpsell>();
  upsellsRaw.forEach((u, i) => {
    const n = normalizeOfferStackUpsell(u, i + 1);
    upsellsBySlot.set(n.slot, n);
  });
  const upsells = [1, 2, 3, 4].map((slot) => {
    const existing = upsellsBySlot.get(slot);
    if (existing) return existing;
    return {
      slot,
      enabled: false,
      name: '',
      price: '',
      promise: '',
      billingType: slot === 1 ? 'subscription' : 'one_time',
    };
  });

  return {
    frontEnd: {
      name: asStr(fe.name),
      price: asStr(fe.price),
      originalPrice: asStr(fe.originalPrice),
      promise: asStr(fe.promise),
      deliverables: asStrArr(fe.deliverables),
    },
    bonuses: bonusesRaw.map(normalizeOfferStackBonus).filter((b) => b.title.trim()),
    bumps: bumpsRaw.map((b, i) => normalizeOfferStackBump(b, i)).filter((b) => b.title.trim()),
    upsells,
  };
}

/**
 * Sync flat upsell1–4 name/price fields into offerStack (and vice-versa)
 * so older thin briefs and the new stack UI stay aligned.
 */
export function syncIntakeStack(intake: SalesAiIntake): SalesAiIntake {
  const stack = normalizeOfferStack(intake.offerStack);
  const fe = { ...stack.frontEnd };

  if (!fe.name && intake.offerName) fe.name = intake.offerName;
  if (!fe.price && intake.offerPrice) fe.price = intake.offerPrice;
  if (!intake.offerName && fe.name) intake = { ...intake, offerName: fe.name };
  if (!intake.offerPrice && fe.price) intake = { ...intake, offerPrice: fe.price };

  const flatNames = [intake.upsell1Name, intake.upsell2Name, intake.upsell3Name, intake.upsell4Name];
  const flatPrices = [intake.upsell1Price, intake.upsell2Price, intake.upsell3Price, intake.upsell4Price];

  const upsells = stack.upsells.map((u, i) => {
    const next = { ...u };
    if (!next.name && flatNames[i]) {
      next.name = flatNames[i];
      next.enabled = true;
    }
    if (!next.price && flatPrices[i]) next.price = flatPrices[i];
    return next;
  });

  // Mirror stack → flat for any code still reading flat fields
  const out: SalesAiIntake = {
    ...intake,
    offerName: intake.offerName || fe.name,
    offerPrice: intake.offerPrice || fe.price,
    upsell1Name: upsells[0]?.name || intake.upsell1Name,
    upsell1Price: upsells[0]?.price || intake.upsell1Price,
    upsell2Name: upsells[1]?.name || intake.upsell2Name,
    upsell2Price: upsells[1]?.price || intake.upsell2Price,
    upsell3Name: upsells[2]?.name || intake.upsell3Name,
    upsell3Price: upsells[2]?.price || intake.upsell3Price,
    upsell4Name: upsells[3]?.name || intake.upsell4Name,
    upsell4Price: upsells[3]?.price || intake.upsell4Price,
    offerStack: { ...stack, frontEnd: fe, upsells },
  };
  return out;
}

export function normalizeSalesAiIntake(raw: unknown): SalesAiIntake {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const as = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
  const base = blankSalesAiIntake();
  const intake: SalesAiIntake = {
    niche: as('niche'),
    audience: as('audience'),
    pain: as('pain'),
    magnetName: as('magnetName'),
    magnetPromise: as('magnetPromise'),
    leadGenSlug: as('leadGenSlug'),
    offerName: as('offerName'),
    offerPrice: as('offerPrice'),
    upsell1Name: as('upsell1Name'),
    upsell1Price: as('upsell1Price'),
    upsell2Name: as('upsell2Name'),
    upsell2Price: as('upsell2Price'),
    upsell3Name: as('upsell3Name'),
    upsell3Price: as('upsell3Price'),
    upsell4Name: as('upsell4Name'),
    upsell4Price: as('upsell4Price'),
    toneNotes: as('toneNotes'),
    visualSubject: as('visualSubject'),
    visualPalette: as('visualPalette'),
    visualStyleKeywords: as('visualStyleKeywords'),
    visualLighting: as('visualLighting'),
    visualComposition: as('visualComposition'),
    visualAvoid: as('visualAvoid'),
    offerStack: o.offerStack != null ? normalizeOfferStack(o.offerStack) : base.offerStack,
  };
  return syncIntakeStack(intake);
}

// ---------------------------------------------------------------------------
// Visual direction
// ---------------------------------------------------------------------------

/**
 * Split a comma/semicolon/newline separated field into the array shape
 * `FunnelBriefVisual` wants. One implementation so the admin field, the brief
 * and the image prompts cannot disagree about what a separator is.
 */
export function splitVisualList(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The `visual.*` paths that will be assumed if images are generated now, as
 * dotted brief paths so the pre-flight warning in the editor and the post-run
 * notice from `assumedVisualFields` name the same things.
 *
 * `visual.avoid` is absent on purpose: the prompt builder always has a base
 * avoid list, so an empty avoid field is never an assumption.
 */
export function missingIntakeVisualFields(intake: SalesAiIntake): string[] {
  const gaps: string[] = [];
  if (!(intake.visualSubject || '').trim()) gaps.push('visual.subject');
  if (!splitVisualList(intake.visualPalette).length) gaps.push('visual.palette');
  if (!splitVisualList(intake.visualStyleKeywords).length) gaps.push('visual.styleKeywords');
  if (!(intake.visualLighting || '').trim()) gaps.push('visual.lighting');
  if (!(intake.visualComposition || '').trim()) gaps.push('visual.composition');
  return gaps;
}

/** One-line art direction summary for AI user prompts. Empty when unstated. */
export function formatIntakeVisualForPrompt(intake: SalesAiIntake): string {
  const bits = [
    intake.visualSubject && 'subject: ' + intake.visualSubject,
    intake.visualPalette && 'palette: ' + intake.visualPalette,
    intake.visualStyleKeywords && 'style: ' + intake.visualStyleKeywords,
    intake.visualLighting && 'lighting: ' + intake.visualLighting,
    intake.visualComposition && 'composition: ' + intake.visualComposition,
    intake.visualAvoid && 'avoid: ' + intake.visualAvoid,
  ].filter(Boolean);
  return bits.join(' | ');
}

/** Human-readable stack summary for AI user prompts. */
export function formatOfferStackForPrompt(stack: OfferStack): string {
  const s = normalizeOfferStack(stack);
  const lines: string[] = [];
  lines.push('FRONT-END OFFER');
  lines.push(`- Name: ${s.frontEnd.name || '(not set)'}`);
  lines.push(`- Price: ${s.frontEnd.price || '(not set)'}`);
  lines.push(`- Original / anchor price: ${s.frontEnd.originalPrice || '(not set)'}`);
  lines.push(`- Promise: ${s.frontEnd.promise || '(not set)'}`);
  if (s.frontEnd.deliverables.length) {
    lines.push('- Deliverables:');
    s.frontEnd.deliverables.forEach((d) => lines.push(`  • ${d}`));
  }
  lines.push('');
  lines.push('BONUSES');
  if (!s.bonuses.length) lines.push('- (none)');
  s.bonuses.forEach((b, i) => {
    lines.push(`${i + 1}. ${b.title} (${b.value || 'value TBD'})`);
    if (b.description) lines.push(`   ${b.description}`);
  });
  lines.push('');
  lines.push('ORDER BUMPS (checkout)');
  if (!s.bumps.length) lines.push('- (none)');
  s.bumps.forEach((b, i) => {
    lines.push(`${i + 1}. [${b.id}] ${b.title} — ${b.price || 'price TBD'}`);
    if (b.description) lines.push(`   ${b.description}`);
  });
  lines.push('');
  lines.push('UPSELLS');
  s.upsells.forEach((u) => {
    if (!u.enabled && !u.name) {
      lines.push(`- Upsell ${u.slot}: DISABLED`);
      return;
    }
    lines.push(
      `- Upsell ${u.slot}: ${u.enabled ? 'ON' : 'OFF'} | ${u.name || '(unnamed)'} | ${u.price || '(no price)'} | ${u.billingType}`,
    );
    if (u.promise) lines.push(`  Promise: ${u.promise}`);
  });
  return lines.join('\n');
}
