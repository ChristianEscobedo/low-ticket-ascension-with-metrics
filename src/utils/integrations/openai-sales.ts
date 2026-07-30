/**
 * MotherMode Sales Funnel AI generator (server-only).
 *
 * From a short intake (niche, audience, magnet, offer, price, upsells) produces
 * a full set of all 10 funnel blocks in Editorial Warm voice:
 * optin + sales + vsl + checkout + upsell1-4 + success + access.
 *
 * Mirrors openai-optin.ts: OpenAI JSON mode with Anthropic fallback, defensive
 * normalizers so bad replies degrade to blanks. Never import from a browser bundle.
 */
import {
  normalizeSalesOptin,
  normalizeSalesPage,
  normalizeVslPage,
  normalizeCheckout,
  normalizeUpsell,
  normalizeSuccess,
  normalizeAccess,
  normalizeSalesFooter,
  type SalesOptinContent,
  type SalesPageContent,
  type VslPageContent,
  type CheckoutContent,
  type UpsellContent,
  type SuccessContent,
  type AccessContent,
  type SalesFooterContent,
} from '@/lib/mothermode/sales/types';
import type { SalesAiIntake } from '@/lib/mothermode/sales/aiIntake';
import {
  funnelBriefFromIntake,
  formatFunnelBriefForPrompt,
} from '@/lib/mothermode/sales/funnelBrief';
import {
  blankSalesAiIntake,
  formatIntakeVisualForPrompt,
  formatOfferStackForPrompt,
  normalizeOfferStack,
  normalizeSalesAiIntake,
  syncIntakeStack,
} from '@/lib/mothermode/sales/aiIntake';
import { BRAND, FOUNDER } from '@/lib/mothermode/brand';
import { getTextModel, type TextProvider } from '@/lib/mothermode/content/models';
import {
  getOpenAiKey,
  getAnthropicKey,
  getMoonshotKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';

// Re-export intake helpers so server callers can import from one place.
export type { SalesAiIntake, OfferStack } from '@/lib/mothermode/sales/aiIntake';
export {
  blankSalesAiIntake,
  blankOfferStack,
  normalizeSalesAiIntake,
  normalizeOfferStack,
  syncIntakeStack,
  formatOfferStackForPrompt,
} from '@/lib/mothermode/sales/aiIntake';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MOONSHOT_BASE = 'https://api.moonshot.cn/v1';
const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';
const DEFAULT_MOONSHOT_TEXT_MODEL = 'kimi-k3';

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export interface SalesAiBundle {
  name: string;
  slugHint: string;
  optin: SalesOptinContent;
  sales: SalesPageContent;
  vsl: VslPageContent;
  checkout: CheckoutContent;
  upsell1: UpsellContent;
  upsell2: UpsellContent;
  upsell3: UpsellContent;
  upsell4: UpsellContent;
  success: SuccessContent;
  access: AccessContent;
  footer: SalesFooterContent;
}

// ---------------------------------------------------------------------------
// Provider plumbing (same pattern as openai-optin)
// ---------------------------------------------------------------------------

const VOICE_RULES = `
VOICE AND COMPLIANCE (always):
- Brand: ${BRAND.name}. Line: "${BRAND.brandLine}". Founder: ${FOUNDER.name}.
- Calm authority. Specific over clever. Lead with the reader, never the sale.
- Periods over exclamation points. No em dashes or en dashes; use commas,
  periods, or a colon.
- No hype, no false scarcity, no income/earnings claims, no medical claims.
- Banned words/phrases: thrive, mama, empower, journey, girlboss, boss babe,
  superwoman, lean in, self-care (as a fix), hustle culture praise.
- Plain, concrete language a real person would say out loud.
- Headline may split into headline + headlineEmphasis (italic middle) + headlineSuffix.
`.trim();

type TextConfig =
  | { ok: true; provider: TextProvider; model: string; key: string }
  | { ok: false; error: string };

async function resolveTextConfig(): Promise<TextConfig> {
  const openaiKey = await getOpenAiKey();
  const anthropicKey = await getAnthropicKey();
  const moonshotKey = await getMoonshotKey();
  if (!openaiKey && !anthropicKey && !moonshotKey) {
    return { ok: false, error: 'No AI provider key configured.' };
  }

  const overrideModel = await getTextModelOverride();
  const overridePick = getTextModel(overrideModel);
  if (overridePick) {
    const key =
      overridePick.provider === 'anthropic'
        ? anthropicKey
        : overridePick.provider === 'moonshot'
          ? moonshotKey
          : openaiKey;
    if (key) return { ok: true, provider: overridePick.provider, model: overridePick.id, key };
  }

  const pref = (await getTextProviderOverride())?.toLowerCase();
  if (pref === 'anthropic' && anthropicKey) {
    return {
      ok: true,
      provider: 'anthropic',
      model: overrideModel || DEFAULT_ANTHROPIC_TEXT_MODEL,
      key: anthropicKey,
    };
  }
  if (pref === 'openai' && openaiKey) {
    return {
      ok: true,
      provider: 'openai',
      model: overrideModel || DEFAULT_OPENAI_TEXT_MODEL,
      key: openaiKey,
    };
  }
  if (pref === 'moonshot' && moonshotKey) {
    return {
      ok: true,
      provider: 'moonshot',
      model: overrideModel || DEFAULT_MOONSHOT_TEXT_MODEL,
      key: moonshotKey,
    };
  }
  if (anthropicKey) {
    return {
      ok: true,
      provider: 'anthropic',
      model: DEFAULT_ANTHROPIC_TEXT_MODEL,
      key: anthropicKey,
    };
  }
  if (moonshotKey) {
    return {
      ok: true,
      provider: 'moonshot',
      model: DEFAULT_MOONSHOT_TEXT_MODEL,
      key: moonshotKey,
    };
  }
  return { ok: true, provider: 'openai', model: DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey! };
}

function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callJson<T>(system: string, user: string): Promise<AiResult<T>> {
  const cfg = await resolveTextConfig();
  if (!cfg.ok) return { ok: false, status: 400, error: cfg.error };

  try {
    let raw = '';
    if (cfg.provider === 'anthropic') {
      const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.key,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 8192,
          system: `${system}\n\nReturn ONLY the JSON object. No markdown, no prose.`,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return {
          ok: false,
          status: res.status,
          error: `Anthropic request failed (HTTP ${res.status}). ${detail.slice(0, 300)}`,
        };
      }
      const payload = (await res.json()) as { content?: Array<{ text?: string }> };
      raw = payload.content?.map((c) => c.text ?? '').join('') ?? '';
    } else {
      // Kimi (Moonshot) speaks the OpenAI-compatible chat API on its own base.
      const base = cfg.provider === 'moonshot' ? MOONSHOT_BASE : OPENAI_BASE;
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${cfg.key}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return {
          ok: false,
          status: res.status,
          error: `OpenAI request failed (HTTP ${res.status}). ${detail.slice(0, 300)}`,
        };
      }
      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      raw = payload.choices?.[0]?.message?.content ?? '';
    }

    const parsed = parseJson<T>(raw);
    if (!parsed) {
      return { ok: false, status: 502, error: 'Model returned unparseable JSON.' };
    }
    return { ok: true, data: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, status: 500, error: message };
  }
}

// ---------------------------------------------------------------------------
// Generate full sales funnel
// ---------------------------------------------------------------------------

interface RawBundle {
  name?: string;
  slugHint?: string;
  optin?: unknown;
  sales?: unknown;
  vsl?: unknown;
  checkout?: unknown;
  upsell1?: unknown;
  upsell2?: unknown;
  upsell3?: unknown;
  upsell4?: unknown;
  success?: unknown;
  access?: unknown;
  footer?: unknown;
}

/**
 * One-shot: intake → full 10-block sales funnel copy.
 * Returns normalized blocks ready to drop into the editor / DB.
 */
export async function aiGenerateSalesFunnel(
  intake: SalesAiIntake,
): Promise<AiResult<SalesAiBundle>> {
  const system = `
You write full sales funnel copy for ${BRAND.name}.
${VOICE_RULES}

Return a single JSON object with this exact shape:
{
  "name": "short internal funnel name",
  "slugHint": "url-safe-kebab-slug",
  "optin": { ... same as optin funnel optin block ... },
  "sales": {
    "name": string,
    "tagline": string,
    "category": string,
    "priceCents": number,
    "originalPriceCents": number,
    "priceLabel": string,
    "originalPriceLabel": string,
    "priceDescription": string,
    "ctaText": string,
    "ctaSubtext": string,
    "guaranteeTitle": string,
    "guaranteeText": string,
    "heroImageUrl": "",
    "heroVideoUrl": "",
    "founderPhotoUrl": "",
    "eyebrow": string,
    "headline": string,
    "headlineEmphasis": string,
    "headlineSuffix": string,
    "subheadline": string,
    "audience": string,
    "promise": string,
    "problemHeading": string,
    "problemIntro": string,
    "problemScene": string,
    "problemPoints": string[4-6],
    "problemCost": string,
    "problemBody": string,
    "originEyebrow": string,
    "originHeading": string,
    "originParagraphs": string[2-4],
    "whatIsHeading": string,
    "whatIsParagraphs": string[2-4],
    "solutionHeading": string,
    "solutionBody": string,
    "mechanismEyebrow": string,
    "mechanismHeading": string,
    "mechanismLabel": string,
    "mechanismParagraphs": string[2-3],
    "mechanismPoints": [{ "title": string, "description": string }][3],
    "insideHeading": string,
    "insideSubheading": string,
    "insideLead": string,
    "insideItems": [{ "title": string, "description": string, "tag": string, "value": string, "outcome": string }][5-7],
    "featuresHeading": string,
    "features": string[5-7],
    "methodHeading": string,
    "methodSubheading": string,
    "methodSteps": [{ "number": number, "title": string, "description": string, "meta": string, "shift": string }][3-5],
    "methodCloser": string,
    "oldWayHeading": string,
    "oldWayItems": string[3-5],
    "newWayHeading": string,
    "newWayItems": string[3-5],
    "proof": [{ "name": string, "role": string, "quote": string, "real": true }][2-3],
    "testimonialsHeading": string,
    "testimonials": [{ "quote": string, "author": string, "role": string }][2-3],
    "bonusesEyebrow": string,
    "bonusesHeading": string,
    "bonusesIntro": string,
    "bonusesItems": [{ "title": string, "description": string, "value": string }][2-4],
    "bonusesTotalValue": string,
    "bonusesCloser": string,
    "founderEyebrow": string,
    "founderHeading": string,
    "founderGreeting": string,
    "founderParagraphs": string[3-5],
    "founderSignoff": string,
    "founderPs": string,
    "faqHeading": string,
    "faqs": [{ "question": string, "answer": string }][3-5],
    "finalCtaHeading": string,
    "finalCtaBody": string,
    "soldSeparatelyLabel": string,
    "todayLabel": string,
    "savingsLabel": string,
    "foundingPriceLabel": string,
    "pricingStackTotalLabel": string,
    "timerNote": string,
    "resourcesInstantLabel": string,
    "secureCheckoutLabel": string,
    "guaranteeNote": string,
    "proofEyebrow": string,
    "brandLine": string,
    "conversionLine": string,
    "generationalLine": string,
    "categoryLine": string,
    "founderName": string,
    "founderRole": string,
    "bumps": [{ "id": string, "title": string, "price": string, "description": string }]
  },

  "vsl": {
    "eyebrow": string,
    "headline": string,
    "subheadline": string,
    "videoUrl": "",
    "ctaRevealSeconds": 420,
    "ctaText": string,
    "ctaHref": "",
    "bullets": string[3],
    "stickyPlayer": true,
    "autoplay": false
  },
  "checkout": {
    "eyebrow": string,
    "headline": string,
    "subheadline": string,
    "priceLabel": string,
    "priceCents": number,
    "stripePriceId": "",
    "productName": string,
    "productId": "",
    "bullets": string[4-5],
    "ctaText": string,
    "guaranteeText": string,
    "paymentType": "one_time",
    "trialDays": 0
  },
  "upsell1": { ... upsell block ... },
  "upsell2": { ... upsell block ... },
  "upsell3": { ... upsell block ... },
  "upsell4": { ... upsell block ... },
  "success": {
    "headline": string,
    "subheadline": string,
    "purchaseSummary": string,
    "deliveryCards": [{ "title": string, "description": string, "href": "", "icon": "check" }][3],
    "ctaText": string,
    "ctaHref": "",
    "supportEmail": "support@mothermode.com",
    "secondaryNote": string
  },
  "access": {
    "headline": string,
    "subheadline": string,
    "onboardingItems": [{ "title": string, "description": string, "href": "" }][3],
    "deliveryLinks": [{ "label": string, "href": "", "description": string }][4-6],
    "welcomeVideoUrl": "",
    "communityHref": "",
    "communityLabel": "Join the community",
    "supportEmail": "support@mothermode.com"
  },
  "footer": {
    "enabled": true,
    "brandLine": string,
    "disclaimer": string,
    "links": [{ "label": string, "href": "" }],
    "copyright": string
  }
}

Upsell block shape:
{
  "enabled": true,
  "eyebrow": string,
  "headline": string,
  "subheadline": string,
  "bullets": string[3-5],
  "priceLabel": string,
  "originalPriceLabel": string,
  "priceCents": number,
  "stripePriceId": "",
  "productName": string,
  "paymentType": "one_time" | "subscription",
  "ctaYes": string,
  "ctaNo": string,
  "yesHref": "",
  "timerMinutes": 15,
  "imageUrl": "",
  "videoUrl": ""
}

Rules for structure:
- optin is free lead magnet capture. Promise is clear and specific.
- sales is the FULL long-form MotherMode sales letter. Fill EVERY field:
  hero (eyebrow/headline split/subheadline/audience/promise),
  problem (heading/intro/scene/points/cost),
  origin story, whatIs, mechanism (with points),
  inside items (5-7 with title/description/tag/value/outcome),
  method steps (3-5 with meta/shift),
  oldWay vs newWay lists,
  proof testimonials (2-3 real-feeling quotes),
  bonuses (2-4 with values),
  founder letter (greeting/paragraphs/signoff/ps),
  FAQ (3-5), final CTA, pricing labels, guarantee title+body.
- Do not leave narrative sections blank. Empty sections break the page.
- vsl is a video sales letter page. Video URL left empty (admin fills later).
- checkout is the Stripe checkout page. priceCents must be a number (e.g. 2700 for $27).
- upsell1-4 are one-time offers after checkout. Each has its own price and CTA.
- success is the receipt + delivery page.
- access is the members area + onboarding.
- priceLabel should match the intake offer price (e.g. "$27").
- priceCents should be the numeric cents equivalent (e.g. 2700 for $27).
- originalPriceCents should be a higher anchor (e.g. 2-4x priceCents).
- Keep all image/video URLs empty. Admin fills those later.
- paymentType is "one_time" for the main checkout and one-time upsells, "subscription" for recurring upsells.
- insideItems[].value should look like "$47" style value tags.
- bonusesItems MUST match the offer stack bonuses (titles, values, descriptions).
- bumps MUST match the offer stack order bumps (id, title, price, description). Do not invent extra bumps if the stack lists specific ones. If stack has bumps, fill them.
- For each upsell slot: if the stack marks it DISABLED or empty, set enabled:false and leave copy minimal. If enabled, write full upsell copy using the stack name/price/promise/billingType.
- priceLabel / priceCents on checkout and sales must match the front-end offer price from the stack.
- originalPriceLabel / originalPriceCents should use the stack originalPrice when provided.
- The identity lines (brandLine, conversionLine, generationalLine, categoryLine,
  founderName, founderRole) and the footer block MUST come from the FUNNEL BRIEF.
  If the brief does not name a founder, leave founderName and founderRole empty.
  Never carry another funnel's brand or founder into this one.
- Micro-labels (soldSeparatelyLabel, todayLabel, savingsLabel, foundingPriceLabel,
  pricingStackTotalLabel, timerNote, resourcesInstantLabel, secureCheckoutLabel,
  guaranteeNote, proofEyebrow) are short in-voice UI strings for THIS offer.
- footer.links are real legal/support links for this funnel with href left empty.

`.trim();

  const synced = syncIntakeStack(intake);
  const stack = normalizeOfferStack(synced.offerStack);
  const brief = funnelBriefFromIntake(synced);

  const user = `
${formatFunnelBriefForPrompt(brief)}

INTAKE
- Niche / topic: ${synced.niche || '(not set)'}
- Audience: ${synced.audience || '(not set)'}
- Core pain: ${synced.pain || '(not set)'}
- Free magnet name: ${synced.magnetName || '(not set)'}
- Magnet promise: ${synced.magnetPromise || '(not set)'}
- Lead gen kit slug: ${synced.leadGenSlug || '(not set)'}
- Paid offer name: ${synced.offerName || stack.frontEnd.name || '(not set)'}
- Paid offer price: ${synced.offerPrice || stack.frontEnd.price || '(not set)'}
- Tone notes: ${synced.toneNotes || '(default MotherMode calm authority)'}
- Visual direction: ${formatIntakeVisualForPrompt(synced) || '(not set)'}

OFFER STACK (authoritative money path — honor this exactly)
${formatOfferStackForPrompt(stack)}

Write the full 10-block sales funnel JSON now. Map stack bonuses → sales.bonusesItems, stack bumps → sales.bumps, stack upsells → upsell1-4.
`.trim();

  const result = await callJson<RawBundle>(system, user);
  if (!result.ok) return result;

  const raw = result.data;
  const optin = normalizeSalesOptin(raw.optin);
  const sales = normalizeSalesPage(raw.sales);
  const vsl = normalizeVslPage(raw.vsl);
  const checkout = normalizeCheckout(raw.checkout);
  const upsell1 = normalizeUpsell(raw.upsell1);
  const upsell2 = normalizeUpsell(raw.upsell2);
  const upsell3 = normalizeUpsell(raw.upsell3);
  const upsell4 = normalizeUpsell(raw.upsell4);
  const success = normalizeSuccess(raw.success);
  const access = normalizeAccess(raw.access);
  const footer = normalizeSalesFooter(raw.footer);

  // Prefer intake / offer-stack values when model leaves blanks.
  const syncedIntake = syncIntakeStack(intake);
  const stackIn = normalizeOfferStack(syncedIntake.offerStack);

  // Map stack bonuses/bumps onto sales if model left them empty.
  if (stackIn.bonuses.length && (!sales.bonusesItems || sales.bonusesItems.length === 0)) {
    sales.bonusesItems = stackIn.bonuses.map((b) => ({
      title: b.title,
      description: b.description,
      value: b.value,
    }));
  }
  if (stackIn.bumps.length && (!sales.bumps || sales.bumps.length === 0)) {
    sales.bumps = stackIn.bumps.map((b) => ({
      id: b.id,
      title: b.title,
      price: b.price,
      description: b.description,
    }));
  }
  if (stackIn.frontEnd.name) {
    if (!sales.name) sales.name = stackIn.frontEnd.name;
    if (!checkout.productName) checkout.productName = stackIn.frontEnd.name;
  }
  if (stackIn.frontEnd.price) {
    if (!sales.priceLabel) sales.priceLabel = stackIn.frontEnd.price;
    if (!checkout.priceLabel) checkout.priceLabel = stackIn.frontEnd.price;
    const pm = stackIn.frontEnd.price.match(/(\d+(?:\.\d+)?)/);
    if (pm) {
      const cents = Math.round(parseFloat(pm[1]) * 100);
      if (!sales.priceCents) sales.priceCents = cents;
      if (!checkout.priceCents) checkout.priceCents = cents;
    }
  }
  if (stackIn.frontEnd.originalPrice) {
    if (!sales.originalPriceLabel) sales.originalPriceLabel = stackIn.frontEnd.originalPrice;
    const om = stackIn.frontEnd.originalPrice.match(/(\d+(?:\.\d+)?)/);
    if (om && !sales.originalPriceCents) {
      sales.originalPriceCents = Math.round(parseFloat(om[1]) * 100);
    }
  }
  if (stackIn.frontEnd.promise && !sales.promise) sales.promise = stackIn.frontEnd.promise;

  const upsellBlocks = [upsell1, upsell2, upsell3, upsell4];
  stackIn.upsells.forEach((u, i) => {
    const block = upsellBlocks[i];
    if (!block) return;
    if (!u.enabled && !u.name) {
      block.enabled = false;
      return;
    }
    if (u.enabled) block.enabled = true;
    if (!u.enabled && u.name === '') block.enabled = false;
    if (u.name && !block.productName) block.productName = u.name;
    if (u.name && !block.headline) block.headline = u.name;
    if (u.price && !block.priceLabel) block.priceLabel = u.price;
    if (u.price) {
      const um = u.price.match(/(\d+(?:\.\d+)?)/);
      if (um && !block.priceCents) block.priceCents = Math.round(parseFloat(um[1]) * 100);
    }
    if (u.promise && !block.subheadline) block.subheadline = u.promise;
    if (u.billingType) {
      block.paymentType = u.billingType === 'subscription' ? 'subscription' : 'one_time';
    }
  });

  // Legacy flat intake fallbacks.
  if (!optin.magnetTitle && intake.magnetName) optin.magnetTitle = intake.magnetName;
  if (!checkout.priceLabel && intake.offerPrice) checkout.priceLabel = intake.offerPrice;
  if (!checkout.productName && intake.offerName) checkout.productName = intake.offerName;
  if (!checkout.priceCents && intake.offerPrice) {
    const m = intake.offerPrice.match(/(\d+(?:\.\d+)?)/);
    if (m) checkout.priceCents = Math.round(parseFloat(m[1]) * 100);
  }
  if (!upsell1.priceLabel && intake.upsell1Price) upsell1.priceLabel = intake.upsell1Price;
  if (!upsell1.productName && intake.upsell1Name) upsell1.productName = intake.upsell1Name;
  if (!upsell2.priceLabel && intake.upsell2Price) upsell2.priceLabel = intake.upsell2Price;
  if (!upsell2.productName && intake.upsell2Name) upsell2.productName = intake.upsell2Name;
  if (!upsell3.priceLabel && intake.upsell3Price) upsell3.priceLabel = intake.upsell3Price;
  if (!upsell3.productName && intake.upsell3Name) upsell3.productName = intake.upsell3Name;
  if (!upsell4.priceLabel && intake.upsell4Price) upsell4.priceLabel = intake.upsell4Price;
  if (!upsell4.productName && intake.upsell4Name) upsell4.productName = intake.upsell4Name;

  const name =
    (typeof raw.name === 'string' && raw.name.trim()) ||
    intake.offerName ||
    intake.niche ||
    'New sales funnel';
  const slugHint =
    (typeof raw.slugHint === 'string' && raw.slugHint.trim()) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);

  return {
    ok: true,
    data: {
      name,
      slugHint,
      optin,
      sales,
      vsl,
      checkout,
      upsell1,
      upsell2,
      upsell3,
      upsell4,
      success,
      access,
      footer,
    },
  };
}

// ---------------------------------------------------------------------------
// Fill intake + offer stack from a thin brief
// ---------------------------------------------------------------------------

/**
 * Expand a thin sales brief into a complete SalesAiIntake including OfferStack
 * (front-end, bonuses, bumps, upsells). Keeps owner-provided values.
 */
export async function aiFillSalesIntake(
  intake: SalesAiIntake,
): Promise<AiResult<SalesAiIntake>> {
  const system = `
You are a senior direct-response offer strategist for ${BRAND.name}.
${VOICE_RULES}

Expand a thin funnel brief into a complete intake AND offer stack.
Keep any non-empty owner values. Fill blanks and sharpen vague ones.
Respond with ONE JSON object matching this shape exactly:

{
  "niche": string,
  "audience": string,
  "pain": string,
  "magnetName": string,
  "magnetPromise": string,
  "leadGenSlug": string,
  "offerName": string,
  "offerPrice": string,
  "upsell1Name": string,
  "upsell1Price": string,
  "upsell2Name": string,
  "upsell2Price": string,
  "upsell3Name": string,
  "upsell3Price": string,
  "upsell4Name": string,
  "upsell4Price": string,
  "toneNotes": string,
  "visualSubject": string,
  "visualPalette": string,
  "visualStyleKeywords": string,
  "visualLighting": string,
  "visualComposition": string,
  "visualAvoid": string,
  "offerStack": {
    "frontEnd": {
      "name": string,
      "price": string,
      "originalPrice": string,
      "promise": string,
      "deliverables": string[4-7]
    },
    "bonuses": [{ "title": string, "description": string, "value": string }][2-4],
    "bumps": [{ "id": string, "title": string, "price": string, "description": string, "imageUrl": "" }][0-2],
    "upsells": [
      { "slot": 1, "enabled": true, "name": string, "price": string, "promise": string, "billingType": "subscription" | "one_time" },
      { "slot": 2, "enabled": true, "name": string, "price": string, "promise": string, "billingType": "one_time" | "subscription" },
      { "slot": 3, "enabled": false, "name": string, "price": string, "promise": string, "billingType": "one_time" },
      { "slot": 4, "enabled": false, "name": string, "price": string, "promise": string, "billingType": "one_time" }
    ]
  }
}

Rules:
- Prices look like "$27" or "$97/mo". originalPrice is a higher anchor (2-4x).
- Bonus values look like "$47".
- Bump ids are snake_case slugs.
- Enable 1-2 upsells by default unless the brief already specifies more.
- leadGenSlug may stay empty unless the brief implies a kit slug.
- toneNotes stay short.
- visual* fields are art direction for image generation, not copy. Describe a
  look this specific brand could own; do not reach for a generic stock look.
  visualPalette, visualStyleKeywords and visualAvoid are comma separated.
  Leave a visual field empty rather than inventing a look that fights the niche
  — an empty field is reported to the admin, a wrong one silently renders.
`.trim();

  const synced = syncIntakeStack(intake);
  const user = `
Complete this sales funnel intake and offer stack.

CURRENT INTAKE (JSON):
${JSON.stringify(synced, null, 2)}

Return the full filled intake JSON now.
`.trim();

  const result = await callJson<Record<string, unknown>>(system, user);
  if (!result.ok) return result;

  const filled = normalizeSalesAiIntake(result.data);
  const base = blankSalesAiIntake();
  const out: SalesAiIntake = { ...base };

  const strKeys: Array<keyof SalesAiIntake> = [
    'niche', 'audience', 'pain', 'magnetName', 'magnetPromise', 'leadGenSlug',
    'offerName', 'offerPrice', 'upsell1Name', 'upsell1Price', 'upsell2Name', 'upsell2Price',
    'upsell3Name', 'upsell3Price', 'upsell4Name', 'upsell4Price', 'toneNotes',
    'visualSubject', 'visualPalette', 'visualStyleKeywords', 'visualLighting',
    'visualComposition', 'visualAvoid',
  ];
  for (const k of strKeys) {
    const owner = String(synced[k] ?? '').trim();
    const model = String(filled[k] ?? '').trim();
    (out as unknown as Record<string, string>)[k] = owner || model || '';
  }

  const ownerStack = normalizeOfferStack(synced.offerStack);
  const modelStack = normalizeOfferStack(filled.offerStack);
  out.offerStack = {
    frontEnd: {
      name: ownerStack.frontEnd.name || modelStack.frontEnd.name || out.offerName,
      price: ownerStack.frontEnd.price || modelStack.frontEnd.price || out.offerPrice,
      originalPrice: ownerStack.frontEnd.originalPrice || modelStack.frontEnd.originalPrice,
      promise: ownerStack.frontEnd.promise || modelStack.frontEnd.promise,
      deliverables:
        ownerStack.frontEnd.deliverables.length > 0
          ? ownerStack.frontEnd.deliverables
          : modelStack.frontEnd.deliverables,
    },
    bonuses: ownerStack.bonuses.length > 0 ? ownerStack.bonuses : modelStack.bonuses,
    bumps: ownerStack.bumps.length > 0 ? ownerStack.bumps : modelStack.bumps,
    upsells: [1, 2, 3, 4].map((slot) => {
      const o = ownerStack.upsells.find((u) => u.slot === slot) || ownerStack.upsells[slot - 1];
      const m = modelStack.upsells.find((u) => u.slot === slot) || modelStack.upsells[slot - 1];
      const name = (o?.name || m?.name || '').trim();
      const price = (o?.price || m?.price || '').trim();
      const promise = (o?.promise || m?.promise || '').trim();
      const billingType = (o?.billingType || m?.billingType || 'one_time') as string;
      let enabled = Boolean(name);
      if (o && (o.name || o.price || o.promise)) enabled = o.enabled;
      else if (m) enabled = m.enabled && Boolean(name);
      return {
        slot,
        enabled,
        name,
        price,
        promise,
        billingType: billingType === 'subscription' ? 'subscription' : 'one_time',
      };
    }),
  };

  return { ok: true, data: syncIntakeStack(out) };
}


// ---------------------------------------------------------------------------
// Per-page regenerate (single block)
// ---------------------------------------------------------------------------

export type SalesAiPageKey =
  | 'optin'
  | 'sales'
  | 'vsl'
  | 'checkout'
  | 'upsell1'
  | 'upsell2'
  | 'upsell3'
  | 'upsell4'
  | 'success'
  | 'access'
  | 'footer';

const PAGE_LABELS: Record<SalesAiPageKey, string> = {
  optin: 'opt-in / lead magnet capture page',
  sales: 'long-form sales letter page',
  vsl: 'VSL (video sales letter) page',
  checkout: 'checkout / order form page',
  upsell1: 'upsell 1 (OTO) page',
  upsell2: 'upsell 2 (OTO) page',
  upsell3: 'upsell 3 (OTO) page',
  upsell4: 'upsell 4 (OTO) page',
  success: 'post-purchase success / receipt page',
  access: 'members access / onboarding page',
  footer: 'site-wide funnel footer block',
};

/**
 * Regenerate a single funnel page block from the offer stack + intake.
 * Returns the normalized content object for that page only.
 */
export async function aiGenerateSalesPage(
  page: SalesAiPageKey,
  intake: SalesAiIntake,
): Promise<AiResult<unknown>> {
  const synced = syncIntakeStack(intake);
  const stack = normalizeOfferStack(synced.offerStack);
  const brief = funnelBriefFromIntake(synced);
  const label = PAGE_LABELS[page] || page;

  let shapeHint = '';
  if (page === 'optin') {
    shapeHint = `Return JSON for the optin block only:
{
  "eyebrow": string, "headline": string, "headlineEmphasis": string, "headlineSuffix": string,
  "subheadline": string, "audience": string, "benefits": string[3-5], "ctaText": string,
  "badgeText": string, "magnetTitle": string, "magnetDescription": string,
  "coverImageUrl": "", "heroVideoUrl": "", "emailPlaceholder": "Email address",
  "namePlaceholder": "First name", "collectName": true, "privacyNote": string
}`;
  } else if (page === 'sales') {
    shapeHint = `Return JSON for the FULL long-form sales page block only.
Include every sales field from the full-funnel schema: identity/pricing, hero, problem,
origin, whatIs, mechanism, insideItems, methodSteps, oldWay/newWay, proof, bonusesItems,
founder letter, FAQ, final CTA, bumps. bonusesItems and bumps MUST match the offer stack.`;
  } else if (page === 'vsl') {
    shapeHint = `Return JSON for the vsl block only:
{
  "eyebrow": string, "headline": string, "subheadline": string, "videoUrl": "",
  "ctaRevealSeconds": 420, "ctaText": string, "ctaHref": "", "bullets": string[3],
  "stickyPlayer": true, "autoplay": false
}`;
  } else if (page === 'checkout') {
    shapeHint = `Return JSON for the checkout block only:
{
  "eyebrow": string, "headline": string, "subheadline": string,
  "priceLabel": string, "priceCents": number, "stripePriceId": "",
  "productName": string, "productId": "", "productImageUrl": "",
  "bullets": string[4-5], "ctaText": string, "guaranteeText": string,
  "paymentType": "one_time", "trialDays": 0,
  "timerLabel": string, "brandLabel": "MotherMode"
}
priceLabel/priceCents must match the front-end offer from the stack.`;
  } else if (page.startsWith('upsell')) {
    const slot = Number(page.replace('upsell', '')) || 1;
    const u = stack.upsells.find((x) => x.slot === slot) || stack.upsells[slot - 1];
    shapeHint = `Return JSON for upsell slot ${slot} only (FULL OTO shape):
{
  "enabled": boolean,
  "productId": "", "billingType": "one_time"|"subscription", "interval": "",
  "priceCents": number, "priceLabel": string, "originalPriceLabel": string,
  "metadataType": "ascension", "pageType": "upsell", "stripePriceId": "",
  "productName": string, "paymentType": "one_time"|"subscription",
  "timerLabel": string, "timerMinutes": 15,
  "mediaVideo": false, "mediaVideoPoster": "", "galleryEyebrow": string,
  "galleryAspect": "4/5", "gallery": [], "imageUrl": "", "videoUrl": "",
  "eyebrow": string, "headline": string, "headlineEmphasis": string, "headlineSuffix": string,
  "subheadline": string, "letter": string[3-5], "bullets": string[3-5],
  "stackEyebrow": string, "stackHeading": string,
  "features": [{ "title": string, "description": string, "value": string, "core": boolean }][4-6],
  "totalValueLabel": string, "bigIdea": string,
  "ctaYes": string, "ctaNo": string, "yesHref": "",
  "guaranteeTitle": string, "guaranteeBody": string
}
Stack slot ${slot}: enabled=${u?.enabled ?? false}, name=${u?.name || '(none)'}, price=${u?.price || ''}, promise=${u?.promise || ''}, billing=${u?.billingType || 'one_time'}.
If disabled and unnamed, return enabled:false with minimal copy.`;
  } else if (page === 'success') {
    shapeHint = `Return JSON for the success block only:
{
  "headline": string, "subheadline": string, "purchaseSummary": string,
  "inboxNote": string, "deliverySectionHeading": string, "deliverySectionIntro": string,
  "deliveryCards": [{ "title": string, "description": string, "href": "", "icon": "check" }][3],
  "nextEyebrow": string, "nextHeading": string, "nextBody": string,
  "ctaText": string, "ctaHref": "", "supportEmail": "support@mothermode.com",
  "secondaryNote": string
}`;
  } else if (page === 'access') {
    shapeHint = `Return JSON for the access block only:
{
  "headline": string, "subheadline": string, "badgeText": string,
  "onboardingEyebrow": string, "onboardingHeading": string,
  "onboardingItems": [{ "title": string, "description": string, "href": "" }][3],
  "libraryEyebrow": string, "libraryHeading": string, "libraryIntro": string,
  "deliveryLinks": [{ "label": string, "href": "", "description": string }][4-6],
  "welcomeVideoUrl": "", "communityHref": "", "communityLabel": string,
  "communityBody": string, "supportHeading": string, "supportBody": string,
  "supportEmail": "support@mothermode.com"
}`;
  } else if (page === 'footer') {
    shapeHint = `Return JSON for the footer block only:
{
  "enabled": true,
  "brandLine": string,
  "disclaimer": string,
  "links": [{ "label": string, "href": "" }][2-4],
  "copyright": string
}
brandLine and disclaimer come from the FUNNEL BRIEF identity, never from another brand.
links are the real legal/support links for this funnel (for example Terms, Privacy,
Support) with href left empty for the admin to fill.
copyright is a plain line like "(c) <year> <brand>. All rights reserved."`;
  }

  const system = `
You write MotherMode sales funnel page copy.
${VOICE_RULES}

Regenerate ONLY the ${label}.
${shapeHint}

Rules:
- Honor the offer stack exactly for prices, names, bonuses, bumps, upsell enablement.
- Keep image/video URLs empty.
- priceCents is a number (e.g. 2700 for $27).
- Return ONE JSON object (the page block only — no wrapper keys).
`.trim();

  const user = `
${formatFunnelBriefForPrompt(brief)}

INTAKE
- Niche: ${synced.niche || '(not set)'}
- Audience: ${synced.audience || '(not set)'}
- Pain: ${synced.pain || '(not set)'}
- Magnet: ${synced.magnetName || '(not set)'} — ${synced.magnetPromise || ''}
- Offer: ${synced.offerName || stack.frontEnd.name || '(not set)'} @ ${synced.offerPrice || stack.frontEnd.price || '(not set)'}
- Tone: ${synced.toneNotes || '(default MotherMode)'}
- Visual direction: ${formatIntakeVisualForPrompt(synced) || '(not set)'}

OFFER STACK
${formatOfferStackForPrompt(stack)}

Write the ${label} JSON now.
`.trim();

  const result = await callJson<Record<string, unknown>>(system, user);
  if (!result.ok) return result;

  const raw = result.data;
  // Unwrap if model nested under page key
  const block =
    raw && typeof raw === 'object' && raw[page] && typeof raw[page] === 'object'
      ? (raw[page] as Record<string, unknown>)
      : raw;

  switch (page) {
    case 'optin':
      return { ok: true, data: normalizeSalesOptin(block) };
    case 'sales': {
      let sales = normalizeSalesPage(block);
      if (stack.bonuses.length && (!sales.bonusesItems || !sales.bonusesItems.length)) {
        sales.bonusesItems = stack.bonuses.map((b) => ({
          title: b.title,
          description: b.description,
          value: b.value,
        }));
      }
      if (stack.bumps.length && (!sales.bumps || !sales.bumps.length)) {
        sales.bumps = stack.bumps.map((b) => ({
          id: b.id,
          title: b.title,
          price: b.price,
          description: b.description,
        }));
      }
      if (stack.frontEnd.name && !sales.name) sales.name = stack.frontEnd.name;
      if (stack.frontEnd.price && !sales.priceLabel) sales.priceLabel = stack.frontEnd.price;
      if (stack.frontEnd.promise && !sales.promise) sales.promise = stack.frontEnd.promise;
      return { ok: true, data: sales };
    }
    case 'vsl':
      return { ok: true, data: normalizeVslPage(block) };
    case 'checkout': {
      let checkout = normalizeCheckout(block);
      if (stack.frontEnd.name && !checkout.productName) checkout.productName = stack.frontEnd.name;
      if (stack.frontEnd.price && !checkout.priceLabel) checkout.priceLabel = stack.frontEnd.price;
      if (stack.frontEnd.price && !checkout.priceCents) {
        const m = stack.frontEnd.price.match(/(\d+(?:\.\d+)?)/);
        if (m) checkout.priceCents = Math.round(parseFloat(m[1]) * 100);
      }
      return { ok: true, data: checkout };
    }
    case 'upsell1':
    case 'upsell2':
    case 'upsell3':
    case 'upsell4': {
      let upsell = normalizeUpsell(block);
      const slot = Number(page.replace('upsell', '')) || 1;
      const u = stack.upsells.find((x) => x.slot === slot);
      if (u) {
        if (!u.enabled && !u.name) upsell.enabled = false;
        else if (u.enabled) upsell.enabled = true;
        if (u.name && !upsell.productName) upsell.productName = u.name;
        if (u.name && !upsell.headline) upsell.headline = u.name;
        if (u.price && !upsell.priceLabel) upsell.priceLabel = u.price;
        if (u.price && !upsell.priceCents) {
          const m = u.price.match(/(\d+(?:\.\d+)?)/);
          if (m) upsell.priceCents = Math.round(parseFloat(m[1]) * 100);
        }
        if (u.promise && !upsell.subheadline) upsell.subheadline = u.promise;
        if (u.billingType) {
          upsell.paymentType = u.billingType === 'subscription' ? 'subscription' : 'one_time';
          upsell.billingType = upsell.paymentType;
        }
      }
      return { ok: true, data: upsell };
    }
    case 'success':
      return { ok: true, data: normalizeSuccess(block) };
    case 'access':
      return { ok: true, data: normalizeAccess(block) };
    case 'footer':
      return { ok: true, data: normalizeSalesFooter(block) };
    default:
      return { ok: false, error: 'Unknown page: ' + page, status: 400 };
  }
}


