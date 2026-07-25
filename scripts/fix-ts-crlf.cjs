const fs = require('fs');

function replaceBalancedBlock(source, startMarker, nextContent) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error('marker not found: ' + startMarker);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error('brace not found after ' + startMarker);
  let depth = 0;
  let end = -1;
  for (let k = brace; k < source.length; k++) {
    const ch = source[k];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = k;
        break;
      }
    }
  }
  if (end < 0) throw new Error('unbalanced braces for ' + startMarker);
  return source.slice(0, start) + nextContent + source.slice(end + 1);
}

// ---- store.ts ----
{
  const p = 'src/lib/mothermode/sales/store.ts';
  let s = fs.readFileSync(p, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const next = [
    'export interface UpsertSalesFunnelInput {',
    '  id?: string | null;',
    '  slug: string;',
    '  name: string;',
    '  status: SalesFunnelStatus;',
    '  offerSlug?: string | null;',
    '  leadGenSlug?: string | null;',
    '  deliverableSlug?: string | null;',
    '  deliverableKey?: string | null;',
    '  emailKitId?: string | null;',
    '  emailKits?: SalesEmailKitBinding[];',
    '  productId?: string | null;',
    '  optin: SalesOptinContent;',
    '  sales: SalesPageContent;',
    '  vsl: VslPageContent;',
    '  checkout: CheckoutContent;',
    '  upsell1: UpsellContent;',
    '  upsell2: UpsellContent;',
    '  upsell3: UpsellContent;',
    '  upsell4: UpsellContent;',
    '  success: SuccessContent;',
    '  access: AccessContent;',
    '  footer: SalesFooterContent;',
    '  updatedBy?: string | null;',
    '}',
  ].join(nl);

  s = replaceBalancedBlock(s, 'export interface UpsertSalesFunnelInput', next);
  fs.writeFileSync(p, s);
  console.log('store UpsertSalesFunnelInput ok', s.includes('emailKits?: SalesEmailKitBinding[]'));
}

// ---- UpsellPage Field ----
{
  const p = 'src/components/mothermode/sales/UpsellPage.tsx';
  let s = fs.readFileSync(p, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const next = [
    'function Field({',
    '  edit,',
    '  field,',
    '  label,',
    '  value,',
    '  multiline,',
    '}: {',
    '  edit: ReturnType<typeof useSalesInlineEdit>;',
    '  field: string;',
    '  label: string;',
    '  value: string;',
    '  multiline?: boolean;',
    '}) {',
    '  return (',
    '    <label className="block space-y-1 text-xs">',
    '      <span className="font-medium text-ink/70">{label}</span>',
    '      <Editable edit={edit} field={field} multiline={multiline}>',
    '        {value || \'\'}',
    '      </Editable>',
    '    </label>',
    '  );',
    '}',
  ].join(nl);

  s = replaceBalancedBlock(s, 'function Field(', next);
  fs.writeFileSync(p, s);
  console.log('UpsellPage Field ok', s.includes('<Editable edit={edit} field={field} multiline={multiline}>'));
}

console.log('DONE');
