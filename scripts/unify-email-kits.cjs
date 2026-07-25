/**
 * Unify sales funnel email kit schema to:
 *   SalesEmailEvent + SalesEmailKitBinding { event, emailKitId }
 * Remove legacy SalesEmailKitEvent / kitId shape.
 */
const fs = require('fs');

// ---------------------------------------------------------------------------
// types.ts
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/types.ts';
  let s = fs.readFileSync(p, 'utf8');

  // Remove first (legacy) SalesEmailKitEvent + SalesEmailKitBinding block
  const legacyBlock = `export type SalesEmailKitEvent =
  | 'optin'
  | 'checkout_start'
  | 'purchase'
  | 'upsell_purchase'
  | 'abandon';

export interface SalesEmailKitBinding {
  event: SalesEmailKitEvent;
  kitId: string;
}


`;
  if (s.includes(legacyBlock)) {
    s = s.replace(legacyBlock, '');
    console.log('removed legacy SalesEmailKitEvent block');
  } else if (s.includes("export type SalesEmailKitEvent =")) {
    // looser removal
    s = s.replace(
      /export type SalesEmailKitEvent =[\s\S]*?export interface SalesEmailKitBinding \{\s*event: SalesEmailKitEvent;\s*kitId: string;\s*\}\s*/m,
      '',
    );
    console.log('removed legacy block (loose)');
  }

  // Ensure only one SalesEmailKitBinding with emailKitId
  // If duplicate interface remains with kitId, remove it
  s = s.replace(
    /export interface SalesEmailKitBinding \{\s*event: SalesEmailKitEvent;\s*kitId: string;\s*\}\s*/g,
    '',
  );

  // Ensure SalesEmailEvent block exists and binding uses emailKitId
  if (!s.includes('export type SalesEmailEvent')) {
    console.error('SalesEmailEvent missing after cleanup');
    process.exit(1);
  }

  // Fix second binding if needed
  if (!s.includes('emailKitId: string;') || !/export interface SalesEmailKitBinding \{[\s\S]*?emailKitId/.test(s)) {
    // inject after SALES_EMAIL_EVENT_LABELS closing
    if (s.includes('export interface SalesEmailKitBinding')) {
      // rewrite any remaining binding
      s = s.replace(
        /export interface SalesEmailKitBinding \{[\s\S]*?\n\}/,
        `export interface SalesEmailKitBinding {
  event: SalesEmailEvent;
  emailKitId: string;
}`,
      );
    } else {
      const marker = 'export const SALES_EMAIL_EVENT_LABELS';
      const idx = s.indexOf(marker);
      if (idx < 0) {
        console.error('labels missing');
        process.exit(1);
      }
      // find end of labels object
      let brace = s.indexOf('{', idx);
      let depth = 0;
      let end = brace;
      for (let i = brace; i < s.length; i++) {
        if (s[i] === '{') depth++;
        if (s[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      const insert = `\n\nexport interface SalesEmailKitBinding {
  event: SalesEmailEvent;
  emailKitId: string;
}\n`;
      s = s.slice(0, end) + insert + s.slice(end);
    }
    console.log('ensured SalesEmailKitBinding emailKitId');
  }

  // Remove SALES_EMAIL_KIT_EVENTS const if present
  s = s.replace(
    /const SALES_EMAIL_KIT_EVENTS: readonly SalesEmailKitEvent\[\] = \[[\s\S]*?\];\s*/m,
    '',
  );

  // Rewrite normalizeEmailKits
  const normNew = `export function normalizeEmailKits(raw: unknown): SalesEmailKitBinding[] {
  if (!Array.isArray(raw)) return [];
  const out: SalesEmailKitBinding[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const event = asString(o.event) as SalesEmailEvent;
    // Accept both emailKitId (canonical) and kitId (legacy)
    const emailKitId = asString(o.emailKitId) || asString(o.kitId);
    if (!emailKitId) continue;
    if (!(SALES_EMAIL_EVENTS as readonly string[]).includes(event)) continue;
    if (seen.has(event)) continue;
    seen.add(event);
    out.push({ event, emailKitId });
  }
  return out;
}
`;

  if (s.includes('export function normalizeEmailKits')) {
    s = s.replace(
      /export function normalizeEmailKits\(raw: unknown\): SalesEmailKitBinding\[] \{[\s\S]*?\n\}\n/,
      normNew + '\n',
    );
    console.log('rewrote normalizeEmailKits');
  } else {
    // insert before normalizeSuccess or rowToSalesFunnel
    const anchor = s.indexOf('export function normalizeSuccess');
    if (anchor > -1) {
      s = s.slice(0, anchor) + normNew + '\n' + s.slice(anchor);
    } else {
      console.error('could not place normalizeEmailKits');
      process.exit(1);
    }
  }

  // Fix rowToSalesFunnel back-compat binding
  s = s.replace(
    "emailKits = [{ event: 'optin', kitId: emailKitId }];",
    "emailKits = [{ event: 'optin', emailKitId }];",
  );

  // Ensure SalesFunnelRecord has emailKits
  if (!s.includes('emailKits: SalesEmailKitBinding[]')) {
    s = s.replace(
      'emailKitId: string | null;\n  productId: string | null;',
      'emailKitId: string | null;\n  /** Multi-event email kit bindings. emailKitId remains legacy optin kit. */\n  emailKits: SalesEmailKitBinding[];\n  productId: string | null;',
    );
  }

  // Ensure SalesFunnelRow has email_kits
  if (!s.includes('email_kits?:')) {
    s = s.replace(
      'email_kit_id: string | null;\n  product_id: string | null;',
      'email_kit_id: string | null;\n  email_kits?: unknown;\n  product_id: string | null;',
    );
  }

  // Ensure rowTo includes emailKits field
  if (!s.includes('emailKits,')) {
    s = s.replace(
      /emailKitId,\n(\s*)productId:/,
      'emailKitId,\n$1emailKits,\n$1productId:',
    );
  }

  // Alias for back-compat if anything still imports SalesEmailKitEvent
  if (!s.includes('export type SalesEmailKitEvent = SalesEmailEvent')) {
    // place after SalesEmailEvent type
    s = s.replace(
      /export type SalesEmailEvent =[\s\S]*?;\n/,
      (m) => m + '\n/** @deprecated alias — use SalesEmailEvent */\nexport type SalesEmailKitEvent = SalesEmailEvent;\n',
    );
  }

  fs.writeFileSync(p, s);
  console.log('types.ts unified');
}

// ---------------------------------------------------------------------------
// store.ts
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/store.ts';
  let s = fs.readFileSync(p, 'utf8');

  // Fix broken import (missing type keyword / bad brace)
  s = s.replace(
    /type AccessContent,\s*\n\s*SalesEmailKitBinding,\s*\n\s*SalesEmailEvent,\} from '\.\/types';/,
    `type AccessContent,
  type SalesEmailKitBinding,
  type SalesEmailEvent,
} from './types';`,
  );
  // another broken shape
  s = s.replace(
    /type AccessContent,\s*\n\s*SalesEmailKitBinding,\s*\n\s*SalesEmailEvent,\} from '\.\/types';/,
    `type AccessContent,
  type SalesEmailKitBinding,
  type SalesEmailEvent,
} from './types';`,
  );
  // generic fix: if SalesEmailKitBinding imported without type
  if (/SalesEmailKitBinding,\s*\n\s*SalesEmailEvent,\} from/.test(s)) {
    s = s.replace(
      /SalesEmailKitBinding,\s*\n\s*SalesEmailEvent,\} from '\.\/types';/,
      `type SalesEmailKitBinding,
  type SalesEmailEvent,
} from './types';`,
    );
  }
  // ensure imports present
  if (!s.includes('SalesEmailKitBinding')) {
    s = s.replace(
      "type AccessContent,\n} from './types';",
      "type AccessContent,\n  type SalesEmailKitBinding,\n  type SalesEmailEvent,\n} from './types';",
    );
  }

  // UpsertSalesFunnelInput emailKits
  if (!s.includes('emailKits?:')) {
    s = s.replace(
      'emailKitId?: string | null;\n  productId?: string | null;',
      'emailKitId?: string | null;\n  emailKits?: SalesEmailKitBinding[];\n  productId?: string | null;',
    );
  }

  // email_kits upsert uses normalizeEmailKits if available
  if (s.includes("email_kits: Array.isArray(input.emailKits) ? input.emailKits : [],")) {
    // Prefer normalize if imported; otherwise keep array
    if (!s.includes('normalizeEmailKits')) {
      s = s.replace(
        "rowToSalesFunnel,\n",
        "rowToSalesFunnel,\n  normalizeEmailKits,\n",
      );
      // if that didn't work
      if (!s.includes('normalizeEmailKits')) {
        s = s.replace(
          "import {\n  normalizeSalesFooter,",
          "import {\n  normalizeEmailKits,\n  normalizeSalesFooter,",
        );
      }
    }
    s = s.replace(
      "email_kits: Array.isArray(input.emailKits) ? input.emailKits : [],",
      "email_kits: normalizeEmailKits(input.emailKits),\n    // keep legacy optin kit in sync when multi-map provides optin\n    // (email_kit_id already set above; override if optin binding present)",
    );
    // Better: also sync email_kit_id from optin binding
    // Re-do cleanly:
  }

  // Cleaner upsert email fields
  if (s.includes('email_kit_id: input.emailKitId || null,')) {
    // replace block around email fields
    s = s.replace(
      /email_kit_id: input\.emailKitId \|\| null,\n\s*email_kits:[\s\S]*?,\n\s*product_id: input\.productId \|\| null,/,
      `email_kit_id: (() => {
      const kits = normalizeEmailKits(input.emailKits);
      const optin = kits.find((k) => k.event === 'optin')?.emailKitId;
      return input.emailKitId || optin || null;
    })(),
    email_kits: normalizeEmailKits(input.emailKits),
    product_id: input.productId || null,`,
    );
  }

  // resolveEmailKitIdForEvent — use emailKitId
  if (s.includes('resolveEmailKitIdForEvent')) {
    s = s.replace(
      /export function resolveEmailKitIdForEvent\([\s\S]*?\n\}/,
      `export function resolveEmailKitIdForEvent(
  funnel: { emailKitId: string | null; emailKits?: SalesEmailKitBinding[] },
  event: SalesEmailEvent | string,
): string | null {
  const kits = Array.isArray(funnel.emailKits) ? funnel.emailKits : [];
  const hit = kits.find((k) => k.event === event && k.emailKitId);
  if (hit?.emailKitId) return hit.emailKitId;
  // legacy fallback
  const legacy = kits.find((k: any) => k.event === event && (k as any).kitId);
  if (legacy && (legacy as any).kitId) return (legacy as any).kitId as string;
  if (event === 'optin' && funnel.emailKitId) return funnel.emailKitId;
  return null;
}`,
    );
  } else {
    // append before enrollLeadInEmailKit or at end of funnel section
    const insertAt = s.indexOf('export async function enrollLeadInEmailKit');
    const fn = `
/** Resolve kit id for a funnel event. Falls back to legacy emailKitId for optin. */
export function resolveEmailKitIdForEvent(
  funnel: { emailKitId: string | null; emailKits?: SalesEmailKitBinding[] },
  event: SalesEmailEvent | string,
): string | null {
  const kits = Array.isArray(funnel.emailKits) ? funnel.emailKits : [];
  const hit = kits.find((k) => k.event === event && k.emailKitId);
  if (hit?.emailKitId) return hit.emailKitId;
  if (event === 'optin' && funnel.emailKitId) return funnel.emailKitId;
  return null;
}

`;
    if (insertAt > -1) s = s.slice(0, insertAt) + fn + s.slice(insertAt);
  }

  // duplicateFunnel should pass emailKits
  if (s.includes('emailKitId: src.emailKitId,') && !s.includes('emailKits: src.emailKits')) {
    s = s.replace(
      'emailKitId: src.emailKitId,\n    productId: src.productId,',
      'emailKitId: src.emailKitId,\n    emailKits: src.emailKits,\n    productId: src.productId,',
    );
  }

  // ensure normalizeEmailKits imported
  if (!s.includes('normalizeEmailKits')) {
    s = s.replace(
      "import {\n  normalizeSalesFooter,",
      "import {\n  normalizeEmailKits,\n  normalizeSalesFooter,",
    );
  }

  fs.writeFileSync(p, s);
  console.log('store.ts unified');
}

// ---------------------------------------------------------------------------
// index.ts exports
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/index.ts';
  if (fs.existsSync(p)) {
    let s = fs.readFileSync(p, 'utf8');
    const need = [
      'SALES_EMAIL_EVENTS',
      'SALES_EMAIL_EVENT_LABELS',
      'SalesEmailEvent',
      'SalesEmailKitBinding',
      'resolveEmailKitIdForEvent',
      'getLeadById',
      'normalizeEmailKits',
    ];
    // best effort: if re-export * from types/store, fine
    if (!s.includes('resolveEmailKitIdForEvent') && s.includes("from './store'")) {
      s = s.replace(
        /from '\.\/store';/,
        (m) => m,
      );
      // if named exports list
      if (/export \{[\s\S]*\} from '\.\/store'/.test(s)) {
        s = s.replace(
          /export \{([^}]*)\} from '\.\/store'/,
          (full, inside) => {
            let add = inside;
            if (!inside.includes('resolveEmailKitIdForEvent')) add += ',\n  resolveEmailKitIdForEvent';
            if (!inside.includes('getLeadById')) add += ',\n  getLeadById';
            return `export {${add}} from './store'`;
          },
        );
      }
    }
    if (!s.includes('SALES_EMAIL_EVENTS') && /export \{[\s\S]*\} from '\.\/types'/.test(s)) {
      s = s.replace(
        /export \{([^}]*)\} from '\.\/types'/,
        (full, inside) => {
          let add = inside;
          for (const n of ['SALES_EMAIL_EVENTS', 'SALES_EMAIL_EVENT_LABELS', 'normalizeEmailKits']) {
            if (!inside.includes(n)) add += `,\n  ${n}`;
          }
          for (const n of ['SalesEmailEvent', 'SalesEmailKitBinding']) {
            if (!inside.includes(n)) add += `,\n  type ${n}`;
          }
          return `export {${add}} from './types'`;
        },
      );
    }
    fs.writeFileSync(p, s);
    console.log('index.ts touched');
  }
}

// ---------------------------------------------------------------------------
// Sanity
// ---------------------------------------------------------------------------
const types = fs.readFileSync('src/lib/mothermode/sales/types.ts', 'utf8');
const store = fs.readFileSync('src/lib/mothermode/sales/store.ts', 'utf8');
const admin = fs.readFileSync('src/app/api/admin/mothermode-sales/route.ts', 'utf8');
const editor = fs.readFileSync('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', 'utf8');
const capture = fs.readFileSync('src/app/api/funnel/capture/route.ts', 'utf8');

const checks = {
  noDupBindingKitId: !/event: SalesEmailKitEvent;\s*kitId:/.test(types),
  hasEmailEvent: types.includes('export type SalesEmailEvent'),
  hasBindingEmailKitId: /export interface SalesEmailKitBinding \{[\s\S]*?emailKitId: string;/.test(types),
  normalizeUsesEmailKitId: types.includes('asString(o.emailKitId)') || types.includes("o.emailKitId"),
  rowUsesEmailKitId: types.includes("emailKits = [{ event: 'optin', emailKitId }]"),
  storeImportOk: store.includes('type SalesEmailKitBinding') && !/SalesEmailEvent,\} from/.test(store),
  storeUpsertField: store.includes('emailKits?:'),
  storeResolveEmailKitId: store.includes('k.emailKitId'),
  adminEmailKits: admin.includes('emailKits:'),
  editorMap: editor.includes('emailKitsMap') && editor.includes('emailKitId:'),
  captureResolve: capture.includes('resolveEmailKitIdForEvent'),
};
console.log('CHECKS', checks);
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
if (failed.length) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('UNIFY OK');
