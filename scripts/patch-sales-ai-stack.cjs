/**
 * Patch openai-sales.ts: stack post-process + aiFillSalesIntake
 * and sales-ai route: fillIntake action.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const salesAiPath = path.join(root, 'src/utils/integrations/openai-sales.ts');
const routePath = path.join(root, 'src/app/api/mothermode/sales-ai/route.ts');

let s = fs.readFileSync(salesAiPath, 'utf8');

// --- 1. Stack apply after normalize ---
const marker = '  // Prefer intake values when model leaves blanks.';
const stackApply = `  // Prefer intake / offer-stack values when model leaves blanks.
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
    const pm = stackIn.frontEnd.price.match(/(\\d+(?:\\.\\d+)?)/);
    if (pm) {
      const cents = Math.round(parseFloat(pm[1]) * 100);
      if (!sales.priceCents) sales.priceCents = cents;
      if (!checkout.priceCents) checkout.priceCents = cents;
    }
  }
  if (stackIn.frontEnd.originalPrice) {
    if (!sales.originalPriceLabel) sales.originalPriceLabel = stackIn.frontEnd.originalPrice;
    const om = stackIn.frontEnd.originalPrice.match(/(\\d+(?:\\.\\d+)?)/);
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
      const um = u.price.match(/(\\d+(?:\\.\\d+)?)/);
      if (um && !block.priceCents) block.priceCents = Math.round(parseFloat(um[1]) * 100);
    }
    if (u.promise && !block.subheadline) block.subheadline = u.promise;
    if (u.billingType) {
      block.paymentType = u.billingType === 'subscription' ? 'subscription' : 'one_time';
    }
  });

  // Legacy flat intake fallbacks.`;

if (!s.includes('const syncedIntake = syncIntakeStack')) {
  if (!s.includes(marker)) {
    console.error('marker missing for stack apply');
    process.exit(1);
  }
  s = s.replace(marker, stackApply);
  console.log('injected stack apply');
} else {
  console.log('stack apply already present');
}

// --- 2. Append aiFillSalesIntake ---
if (!s.includes('export async function aiFillSalesIntake')) {
  const fillFn = `

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
  const system = \`
You are a senior direct-response offer strategist for \${BRAND.name}.
\${VOICE_RULES}

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
\`.trim();

  const synced = syncIntakeStack(intake);
  const user = \`
Complete this sales funnel intake and offer stack.

CURRENT INTAKE (JSON):
\${JSON.stringify(synced, null, 2)}

Return the full filled intake JSON now.
\`.trim();

  const result = await callJson<Record<string, unknown>>(system, user);
  if (!result.ok) return result;

  const filled = normalizeSalesAiIntake(result.data);
  const base = blankSalesAiIntake();
  const out: SalesAiIntake = { ...base };

  const strKeys: Array<keyof SalesAiIntake> = [
    'niche', 'audience', 'pain', 'magnetName', 'magnetPromise', 'leadGenSlug',
    'offerName', 'offerPrice', 'upsell1Name', 'upsell1Price', 'upsell2Name', 'upsell2Price',
    'upsell3Name', 'upsell3Price', 'upsell4Name', 'upsell4Price', 'toneNotes',
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
`;
  s = s.trimEnd() + fillFn;
  console.log('appended aiFillSalesIntake');
} else {
  console.log('aiFillSalesIntake already present');
}

fs.writeFileSync(salesAiPath, s);
console.log('wrote', salesAiPath, s.length);

// --- 3. Route ---
const route = `import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  aiFillSalesIntake,
  aiGenerateSalesFunnel,
  normalizeSalesAiIntake,
} from '@/utils/integrations/openai-sales';

/**
 * Admin-only Sales Funnel AI endpoint.
 *
 *   POST { action: 'fillIntake', intake }
 *     → { success, intake }  // complete brief + offer stack
 *
 *   POST { action: 'generate', intake }
 *     → { success, name, slugHint, optin, sales, vsl, checkout, upsell1-4, success, access }
 *
 * Server-only; keys resolved via runtime-config (same as optin-ai).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body.action ?? 'generate');
  const intake = normalizeSalesAiIntake(body.intake);

  if (!intake.niche.trim() && !intake.magnetName.trim() && !intake.audience.trim() && !intake.offerName.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Give at least a niche, audience, magnet name, or offer name so the model has something to write from.',
      },
      { status: 400 },
    );
  }

  if (action === 'fillIntake') {
    const result = await aiFillSalesIntake(intake);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, intake: result.data });
  }

  if (action !== 'generate') {
    return NextResponse.json(
      { success: false, error: \`Unknown action: \${action}\` },
      { status: 400 },
    );
  }

  const result = await aiGenerateSalesFunnel(intake);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    name: result.data.name,
    slugHint: result.data.slugHint,
    optin: result.data.optin,
    sales: result.data.sales,
    vsl: result.data.vsl,
    checkout: result.data.checkout,
    upsell1: result.data.upsell1,
    upsell2: result.data.upsell2,
    upsell3: result.data.upsell3,
    upsell4: result.data.upsell4,
    successBlock: result.data.success,
    access: result.data.access,
  });
}
`;

fs.writeFileSync(routePath, route);
console.log('wrote route');
console.log('OK');
