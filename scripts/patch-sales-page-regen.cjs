/**
 * Phase 2: Per-page AI regen + fuller generate schemas.
 *
 * - openai-sales.ts: expand upsell/checkout/success/access schemas;
 *   add aiGenerateSalesPage(page, intake)
 * - sales-ai route: action generatePage
 * - SalesFunnelEditor: Regenerate this page on each content tab
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, s) {
  fs.writeFileSync(path.join(ROOT, rel), s, 'utf8');
  console.log('wrote', rel, s.length);
}

// ---------------------------------------------------------------------------
// 1) openai-sales.ts — expand schemas + add per-page generator
// ---------------------------------------------------------------------------
{
  let o = read('src/utils/integrations/openai-sales.ts');

  // Expand upsell block shape in the full-generate system prompt
  const oldUpsellShape = `Upsell block shape:
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
}`;

  const newUpsellShape = `Upsell block shape (FULL MotherMode OTO — fill every field):
{
  "enabled": true,
  "productId": "",
  "billingType": "one_time" | "subscription",
  "interval": "month" | "",
  "priceCents": number,
  "priceLabel": string,
  "originalPriceLabel": string,
  "metadataType": "ascension",
  "pageType": "upsell",
  "stripePriceId": "",
  "productName": string,
  "paymentType": "one_time" | "subscription",
  "timerLabel": string,
  "timerMinutes": 15,
  "mediaVideo": false,
  "mediaVideoPoster": "",
  "galleryEyebrow": string,
  "galleryAspect": "4/5",
  "gallery": [],
  "imageUrl": "",
  "videoUrl": "",
  "eyebrow": string,
  "headline": string,
  "headlineEmphasis": string,
  "headlineSuffix": string,
  "subheadline": string,
  "letter": string[3-5],
  "bullets": string[3-5],
  "stackEyebrow": string,
  "stackHeading": string,
  "features": [{ "title": string, "description": string, "value": string, "core": boolean }][4-6],
  "totalValueLabel": string,
  "bigIdea": string,
  "ctaYes": string,
  "ctaNo": string,
  "yesHref": "",
  "guaranteeTitle": string,
  "guaranteeBody": string
}`;

  if (o.includes(oldUpsellShape)) {
    o = o.replace(oldUpsellShape, newUpsellShape);
    console.log('upsell shape expanded');
  } else if (o.includes('"ctaYes": string')) {
    console.log('upsell shape already expanded or different — skip shape replace');
  } else {
    console.warn('WARN: old upsell shape not found');
  }

  // Expand checkout schema in full generate
  const oldCheckout = `"checkout": {
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
  }`;

  const newCheckout = `"checkout": {
    "eyebrow": string,
    "headline": string,
    "subheadline": string,
    "priceLabel": string,
    "priceCents": number,
    "stripePriceId": "",
    "productName": string,
    "productId": "",
    "productImageUrl": "",
    "bullets": string[4-5],
    "ctaText": string,
    "guaranteeText": string,
    "paymentType": "one_time",
    "trialDays": 0,
    "timerLabel": string,
    "brandLabel": "MotherMode"
  }`;

  if (o.includes(oldCheckout)) {
    o = o.replace(oldCheckout, newCheckout);
    console.log('checkout schema expanded');
  } else {
    console.warn('WARN: old checkout schema not found (may already be expanded)');
  }

  // Expand success schema
  const oldSuccess = `"success": {
    "headline": string,
    "subheadline": string,
    "purchaseSummary": string,
    "deliveryCards": [{ "title": string, "description": string, "href": "", "icon": "check" }][3],
    "ctaText": string,
    "ctaHref": "",
    "supportEmail": "support@mothermode.com",
    "secondaryNote": string
  }`;

  const newSuccess = `"success": {
    "headline": string,
    "subheadline": string,
    "purchaseSummary": string,
    "inboxNote": string,
    "deliverySectionHeading": string,
    "deliverySectionIntro": string,
    "deliveryCards": [{ "title": string, "description": string, "href": "", "icon": "check" }][3],
    "nextEyebrow": string,
    "nextHeading": string,
    "nextBody": string,
    "ctaText": string,
    "ctaHref": "",
    "supportEmail": "support@mothermode.com",
    "secondaryNote": string
  }`;

  if (o.includes(oldSuccess)) {
    o = o.replace(oldSuccess, newSuccess);
    console.log('success schema expanded');
  } else {
    console.warn('WARN: old success schema not found');
  }

  // Expand access schema
  const oldAccess = `"access": {
    "headline": string,
    "subheadline": string,
    "onboardingItems": [{ "title": string, "description": string, "href": "" }][3],
    "deliveryLinks": [{ "label": string, "href": "", "description": string }][4-6],
    "welcomeVideoUrl": "",
    "communityHref": "",
    "communityLabel": "Join the community",
    "supportEmail": "support@mothermode.com"
  }`;

  const newAccess = `"access": {
    "headline": string,
    "subheadline": string,
    "badgeText": string,
    "onboardingEyebrow": string,
    "onboardingHeading": string,
    "onboardingItems": [{ "title": string, "description": string, "href": "" }][3],
    "libraryEyebrow": string,
    "libraryHeading": string,
    "libraryIntro": string,
    "deliveryLinks": [{ "label": string, "href": "", "description": string }][4-6],
    "welcomeVideoUrl": "",
    "communityHref": "",
    "communityLabel": "Join the community",
    "communityBody": string,
    "supportHeading": string,
    "supportBody": string,
    "supportEmail": "support@mothermode.com"
  }`;

  if (o.includes(oldAccess)) {
    o = o.replace(oldAccess, newAccess);
    console.log('access schema expanded');
  } else {
    console.warn('WARN: old access schema not found');
  }

  // Add per-page generator if missing
  if (!o.includes('export async function aiGenerateSalesPage')) {
    const pageGen = `

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
  | 'access';

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
  const label = PAGE_LABELS[page] || page;

  let shapeHint = '';
  if (page === 'optin') {
    shapeHint = \`Return JSON for the optin block only:
{
  "eyebrow": string, "headline": string, "headlineEmphasis": string, "headlineSuffix": string,
  "subheadline": string, "audience": string, "benefits": string[3-5], "ctaText": string,
  "badgeText": string, "magnetTitle": string, "magnetDescription": string,
  "coverImageUrl": "", "heroVideoUrl": "", "emailPlaceholder": "Email address",
  "namePlaceholder": "First name", "collectName": true, "privacyNote": string
}\`;
  } else if (page === 'sales') {
    shapeHint = \`Return JSON for the FULL long-form sales page block only.
Include every sales field from the full-funnel schema: identity/pricing, hero, problem,
origin, whatIs, mechanism, insideItems, methodSteps, oldWay/newWay, proof, bonusesItems,
founder letter, FAQ, final CTA, bumps. bonusesItems and bumps MUST match the offer stack.\`;
  } else if (page === 'vsl') {
    shapeHint = \`Return JSON for the vsl block only:
{
  "eyebrow": string, "headline": string, "subheadline": string, "videoUrl": "",
  "ctaRevealSeconds": 420, "ctaText": string, "ctaHref": "", "bullets": string[3],
  "stickyPlayer": true, "autoplay": false
}\`;
  } else if (page === 'checkout') {
    shapeHint = \`Return JSON for the checkout block only:
{
  "eyebrow": string, "headline": string, "subheadline": string,
  "priceLabel": string, "priceCents": number, "stripePriceId": "",
  "productName": string, "productId": "", "productImageUrl": "",
  "bullets": string[4-5], "ctaText": string, "guaranteeText": string,
  "paymentType": "one_time", "trialDays": 0,
  "timerLabel": string, "brandLabel": "MotherMode"
}
priceLabel/priceCents must match the front-end offer from the stack.\`;
  } else if (page.startsWith('upsell')) {
    const slot = Number(page.replace('upsell', '')) || 1;
    const u = stack.upsells.find((x) => x.slot === slot) || stack.upsells[slot - 1];
    shapeHint = \`Return JSON for upsell slot \${slot} only (FULL OTO shape):
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
Stack slot \${slot}: enabled=\${u?.enabled ?? false}, name=\${u?.name || '(none)'}, price=\${u?.price || ''}, promise=\${u?.promise || ''}, billing=\${u?.billingType || 'one_time'}.
If disabled and unnamed, return enabled:false with minimal copy.\`;
  } else if (page === 'success') {
    shapeHint = \`Return JSON for the success block only:
{
  "headline": string, "subheadline": string, "purchaseSummary": string,
  "inboxNote": string, "deliverySectionHeading": string, "deliverySectionIntro": string,
  "deliveryCards": [{ "title": string, "description": string, "href": "", "icon": "check" }][3],
  "nextEyebrow": string, "nextHeading": string, "nextBody": string,
  "ctaText": string, "ctaHref": "", "supportEmail": "support@mothermode.com",
  "secondaryNote": string
}\`;
  } else if (page === 'access') {
    shapeHint = \`Return JSON for the access block only:
{
  "headline": string, "subheadline": string, "badgeText": string,
  "onboardingEyebrow": string, "onboardingHeading": string,
  "onboardingItems": [{ "title": string, "description": string, "href": "" }][3],
  "libraryEyebrow": string, "libraryHeading": string, "libraryIntro": string,
  "deliveryLinks": [{ "label": string, "href": "", "description": string }][4-6],
  "welcomeVideoUrl": "", "communityHref": "", "communityLabel": string,
  "communityBody": string, "supportHeading": string, "supportBody": string,
  "supportEmail": "support@mothermode.com"
}\`;
  }

  const system = \`
You write MotherMode sales funnel page copy.
\${VOICE_RULES}

Regenerate ONLY the \${label}.
\${shapeHint}

Rules:
- Honor the offer stack exactly for prices, names, bonuses, bumps, upsell enablement.
- Keep image/video URLs empty.
- priceCents is a number (e.g. 2700 for $27).
- Return ONE JSON object (the page block only — no wrapper keys).
\`.trim();

  const user = \`
INTAKE
- Niche: \${synced.niche || '(not set)'}
- Audience: \${synced.audience || '(not set)'}
- Pain: \${synced.pain || '(not set)'}
- Magnet: \${synced.magnetName || '(not set)'} — \${synced.magnetPromise || ''}
- Offer: \${synced.offerName || stack.frontEnd.name || '(not set)'} @ \${synced.offerPrice || stack.frontEnd.price || '(not set)'}
- Tone: \${synced.toneNotes || '(default MotherMode)'}

OFFER STACK
\${formatOfferStackForPrompt(stack)}

Write the \${label} JSON now.
\`.trim();

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
        const m = stack.frontEnd.price.match(/(\\d+(?:\\.\\d+)?)/);
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
          const m = u.price.match(/(\\d+(?:\\.\\d+)?)/);
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
    default:
      return { ok: false, error: 'Unknown page: ' + page, status: 400 };
  }
}
`;

    // Append before end of file
    o = o.trimEnd() + '\n' + pageGen + '\n';
    console.log('aiGenerateSalesPage appended');
  } else {
    console.log('aiGenerateSalesPage already present');
  }

  write('src/utils/integrations/openai-sales.ts', o);
}

// ---------------------------------------------------------------------------
// 2) sales-ai route — generatePage action
// ---------------------------------------------------------------------------
{
  let r = read('src/app/api/mothermode/sales-ai/route.ts');

  if (!r.includes('aiGenerateSalesPage')) {
    r = r.replace(
      `import {
  aiFillSalesIntake,
  aiGenerateSalesFunnel,
  normalizeSalesAiIntake,
} from '@/utils/integrations/openai-sales';`,
      `import {
  aiFillSalesIntake,
  aiGenerateSalesFunnel,
  aiGenerateSalesPage,
  normalizeSalesAiIntake,
  type SalesAiPageKey,
} from '@/utils/integrations/openai-sales';`,
    );
    console.log('route imports patched');
  }

  if (!r.includes("action === 'generatePage'")) {
    const insert = `
  if (action === 'generatePage') {
    const page = String(body.page ?? '') as SalesAiPageKey;
    const allowed: SalesAiPageKey[] = [
      'optin', 'sales', 'vsl', 'checkout',
      'upsell1', 'upsell2', 'upsell3', 'upsell4',
      'success', 'access',
    ];
    if (!allowed.includes(page)) {
      return NextResponse.json(
        { success: false, error: 'Invalid page. Use one of: ' + allowed.join(', ') },
        { status: 400 },
      );
    }
    const pageResult = await aiGenerateSalesPage(page, intake);
    if (!pageResult.ok) {
      return NextResponse.json(
        { success: false, error: pageResult.error },
        { status: pageResult.status },
      );
    }
    return NextResponse.json({ success: true, page, content: pageResult.data });
  }

`;
    // Insert before the generate action check
    if (r.includes("if (action !== 'generate')")) {
      r = r.replace("if (action !== 'generate')", insert + "if (action !== 'generate')");
      console.log('generatePage action inserted');
    } else {
      console.warn('WARN: could not find generate action guard');
    }
  } else {
    console.log('generatePage action already present');
  }

  // Update header comment
  if (!r.includes("action: 'generatePage'")) {
    r = r.replace(
      ` *   POST { action: 'generate', intake }
 *     → { success, name, slugHint, optin, sales, vsl, checkout, upsell1-4, success, access }`,
      ` *   POST { action: 'generate', intake }
 *     → { success, name, slugHint, optin, sales, vsl, checkout, upsell1-4, success, access }
 *
 *   POST { action: 'generatePage', page, intake }
 *     → { success, page, content }`,
    );
  }

  write('src/app/api/mothermode/sales-ai/route.ts', r);
}

// ---------------------------------------------------------------------------
// 3) SalesFunnelEditor — onGeneratePage + Regen buttons
// ---------------------------------------------------------------------------
{
  let ed = read('src/app/admin/sales-funnels/SalesFunnelEditor.tsx');

  // Expand busy type
  if (!ed.includes("'generatePage'")) {
    ed = ed.replace(
      /useState<null \| 'save' \| 'generate' \| 'fillIntake'[^>]*>\(null\)/,
      "useState<null | 'save' | 'generate' | 'fillIntake' | 'generatePage'>(null)",
    );
    console.log('busy type expanded');
  }

  // Add onGeneratePage after onGenerate
  if (!ed.includes('async function onGeneratePage')) {
    const handler = `
  async function onGeneratePage(page: 'optin' | 'sales' | 'vsl' | 'checkout' | 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4' | 'success' | 'access') {
    setBusy('generatePage'); setError(null); setNotice(null);
    try {
      const synced = syncIntakeStack(intake);
      setIntake(synced);
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generatePage', page, intake: synced }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Page generate failed (HTTP ' + res.status + ')');
      const content = data.content;
      if (!content) throw new Error('No content returned for ' + page);
      if (page === 'optin') setOptin(content);
      else if (page === 'sales') setSales(content);
      else if (page === 'vsl') setVsl(content);
      else if (page === 'checkout') setCheckout(content);
      else if (page === 'upsell1') setUpsell1(content);
      else if (page === 'upsell2') setUpsell2(content);
      else if (page === 'upsell3') setUpsell3(content);
      else if (page === 'upsell4') setUpsell4(content);
      else if (page === 'success') setSuccessBlock(content);
      else if (page === 'access') setAccess(content);
      setNotice('Regenerated ' + page + ' from offer stack. Review, then save.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Page generate failed');
    } finally {
      setBusy(null);
    }
  }

`;
    const marker = '  function setIntakeField<K extends keyof SalesAiIntake>';
    if (ed.includes(marker)) {
      ed = ed.replace(marker, handler + marker);
      console.log('onGeneratePage handler inserted');
    } else {
      console.warn('WARN: setIntakeField marker not found');
    }
  }

  // Helper component-ish: regen bar string
  const regenBar = (pageKey) =>
    `<div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-mode/15 bg-mode/[0.04] px-3 py-2">
            <p className="text-[11px] text-ink/55">Rewrite this page from the Build tab offer stack.</p>
            <button type="button" disabled={busy !== null} onClick={() => onGeneratePage('${pageKey}')} className={btnSecondary}>
              {busy === 'generatePage' ? 'Regenerating…' : 'Regenerate this page'}
            </button>
          </div>`;

  // Insert regen bars at start of each tab content section
  const tabMarkers = [
    { tab: 'optin', find: "tab === 'optin' && (", page: 'optin' },
    { tab: 'sales', find: "tab === 'sales' && (", page: 'sales' },
    { tab: 'vsl', find: "tab === 'vsl' && (", page: 'vsl' },
    { tab: 'checkout', find: "tab === 'checkout' && (", page: 'checkout' },
    { tab: 'upsell1', find: "tab === 'upsell1' && (", page: 'upsell1' },
    { tab: 'upsell2', find: "tab === 'upsell2' && (", page: 'upsell2' },
    { tab: 'upsell3', find: "tab === 'upsell3' && (", page: 'upsell3' },
    { tab: 'upsell4', find: "tab === 'upsell4' && (", page: 'upsell4' },
    { tab: 'success', find: "tab === 'success' && (", page: 'success' },
    { tab: 'access', find: "tab === 'access' && (", page: 'access' },
  ];

  for (const { find, page } of tabMarkers) {
    const marker = `onGeneratePage('${page}')`;
    if (ed.includes(marker)) {
      console.log('regen bar already for', page);
      continue;
    }
    const idx = ed.indexOf(find);
    if (idx < 0) {
      console.warn('WARN: tab not found', page);
      continue;
    }
    // Find the first child div after the condition
    // Pattern: tab === 'x' && (\n        <div ...>\n
    const slice = ed.slice(idx, idx + 400);
    const divMatch = slice.match(/&&\s*\(\s*\n(\s*)<div/);
    if (!divMatch) {
      // try without newline
      const alt = slice.match(/&&\s*\(\s*<div/);
      if (!alt) {
        console.warn('WARN: no div after', page, slice.slice(0, 120));
        continue;
      }
    }
    // Insert after opening of the outer fragment/div — look for first > after find
    // Safer: insert right after `tab === 'x' && (` newline + indent
    const insertAt = ed.indexOf('\n', idx + find.length);
    if (insertAt < 0) continue;
    // Find the line with opening <div and insert after that line's >
    let pos = insertAt + 1;
    // skip whitespace lines, find first tag line
    const rest = ed.slice(pos);
    const openDiv = rest.match(/^(\s*<div[^>]*>)\n/);
    if (openDiv) {
      const afterOpen = pos + openDiv[0].length;
      ed = ed.slice(0, afterOpen) + regenBar(page) + '\n' + ed.slice(afterOpen);
      console.log('regen bar inserted for', page);
    } else {
      console.warn('WARN: open div pattern miss for', page, rest.slice(0, 80));
    }
  }

  write('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', ed);
}

console.log('OK');
