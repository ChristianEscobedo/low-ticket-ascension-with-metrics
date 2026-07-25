/**
 * Finish remaining sales funnel upsell + multi-email kit wiring.
 */
const fs = require('fs');
const path = require('path');

function write(rel, content) {
  const p = path.join(process.cwd(), rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log('wrote', rel);
}

function patch(rel, pairs) {
  const p = path.join(process.cwd(), rel);
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b, label] of pairs) {
    if (!s.includes(a)) {
      console.error('MISSING in', rel, ':', label || a.slice(0, 80));
      process.exit(1);
    }
    if (s.includes(b) && b.length > 20) {
      console.log('skip already', rel, label || '');
      continue;
    }
    s = s.replace(a, b);
    console.log('patched', rel, label || '');
  }
  fs.writeFileSync(p, s, 'utf8');
}

// ---------------------------------------------------------------------------
// 1) types.ts — add SALES_EMAIL_EVENTS if missing
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/types.ts';
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('SALES_EMAIL_EVENTS')) {
    const needle = "export type SalesEmailEvent =";
    if (!s.includes(needle)) {
      // insert near emailKits types
      const anchor = 'export type SalesEmailKitBinding';
      if (s.includes(anchor)) {
        // already have binding type maybe without events const
      }
    }
    // Prefer insert after SalesEmailEvent type definition
    if (s.includes("export type SalesEmailEvent =")) {
      s = s.replace(
        /export type SalesEmailEvent =[\s\S]*?;/,
        (m) =>
          m +
          `\n\nexport const SALES_EMAIL_EVENTS: SalesEmailEvent[] = [\n` +
          `  'optin',\n  'checkout_start',\n  'purchase',\n` +
          `  'upsell1_yes',\n  'upsell1_no',\n` +
          `  'upsell2_yes',\n  'upsell2_no',\n` +
          `  'upsell3_yes',\n  'upsell3_no',\n` +
          `  'upsell4_yes',\n  'upsell4_no',\n` +
          `  'success',\n  'access',\n];\n\n` +
          `export const SALES_EMAIL_EVENT_LABELS: Record<SalesEmailEvent, string> = {\n` +
          `  optin: 'Opt-in capture',\n` +
          `  checkout_start: 'Checkout started',\n` +
          `  purchase: 'Purchase completed',\n` +
          `  upsell1_yes: 'Upsell 1 accepted',\n` +
          `  upsell1_no: 'Upsell 1 declined',\n` +
          `  upsell2_yes: 'Upsell 2 accepted',\n` +
          `  upsell2_no: 'Upsell 2 declined',\n` +
          `  upsell3_yes: 'Upsell 3 accepted',\n` +
          `  upsell3_no: 'Upsell 3 declined',\n` +
          `  upsell4_yes: 'Upsell 4 accepted',\n` +
          `  upsell4_no: 'Upsell 4 declined',\n` +
          `  success: 'Success page',\n` +
          `  access: 'Access page',\n` +
          `};\n`,
      );
    } else if (s.includes('emailKits')) {
      // insert before emailKits field usage area — after SalesFunnelStatus maybe
      const insertAt = s.indexOf('export interface SalesFunnelRecord');
      const block =
        `\nexport type SalesEmailEvent =\n` +
        `  | 'optin'\n  | 'checkout_start'\n  | 'purchase'\n` +
        `  | 'upsell1_yes' | 'upsell1_no'\n` +
        `  | 'upsell2_yes' | 'upsell2_no'\n` +
        `  | 'upsell3_yes' | 'upsell3_no'\n` +
        `  | 'upsell4_yes' | 'upsell4_no'\n` +
        `  | 'success' | 'access';\n\n` +
        `export const SALES_EMAIL_EVENTS: SalesEmailEvent[] = [\n` +
        `  'optin', 'checkout_start', 'purchase',\n` +
        `  'upsell1_yes', 'upsell1_no', 'upsell2_yes', 'upsell2_no',\n` +
        `  'upsell3_yes', 'upsell3_no', 'upsell4_yes', 'upsell4_no',\n` +
        `  'success', 'access',\n];\n\n` +
        `export const SALES_EMAIL_EVENT_LABELS: Record<SalesEmailEvent, string> = {\n` +
        `  optin: 'Opt-in capture',\n` +
        `  checkout_start: 'Checkout started',\n` +
        `  purchase: 'Purchase completed',\n` +
        `  upsell1_yes: 'Upsell 1 accepted',\n` +
        `  upsell1_no: 'Upsell 1 declined',\n` +
        `  upsell2_yes: 'Upsell 2 accepted',\n` +
        `  upsell2_no: 'Upsell 2 declined',\n` +
        `  upsell3_yes: 'Upsell 3 accepted',\n` +
        `  upsell3_no: 'Upsell 3 declined',\n` +
        `  upsell4_yes: 'Upsell 4 accepted',\n` +
        `  upsell4_no: 'Upsell 4 declined',\n` +
        `  success: 'Success page',\n` +
        `  access: 'Access page',\n` +
        `};\n\n` +
        `export interface SalesEmailKitBinding {\n` +
        `  event: SalesEmailEvent;\n` +
        `  emailKitId: string;\n` +
        `}\n\n`;
      if (insertAt > 0 && !s.includes('export type SalesEmailEvent')) {
        s = s.slice(0, insertAt) + block + s.slice(insertAt);
      }
    }
    fs.writeFileSync(p, s, 'utf8');
    console.log('types SALES_EMAIL_EVENTS OK');
  } else {
    console.log('types SALES_EMAIL_EVENTS already present');
  }
}

// ---------------------------------------------------------------------------
// 2) store.ts — getLeadById + ensure emailKits on upsert row
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/store.ts';
  let s = fs.readFileSync(p, 'utf8');

  if (!s.includes('export async function getLeadById')) {
    const anchor = '/** Admin: recent leads, optionally filtered by funnel. */';
    if (!s.includes(anchor)) {
      console.error('missing listLeads anchor');
      process.exit(1);
    }
    const fn =
      `/** Fetch a single lead by id (for event-based email enrollment). */\n` +
      `export async function getLeadById(leadId: string): Promise<SalesLeadRecord | null> {\n` +
      `  if (!leadId) return null;\n` +
      `  try {\n` +
      `    const { data, error } = await (serviceClient() as any)\n` +
      `      .from(LEADS)\n` +
      `      .select(LEAD_COLUMNS)\n` +
      `      .eq('id', leadId)\n` +
      `      .maybeSingle();\n` +
      `    if (error || !data) return null;\n` +
      `    return rowToSalesLead(data as SalesLeadRow);\n` +
      `  } catch {\n` +
      `    return null;\n` +
      `  }\n` +
      `}\n\n`;
    s = s.replace(anchor, fn + anchor);
    console.log('store getLeadById OK');
  }

  // ensure upsert writes email_kits
  if (!s.includes("email_kits:")) {
    if (s.includes('email_kit_id: input.emailKitId || null,')) {
      s = s.replace(
        'email_kit_id: input.emailKitId || null,',
        "email_kit_id: input.emailKitId || null,\n    email_kits: Array.isArray(input.emailKits) ? input.emailKits : [],",
      );
      console.log('store upsert email_kits OK');
    }
  }

  // ensure UpsertSalesFunnelInput has emailKits
  if (!s.includes('emailKits?:') && s.includes('emailKitId?: string | null;')) {
    s = s.replace(
      'emailKitId?: string | null;',
      'emailKitId?: string | null;\n  emailKits?: SalesEmailKitBinding[] | null;',
    );
    console.log('store input emailKits OK');
  }

  // ensure import of SalesEmailKitBinding / SalesEmailEvent if resolve uses them
  if (s.includes('SalesEmailKitBinding') && !s.includes('type SalesEmailKitBinding')) {
    // check import line
    if (!/SalesEmailKitBinding/.test(s.split('from')[0] || '')) {
      // try patch import from types
      s = s.replace(
        /from '\.\/types';/,
        (m) => m, // leave; may already import *
      );
    }
  }

  fs.writeFileSync(p, s, 'utf8');
}

// ---------------------------------------------------------------------------
// 3) index.ts — export fromAscension
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/index.ts';
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('fromAscension')) {
    s =
      s.trimEnd() +
      `\nexport { ascensionToUpsellContent, upsellContentToAscension } from './fromAscension';\n`;
    fs.writeFileSync(p, s, 'utf8');
    console.log('index fromAscension OK');
  }
}

// ---------------------------------------------------------------------------
// 4) UpsellPage.tsx — production MotherMode layout
// ---------------------------------------------------------------------------
write(
  'src/components/mothermode/sales/UpsellPage.tsx',
  `'use client';

import { useMemo } from 'react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { upsellContentToAscension } from '@/lib/mothermode/sales/fromAscension';
import { MotherModeUpsellPage } from '@/components/mothermode/upsell/MotherModeUpsellPage';
import {
  InlineEditPopup,
  SalesEditToolbar,
  useSalesInlineEdit,
  Editable,
} from './inlineEdit';

type UpsellKey = 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4';

interface Props {
  funnel: SalesFunnelRecord;
  upsellKey?: UpsellKey;
  isAdmin?: boolean;
}

function nextPath(slug: string, key: UpsellKey, funnel: SalesFunnelRecord): string {
  const order: UpsellKey[] = ['upsell1', 'upsell2', 'upsell3', 'upsell4'];
  const idx = order.indexOf(key);
  for (let i = idx + 1; i < order.length; i++) {
    const k = order[i];
    if (funnel[k]?.enabled) {
      if (k === 'upsell1') return \`/funnel/\${slug}/upsell\`;
      if (k === 'upsell2') return \`/funnel/\${slug}/upsell-2\`;
      if (k === 'upsell3') return \`/funnel/\${slug}/upsell-3\`;
      return \`/funnel/\${slug}/upsell-4\`;
    }
  }
  return \`/funnel/\${slug}/success\`;
}

/**
 * Editable upsell page that renders the EXACT MotherMode OTO layout
 * (timer → media → letter → value stack → CTAs → guarantee) while driving
 * every field from funnel.upsellN JSON via upsellContentToAscension.
 */
export default function UpsellPage({
  funnel,
  upsellKey = 'upsell1',
  isAdmin = false,
}: Props) {
  const edit = useSalesInlineEdit(funnel, upsellKey, isAdmin);
  const c = edit.draft[upsellKey];

  const offer = useMemo(
    () =>
      upsellContentToAscension(c, {
        productIdFallback: funnel.productId || \`funnel_\${upsellKey}\`,
        pageTypeFallback: upsellKey,
      }),
    [c, funnel.productId, upsellKey],
  );

  const acceptRedirect = c.yesHref?.trim() || nextPath(funnel.slug, upsellKey, edit.draft);
  const declineRedirect = nextPath(funnel.slug, upsellKey, edit.draft);

  const recordOnAccept = useMemo(() => {
    // Funnel builder tracks accept via /api/funnel/capture; purchase flags
    // stay local for MotherMode continuity when buyer also hits production OTOs.
    if (upsellKey === 'upsell1') return { oto1: true as const };
    if (upsellKey === 'upsell2') return { oto2: true as const };
    if (upsellKey === 'upsell3') return { oto3: true as const };
    return { oto4: true as const };
  }, [upsellKey]);

  return (
    <div className="relative">
      <MotherModeUpsellPage
        offer={offer}
        recordOnAccept={recordOnAccept}
        acceptRedirect={acceptRedirect}
        declineRedirect={declineRedirect}
        finalizeFrontEnd={upsellKey === 'upsell1'}
      />

      {isAdmin && (
        <>
          <SalesEditToolbar edit={edit} />
          <InlineEditPopup edit={edit} />

          {edit.isEditMode && (
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[45vh] overflow-y-auto border-t border-ink/10 bg-bone/95 p-4 shadow-2xl backdrop-blur">
              <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field edit={edit} field="eyebrow" label="Eyebrow" value={c.eyebrow} />
                <Field edit={edit} field="headline" label="Headline" value={c.headline} />
                <Field
                  edit={edit}
                  field="headlineEmphasis"
                  label="Headline emphasis"
                  value={c.headlineEmphasis}
                />
                <Field
                  edit={edit}
                  field="headlineSuffix"
                  label="Headline suffix"
                  value={c.headlineSuffix}
                />
                <Field
                  edit={edit}
                  field="subheadline"
                  label="Subheadline"
                  value={c.subheadline}
                  multiline
                />
                <Field edit={edit} field="priceLabel" label="Price label" value={c.priceLabel} />
                <Field
                  edit={edit}
                  field="originalPriceLabel"
                  label="Original price"
                  value={c.originalPriceLabel}
                />
                <Field edit={edit} field="ctaYes" label="Accept CTA" value={c.ctaYes} />
                <Field edit={edit} field="ctaNo" label="Decline CTA" value={c.ctaNo} />
                <Field
                  edit={edit}
                  field="stackEyebrow"
                  label="Stack eyebrow"
                  value={c.stackEyebrow}
                />
                <Field
                  edit={edit}
                  field="stackHeading"
                  label="Stack heading"
                  value={c.stackHeading}
                />
                <Field
                  edit={edit}
                  field="totalValueLabel"
                  label="Total value"
                  value={c.totalValueLabel}
                />
                <Field edit={edit} field="bigIdea" label="Big idea" value={c.bigIdea} multiline />
                <Field
                  edit={edit}
                  field="guaranteeTitle"
                  label="Guarantee title"
                  value={c.guaranteeTitle}
                />
                <Field
                  edit={edit}
                  field="guaranteeBody"
                  label="Guarantee body"
                  value={c.guaranteeBody}
                  multiline
                />
                <Field edit={edit} field="timerLabel" label="Timer label" value={c.timerLabel} />
                <Field
                  edit={edit}
                  field="productName"
                  label="Product name"
                  value={c.productName}
                />
              </div>
              <p className="mx-auto mt-3 max-w-6xl text-xs text-ink/50">
                Production OTO layout (MotherModeUpsellPage). Toggle fields above, then Save.
                Letter paragraphs, features, and gallery shots edit best from the admin form tabs.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  edit,
  field,
  label,
  value,
  multiline,
}: {
  edit: ReturnType<typeof useSalesInlineEdit>;
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <Editable
      edit={edit}
      field={field}
      label={label}
      value={value || ''}
      multiline={multiline}
    />
  );
}
`,
);

// ---------------------------------------------------------------------------
// 5) capture route — multi-event email enrollment
// ---------------------------------------------------------------------------
write(
  'src/app/api/funnel/capture/route.ts',
  `import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  captureLead,
  checkCaptureRateLimit,
  enrollLeadInEmailKit,
  getFunnelBySlug,
  getLeadById,
  incrementCheckoutCount,
  incrementFunnelConversions,
  incrementUpsellCount,
  markLeadCheckoutStarted,
  markLeadUpsell,
  recordSalesEvent,
  resolveEmailKitIdForEvent,
} from '@/lib/mothermode/sales/store';
import type { SalesEmailEvent } from '@/lib/mothermode/sales/types';

type UpsellKey = 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4';

function toUpsellKey(value: string): UpsellKey {
  if (value === 'upsell1' || value === 'upsell2' || value === 'upsell3' || value === 'upsell4') {
    return value;
  }
  return 'upsell1';
}

function upsellNumber(key: UpsellKey): 1 | 2 | 3 | 4 {
  if (key === 'upsell1') return 1;
  if (key === 'upsell2') return 2;
  if (key === 'upsell3') return 3;
  return 4;
}

function upsellEvent(key: UpsellKey, accepted: boolean): SalesEmailEvent {
  const n = upsellNumber(key);
  return (accepted ? \`upsell\${n}_yes\` : \`upsell\${n}_no\`) as SalesEmailEvent;
}

async function maybeEnroll(
  funnel: {
    id: string;
    slug: string;
    emailKitId: string | null;
    emailKits?: { event: string; emailKitId: string }[];
  },
  event: SalesEmailEvent,
  lead: { id: string; email: string; firstName: string | null },
) {
  const kitId = resolveEmailKitIdForEvent(funnel, event);
  if (!kitId) return;
  void enrollLeadInEmailKit({
    emailKitId: kitId,
    email: lead.email,
    leadId: lead.id,
    funnelId: funnel.id,
    funnelSlug: funnel.slug,
    firstName: lead.firstName,
    event,
  });
}

/**
 * Public lead capture for MotherMode sales funnels.
 *
 * POST { slug, email, firstName?, website? (honeypot), utm*, referrer? }
 * POST { action: 'checkout_start', leadId, slug? }
 * POST { action: 'upsell', leadId, upsellKey, accepted, slug? }
 * POST { action: 'purchase', leadId, slug?, amountCents? }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.action === 'checkout_start') {
    const leadId = typeof body.leadId === 'string' ? body.leadId : '';
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 });
    }
    try {
      await markLeadCheckoutStarted(leadId);
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (slug) {
        const funnel = await getFunnelBySlug(slug);
        if (funnel) {
          void incrementCheckoutCount(funnel.id);
          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: 'checkout_start',
            leadId,
            step: 'checkout',
          });
          const lead = await getLeadById(leadId);
          if (lead) {
            await maybeEnroll(funnel, 'checkout_start', lead);
          }
        }
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('[funnel/capture] checkout_start failed:', err);
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed' },
        { status: 500 },
      );
    }
  }

  if (body.action === 'upsell') {
    const leadId = typeof body.leadId === 'string' ? body.leadId : '';
    const rawKey = typeof body.upsellKey === 'string' ? body.upsellKey : '';
    const accepted = Boolean(body.accepted);
    if (!leadId || !rawKey) {
      return NextResponse.json(
        { success: false, error: 'leadId and upsellKey are required' },
        { status: 400 },
      );
    }
    try {
      const key = toUpsellKey(rawKey);
      const slot = upsellNumber(key);
      await markLeadUpsell(leadId, slot, accepted);
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (slug) {
        const funnel = await getFunnelBySlug(slug);
        if (funnel) {
          void incrementUpsellCount(funnel.id, slot, accepted);
          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: accepted ? 'upsell_yes' : 'upsell_no',
            leadId,
            step: key,
          });
          const lead = await getLeadById(leadId);
          if (lead) {
            await maybeEnroll(funnel, upsellEvent(key, accepted), lead);
          }
        }
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('[funnel/capture] upsell failed:', err);
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed' },
        { status: 500 },
      );
    }
  }

  if (body.action === 'purchase') {
    const leadId = typeof body.leadId === 'string' ? body.leadId : '';
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 });
    }
    try {
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (slug) {
        const funnel = await getFunnelBySlug(slug);
        if (funnel) {
          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: 'purchase',
            leadId,
            step: 'success',
          });
          const lead = await getLeadById(leadId);
          if (lead) {
            await maybeEnroll(funnel, 'purchase', lead);
          }
        }
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('[funnel/capture] purchase failed:', err);
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed' },
        { status: 500 },
      );
    }
  }

  const honeypot = typeof body.website === 'string' ? body.website.trim() : '';
  if (honeypot) {
    return NextResponse.json({
      success: true,
      redirectTo: 'sales',
      leadId: 'ok',
      isNew: false,
    });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';

  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 });
  }

  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim() || 'unknown';
  const rateKey = \`sales:\${slug}:\${ip}\`;
  const rate = checkCaptureRateLimit(rateKey);
  if (!rate.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  const funnel = await getFunnelBySlug(slug);
  if (!funnel) {
    return NextResponse.json({ success: false, error: 'Funnel not found' }, { status: 404 });
  }

  const ua = request.headers.get('user-agent') || '';
  const ipHash =
    ip && ip !== 'unknown'
      ? createHash('sha256')
          .update(ip + (process.env.OPTIN_IP_SALT || 'mothermode'))
          .digest('hex')
          .slice(0, 32)
      : null;

  try {
    const { lead, isNew } = await captureLead({
      funnelId: funnel.id,
      email,
      firstName: firstName || null,
      utmSource: typeof body.utmSource === 'string' ? body.utmSource : null,
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium : null,
      utmCampaign: typeof body.utmCampaign === 'string' ? body.utmCampaign : null,
      referrer: typeof body.referrer === 'string' ? body.referrer : null,
      userAgent: ua || null,
      ipHash,
    });

    if (isNew) {
      await incrementFunnelConversions(funnel.id);
    }

    void recordSalesEvent({
      funnelId: funnel.id,
      eventType: 'optin_submit',
      leadId: lead.id,
      step: 'optin',
      metadata: { isNew },
    });

    if (isNew) {
      await maybeEnroll(funnel, 'optin', lead);
    }

    return NextResponse.json({
      success: true,
      redirectTo: 'sales',
      leadId: lead.id,
      isNew,
      funnelSlug: funnel.slug,
    });
  } catch (err) {
    console.error('[funnel/capture] failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Capture failed' },
      { status: 500 },
    );
  }
}
`,
);

// ---------------------------------------------------------------------------
// 6) admin route — pass emailKits
// ---------------------------------------------------------------------------
patch('src/app/api/admin/mothermode-sales/route.ts', [
  [
    `emailKitId: (body.emailKitId as string) || null,
      productId: (body.productId as string) || null,`,
    `emailKitId: (body.emailKitId as string) || null,
      emailKits: Array.isArray(body.emailKits) ? (body.emailKits as any) : [],
      productId: (body.productId as string) || null,`,
    'admin emailKits',
  ],
]);

// ---------------------------------------------------------------------------
// 7) SalesFunnelEditor — multi-event email kit bindings UI
// ---------------------------------------------------------------------------
{
  const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
  let s = fs.readFileSync(p, 'utf8');

  // imports
  if (!s.includes('SALES_EMAIL_EVENTS')) {
    s = s.replace(
      `  slugifySalesName,
  type SalesFooterContent,`,
      `  slugifySalesName,
  SALES_EMAIL_EVENTS,
  SALES_EMAIL_EVENT_LABELS,
  type SalesEmailEvent,
  type SalesEmailKitBinding,
  type SalesFooterContent,`,
    );
  }

  // state
  if (!s.includes('const [emailKitsMap')) {
    s = s.replace(
      `const [emailKitId, setEmailKitId] = useState('');
  const [productId, setProductId] = useState('');`,
      `const [emailKitId, setEmailKitId] = useState('');
  const [emailKitsMap, setEmailKitsMap] = useState<Partial<Record<SalesEmailEvent, string>>>({});
  const [productId, setProductId] = useState('');`,
    );
  }

  // helpers after state block — inject near resetToNew
  if (!s.includes('function bindingsFromMap')) {
    s = s.replace(
      'function resetToNew() {',
      `function bindingsFromMap(map: Partial<Record<SalesEmailEvent, string>>): SalesEmailKitBinding[] {
    return SALES_EMAIL_EVENTS
      .map((event) => ({ event, emailKitId: (map[event] || '').trim() }))
      .filter((b) => Boolean(b.emailKitId));
  }

  function mapFromBindings(bindings: SalesEmailKitBinding[] | undefined | null, fallbackOptinId?: string | null): Partial<Record<SalesEmailEvent, string>> {
    const map: Partial<Record<SalesEmailEvent, string>> = {};
    for (const b of bindings || []) {
      if (b?.event && b?.emailKitId) map[b.event] = b.emailKitId;
    }
    if (!map.optin && fallbackOptinId) map.optin = fallbackOptinId;
    return map;
  }

  function setKitForEvent(event: SalesEmailEvent, kitId: string) {
    setEmailKitsMap((prev) => {
      const next = { ...prev };
      if (!kitId) delete next[event];
      else next[event] = kitId;
      return next;
    });
    if (event === 'optin') setEmailKitId(kitId);
  }

  function resetToNew() {`,
    );
  }

  // resetToNew clear map
  if (!s.includes("setEmailKitsMap({})")) {
    s = s.replace(
      "setEmailKitId(''); setProductId('');",
      "setEmailKitId(''); setEmailKitsMap({}); setProductId('');",
    );
  }

  // loadFunnel
  if (!s.includes('mapFromBindings(f.emailKits')) {
    s = s.replace(
      "setEmailKitId(f.emailKitId ?? ''); setProductId(f.productId ?? '');",
      "setEmailKitId(f.emailKitId ?? ''); setEmailKitsMap(mapFromBindings(f.emailKits, f.emailKitId)); setProductId(f.productId ?? '');",
    );
  }

  // onSave body
  if (!s.includes('emailKits: bindingsFromMap')) {
    s = s.replace(
      'emailKitId: emailKitId || null, productId: productId || null,',
      'emailKitId: emailKitId || emailKitsMap.optin || null, emailKits: bindingsFromMap(emailKitsMap), productId: productId || null,',
    );
  }

  // after save refresh map
  if (!s.includes('setEmailKitsMap(mapFromBindings(item.emailKits')) {
    s = s.replace(
      "setSelectedId(item.id); setSlug(item.slug); setEmailKitId(item.emailKitId ?? '');",
      "setSelectedId(item.id); setSlug(item.slug); setEmailKitId(item.emailKitId ?? ''); setEmailKitsMap(mapFromBindings(item.emailKits, item.emailKitId));",
    );
  }

  // checklist
  s = s.replace(
    "{ ok: Boolean(emailKitId), label: 'Email kit linked (optional but recommended)' },",
    "{ ok: Boolean(emailKitId || emailKitsMap.optin || Object.keys(emailKitsMap).length), label: 'Email kit linked (optional but recommended)' },",
  );
  s = s.replace(
    'footer.disclaimer, emailKitId]);',
    'footer.disclaimer, emailKitId, emailKitsMap]);',
  );

  // Replace single email kit select with multi-event panel
  const oldSelect =
    '<div><label className={labelClass}>Email kit on optin</label><select className={inputClass} value={emailKitId} onChange={(e) => setEmailKitId(e.target.value)}><option value="">None  no auto-enroll</option>{emailKits.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.status})</option>)}</select></div>';

  // tolerant match for en-dash variants
  const selectRe =
    /<div><label className=\{labelClass\}>Email kit on optin<\/label><select className=\{inputClass\} value=\{emailKitId\} onChange=\{\(e\) => setEmailKitId\(e\.target\.value\)\}><option value="">None[^<]*<\/option>\{emailKits\.map\(\(k\) => <option key=\{k\.id\} value=\{k\.id\}>\{k\.name\} \(\{k\.status\}\)<\/option>\)\}<\/select><\/div>/;

  const multiUi = `<div className="sm:col-span-2">
              <label className={labelClass}>Email kits by funnel event</label>
              <p className="mb-2 text-xs text-bone/40">Bind a different Email Marketing kit to each step. Opt-in still mirrors the legacy single kit field.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SALES_EMAIL_EVENTS.map((event) => (
                  <div key={event} className="rounded-lg border border-bone/10 bg-ink/30 p-2">
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-bone/45">{SALES_EMAIL_EVENT_LABELS[event]}</label>
                    <select
                      className={inputClass}
                      value={emailKitsMap[event] || (event === 'optin' ? emailKitId : '') || ''}
                      onChange={(e) => setKitForEvent(event, e.target.value)}
                    >
                      <option value="">None — no auto-enroll</option>
                      {emailKits.map((k) => (
                        <option key={k.id} value={k.id}>{k.name} ({k.status})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>`;

  if (selectRe.test(s)) {
    s = s.replace(selectRe, multiUi);
    console.log('editor multi-kit UI OK');
  } else if (s.includes('Email kit on optin')) {
    // looser replace from label through closing div of select parent
    const start = s.indexOf('<div><label className={labelClass}>Email kit on optin</label>');
    if (start >= 0) {
      const end = s.indexOf('</div>', start);
      if (end > start) {
        s = s.slice(0, start) + multiUi + s.slice(end + 6);
        console.log('editor multi-kit UI OK (loose)');
      }
    }
  } else if (s.includes('Email kits by funnel event')) {
    console.log('editor multi-kit UI already present');
  } else {
    console.error('Could not find email kit select to replace');
    process.exit(1);
  }

  fs.writeFileSync(p, s, 'utf8');
}

// ---------------------------------------------------------------------------
// 8) ensure enrollLeadInEmailKit accepts event param (optional metadata)
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/store.ts';
  let s = fs.readFileSync(p, 'utf8');
  // If enroll signature lacks event, widen it softly
  if (s.includes('export async function enrollLeadInEmailKit') && !s.includes('event?:')) {
    s = s.replace(
      /export async function enrollLeadInEmailKit\(input: \{[\s\S]*?\}\)/,
      (m) => {
        if (m.includes('event?:')) return m;
        return m.replace(
          'funnelSlug: string;',
          'funnelSlug: string;\n  event?: string;',
        );
      },
    );
    fs.writeFileSync(p, s, 'utf8');
    console.log('enroll event param OK');
  }
}

console.log('ALL FINISH PATCHES DONE');
