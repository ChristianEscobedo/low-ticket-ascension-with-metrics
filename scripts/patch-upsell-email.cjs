/* One-shot patcher: upsell defaults + store emailKits + capture multi-enroll */
const fs = require('fs');
const path = require('path');

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---------- defaults.ts ----------
{
  const p = path.join('src/lib/mothermode/sales/defaults.ts');
  let s = fs.readFileSync(p, 'utf8');

  if (!s.includes("from './fromAscension'")) {
    s = s.replace(
      "import { offerToSalesContent } from './fromOffer';\nimport { brainDump } from '@/lib/mothermode/offers/brain-dump';",
      [
        "import { offerToSalesContent } from './fromOffer';",
        "import { ascensionToUpsellContent } from './fromAscension';",
        "import { brainDump } from '@/lib/mothermode/offers/brain-dump';",
        "import {",
        '  mothermodeOS,',
        '  osAnnualUpgrade,',
        '  redesignVault,',
        '  motherModeCoaching,',
        "} from '@/lib/mothermode/ascension';",
      ].join('\n'),
    );
  }

  const map = {
    defaultMotherModeUpsell1: 'mothermodeOS',
    defaultMotherModeUpsell2: 'osAnnualUpgrade',
    defaultMotherModeUpsell3: 'redesignVault',
    defaultMotherModeUpsell4: 'motherModeCoaching',
  };

  for (const [fn, offer] of Object.entries(map)) {
    const re = new RegExp(`export function ${fn}\\(\\)[\\s\\S]*?\\n\\}\\n`);
    must(re.test(s), `missing ${fn}`);
    s = s.replace(
      re,
      `export function ${fn}(): UpsellContent {\n  return ascensionToUpsellContent(${offer}, { enabled: true });\n}\n\n`,
    );
    console.log('defaults OK', fn);
  }

  fs.writeFileSync(p, s);
}

// ---------- store.ts ----------
{
  const p = path.join('src/lib/mothermode/sales/store.ts');
  let s = fs.readFileSync(p, 'utf8');

  // FUNNEL_COLUMNS
  if (!s.includes('email_kits')) {
    s = s.replace(
      'email_kit_id, product_id,',
      'email_kit_id, email_kits, product_id,',
    );
    console.log('store columns OK');
  }

  // imports normalizeEmailKits + SalesEmailKitBinding
  if (!s.includes('normalizeEmailKits')) {
    s = s.replace(
      '  normalizeAccess,\n  rowToSalesFunnel,',
      '  normalizeAccess,\n  normalizeEmailKits,\n  rowToSalesFunnel,',
    );
    s = s.replace(
      '  type SalesEventType,\n',
      '  type SalesEmailKitBinding,\n  type SalesEmailKitEvent,\n  type SalesEventType,\n',
    );
    console.log('store imports OK');
  }

  // Upsert input
  if (!s.includes('emailKits?:')) {
    s = s.replace(
      '  emailKitId?: string | null;\n  productId?: string | null;',
      '  emailKitId?: string | null;\n  emailKits?: SalesEmailKitBinding[] | null;\n  productId?: string | null;',
    );
    console.log('store input OK');
  }

  // upsert row write
  if (!s.includes('email_kits:')) {
    s = s.replace(
      '    email_kit_id: input.emailKitId || null,\n    product_id: input.productId || null,',
      [
        '    email_kit_id: input.emailKitId || null,',
        '    email_kits: normalizeEmailKits(input.emailKits ?? []),',
        '    product_id: input.productId || null,',
      ].join('\n'),
    );
    console.log('store upsert OK');
  }

  // enroll helper upgrade: resolve kit by event
  if (!s.includes('resolveEmailKitIdForEvent')) {
    const helper = `
/** Resolve kit id for a funnel event. Falls back to legacy emailKitId for optin. */
export function resolveEmailKitIdForEvent(
  funnel: { emailKitId: string | null; emailKits?: SalesEmailKitBinding[] },
  event: SalesEmailKitEvent,
): string | null {
  const kits = Array.isArray(funnel.emailKits) ? funnel.emailKits : [];
  const hit = kits.find((k) => k.event === event && k.kitId);
  if (hit?.kitId) return hit.kitId;
  if (event === 'optin' && funnel.emailKitId) return funnel.emailKitId;
  return null;
}

`;
    // insert before enrollLeadInEmailKit if present, else before end
    if (s.includes('export async function enrollLeadInEmailKit')) {
      s = s.replace(
        'export async function enrollLeadInEmailKit',
        helper + 'export async function enrollLeadInEmailKit',
      );
    } else {
      s += '\n' + helper;
    }
    console.log('store resolve helper OK');
  }

  fs.writeFileSync(p, s);
}

// ---------- capture route multi-enroll ----------
{
  const p = path.join('src/app/api/funnel/capture/route.ts');
  let s = fs.readFileSync(p, 'utf8');

  if (!s.includes('resolveEmailKitIdForEvent')) {
    s = s.replace(
      '  enrollLeadInEmailKit,\n  getFunnelBySlug,',
      '  enrollLeadInEmailKit,\n  resolveEmailKitIdForEvent,\n  getFunnelBySlug,',
    );
  }

  // optin enroll block
  if (s.includes('if (funnel.emailKitId && isNew)')) {
    s = s.replace(
      `    if (funnel.emailKitId && isNew) {
      void enrollLeadInEmailKit({
        emailKitId: funnel.emailKitId,
        email: lead.email,
        leadId: lead.id,
        funnelId: funnel.id,
        funnelSlug: funnel.slug,
        firstName: lead.firstName,
      });
    }`,
      `    if (isNew) {
      const optinKitId = resolveEmailKitIdForEvent(funnel, 'optin');
      if (optinKitId) {
        void enrollLeadInEmailKit({
          emailKitId: optinKitId,
          email: lead.email,
          leadId: lead.id,
          funnelId: funnel.id,
          funnelSlug: funnel.slug,
          firstName: lead.firstName,
        });
      }
    }`,
    );
    console.log('capture optin enroll OK');
  }

  // checkout_start enroll
  if (!s.includes("resolveEmailKitIdForEvent(funnel, 'checkout_start')")) {
    s = s.replace(
      `          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: 'checkout_start',
            leadId,
            step: 'checkout',
          });
        }
      }
      return NextResponse.json({ success: true });`,
      `          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: 'checkout_start',
            leadId,
            step: 'checkout',
          });
          const checkoutKitId = resolveEmailKitIdForEvent(funnel, 'checkout_start');
          if (checkoutKitId) {
            // best-effort: enroll if we can resolve lead email later via store
            void (async () => {
              try {
                const { getLeadById } = await import('@/lib/mothermode/sales/store');
                const lead = typeof getLeadById === 'function' ? await getLeadById(leadId) : null;
                if (lead?.email) {
                  await enrollLeadInEmailKit({
                    emailKitId: checkoutKitId,
                    email: lead.email,
                    leadId: lead.id,
                    funnelId: funnel.id,
                    funnelSlug: funnel.slug,
                    firstName: lead.firstName,
                  });
                }
              } catch {
                /* non-fatal */
              }
            })();
          }
        }
      }
      return NextResponse.json({ success: true });`,
    );
    console.log('capture checkout enroll OK');
  }

  // upsell accepted enroll
  if (!s.includes("resolveEmailKitIdForEvent(funnel, 'upsell_purchase')")) {
    s = s.replace(
      `          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: accepted ? 'upsell_yes' : 'upsell_no',
            leadId,
            step: key,
          });
        }
      }

      return NextResponse.json({ success: true });`,
      `          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: accepted ? 'upsell_yes' : 'upsell_no',
            leadId,
            step: key,
          });
          if (accepted) {
            const upsellKitId = resolveEmailKitIdForEvent(funnel, 'upsell_purchase');
            if (upsellKitId) {
              void (async () => {
                try {
                  const { getLeadById } = await import('@/lib/mothermode/sales/store');
                  const lead = typeof getLeadById === 'function' ? await getLeadById(leadId) : null;
                  if (lead?.email) {
                    await enrollLeadInEmailKit({
                      emailKitId: upsellKitId,
                      email: lead.email,
                      leadId: lead.id,
                      funnelId: funnel.id,
                      funnelSlug: funnel.slug,
                      firstName: lead.firstName,
                    });
                  }
                } catch {
                  /* non-fatal */
                }
              })();
            }
          }
        }
      }

      return NextResponse.json({ success: true });`,
    );
    console.log('capture upsell enroll OK');
  }

  fs.writeFileSync(p, s);
}

// ---------- admin route emailKits ----------
{
  const p = path.join('src/app/api/admin/mothermode-sales/route.ts');
  if (fs.existsSync(p)) {
    let s = fs.readFileSync(p, 'utf8');
    if (!s.includes('emailKits') && s.includes('emailKitId')) {
      // best-effort: allow body.emailKits through if upsert payload is built inline
      s = s.replace(
        /emailKitId:\s*body\.emailKitId[^,\n]*,/,
        (m) => m + '\n      emailKits: Array.isArray(body.emailKits) ? body.emailKits : undefined,',
      );
      fs.writeFileSync(p, s);
      console.log('admin route emailKits OK');
    } else {
      console.log('admin route skip/already');
    }
  }
}

console.log('ALL PATCHES DONE');
